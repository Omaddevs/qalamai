// QalamChat: a registered user writes to the team (question, partnership, complaint …).
// Messages are saved and, when CONTACT_CHAT_ID is set, forwarded to that Telegram chat through the bot.
// Guests are refused with REGISTER_REQUIRED — the team needs an account to get back to.
import { desc, eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError } from '../../lib/errors.js'
import { newId, ID_PREFIX } from '../../lib/ids.js'
import { CONTACT_LIMITS, EMAIL_RE, PHONE_RE, SUPPORT_MESSAGE_MAX, SUPPORT_TOPICS } from '../../../../shared/support.js'

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const out = (m) => ({
  id: m.id,
  topic: m.topic,
  message: m.message,
  contact: { name: m.contactName, phone: m.contactPhone, email: m.contactEmail },
  status: m.status,
  createdAt: m.createdAt,
})
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

/** @param {import('fastify').FastifyInstance} app */
export default async function supportRoutes(app) {
  const { db, bot, config } = app.ctx

  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', async (req) => {
    if (req.user.isGuest) throw new AppError(403, 'REGISTER_REQUIRED', 'Xabar yuboriş uçun röyxatdan öting')
  })

  app.get('/', { schema: { tags: ['support'], summary: 'QalamChat: mening xabarlarim' } }, async (req) => {
    const rows = await db
      .select()
      .from(schema.supportMessages)
      .where(eq(schema.supportMessages.userId, req.user.id))
      .orderBy(desc(schema.supportMessages.createdAt))
      .limit(50)
    return { messages: rows.reverse().map(out) }
  })

  app.post(
    '/',
    {
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
      schema: {
        tags: ['support'],
        summary: 'QalamChat: jamoaga xabar yuboriş',
        body: {
          type: 'object',
          required: ['topic', 'message', 'contact'],
          additionalProperties: false,
          properties: {
            topic: { type: 'string', enum: SUPPORT_TOPICS },
            message: { type: 'string', minLength: 2, maxLength: SUPPORT_MESSAGE_MAX },
            contact: {
              type: 'object',
              required: ['name'],
              additionalProperties: false,
              properties: {
                name: { type: 'string', maxLength: CONTACT_LIMITS.name },
                phone: { type: 'string', maxLength: CONTACT_LIMITS.phone },
                email: { type: 'string', maxLength: CONTACT_LIMITS.email },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const u = req.user
      const message = req.body.message.trim()
      if (message.length < 2) throw new AppError(400, 'VALIDATION_ERROR', 'Xabar böş')
      const c = req.body.contact
      const contact = { name: clean(c.name), phone: clean(c.phone) || null, email: clean(c.email) || null }
      if (contact.name.length < 2) throw new AppError(400, 'CONTACT_NAME', 'Ismingizni yozing')
      if (contact.phone && !PHONE_RE.test(contact.phone)) throw new AppError(400, 'CONTACT_PHONE', 'Telefon raqam notöğri')
      if (contact.email && !EMAIL_RE.test(contact.email)) throw new AppError(400, 'CONTACT_EMAIL', 'Email notöğri')
      if (!contact.phone && !contact.email) throw new AppError(400, 'CONTACT_REQUIRED', 'Telefon yoki email yozing')
      const [row] = await db
        .insert(schema.supportMessages)
        .values({
          id: newId(ID_PREFIX.support),
          userId: u.id,
          topic: req.body.topic,
          message,
          contactName: contact.name,
          contactPhone: contact.phone,
          contactEmail: contact.email,
          lang: typeof req.headers['x-lang'] === 'string' ? req.headers['x-lang'].slice(0, 10) : null,
        })
        .returning()

      if (bot && config.support.chatId) {
        const who = [
          `👤 ${esc(contact.name)}`,
          contact.phone && `📞 ${esc(contact.phone)}`,
          contact.email && `✉️ ${esc(contact.email)}`,
          u.telegramUsername && `💬 @${esc(u.telegramUsername)}`,
        ].filter(Boolean)
        const text = ['💬 <b>QalamChat</b> · #' + esc(row.topic), '', ...who, `🆔 <code>${esc(u.id)}</code>`, '', esc(message)].join('\n')
        bot.sendMessage(config.support.chatId, text).catch((err) => req.log.warn({ err }, 'support: telegram notify failed'))
      }
      return { message: out(row) }
    },
  )
}
