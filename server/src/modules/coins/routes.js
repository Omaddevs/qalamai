import { eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, forbidden, notFound } from '../../lib/errors.js'
import { randomToken } from '../../lib/crypto.js'
import { COIN_COSTS, COIN_PACKS, SIGNUP_BONUS } from '../../../../shared/coins.js'

const ref = { type: 'string', minLength: 6, maxLength: 80, pattern: '^[A-Za-z0-9:_-]+$' }
const entry = (e) => ({ id: e.id, delta: e.delta, balance: e.balance, reason: e.reason, item: e.item, createdAt: e.createdAt })

/** @param {import('fastify').FastifyInstance} app */
export default async function coinRoutes(app) {
  const { coins, config, db } = app.ctx

  app.get('/prices', { schema: { tags: ['coins'], summary: 'Amallar narxi va coin paketlari' } }, async () => ({
    costs: COIN_COSTS,
    packs: COIN_PACKS,
    signupBonus: SIGNUP_BONUS,
    purchase: config.coins.demoPurchase ? 'demo' : 'soon',
  }))

  app.register(async (me) => {
    me.addHook('preHandler', app.authenticate)

    me.get('/', { schema: { tags: ['coins'], summary: 'Coin balansi va oxirgi harakatlar' } }, async (req) => {
      const [wallet, history] = await Promise.all([coins.balance(req.user.id), coins.history(req.user.id, 30)])
      return { ...wallet, history: history.map(entry) }
    })

    me.post(
      '/spend',
      {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
        schema: {
          tags: ['coins'],
          summary: 'AI amali uçun coin yeçiş',
          body: {
            type: 'object',
            required: ['action', 'ref'],
            additionalProperties: false,
            properties: {
              action: { type: 'string', enum: Object.keys(COIN_COSTS) },
              qty: { type: 'number', minimum: 1, maximum: 1000 },
              ref,
              topic: { type: 'string', maxLength: 300 },
            },
          },
        },
      },
      async (req) => {
        const { action, qty, ref: r, topic } = req.body
        const res = await coins.spend(req.user, action, { qty, ref: r, meta: topic ? { topic } : {} })
        return { balance: res.balance, cost: res.cost, repeated: res.repeated, entry: entry(res.entry) }
      },
    )

    me.post(
      '/refund',
      { schema: { tags: ['coins'], summary: 'Muvaffaqiyatsiz generatsiya uçun coinni qaytariş', body: { type: 'object', required: ['ref'], additionalProperties: false, properties: { ref } } } },
      async (req) => {
        const res = await coins.refund(req.user, req.body.ref)
        return { balance: res.balance }
      },
    )

    // Real payments (Payme / Click) will credit packs from their webhooks. Until then a demo
    // purchase is available outside production so the whole flow can be tried end to end.
    me.post(
      '/purchase',
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        schema: {
          tags: ['coins'],
          summary: 'Coin paketini sotib oliş (hozircha demo)',
          body: { type: 'object', required: ['pack'], additionalProperties: false, properties: { pack: { type: 'string', enum: COIN_PACKS.map((p) => p.id) } } },
        },
      },
      async (req) => {
        if (!config.coins.demoPurchase) throw new AppError(503, 'PAYMENTS_SOON', 'Tölov tizimi (Payme, Click) tez kunda ulanadi.')
        if (req.user.isGuest) throw new AppError(403, 'REGISTER_REQUIRED', 'Coin sotib oliş uçun röyxatdan öting.')
        const res = await coins.purchase(req.user.id, req.body.pack, `demo:${randomToken()}`, { demo: true })
        return { balance: res.balance, premium: true, tier: await coins.tier(req.user.id), entry: entry(res.entry) }
      },
    )

    me.post(
      '/grant',
      {
        schema: {
          tags: ['coins'],
          summary: 'Admin: foydalanuvçiga coin qöşiş yoki ayiriş',
          body: {
            type: 'object',
            required: ['userId', 'amount'],
            additionalProperties: false,
            properties: { userId: { type: 'string', maxLength: 40 }, amount: { type: 'integer', minimum: -100000, maximum: 100000, not: { const: 0 } }, note: { type: 'string', maxLength: 200 } },
          },
        },
      },
      async (req) => {
        if (req.user.role !== 'admin') throw forbidden()
        const [target] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, req.body.userId)).limit(1)
        if (!target) throw notFound('Foydalanuvçi topilmadi')
        const res = await coins.grant(target.id, req.body.amount, req.user.id, req.body.note)
        return { balance: res.balance }
      },
    )
  })
}
