// Admin side of card payments (registered inside the admin panel's guarded scope):
//   GET   /admin/payments                — receipts to check, with counts and totals
//   GET   /admin/payments/:id/receipt    — the receipt itself (image / PDF, shown inline)
//   POST  /admin/payments/:id/approve    — credits the coins (once) and marks it approved
//   POST  /admin/payments/:id/reject     — marks it rejected, the buyer is told why
//   GET   /admin/payment-cards           — HUMO / UZCARD / VISA cards buyers pay to
//   PUT   /admin/payment-cards
import { and, count, desc, eq, gte, ilike, or, sql, sum } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest, notFound } from '../../lib/errors.js'
import { avatarUrlOf } from '../../lib/avatars.js'
import { PAY_METHODS } from '../../../../shared/coins.js'
import { CARDS_KEY, digits, readCards } from './routes.js'

const { paymentOrders: po, users, adminSettings } = schema
const idParams = { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } }

/**
 * @param {import('fastify').FastifyInstance} admin  the guarded admin scope
 */
export async function paymentAdminRoutes(admin) {
  const { db, storage, coins, notifier } = admin.ctx

  admin.get(
    '/payments',
    {
      schema: {
        hide: true,
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'all'], default: 'pending' },
            q: { type: 'string', maxLength: 100 },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (req) => {
      const { status, q, page, limit } = req.query
      const like = q?.trim() && `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`
      const where = [
        status !== 'all' && eq(po.status, status),
        like && or(ilike(users.name, like), ilike(users.email, like), ilike(users.phone, like), ilike(users.telegramUsername, like), ilike(po.note, like), eq(po.id, q.trim()), eq(po.userId, q.trim())),
      ].filter(Boolean)
      const cond = where.length ? and(...where) : undefined
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const [rows, [{ total }], byStatus, [today], [all]] = await Promise.all([
        db
          .select({ o: po, u: { id: users.id, name: users.name, email: users.email, phone: users.phone, telegramUsername: users.telegramUsername, avatarKey: users.avatarKey, avatarAt: users.avatarAt, coins: users.coins } })
          .from(po)
          .leftJoin(users, eq(users.id, po.userId))
          .where(cond)
          // waiting ones oldest first (first come, first served); the rest newest first
          .orderBy(status === 'pending' ? po.createdAt : desc(po.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),
        db.select({ total: count() }).from(po).leftJoin(users, eq(users.id, po.userId)).where(cond),
        db.select({ status: po.status, n: count(), som: sum(po.amount) }).from(po).groupBy(po.status),
        db.select({ n: count(), som: sum(po.amount), coins: sum(po.coins) }).from(po).where(and(eq(po.status, 'approved'), gte(po.reviewedAt, dayStart))),
        db.select({ coins: sum(po.coins) }).from(po).where(eq(po.status, 'approved')),
      ])
      const counts = { pending: 0, approved: 0, rejected: 0 }
      const amounts = { pending: 0, approved: 0, rejected: 0 }
      byStatus.forEach((r) => {
        counts[r.status] = Number(r.n)
        amounts[r.status] = Number(r.som ?? 0)
      })
      return {
        total: Number(total),
        page,
        limit,
        counts: { ...counts, all: counts.pending + counts.approved + counts.rejected },
        amounts,
        today: { n: Number(today?.n ?? 0), som: Number(today?.som ?? 0), coins: Number(today?.coins ?? 0) },
        coinsSold: Number(all?.coins ?? 0),
        items: rows.map(({ o, u }) => ({
          id: o.id,
          coins: o.coins,
          amount: o.amount,
          pack: o.pack,
          method: o.method,
          card: o.card,
          note: o.note,
          status: o.status,
          reason: o.reason,
          receipt: { mime: o.receiptMime, size: o.receiptSize, url: `/api/v1/admin/payments/${o.id}/receipt` },
          createdAt: o.createdAt,
          reviewedAt: o.reviewedAt,
          user: u?.id
            ? { id: u.id, name: u.name, email: u.email, phone: u.phone, telegramUsername: u.telegramUsername, avatarUrl: avatarUrlOf(u.id, u.avatarKey, u.avatarAt), coins: u.coins }
            : null,
        })),
      }
    },
  )

  admin.get('/payments/:id/receipt', { schema: { hide: true, params: idParams } }, async (req, reply) => {
    const [o] = await db.select({ key: po.receiptKey, mime: po.receiptMime }).from(po).where(eq(po.id, req.params.id)).limit(1)
    if (!o || !(await storage.exists(o.key))) throw notFound('Çek topilmadi')
    // shown in the panel (img / PDF viewer); nothing in it may run
    reply.header('content-type', o.mime)
    reply.header('content-disposition', `inline; filename="${req.params.id}.${o.key.split('.').pop()}"`)
    // the type was checked from the bytes; a sandbox would blank the browser's PDF viewer, so images only
    if (!o.mime.includes('pdf')) reply.header('content-security-policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox")
    reply.header('x-content-type-options', 'nosniff')
    reply.header('cache-control', 'private, max-age=3600')
    return reply.send(storage.stream(o.key))
  })

  admin.post(
    '/payments/:id/approve',
    { schema: { hide: true, params: idParams } },
    async (req) => {
      const [o] = await db.select().from(po).where(eq(po.id, req.params.id)).limit(1)
      if (!o) throw notFound('Tölov topilmadi')
      if (o.status === 'rejected') throw new AppError(409, 'ALREADY_REJECTED', 'Bu tölov rad etilgan')
      // the credit is keyed by the payment id: a double click or a retry adds the coins once
      const res = await coins.credit(o.userId, o.coins, { item: o.pack ?? 'custom', ref: `pay:${o.id}`, meta: { payment: o.id, amount: o.amount, method: o.method } })
      const [row] = await db
        .update(po)
        .set({ status: 'approved', reviewedAt: sql`coalesce(${po.reviewedAt}, now())`, reason: null })
        .where(eq(po.id, o.id))
        .returning()
      return { id: row.id, status: row.status, reviewedAt: row.reviewedAt, balance: res.balance, repeated: res.repeated }
    },
  )

  admin.post(
    '/payments/:id/reject',
    {
      schema: {
        hide: true,
        params: idParams,
        body: { type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 2, maxLength: 300 } } },
      },
    },
    async (req) => {
      const reason = req.body.reason.trim()
      if (reason.length < 2) throw badRequest('Sababini yozing')
      const [row] = await db
        .update(po)
        .set({ status: 'rejected', reason, reviewedAt: new Date() })
        .where(and(eq(po.id, req.params.id), eq(po.status, 'pending')))
        .returning()
      if (!row) {
        const [o] = await db.select({ status: po.status }).from(po).where(eq(po.id, req.params.id)).limit(1)
        if (!o) throw notFound('Tölov topilmadi')
        throw new AppError(409, 'NOT_PENDING', o.status === 'approved' ? 'Bu tölov allaqaçon tasdiqlangan' : 'Bu tölov allaqaçon rad etilgan')
      }
      await notifier.send(row.userId, 'payment.rejected', { coins: row.coins, amount: row.amount, reason }, '#/')
      return { id: row.id, status: row.status, reason: row.reason, reviewedAt: row.reviewedAt }
    },
  )

  admin.get('/payment-cards', { schema: { hide: true } }, async () => {
    const cards = await readCards(db)
    return { cards: Object.fromEntries(PAY_METHODS.map((m) => [m, { number: digits(cards[m]?.number), holder: cards[m]?.holder ?? '', enabled: cards[m]?.enabled !== false }])) }
  })

  const cardSchema = {
    type: 'object',
    additionalProperties: false,
    properties: { number: { type: 'string', maxLength: 32 }, holder: { type: 'string', maxLength: 80 }, enabled: { type: 'boolean' } },
  }
  admin.put(
    '/payment-cards',
    { schema: { hide: true, body: { type: 'object', additionalProperties: false, properties: Object.fromEntries(PAY_METHODS.map((m) => [m, cardSchema])) } } },
    async (req) => {
      const cur = await readCards(db)
      const next = { ...cur }
      for (const m of PAY_METHODS) {
        const c = req.body[m]
        if (!c) continue
        const number = c.number != null ? digits(c.number) : digits(cur[m]?.number)
        if (number && number.length !== 16) throw new AppError(400, 'CARD_NUMBER', `${m.toUpperCase()}: karta raqami 16 ta raqamdan iborat bölişi kerak`)
        next[m] = { number, holder: (c.holder ?? cur[m]?.holder ?? '').trim(), enabled: c.enabled ?? cur[m]?.enabled ?? true }
      }
      await db
        .insert(adminSettings)
        .values({ key: CARDS_KEY, value: next, updatedAt: new Date() })
        .onConflictDoUpdate({ target: adminSettings.key, set: { value: next, updatedAt: new Date() } })
      return { cards: Object.fromEntries(PAY_METHODS.map((m) => [m, { number: next[m]?.number ?? '', holder: next[m]?.holder ?? '', enabled: next[m]?.enabled !== false }])) }
    },
  )
}
