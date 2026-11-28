// Admin panel API (/api/v1/admin) and the public pieces it controls: the page-view beacon
// (/api/v1/t) and the Google Search Console verification file (/google….html).
//
// Sign-in is one password. Its scrypt hash lives in admin_settings; the first one comes from
// ADMIN_PASSWORD and is changed from the panel afterwards. The session is a 12-hour JWT in an
// httpOnly, SameSite=Strict cookie; changing the password bumps a version that ends every session.
import { createHash } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest, notFound, unauthorized } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/crypto.js'
import { avatarUrlOf } from '../../lib/avatars.js'
import { createAnalytics, VISITOR_COOKIE } from './analytics.js'
import { parseUa } from './detect.js'
import { paymentAdminRoutes } from '../payments/admin.js'
import { siteAdminRoutes } from '../site/admin.js'
import { promoAdminRoutes } from '../promos/routes.js'
import { createContentStats } from './content.js'
import { CREATION_KINDS } from '../../../../shared/creations.js'

const { users, sessions, adminSettings, designs, documents, files, jobs, coinLedger, bioPages, supportMessages, notifications, notificationReads } = schema

const COOKIE = 'qalam_adm'
const COOKIE_PATH = '/api/v1/admin'
const TTL_H = 12
const LOCK_AFTER = 10
const LOCK_WINDOW_MS = 15 * 60_000
const GSC_FILE = /^google[0-9a-f]{8,32}\.html$/
const GA4_ID = /^G-[A-Z0-9]{4,16}$/

/** @param {import('fastify').FastifyInstance} app */
export async function adminRoutes(app) {
  const { db, config, coins, notifier } = app.ctx
  const analytics = app.ctx.analytics
  const content = createContentStats(db)
  const key = createHash('sha256').update(`qalam-admin:${config.auth.jwtSecret}`).digest()

  /* ───────── settings ───────── */

  const getSetting = async (k) => (await db.select().from(adminSettings).where(eq(adminSettings.key, k)).limit(1))[0]?.value ?? null
  const setSetting = (k, value) =>
    db.insert(adminSettings).values({ key: k, value, updatedAt: new Date() }).onConflictDoUpdate({ target: adminSettings.key, set: { value, updatedAt: new Date() } })

  /** { hash, version } — created from ADMIN_PASSWORD the first time it is needed. */
  async function credentials() {
    const saved = await getSetting('auth')
    if (saved?.hash) return saved
    if (!config.admin.password) return null
    const auth = { hash: await hashPassword(config.admin.password), version: 1 }
    await setSetting('auth', auth)
    return auth
  }

  /* ───────── session ───────── */

  const sign = (version) =>
    new SignJWT({ v: version }).setProtectedHeader({ alg: 'HS256' }).setSubject('admin').setAudience('qalam-admin').setIssuedAt().setExpirationTime(`${TTL_H}h`).sign(key)

  const setCookie = (reply, token) =>
    reply.setCookie(COOKIE, token, { path: COOKIE_PATH, httpOnly: true, sameSite: 'strict', secure: config.auth.cookieSecure, maxAge: TTL_H * 3600 })

  async function requireAdmin(req) {
    const token = req.cookies?.[COOKIE]
    if (!token) throw unauthorized('Admin panelga kiring')
    let payload
    try {
      ;({ payload } = await jwtVerify(token, key, { audience: 'qalam-admin', algorithms: ['HS256'] }))
    } catch {
      throw unauthorized('Sessiya tugagan — qaytadan kiring')
    }
    const auth = await credentials()
    if (!auth || payload.v !== auth.version) throw unauthorized('Parol özgargan — qaytadan kiring')
    req.admin = payload
  }

  // Brute-force guard on top of the per-IP rate limit: 10 wrong passwords in 15 minutes lock sign-in.
  let failures = []
  const locked = () => {
    failures = failures.filter((t) => Date.now() - t < LOCK_WINDOW_MS)
    return failures.length >= LOCK_AFTER ? Math.ceil((failures[0] + LOCK_WINDOW_MS - Date.now()) / 60_000) : 0
  }

  app.post(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { hide: true, body: { type: 'object', required: ['password'], additionalProperties: false, properties: { password: { type: 'string', minLength: 1, maxLength: 128 } } } },
    },
    async (req, reply) => {
      const wait = locked()
      if (wait) throw new AppError(429, 'LOCKED', `Köp marta notöğri parol kiritildi. ${wait} daqiqadan keyin urinib köring.`)
      const auth = await credentials()
      if (!auth) throw new AppError(503, 'ADMIN_OFF', 'Admin paroli hali sozlanmagan (serverda ADMIN_PASSWORD)')
      if (!(await verifyPassword(req.body.password, auth.hash))) {
        failures.push(Date.now())
        req.log.warn({ ip: req.ip }, 'admin: wrong password')
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Parol notöğri')
      }
      failures = []
      req.log.info({ ip: req.ip }, 'admin: signed in')
      setCookie(reply, await sign(auth.version))
      return { ok: true, expiresInHours: TTL_H }
    },
  )

  app.post('/logout', { schema: { hide: true } }, async (req, reply) => {
    reply.clearCookie(COOKIE, { path: COOKIE_PATH })
    return { ok: true }
  })

  // everything below needs the admin cookie
  await app.register(async (admin) => {
    admin.addHook('onRequest', requireAdmin)
    admin.addHook('onSend', async (req, reply, payload) => {
      reply.header('cache-control', 'no-store')
      return payload
    })

    admin.get('/me', { schema: { hide: true } }, async (req) => ({ ok: true, since: new Date(req.admin.iat * 1000), expiresAt: new Date(req.admin.exp * 1000) }))

    admin.post(
      '/password',
      {
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
        schema: {
          hide: true,
          body: {
            type: 'object',
            required: ['current', 'next'],
            additionalProperties: false,
            properties: { current: { type: 'string', maxLength: 128 }, next: { type: 'string', minLength: 8, maxLength: 128 } },
          },
        },
      },
      async (req, reply) => {
        const auth = await credentials()
        if (!(await verifyPassword(req.body.current, auth.hash))) throw new AppError(400, 'INVALID_CREDENTIALS', 'Joriy parol notöğri')
        const next = req.body.next
        if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) throw badRequest('Yangi parolda harf va raqam bölsin')
        const version = auth.version + 1
        await setSetting('auth', { hash: await hashPassword(next), version, changedAt: new Date() })
        // every other open admin session ends; this one gets a fresh cookie
        setCookie(reply, await sign(version))
        return { ok: true }
      },
    )

    /* ───────── card payments (receipts to check, the cards buyers pay to) ───────── */
    await paymentAdminRoutes(admin)
    await siteAdminRoutes(admin)
    await promoAdminRoutes(admin, app.ctx.promos)

    /* ───────── statistics ───────── */

    const daysQuery = { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365, default: 30 } } }
    admin.get('/stats', { schema: { hide: true, querystring: daysQuery } }, async (req) => analytics.stats(req.query.days))
    admin.get('/users/stats', { schema: { hide: true, querystring: daysQuery } }, async (req) => analytics.userStats(req.query.days))

    // what users created: by kind, by AI, file tools, and who made the most (days = 0: all time)
    admin.get(
      '/content',
      {
        schema: {
          hide: true,
          querystring: {
            type: 'object',
            properties: {
              days: { type: 'integer', minimum: 0, maximum: 3650, default: 30 },
              kind: { type: 'string', enum: ['', ...CREATION_KINDS], default: '' },
              limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            },
          },
        },
      },
      async (req) => content.stats(req.query.days, { kind: req.query.kind || null, limit: req.query.limit }),
    )

    /* ───────── users ───────── */

    const SORTS = {
      registered: sql`coalesce(u.registered_at, u.created_at)`,
      seen: sql`u.last_seen_at`,
      coins: sql`u.coins`,
      name: sql`lower(u.name)`,
      created: sql`(SELECT count(*) FROM creations c WHERE c.user_id = u.id)`,
    }

    admin.get(
      '/users',
      {
        schema: {
          hide: true,
          querystring: {
            type: 'object',
            properties: {
              q: { type: 'string', maxLength: 120 },
              status: { type: 'string', enum: ['registered', 'guests', 'all', 'premium', 'active'], default: 'registered' },
              method: { type: 'string', enum: ['', 'password', 'google', 'telegram'], default: '' },
              sort: { type: 'string', enum: Object.keys(SORTS), default: 'registered' },
              order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 5000, default: 25 },
            },
          },
        },
      },
      async (req) => {
        const { q, status, method, sort, order, page, limit } = req.query
        const where = [sql`true`]
        if (status === 'registered') where.push(sql`NOT u.is_guest`)
        if (status === 'guests') where.push(sql`u.is_guest`)
        if (status === 'premium') where.push(sql`u.coins_purchased_at IS NOT NULL`)
        if (status === 'active') where.push(sql`NOT u.is_guest AND u.last_seen_at >= now() - interval '1 day'`)
        if (method) where.push(sql`u.signup_method = ${method}`)
        if (q?.trim()) {
          const like = `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`
          where.push(sql`(u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone ILIKE ${like} OR u.telegram_username ILIKE ${like} OR u.id = ${q.trim()})`)
        }
        const w = sql.join(where, sql` AND `)
        const dir = order === 'asc' ? sql`ASC` : sql`DESC`
        const rows = (
          await db.execute(sql`
            SELECT u.*, count(*) OVER() AS total,
              (SELECT count(*) FROM designs d WHERE d.user_id = u.id) AS designs,
              (SELECT count(*) FROM documents d WHERE d.user_id = u.id) AS documents,
              (SELECT count(*) FROM files f WHERE f.user_id = u.id) AS files,
              (SELECT count(*) FROM creations c WHERE c.user_id = u.id) AS created
            FROM users u WHERE ${w}
            ORDER BY ${SORTS[sort]} ${dir} NULLS LAST, u.id
            LIMIT ${limit} OFFSET ${(page - 1) * limit}`)
        ).rows ?? []
        return { total: Number(rows[0]?.total ?? 0), page, limit, items: rows.map(listItem) }
      },
    )

    admin.get('/users/:id', { schema: { hide: true, params: { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } } } }, async (req) => {
      const [u] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1)
      if (!u) throw notFound('Foydalanuvçi topilmadi')
      const id = u.id
      const [sess, ledger, dsg, docs, nFiles, nJobs, bio, journey, created, nDesigns, nDocs] = await Promise.all([
        db.select().from(sessions).where(eq(sessions.userId, id)).orderBy(desc(sessions.createdAt)).limit(15),
        db.select().from(coinLedger).where(eq(coinLedger.userId, id)).orderBy(desc(coinLedger.createdAt)).limit(30),
        db.select({ id: designs.id, name: designs.name, kind: designs.kind, updatedAt: designs.updatedAt }).from(designs).where(eq(designs.userId, id)).orderBy(desc(designs.updatedAt)).limit(12),
        db.select({ id: documents.id, name: documents.name, kind: documents.kind, updatedAt: documents.updatedAt }).from(documents).where(eq(documents.userId, id)).orderBy(desc(documents.updatedAt)).limit(12),
        db.select({ n: count() }).from(files).where(eq(files.userId, id)),
        db.select({ n: count() }).from(jobs).where(eq(jobs.userId, id)),
        db.select({ slug: bioPages.slug, views: bioPages.views }).from(bioPages).where(eq(bioPages.userId, id)),
        analytics.journey(u.visitorId),
        content.forUser(id),
        db.select({ n: count() }).from(designs).where(eq(designs.userId, id)),
        db.select({ n: count() }).from(documents).where(eq(documents.userId, id)),
      ])
      return {
        user: detail(u),
        sessions: sess.map((s) => ({ ip: s.ip, ...parseUa(s.userAgent ?? ''), userAgent: s.userAgent, createdAt: s.createdAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt })),
        ledger: ledger.map((l) => ({ delta: l.delta, balance: l.balance, reason: l.reason, item: l.item, createdAt: l.createdAt, note: l.meta?.note ?? null })),
        designs: dsg,
        documents: docs,
        counts: { files: nFiles[0]?.n ?? 0, jobs: nJobs[0]?.n ?? 0, designs: nDesigns[0]?.n ?? 0, documents: nDocs[0]?.n ?? 0 },
        created,
        bio,
        journey,
      }
    })

    admin.post(
      '/users/:id/coins',
      {
        schema: {
          hide: true,
          params: { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } },
          body: {
            type: 'object',
            required: ['amount'],
            additionalProperties: false,
            properties: { amount: { type: 'integer', minimum: -100000, maximum: 100000 }, note: { type: 'string', maxLength: 200 } },
          },
        },
      },
      async (req) => {
        const [u] = await db.select({ id: users.id, coins: users.coins }).from(users).where(eq(users.id, req.params.id)).limit(1)
        if (!u) throw notFound('Foydalanuvçi topilmadi')
        const { amount, note } = req.body
        if (!amount) throw badRequest('Miqdorni kiriting')
        if (u.coins + amount < 0) throw badRequest(`Balans yetmaydi: hozir ${u.coins} coin`)
        return coins.grant(u.id, amount, 'admin', note?.trim() || null)
      },
    )

    /* ───────── QalamChat messages ───────── */

    admin.get(
      '/chat',
      {
        schema: {
          hide: true,
          querystring: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['new', 'done', 'all'], default: 'new' },
              topic: { type: 'string', maxLength: 20 },
              q: { type: 'string', maxLength: 100 },
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
            },
          },
        },
      },
      async (req) => {
        const { status, topic, q, page, limit } = req.query
        const m = supportMessages
        const where = [
          status !== 'all' && eq(m.status, status),
          topic && eq(m.topic, topic),
          q?.trim() &&
            or(
              ...[m.message, m.contactName, m.contactPhone, m.contactEmail, users.name, users.email, users.phone, users.telegramUsername].map((col) => ilike(col, `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`)),
              eq(m.userId, q.trim()),
            ),
        ].filter(Boolean)
        const cond = where.length ? and(...where) : undefined
        const [rows, [{ total }], byStatus] = await Promise.all([
          db
            .select({ m, u: { id: users.id, name: users.name, email: users.email, phone: users.phone, telegramUsername: users.telegramUsername, avatarKey: users.avatarKey, avatarAt: users.avatarAt, signupMethod: users.signupMethod, isGuest: users.isGuest } })
            .from(m)
            .leftJoin(users, eq(users.id, m.userId))
            .where(cond)
            .orderBy(desc(m.createdAt))
            .limit(limit)
            .offset((page - 1) * limit),
          db.select({ total: count() }).from(m).leftJoin(users, eq(users.id, m.userId)).where(cond),
          db.select({ status: m.status, n: count() }).from(m).groupBy(m.status),
        ])
        const counts = { new: 0, done: 0 }
        byStatus.forEach((r) => (counts[r.status] = Number(r.n)))
        return {
          total: Number(total),
          page,
          limit,
          counts: { ...counts, all: counts.new + counts.done },
          items: rows.map(({ m: x, u }) => ({
            id: x.id,
            topic: x.topic,
            message: x.message,
            contact: { name: x.contactName, phone: x.contactPhone, email: x.contactEmail },
            lang: x.lang,
            status: x.status,
            createdAt: x.createdAt,
            doneAt: x.doneAt,
            user: u?.id
              ? { id: u.id, name: u.name, email: u.email, phone: u.phone, telegramUsername: u.telegramUsername, avatarUrl: avatarOf(u.id, u.avatarKey, u.avatarAt), method: u.signupMethod, isGuest: u.isGuest }
              : null,
          })),
        }
      },
    )

    admin.patch(
      '/chat/:id',
      {
        schema: {
          hide: true,
          params: { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } },
          body: { type: 'object', required: ['status'], additionalProperties: false, properties: { status: { type: 'string', enum: ['new', 'done'] }, notify: { type: 'boolean' } } },
        },
      },
      async (req) => {
        const done = req.body.status === 'done'
        // only a new → done change tells the user (re-marking or undoing stays quiet)
        const [before] = await db.select({ status: supportMessages.status }).from(supportMessages).where(eq(supportMessages.id, req.params.id)).limit(1)
        const [row] = await db
          .update(supportMessages)
          .set({ status: req.body.status, doneAt: done ? new Date() : null })
          .where(eq(supportMessages.id, req.params.id))
          .returning({ id: supportMessages.id, status: supportMessages.status, doneAt: supportMessages.doneAt, userId: supportMessages.userId, topic: supportMessages.topic })
        if (!row) throw notFound('Xabar topilmadi')
        if (done && before?.status === 'new' && req.body.notify !== false) await notifier.send(row.userId, 'support.done', { topic: row.topic })
        return { id: row.id, status: row.status, doneAt: row.doneAt }
      },
    )

    /* ───────── announcements (Bildirişnomalar for everyone) ───────── */

    admin.get('/notifications', { schema: { hide: true } }, async () => {
      const rows = await db
        .select({ n: notifications, reads: count(notificationReads.userId) })
        .from(notifications)
        .leftJoin(notificationReads, eq(notificationReads.notificationId, notifications.id))
        .where(isNull(notifications.userId))
        .groupBy(notifications.id)
        .orderBy(desc(notifications.createdAt))
        .limit(100)
      return { items: rows.map(({ n, reads }) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: n.createdAt, reads: Number(reads) })) }
    })

    admin.post(
      '/notifications',
      {
        schema: {
          hide: true,
          body: {
            type: 'object',
            required: ['title', 'body'],
            additionalProperties: false,
            properties: {
              title: { type: 'string', minLength: 2, maxLength: 120 },
              body: { type: 'string', minLength: 2, maxLength: 1000 },
              link: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
      async (req) => {
        const link = req.body.link?.trim() || null
        if (link && !/^(https:\/\/|#\/)/.test(link)) throw badRequest('Havola https:// yoki #/ bilan boşlanişi kerak')
        const row = await notifier.announce({ title: req.body.title.trim(), body: req.body.body.trim(), link })
        return { id: row.id, title: row.title, body: row.body, link: row.link, createdAt: row.createdAt, reads: 0 }
      },
    )

    admin.delete('/notifications/:id', { schema: { hide: true, params: { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } } } }, async (req) => {
      const [row] = await db
        .delete(notifications)
        .where(and(eq(notifications.id, req.params.id), isNull(notifications.userId)))
        .returning({ id: notifications.id })
      if (!row) throw notFound('Bildirişnoma topilmadi')
      return { ok: true }
    })

    /* ───────── site settings ───────── */

    admin.get('/settings', { schema: { hide: true } }, async () => {
      const site = (await getSetting('site')) ?? {}
      const auth = await getSetting('auth')
      return { ...site, siteUrl: config.appUrl, passwordChangedAt: auth?.changedAt ?? null }
    })

    admin.patch(
      '/settings',
      {
        schema: {
          hide: true,
          body: {
            type: 'object',
            additionalProperties: false,
            properties: { gscFile: { type: 'string', maxLength: 64 }, ga4Id: { type: 'string', maxLength: 24 } },
          },
        },
      },
      async (req) => {
        const site = (await getSetting('site')) ?? {}
        const { gscFile, ga4Id } = req.body
        if (gscFile !== undefined) {
          // accept the whole file name, or the code Google shows inside it
          const f = gscFile.trim().replace(/^google-site-verification:\s*/i, '')
          if (f && !GSC_FILE.test(f)) throw badRequest('Fayl nomi "google1234abcd….html" körinişida bölişi kerak')
          site.gscFile = f || null
        }
        if (ga4Id !== undefined) {
          const g = ga4Id.trim().toUpperCase()
          if (g && !GA4_ID.test(g)) throw badRequest('Google Analytics ID "G-XXXXXXXXXX" körinişida bölişi kerak')
          site.ga4Id = g || null
        }
        await setSetting('site', site)
        siteCache = null
        return { ...site, siteUrl: config.appUrl }
      },
    )
  })
}

/* ───────── public: beacon + verification file ───────── */

let siteCache = null
async function siteSettings(db) {
  if (siteCache && Date.now() - siteCache.at < 60_000) return siteCache.value
  const [row] = await db.select().from(adminSettings).where(eq(adminSettings.key, 'site')).limit(1)
  siteCache = { at: Date.now(), value: row?.value ?? {} }
  return siteCache.value
}

/** POST /api/v1/t — one page view. Answers with the Google Analytics id, if one is set. */
export async function trackRoutes(app) {
  app.post(
    '/t',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        hide: true,
        body: {
          type: 'object',
          properties: {
            v: { type: 'string', maxLength: 64 },
            s: { type: 'string', maxLength: 64 },
            p: { type: 'string', maxLength: 300 },
            r: { type: 'string', maxLength: 1000 },
            e: { type: 'boolean' },
            tz: { type: 'string', maxLength: 64 },
            l: { type: 'string', maxLength: 35 },
            sc: { type: 'string', maxLength: 20 },
            u: { type: 'object', additionalProperties: { type: 'string', maxLength: 120 } },
          },
        },
      },
    },
    async (req) => {
      await app.ctx.analytics.track(req.body ?? {}, req).catch((err) => req.log.warn({ err }, 'track failed'))
      const site = await siteSettings(app.ctx.db)
      return { ga: site.ga4Id ?? null }
    },
  )
}

/** GET /google….html — Search Console "HTML file" verification. */
export async function verificationRoutes(app, opts = {}) {
  app.get('/:file', { schema: { hide: true } }, async (req, reply) => {
    const file = req.params.file
    // not a verification file name: another root page (an invitation) may own the address
    if (!GSC_FILE.test(file) && opts.fallback) return opts.fallback(req, reply)
    const site = await siteSettings(app.ctx.db)
    if (!GSC_FILE.test(file) || site.gscFile !== file) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Bunday manzil yöq' } })
    return reply.type('text/html; charset=utf-8').send(`google-site-verification: ${file}`)
  })
}

export { createAnalytics, VISITOR_COOKIE }

/* ───────── shapes ───────── */

const avatarOf = avatarUrlOf

function listItem(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    telegramUsername: r.telegram_username,
    avatarUrl: avatarOf(r.id, r.avatar_key, r.avatar_at),
    isGuest: r.is_guest,
    method: r.signup_method,
    linked: { google: Boolean(r.google_id), telegram: Boolean(r.telegram_id), password: Boolean(r.password_hash) },
    phoneVerified: Boolean(r.phone_verified_at),
    coins: Number(r.coins ?? 0),
    premium: Boolean(r.coins_purchased_at),
    country: r.signup_country,
    device: r.signup_device,
    browser: r.signup_browser,
    os: r.signup_os,
    source: r.signup_source,
    referrer: r.signup_referrer,
    ip: r.signup_ip,
    registeredAt: r.registered_at,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    counts: { designs: Number(r.designs ?? 0), documents: Number(r.documents ?? 0), files: Number(r.files ?? 0), created: Number(r.created ?? 0) },
  }
}

function detail(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    telegramUsername: u.telegramUsername,
    telegramId: u.telegramId,
    avatarUrl: avatarOf(u.id, u.avatarKey, u.avatarAt),
    isGuest: u.isGuest,
    role: u.role,
    plan: u.plan,
    method: u.signupMethod,
    linked: { google: Boolean(u.googleId), telegram: Boolean(u.telegramId), password: Boolean(u.passwordHash) },
    phoneVerifiedAt: u.phoneVerifiedAt,
    coins: u.coins,
    premium: Boolean(u.coinsPurchasedAt),
    coinsPurchasedAt: u.coinsPurchasedAt,
    profile: u.profile ?? {},
    signup: {
      ip: u.signupIp,
      country: u.signupCountry,
      device: u.signupDevice,
      browser: u.signupBrowser,
      os: u.signupOs,
      source: u.signupSource,
      referrer: u.signupReferrer,
      utm: u.signupUtm,
      landing: u.signupLanding,
    },
    registeredAt: u.registeredAt,
    createdAt: u.createdAt,
    lastSeenAt: u.lastSeenAt,
  }
}

