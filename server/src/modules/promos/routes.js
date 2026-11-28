// /api/v1/promos — the user's «Aksiyalar»:
//   GET  /promos                 Juma sovğasi + Döst taklifi state (code, link stats, friends)
//   POST /promos/friday/claim    take this Friday's coins
//   GET  /promos/invite/:code    public: who invites (sign-up page banner)
// Admin side (inside the guarded admin scope): GET / PUT /admin/promos.
import { PROMO_LIMITS, REF_CODE_RE, lastFridays } from '../../../../shared/promos.js'

const int = ({ min, max }) => ({ type: 'integer', minimum: min, maximum: max })

/** @param {import('fastify').FastifyInstance} app */
export default async function promoRoutes(app) {
  const { promos } = app.ctx

  app.get(
    '/invite/:code',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { tags: ['promos'], summary: 'Taklif kodi kimniki', params: { type: 'object', properties: { code: { type: 'string', maxLength: 16 } } } } },
    async (req) => {
      const code = String(req.params.code).toUpperCase()
      return { invite: REF_CODE_RE.test(code) ? await promos.checkCode(code) : null }
    },
  )

  app.register(async (me) => {
    me.addHook('preHandler', app.authenticate)
    me.get('/', { schema: { tags: ['promos'], summary: 'Aksiyalar: Juma sovğasi va döst taklifi' } }, async (req) => promos.state(req.user))
    me.post(
      '/friday/claim',
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { tags: ['promos'], summary: 'Juma sovğasini oliş' } },
      async (req) => promos.claimFriday(req.user),
    )
  })
}

/** Registered by the admin routes inside their guarded scope. */
export async function promoAdminRoutes(admin, promos) {
  admin.get('/promos', { schema: { hide: true } }, async () => {
    const [settings, stats] = await Promise.all([promos.settings(), promos.adminStats(lastFridays(8))])
    return { settings, stats, limits: PROMO_LIMITS }
  })

  admin.put(
    '/promos',
    {
      schema: {
        hide: true,
        body: {
          type: 'object',
          required: ['friday', 'referral'],
          additionalProperties: false,
          properties: {
            friday: {
              type: 'object',
              required: ['enabled', 'coins'],
              additionalProperties: false,
              properties: { enabled: { type: 'boolean' }, coins: int(PROMO_LIMITS.fridayCoins) },
            },
            referral: {
              type: 'object',
              required: ['enabled', 'coins', 'friendCoins', 'maxPerUser'],
              additionalProperties: false,
              properties: {
                enabled: { type: 'boolean' },
                coins: int(PROMO_LIMITS.referralCoins),
                friendCoins: int(PROMO_LIMITS.friendCoins),
                maxPerUser: int(PROMO_LIMITS.maxPerUser),
              },
            },
          },
        },
      },
    },
    async (req) => {
      const settings = await promos.save(req.body)
      req.log.info({ settings }, 'admin: promos saved')
      return { settings }
    },
  )
}
