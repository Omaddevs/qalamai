// Buying coins by card transfer (until Click / Payme are connected).
//   GET  /payments/methods  — the cards to pay to (set by the team in the admin panel)
//   POST /payments/orders   — multipart: coins | pack, method, note, receipt (photo or PDF)
//   GET  /payments/orders   — the buyer's own payments and where each one stands
// An admin checks every receipt (admin.js) and approves it — the coins arrive then — or rejects it
// with a reason. The team hears about each new receipt in Telegram when CONTACT_CHAT_ID is set.
import { and, count, desc, eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest } from '../../lib/errors.js'
import { detectType } from '../../lib/filetypes.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { COIN_PACKS, CUSTOM_COINS, MAX_PENDING_PAYMENTS, PAY_METHODS, RECEIPT_MAX_MB, priceFor } from '../../../../shared/coins.js'

const { paymentOrders } = schema
const RECEIPT_TYPES = new Set(['pdf', 'png', 'jpg', 'webp', 'heic'])
export const CARDS_KEY = 'payment_cards'

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
export const fmtSom = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
export const digits = (s) => String(s ?? '').replace(/\D/g, '')

/** The cards saved in the admin panel: { humo: { number, holder, enabled }, … }. */
export async function readCards(db) {
  const [row] = await db.select().from(schema.adminSettings).where(eq(schema.adminSettings.key, CARDS_KEY)).limit(1)
  return row?.value ?? {}
}

/** Only the cards a buyer can pay to now: switched on and with a full number. */
export function liveCards(cards) {
  return PAY_METHODS.filter((m) => cards[m]?.enabled !== false && digits(cards[m]?.number).length >= 16).map((m) => ({
    id: m,
    number: digits(cards[m].number),
    holder: cards[m].holder?.trim() || null,
  }))
}

export const orderOut = (o) => ({
  id: o.id,
  coins: o.coins,
  amount: o.amount,
  pack: o.pack,
  method: o.method,
  status: o.status,
  reason: o.reason,
  note: o.note,
  createdAt: o.createdAt,
  reviewedAt: o.reviewedAt,
  cancelledAt: o.cancelledAt,
})

/** @param {import('fastify').FastifyInstance} app */
export default async function paymentRoutes(app) {
  const { db, storage, bot, config } = app.ctx

  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', async (req) => {
    if (req.user.isGuest) throw new AppError(403, 'REGISTER_REQUIRED', 'Coin sotib oliş uçun röyxatdan öting.')
  })

  app.get('/methods', { schema: { tags: ['payments'], summary: 'Tölov kartalari (HUMO, UZCARD, VISA) va çegaralar' } }, async () => ({
    methods: liveCards(await readCards(db)),
    custom: CUSTOM_COINS,
    receiptMaxMb: RECEIPT_MAX_MB,
  }))

  app.get('/orders', { schema: { tags: ['payments'], summary: 'Mening tölovlarim' } }, async (req) => {
    const rows = await db.select().from(paymentOrders).where(eq(paymentOrders.userId, req.user.id)).orderBy(desc(paymentOrders.createdAt)).limit(20)
    return { orders: rows.map(orderOut) }
  })

  app.post(
    '/orders',
    {
      config: { rateLimit: { max: 6, timeWindow: '10 minutes' } },
      schema: { tags: ['payments'], summary: 'Tölov çekini yuboriş — multipart: coins yoki pack, method, note, receipt', consumes: ['multipart/form-data'] },
    },
    async (req, reply) => {
      if (!req.isMultipart()) throw badRequest('Çek multipart/form-data körinişida yuborilişi kerak')
      const id = newId(ID_PREFIX.payment)
      const tmpKey = `.tmp/${id}`
      const fields = {}
      let receipt = null
      try {
        for await (const part of req.parts({ limits: { fileSize: RECEIPT_MAX_MB * 1048576, files: 1 } })) {
          if (part.type === 'file') {
            if (part.fieldname !== 'receipt' || receipt) {
              part.file.resume()
              continue
            }
            const { size, head } = await storage.putStream(tmpKey, part.file, { maxBytes: RECEIPT_MAX_MB * 1048576 })
            const type = detectType(head, part.filename)
            receipt = { size, type }
          } else {
            fields[part.fieldname] = String(part.value ?? '').slice(0, 400)
          }
        }

        if (!receipt) throw new AppError(400, 'RECEIPT_REQUIRED', 'Tölov çekini (rasm yoki PDF) biriktiring')
        if (!receipt.type || !RECEIPT_TYPES.has(receipt.type.ext) || !receipt.size) {
          throw new AppError(415, 'RECEIPT_TYPE', 'Çek rasm (JPG, PNG, WEBP, HEIC) yoki PDF bölişi kerak')
        }

        // what is bought: a pack, or any amount from CUSTOM_COINS.min
        let coins
        let pack = null
        if (fields.pack) {
          const p = COIN_PACKS.find((x) => x.id === fields.pack)
          if (!p) throw badRequest('Bunday paket yöq', { pack: fields.pack })
          coins = p.coins
          pack = p.id
        } else {
          coins = Number(fields.coins)
          if (!Number.isInteger(coins) || coins < CUSTOM_COINS.min || coins > CUSTOM_COINS.max) {
            throw new AppError(400, 'COINS_RANGE', `Coin soni ${CUSTOM_COINS.min} dan ${CUSTOM_COINS.max} gaça bölişi kerak`, CUSTOM_COINS)
          }
        }
        const amount = priceFor(coins)

        const card = liveCards(await readCards(db)).find((c) => c.id === fields.method)
        if (!card) throw new AppError(400, 'PAY_METHOD_OFF', 'Bu karta orqali tölov hozir qabul qilinmaydi', { method: fields.method })

        const [{ n }] = await db.select({ n: count() }).from(paymentOrders).where(and(eq(paymentOrders.userId, req.user.id), eq(paymentOrders.status, 'pending')))
        if (Number(n) >= MAX_PENDING_PAYMENTS) {
          throw new AppError(429, 'PAYMENTS_PENDING', `Sizda ${MAX_PENDING_PAYMENTS} ta tekşirilayotgan tölov bor — ular körib çiqilişini kuting`, { max: MAX_PENDING_PAYMENTS })
        }

        const key = `receipts/${id}.${receipt.type.ext}`
        await storage.putFile(key, storage.pathOf(tmpKey))
        const note = fields.note?.trim().slice(0, 300) || null
        const [order] = await db
          .insert(paymentOrders)
          .values({
            id,
            userId: req.user.id,
            coins,
            amount,
            pack,
            method: card.id,
            card: { number: card.number, holder: card.holder },
            receiptKey: key,
            receiptMime: receipt.type.mime,
            receiptSize: receipt.size,
            note,
          })
          .returning()

        if (bot && config.support.chatId) {
          const u = req.user
          const text = [
            `💳 <b>Yangi tölov</b> · ${esc(card.id.toUpperCase())}`,
            '',
            `🪙 <b>${fmtSom(coins)} coin</b> — ${fmtSom(amount)} söm${pack ? ` (${esc(pack)})` : ''}`,
            `👤 ${esc(u.name || u.email || u.phone || u.id)}`,
            u.telegramUsername && `💬 @${esc(u.telegramUsername)}`,
            note && `📝 ${esc(note)}`,
            '',
            `Çekni tekşirib tasdiqlang: ${esc(config.appUrl)}/admin#payments`,
          ].filter((x) => x !== null && x !== undefined && x !== false)
          bot.sendMessage(config.support.chatId, text.join('\n')).catch((err) => req.log.warn({ err }, 'payments: telegram notify failed'))
        }
        reply.status(201)
        return { order: orderOut(order) }
      } catch (err) {
        await storage.remove(tmpKey).catch(() => {})
        throw err
      }
    },
  )
}
