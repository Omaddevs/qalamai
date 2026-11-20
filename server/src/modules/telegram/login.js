// "Telegram orqali kiriş": proves that the phone number typed on the site belongs to the
// person signing in.
//
//   site:  POST /auth/telegram/start {phone}  → request id + bot link (browser keeps a secret cookie)
//   bot:   /start <id>  → "📱 Raqamni yuboriş" button (request_contact)
//   bot:   contact      → must be the sender's OWN contact and the same number → code sent in the chat
//   site:  GET  /auth/telegram/:id            → status; the code too once confirmed (for auto-fill)
//   site:  POST /auth/telegram/:id/verify     → code checked → signed in / registered
//
// Telegram fills `contact.user_id` only for the sender's own number when it comes from the
// request_contact button, so someone else's number can never be confirmed.
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest } from '../../lib/errors.js'
import { createHmac } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { randomToken, sha256 } from '../../lib/crypto.js'
import { normalizePhone } from '../auth/service.js'

const { telegramLogins, users } = schema

const TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 5
const PER_PHONE_PER_HOUR = 5

const masked = (phone) => `${phone.slice(0, 4)} ${phone.slice(4, 6)} *** ${phone.slice(-4, -2)} ${phone.slice(-2)}`
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

export function createTelegramLogin({ db, bot, auth, secret, storage, log }) {
  /** 6-digit code derived from the request id — nothing to store, nothing to leak from the DB. */
  const codeFor = (id) => String(createHmac('sha256', secret).update(`tg-code:${id}`).digest().readUInt32BE(0) % 1_000_000).padStart(6, '0')

  async function load(id, browserSecret) {
    const [r] = await db.select().from(telegramLogins).where(eq(telegramLogins.id, String(id))).limit(1)
    if (!r || !browserSecret || r.browserSecretHash !== sha256(browserSecret)) throw new AppError(404, 'TG_REQUEST_NOT_FOUND', 'Sörov topilmadi. Qaytadan boşlang.')
    return r
  }
  const expired = (r) => r.expiresAt < new Date() || r.usedAt

  async function pendingFor(telegramUserId) {
    const [r] = await db
      .select()
      .from(telegramLogins)
      .where(and(eq(telegramLogins.telegramUserId, telegramUserId), isNull(telegramLogins.usedAt), gt(telegramLogins.expiresAt, new Date())))
      .orderBy(desc(telegramLogins.createdAt))
      .limit(1)
    return r ?? null
  }

  const contactKeyboard = {
    keyboard: [[{ text: '📱 Raqamni yuboriş', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  }
  const noKeyboard = { remove_keyboard: true }

  async function savePhoto(user, telegramUserId) {
    if (!storage || !bot.profilePhoto) return user
    try {
      const jpeg = await bot.profilePhoto(telegramUserId)
      if (!jpeg || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return user // JPEG only
      const key = `avatars/${user.id}.jpg`
      const tmp = `${storage.tmpDir}/${user.id}-${Date.now()}.jpg`
      await writeFile(tmp, jpeg)
      await storage.putFile(key, tmp)
      const [u] = await db.update(users).set({ avatarKey: key, avatarAt: new Date() }).where(eq(users.id, user.id)).returning()
      return { ...u, coins: user.coins }
    } catch (err) {
      log?.warn({ err }, 'telegram: profile photo not saved')
      return user
    }
  }

  return {
    codeFor,

    async start(phoneInput) {
      const phone = normalizePhone(phoneInput)
      if (!phone) throw badRequest('Telefon raqamni +998 XX XXX XX XX körinişida kiriting')
      const [{ n }] = await db
        .select({ n: sql`count(*)::int` })
        .from(telegramLogins)
        .where(and(eq(telegramLogins.phone, phone), gt(telegramLogins.createdAt, new Date(Date.now() - 3600_000))))
      if (n >= PER_PHONE_PER_HOUR) throw new AppError(429, 'TG_TOO_MANY', 'Bu raqam uçun juda köp uriniş. Bir soatdan keyin qayta urinib köring.')

      let username
      try {
        ;({ username } = await bot.getMe())
      } catch {
        throw new AppError(503, 'TG_UNAVAILABLE', 'Telegram bot bilan boğlanib bölmadi. Birozdan keyin urinib köring.')
      }
      const id = randomToken(24) // 32 chars of [A-Za-z0-9_-] — valid as a /start payload
      const browserSecret = randomToken(32)
      const expiresAt = new Date(Date.now() + TTL_MS)
      await db.insert(telegramLogins).values({ id, phone, browserSecretHash: sha256(browserSecret), expiresAt })
      return { id, browserSecret, phone, botUsername: username, botUrl: `https://t.me/${username}?start=${id}`, expiresAt }
    },

    /** What the site shows while waiting. The code is returned only after the bot confirmed the number. */
    async status(id, browserSecret) {
      const r = await load(id, browserSecret)
      if (expired(r)) return { status: 'expired' }
      if (r.verifiedAt) return { status: 'verified', code: codeFor(r.id) }
      return { status: r.telegramUserId ? 'opened' : 'pending' }
    },

    /** Check the code and sign the person in (or register them). */
    async verify(id, browserSecret, code, { name, currentUser, meta }) {
      const r = await load(id, browserSecret)
      if (expired(r)) throw new AppError(410, 'TG_EXPIRED', 'Kod muddati tugagan. Qaytadan boşlang.')
      if (!r.verifiedAt) throw new AppError(400, 'TG_NOT_CONFIRMED', 'Avval Telegram botda raqamingizni yuboring.')
      if (r.attempts >= MAX_ATTEMPTS) throw new AppError(429, 'TG_TOO_MANY', 'Urinişlar soni tugadi. Qaytadan boşlang.')
      if (String(code ?? '').replace(/\D/g, '') !== codeFor(r.id)) {
        await db.update(telegramLogins).set({ attempts: sql`${telegramLogins.attempts} + 1` }).where(eq(telegramLogins.id, r.id))
        throw new AppError(400, 'TG_WRONG_CODE', 'Kod notöğri')
      }
      // single use, also against two parallel requests
      const won = await db
        .update(telegramLogins)
        .set({ usedAt: new Date() })
        .where(and(eq(telegramLogins.id, r.id), isNull(telegramLogins.usedAt)))
        .returning({ id: telegramLogins.id })
      if (!won.length) throw new AppError(410, 'TG_EXPIRED', 'Bu kod allaqaçon işlatilgan. Qaytadan boşlang.')
      const session = await auth.phoneSignIn(
        { phone: r.phone, telegramId: r.telegramUserId, telegramUsername: r.telegramUsername, name: r.telegramName || name?.trim() || '' },
        currentUser,
        meta,
      )
      // the Telegram profile picture becomes the account's avatar (best effort — never blocks sign-in)
      const user = await savePhoto(session.user, r.telegramUserId)
      return { ...session, user }
    },

    /** One Telegram update (from polling or a webhook). */
    async handleUpdate(update) {
      const msg = update.message
      if (!msg?.from || msg.chat?.type !== 'private') return
      const chatId = msg.chat.id
      const fromId = String(msg.from.id)
      const text = msg.text ?? ''

      const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/)
      if (startMatch) {
        const payload = startMatch[1]
        if (!payload) {
          return bot.sendMessage(chatId, 'Assalomu alaykum! Bu <b>QalamAI</b> rasmiy boti.\n\nKiriş uçun saytda <b>Telegram</b> tugmasini bosing va telefon raqamingizni kiriting — bot sizni şu yerga olib keladi.', { reply_markup: noKeyboard })
        }
        const [r] = await db.select().from(telegramLogins).where(eq(telegramLogins.id, payload)).limit(1)
        if (!r || expired(r)) return bot.sendMessage(chatId, '⌛️ Bu havola eskirgan. Saytda qaytadan boşlang.', { reply_markup: noKeyboard })
        if (r.telegramUserId && r.telegramUserId !== fromId) return bot.sendMessage(chatId, 'Bu havola boşqa Telegram hisobi uçun oçilgan. Saytda qaytadan boşlang.', { reply_markup: noKeyboard })
        const telegramName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').slice(0, 80)
        const telegramUsername = msg.from.username?.slice(0, 64) ?? null
        await db.update(telegramLogins).set({ telegramUserId: fromId, telegramName, telegramUsername }).where(eq(telegramLogins.id, r.id))
        if (r.verifiedAt) return bot.sendMessage(chatId, `Raqamingiz allaqaçon tasdiqlangan. Tasdiqlaş kodi: <code>${codeFor(r.id)}</code>`, { reply_markup: noKeyboard })
        return bot.sendMessage(
          chatId,
          `QalamAI saytida <b>${masked(r.phone)}</b> raqami bilan kiriş söraldi.\n\nBu siz bölsangiz, pastdagi <b>«📱 Raqamni yuboriş»</b> tugmasini bosing — kod şu yerga keladi.\n\n<i>Siz sörmagan bölsangiz, heç narsa qilmang.</i>`,
          { reply_markup: contactKeyboard },
        )
      }

      if (msg.contact) {
        const r = await pendingFor(fromId)
        if (!r) return bot.sendMessage(chatId, 'Faol sörov topilmadi. Saytda <b>Telegram</b> tugmasini bosib, qaytadan boşlang.', { reply_markup: noKeyboard })
        // a forwarded or typed-in contact has no user_id, or someone else's
        if (String(msg.contact.user_id ?? '') !== fromId) {
          return bot.sendMessage(chatId, '❗️ Faqat öz raqamingizni yuboring — pastdagi <b>«📱 Raqamni yuboriş»</b> tugmasidan foydalaning.', { reply_markup: contactKeyboard })
        }
        const phone = normalizePhone(msg.contact.phone_number)
        if (phone !== r.phone) {
          return bot.sendMessage(
            chatId,
            `❗️ Telegram hisobingiz raqami (${esc(phone ?? msg.contact.phone_number)}) saytda kiritilgan raqamga (${masked(r.phone)}) mos emas.\n\nSaytda öz raqamingizni kiritib, qaytadan boşlang.`,
            { reply_markup: noKeyboard },
          )
        }
        if (!r.verifiedAt) await db.update(telegramLogins).set({ verifiedAt: new Date() }).where(eq(telegramLogins.id, r.id))
        return bot.sendMessage(
          chatId,
          `✅ Raqam tasdiqlandi.\n\nTasdiqlaş kodi: <code>${codeFor(r.id)}</code>\n\nKod 10 daqiqa amal qiladi. Uni heç kimga bermang — QalamAI xodimlari kodni heç qaçon sörashmaydi.`,
          { reply_markup: noKeyboard },
        )
      }

      return bot.sendMessage(chatId, 'Kiriş uçun saytda <b>Telegram</b> tugmasini bosing va telefon raqamingizni kiriting.', { reply_markup: noKeyboard })
    },
  }
}
