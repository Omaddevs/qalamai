import { and, eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { limitsFor, tashkentDay } from '../plans/plans.js'
import { publicUser } from '../auth/service.js'

const { users, usage } = schema

// Titul profile fields the frontend keeps (src/profile.js). Unknown keys are dropped.
const PROFILE_KEYS = [
  'workType', 'topic', 'subject', 'uniId', 'uniCustom', 'faculty', 'direction', 'course', 'group', 'fullName',
  'supervisor', 'city', 'year', 'phone', 'company', 'position', 'director', 'stir', 'address', 'bank', 'mfo', 'account',
  // browser clock (ms, as a string) of the last edit — the newer side wins when devices sync
  'updatedAt',
]

/** @param {import('fastify').FastifyInstance} app */
export default async function userRoutes(app) {
  const { db, auth, coins } = app.ctx
  app.addHook('preHandler', app.authenticate)

  app.get('/', { schema: { tags: ['me'], summary: 'Joriy foydalanuvçi, coin balansi va çegaralar' } }, async (req) => publicUser({ ...req.user, tier: await coins.tier(req.user.id) }, limitsFor(req.user)))

  app.patch(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Ism va titul profilini yangilaş',
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', maxLength: 80 },
            profile: { type: 'object', additionalProperties: { type: 'string', maxLength: 300 } },
          },
        },
      },
    },
    async (req) => {
      const set = { updatedAt: new Date() }
      if (req.body.name !== undefined) set.name = req.body.name.trim()
      if (req.body.profile) {
        const clean = Object.fromEntries(Object.entries(req.body.profile).filter(([k]) => PROFILE_KEYS.includes(k)))
        set.profile = { ...(req.user.profile ?? {}), ...clean }
      }
      const [u] = await db.update(users).set(set).where(eq(users.id, req.user.id)).returning()
      return publicUser({ ...u, tier: await coins.tier(u.id) }, limitsFor(u))
    },
  )

  app.get('/usage', { schema: { tags: ['me'], summary: 'Bugungi foydalaniş va çegaralar' } }, async (req) => {
    const day = tashkentDay()
    const rows = await db.select().from(usage).where(and(eq(usage.userId, req.user.id), eq(usage.day, day)))
    return { day, limits: limitsFor(req.user), used: Object.fromEntries(rows.map((r) => [r.metric, r.count])) }
  })

  app.post(
    '/password',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['me'],
        summary: 'Parolni özgartiriş (barça sessiyalar yopiladi)',
        body: {
          type: 'object',
          required: ['next'],
          additionalProperties: false,
          properties: { current: { type: 'string', maxLength: 128 }, next: { type: 'string', minLength: 8, maxLength: 128 } },
        },
      },
    },
    async (req) => {
      await auth.changePassword(req.user, req.body.current, req.body.next)
      return { ok: true }
    },
  )

  app.delete('/', { schema: { tags: ['me'], summary: 'Hisobni butunlay öçiriş (fayllar bilan)' } }, async (req) => {
    await app.ctx.files.removeAllFor(req.user.id)
    await db.delete(users).where(eq(users.id, req.user.id))
    return { ok: true }
  })
}
