import { timingSafeEqual } from 'node:crypto'
import { limitsFor } from '../plans/plans.js'
import { randomToken } from '../../lib/crypto.js'
import { ensureAvatar } from '../../lib/avatars.js'
import { AppError } from '../../lib/errors.js'
import { publicUser } from './service.js'
import { VISITOR_COOKIE } from '../admin/analytics.js'
import { REF_COOKIE } from '../../../../shared/promos.js'

const COOKIE = 'qalam_rt'
const COOKIE_PATH = '/api/v1/auth'
// state + PKCE verifier between "/google" and Google's redirect back; lives 10 minutes
const G_COOKIE = 'qalam_g'
const G_PATH = '/api/v1/auth/google'

const sameText = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

const credentials = {
  type: 'object',
  required: ['login', 'password'],
  additionalProperties: false,
  properties: {
    login: { type: 'string', minLength: 3, maxLength: 120, description: 'Email yoki +998 telefon raqam' },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    name: { type: 'string', maxLength: 80 },
  },
}

const sessionReply = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    accessExpiresIn: { type: 'integer', description: 'soniya' },
    refreshToken: { type: 'string', description: 'Faqat X-Token-Transport: body sarlavhasi yuborilganda' },
    user: { type: 'object', additionalProperties: true },
  },
}

/** @param {import('fastify').FastifyInstance} app */
export default async function authRoutes(app) {
  const { auth, config, coins } = app.ctx
  const meta = (req) => ({ ip: req.ip, userAgent: req.headers['user-agent'] })

  // Browsers get the refresh token as an httpOnly cookie; native clients ask for it in the body.
  const send = async (req, reply, s, method) => {
    // an account that just stopped being a guest: remember how and where from (admin panel)
    if (method && !s.user.isGuest && !s.user.registeredAt) {
      await app.ctx.analytics.recordSignup(s.user, req, method).catch((err) => req.log.warn({ err }, 'signup record failed'))
      // came through a friend's invite link (Döst taklifi): pay the inviter once
      const code = String(req.cookies?.[REF_COOKIE] ?? '').toUpperCase()
      if (code) {
        const vid = req.cookies?.[VISITOR_COOKIE]
        const settled = await app.ctx.promos.onSignup(s.user, { code, visitorId: vid && /^[A-Za-z0-9_-]{8,64}$/.test(vid) ? vid : null })
        if (settled?.balance != null) s.user = { ...s.user, coins: settled.balance }
        reply.clearCookie(REF_COOKIE, { path: '/' })
      }
    }
    // a registered account without a picture gets the next drawn avatar (best effort)
    if (!s.user.isGuest && !s.user.avatarKey) {
      s.user = await ensureAvatar(app.ctx.db, s.user).catch((err) => {
        req.log.warn({ err }, 'default avatar not set')
        return s.user
      })
    }
    const bodyTransport = req.headers['x-token-transport'] === 'body'
    if (!bodyTransport) {
      reply.setCookie(COOKIE, s.refreshToken, {
        path: COOKIE_PATH,
        httpOnly: true,
        sameSite: 'lax',
        secure: config.auth.cookieSecure,
        expires: s.refreshExpiresAt,
      })
    }
    return {
      accessToken: s.accessToken,
      accessExpiresIn: s.accessExpiresIn,
      ...(bodyTransport ? { refreshToken: s.refreshToken } : {}),
      user: publicUser({ ...s.user, tier: await coins.tier(s.user.id) }, limitsFor(s.user)),
    }
  }
  const tokenFrom = (req) => req.cookies?.[COOKIE] || req.body?.refreshToken
  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }

  app.post('/guest', { ...strict, schema: { tags: ['auth'], summary: 'Mehmon sessiyasi (röyxatdan ötmasdan) — faqat ALLOW_GUESTS yoqilganda', response: { 200: sessionReply } } }, async (req, reply) => {
    if (!config.auth.allowGuests) throw new AppError(403, 'GUESTS_OFF', 'Avval röyxatdan öting yoki hisobingizga kiring')
    return send(req, reply, await auth.createGuest(meta(req)))
  })

  app.post(
    '/register',
    {
      ...strict,
      preHandler: app.optionalAuth,
      schema: {
        tags: ['auth'],
        summary: 'Röyxatdan ötiş',
        description: 'Mehmon tokeni bilan çaqirilsa — mehmon hisobi saqlanib, fayllari bilan birga doimiy hisobga aylanadi.',
        body: credentials,
        response: { 200: sessionReply },
      },
    },
    async (req, reply) => send(req, reply, await auth.register(req.body, req.user, meta(req)), 'password'),
  )

  app.post('/login', { ...strict, schema: { tags: ['auth'], summary: 'Kiriş', body: credentials, response: { 200: sessionReply } } }, async (req, reply) =>
    send(req, reply, await auth.login(req.body, meta(req))),
  )

  app.post(
    '/refresh',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Access tokenni yangilaş (refresh token aylantiriladi)',
        body: { type: ['object', 'null'], properties: { refreshToken: { type: 'string' } } },
        response: { 200: sessionReply },
      },
    },
    async (req, reply) => {
      try {
        return send(req, reply, await auth.refresh(tokenFrom(req), meta(req)))
      } catch (err) {
        reply.clearCookie(COOKIE, { path: COOKIE_PATH })
        throw err
      }
    },
  )

  app.post('/logout', { schema: { tags: ['auth'], summary: 'Çiqiş', body: { type: ['object', 'null'], properties: { refreshToken: { type: 'string' } } } } }, async (req, reply) => {
    await auth.logout(tokenFrom(req))
    reply.clearCookie(COOKIE, { path: COOKIE_PATH })
    return { ok: true }
  })

  /* ───────── Google bilan kiriş ───────── */

  const redirectUri = `${config.appUrl}/api/v1/auth/google/callback`
  const appHost = new URL(config.appUrl).host
  // success → the app (which picks the session up from the refresh cookie); failure → sign-in page with a reason
  // `page`: which form the reason is shown on — sign-in, or sign-up (e.g. "no account yet")
  const backToApp = (reply, error, page = 'login') =>
    reply.redirect(error ? `${config.appUrl}/?auth_error=${error}#/auth${page === 'login' ? '/login' : ''}` : `${config.appUrl}/#/`)
  const MODES = new Set(['login', 'signup'])

  app.get(
    '/google',
    {
      ...strict,
      schema: {
        tags: ['auth'],
        summary: 'Google bilan kiriş (Google sahifasiga yönaltiradi)',
        description: '`mode=login` — faqat mavjud hisobga kiriş; `mode=signup` — faqat yangi hisob oçiş.',
        querystring: { type: 'object', properties: { mode: { type: 'string', enum: ['login', 'signup'] }, lang: { type: 'string', maxLength: 10 } } },
      },
    },
    async (req, reply) => {
      if (!app.ctx.google) return backToApp(reply, 'google_off')
      const mode = MODES.has(req.query.mode) ? req.query.mode : 'any'
      // the state cookie has to live on the host Google sends the user back to
      if (req.host !== appHost) return reply.redirect(`${config.appUrl}${G_PATH}${mode === 'any' ? '' : `?mode=${mode}`}`)
      const state = randomToken(24)
      const verifier = randomToken(48)
      reply.setCookie(G_COOKIE, `${state}.${verifier}.${mode}`, {
        path: G_PATH,
        httpOnly: true,
        sameSite: 'lax',
        secure: config.auth.cookieSecure,
        maxAge: 600,
      })
      return reply.redirect(app.ctx.google.authUrl({ redirectUri, state, verifier }))
    },
  )

  app.get(
    '/google/callback',
    {
      ...strict,
      schema: {
        tags: ['auth'],
        summary: 'Google qaytaradigan manzil',
        querystring: { type: 'object', properties: { code: { type: 'string' }, state: { type: 'string' }, error: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const saved = req.cookies?.[G_COOKIE] ?? ''
      reply.clearCookie(G_COOKIE, { path: G_PATH })
      const google = app.ctx.google
      if (!google) return backToApp(reply, 'google_off')
      const { code, state, error } = req.query
      if (error) return backToApp(reply, error === 'access_denied' ? 'google_cancelled' : 'google_failed')
      const [savedState, verifier, savedMode] = saved.split('.')
      if (!savedState || !verifier || !code || !sameText(savedState, state ?? '')) return backToApp(reply, 'google_state')
      const mode = MODES.has(savedMode) ? savedMode : undefined
      try {
        const identity = await google.identity({ code, redirectUri, verifier })
        await send(req, reply, await auth.googleSignIn(identity, req.cookies?.[COOKIE], meta(req), { mode }), 'google')
        return backToApp(reply)
      } catch (err) {
        if (err.code === 'ACCOUNT_NOT_FOUND') return backToApp(reply, 'google_no_account', 'signup')
        if (err.code === 'ACCOUNT_EXISTS') return backToApp(reply, 'google_exists', 'login')
        req.log.warn({ err }, 'google sign-in failed')
        return backToApp(reply, 'google_failed')
      }
    },
  )

  /* ───────── Telegram orqali kiriş ───────── */

  const TG_COOKIE = 'qalam_tg'
  const TG_PATH = '/api/v1/auth/telegram'
  const telegramOn = () => {
    if (!app.ctx.telegram) throw new AppError(503, 'TG_OFF', 'Telegram orqali kiriş hali sozlanmagan')
    return app.ctx.telegram
  }
  const requestId = { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 64 } } }

  app.post(
    '/telegram/start',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Telegram orqali kiriş: raqam → bot havolasi',
        body: { type: 'object', required: ['phone'], additionalProperties: false, properties: { phone: { type: 'string', maxLength: 32 }, mode: { type: 'string', enum: ['login', 'signup'] } } },
      },
    },
    async (req, reply) => {
      const r = await telegramOn().start(req.body.phone, { mode: req.body.mode })
      reply.setCookie(TG_COOKIE, r.browserSecret, { path: TG_PATH, httpOnly: true, sameSite: 'lax', secure: config.auth.cookieSecure, maxAge: 900 })
      return { id: r.id, botUrl: r.botUrl, botUsername: r.botUsername, phone: r.phone, expiresAt: r.expiresAt }
    },
  )

  app.get(
    '/telegram/:id',
    { config: { rateLimit: { max: 90, timeWindow: '1 minute' } }, schema: { tags: ['auth'], summary: 'Telegram sörovi holati (tasdiqlangaç — kod ham)', params: requestId } },
    async (req) => telegramOn().status(req.params.id, req.cookies?.[TG_COOKIE]),
  )

  app.post(
    '/telegram/:id/verify',
    {
      ...strict,
      preHandler: app.optionalAuth,
      schema: {
        tags: ['auth'],
        summary: 'Kodni tekşiriş va kiriş / röyxatdan ötiş',
        params: requestId,
        body: {
          type: 'object',
          required: ['code'],
          additionalProperties: false,
          properties: { code: { type: 'string', maxLength: 12 }, name: { type: 'string', maxLength: 80 }, mode: { type: 'string', enum: ['login', 'signup'] } },
        },
        response: { 200: sessionReply },
      },
    },
    async (req, reply) => {
      const s = await telegramOn().verify(req.params.id, req.cookies?.[TG_COOKIE], req.body.code, { name: req.body.name, currentUser: req.user, meta: meta(req), mode: req.body.mode })
      reply.clearCookie(TG_COOKIE, { path: TG_PATH })
      return send(req, reply, s, 'telegram')
    },
  )
}
