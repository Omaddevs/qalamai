// Fastify application: plugins, auth decorators and modules under /api/v1.
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { eq } from 'drizzle-orm'
import { connectDb, schema } from './db/index.js'
import { AppError, errorHandler, unauthorized } from './lib/errors.js'
import { createStorage } from './lib/storage.js'
import { createTokenService } from './lib/tokens.js'
import { WorkerPool } from './workers/pool.js'
import authRoutes from './modules/auth/routes.js'
import { createAuthService } from './modules/auth/service.js'
import { createGoogleClient } from './modules/auth/google.js'
import { createBotApi } from './modules/telegram/bot.js'
import { createTelegramLogin } from './modules/telegram/login.js'
import userRoutes from './modules/users/routes.js'
import avatarRoutes from './modules/users/avatar.js'
import fileRoutes from './modules/files/routes.js'
import { createFileService } from './modules/files/service.js'
import { jobRoutes, localRunRoutes, toolRoutes } from './modules/jobs/routes.js'
import { createJobService } from './modules/jobs/service.js'
import { designRoutes, documentRoutes, sharedDesignRoutes } from './modules/documents/routes.js'
import { bioApiRoutes, bioPublicRoutes } from './modules/bio/routes.js'
import { PLAN_LIMITS } from './modules/plans/plans.js'
import coinRoutes from './modules/coins/routes.js'
import supportRoutes from './modules/support/routes.js'
import notificationRoutes from './modules/notifications/routes.js'
import photoRoutes from './modules/photos/routes.js'
import aiRoutes from './modules/ai/routes.js'
import { siteRoutes } from './modules/site/routes.js'
import { backfillCreations } from './modules/admin/content.js'
import { createInvitePage, inviteApiRoutes, invitePublicApiRoutes } from './modules/invite/routes.js'
import { sitePageRoutes } from './modules/site/page.js'
import paymentRoutes from './modules/payments/routes.js'
import { createNotifier } from './modules/notifications/service.js'
import { createCoinService } from './modules/coins/service.js'
import { createPromoService } from './modules/promos/service.js'
import promoRoutes from './modules/promos/routes.js'
import { adminRoutes, createAnalytics, trackRoutes, verificationRoutes } from './modules/admin/routes.js'
import { COIN_COSTS, COIN_PACKS, SIGNUP_BONUS } from '../../shared/coins.js'

const SEEN_EVERY_MS = 5 * 60_000

/** @param {ReturnType<typeof import('./config.js')['config']>} config */
export async function buildApp(config) {
  const app = Fastify({
    logger: config.isTest
      ? false
      : {
          level: config.logLevel,
          ...(config.isProd ? {} : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
    trustProxy: config.trustProxy,
    bodyLimit: 2 * 1048576,
    genReqId: () => Math.random().toString(36).slice(2, 10),
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array', useDefaults: true } },
  })

  /* ── services ── */
  const { db, close: closeDb, driver } = await connectDb(config.db, app.log)
  const storage = createStorage(config.storageDir)
  await storage.init()
  const tokens = createTokenService(config.auth)
  const pool = new WorkerPool({
    size: config.jobs.concurrency,
    timeoutMs: config.jobs.timeoutMs,
    log: app.log,
    workerData: { modelsDir: config.modelsDir, bgModel: config.bg.model, modelsAutoDownload: config.bg.autoDownload, gotenbergUrl: config.gotenbergUrl },
  })
  const files = createFileService({ db, storage, config, log: app.log })
  const jobs = createJobService({ db, pool, files, storage, log: app.log })
  const notifier = createNotifier({ db, log: app.log })
  const coins = createCoinService({ db, notifier })
  const auth = createAuthService({ db, tokens, config, coins })
  const promos = createPromoService({ db, coins, notifier, log: app.log })
  // null until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set; tests swap in a fake
  const google = config.google ? createGoogleClient(config.google) : null
  // Telegram bot that confirms phone numbers; polling is started by index.js (not in tests)
  const bot = config.telegram ? createBotApi(config.telegram.token, { apiUrl: config.telegram.apiUrl, apiIp: config.telegram.apiIp, log: app.log }) : null
  const telegram = bot ? createTelegramLogin({ db, bot, auth, secret: config.auth.jwtSecret, storage, log: app.log }) : null
  const analytics = createAnalytics({ db, config })
  // designs and documents made before the creations log existed are counted too (admin panel)
  backfillCreations(db, app.log).catch((err) => app.log.warn({ err }, 'creations backfill failed'))
  app.decorate('ctx', { config, db, storage, tokens, pool, files, jobs, auth, coins, promos, notifier, google, bot, telegram, driver, analytics })

  /* ── auth decorators ── */
  const loadUser = async (req) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return null
    const payload = await tokens.verifyAccess(header.slice(7))
    if (!payload?.sub) return null
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1)
    if (user && Date.now() - user.lastSeenAt.getTime() > SEEN_EVERY_MS) {
      db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, user.id)).catch(() => {})
    }
    return user ?? null
  }
  app.decorateRequest('user', null)
  app.decorate('authenticate', async (req) => {
    req.user = await loadUser(req)
    if (!req.user) throw unauthorized('Sessiya tugagan — qaytadan kiring')
    // with guests off, a guest account left from before can't use the app any more
    if (req.user.isGuest && !config.auth.allowGuests) throw new AppError(401, 'SIGN_IN_REQUIRED', 'Avval röyxatdan öting yoki hisobingizga kiring')
  })
  app.decorate('optionalAuth', async (req) => {
    req.user = await loadUser(req)
  })

  /* ── plugins ── */
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler((req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Bunday manzil yöq' } }))
  await app.register(helmet, {
    contentSecurityPolicy: false, // JSON API; file responses set their own CSP
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // thumbnails are shown on the web app's origin
  })
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  })
  await app.register(cookie)
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute', allowList: config.isTest ? () => true : undefined })
  await app.register(multipart, { limits: { fieldSize: 1024, fields: 10, headerPairs: 200 } })
  await app.register(swagger, {
    openapi: {
      info: { title: 'QalamAI API', version: '1.0.0', description: 'Fayl studiyasi, hujjatlar, dizaynlar va hisoblar. Barça xabarlar özbek tilida.' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearer: [] }],
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  /* ── routes ── */
  app.get('/health', { schema: { hide: true } }, async () => ({ ok: true, db: driver, workers: pool.size, queued: pool.pending }))
  await app.register(
    async (api) => {
      api.get('/plans', { schema: { tags: ['plans'], summary: 'Çegaralar va QalamCoin narxlari' } }, async () => ({ limits: PLAN_LIMITS, coins: { costs: COIN_COSTS, packs: COIN_PACKS, signupBonus: SIGNUP_BONUS } }))
      await api.register(authRoutes, { prefix: '/auth' })
      await api.register(userRoutes, { prefix: '/me' })
      await api.register(avatarRoutes, { prefix: '/avatars' })
      await api.register(coinRoutes, { prefix: '/coins' })
      await api.register(promoRoutes, { prefix: '/promos' })
      await api.register(paymentRoutes, { prefix: '/payments' })
      await api.register(fileRoutes, { prefix: '/files' })
      await api.register(toolRoutes, { prefix: '/tools' })
      await api.register(localRunRoutes, { prefix: '/tools' })
      await api.register(jobRoutes, { prefix: '/jobs' })
      await api.register(documentRoutes, { prefix: '/documents' })
      await api.register(designRoutes, { prefix: '/designs' })
      await api.register(sharedDesignRoutes, { prefix: '/shared' })
      await api.register(bioApiRoutes, { prefix: '/bio' })
      await api.register(trackRoutes)
      await api.register(adminRoutes, { prefix: '/admin' })
      await api.register(supportRoutes, { prefix: '/support' })
      await api.register(notificationRoutes, { prefix: '/notifications' })
      await api.register(photoRoutes, { prefix: '/photos' })
      await api.register(aiRoutes, { prefix: '/ai' })
      await api.register(siteRoutes, { prefix: '/site' })
      await api.register(inviteApiRoutes, { prefix: '/invites' })
      await api.register(invitePublicApiRoutes, { prefix: '/i' })
    },
    { prefix: '/api/v1' },
  )
  await app.register(bioPublicRoutes, { prefix: '/b' })
  await app.register(sitePageRoutes, { prefix: '/yangiliklar' }) // news pages for crawlers and link previews
  // /google….html for Search Console; any other single-segment address is an invitation (qalamai.uz/<slug>)
  await app.register(verificationRoutes, { fallback: createInvitePage(app) })

  app.addHook('onClose', async () => {
    app.ctx.bot?.stopPolling()
    await pool.destroy()
    await closeDb()
  })
  return app
}
