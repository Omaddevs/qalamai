// Site analytics: the page-view beacon (public) and the numbers the admin panel shows.
// Days are counted in Tashkent time (UTC+5, no daylight saving).
import { eq, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { BOT_UA, classifyReferrer, clientIp, countryOf, parseUa } from './detect.js'

const { pageViews, users } = schema

/** created_at as Tashkent wall-clock time. */
const LOCAL = (col = 'created_at') => sql.raw(`(${col} AT TIME ZONE 'UTC' + interval '5 hours')`)
export const VISITOR_COOKIE = 'qalam_vid'

const rowsOf = (r) => r.rows ?? r
const num = (v) => Number(v ?? 0)
const clean = (v, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const ID = /^[A-Za-z0-9_-]{8,64}$/

/** Start of the Tashkent day `daysAgo` days back, as a UTC Date. */
function localDayStart(daysAgo = 0) {
  const shifted = new Date(Date.now() + 5 * 3600_000)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - daysAgo * 86400_000 - 5 * 3600_000)
}

export function createAnalytics({ db, config }) {
  const ownHost = new URL(config.appUrl).hostname

  /** Store one page view. Returns false for bots and malformed beacons. */
  async function track(body, req) {
    const ua = req.headers['user-agent'] ?? ''
    if (!ua || BOT_UA.test(ua)) return false
    if (!ID.test(body?.v ?? '') || !ID.test(body?.s ?? '')) return false
    const path = clean(body.p, 200)
    if (!path || path.startsWith('/admin')) return false
    const ref = body.e ? classifyReferrer(body.r, req.hostname || ownHost) : { source: null, referrer: null, searchEngine: null, searchTerm: null }
    const utm = body.u && typeof body.u === 'object' ? body.u : {}
    const timezone = clean(body.tz, 64)
    const lang = clean(body.l, 16)
    const { device, browser, os } = parseUa(ua)
    await db.insert(pageViews).values({
      visitorId: body.v,
      sessionId: body.s,
      path,
      entry: Boolean(body.e),
      ...ref,
      // utm_source wins over "direct" (links shared in messengers often lose the referrer)
      ...(body.e && clean(utm.source) && ref.source === 'direct' ? { source: /telegram|instagram|facebook|tiktok|youtube|twitter|vk/i.test(utm.source) ? 'social' : 'referral' } : {}),
      utmSource: clean(utm.source, 80),
      utmMedium: clean(utm.medium, 80),
      utmCampaign: clean(utm.campaign, 80),
      country: (req.headers['cf-ipcountry'] && String(req.headers['cf-ipcountry']).slice(0, 2)) || countryOf(timezone, lang),
      timezone,
      lang,
      device,
      browser,
      os,
      screen: clean(body.sc, 20),
    })
    return true
  }

  /**
   * Fill the signup columns of an account that just stopped being a guest:
   * method, IP, device, and the first visit of the browser it signed up from.
   */
  async function recordSignup(user, req, method) {
    const vid = req.cookies?.[VISITOR_COOKIE]
    const visitorId = vid && ID.test(vid) ? vid : null
    let first = null
    if (visitorId) {
      const r = await db.execute(sql`
        SELECT path, source, referrer, utm_source, utm_medium, utm_campaign, country FROM page_views
        WHERE visitor_id = ${visitorId} ORDER BY entry DESC, (source IS NOT NULL AND source <> 'direct') DESC, created_at ASC LIMIT 1`)
      // the visit that brought them: an entry view with a real source (search, social …) if there is one, else the first
      first = rowsOf(r)[0] ?? null
    }
    const ua = parseUa(req.headers['user-agent'] ?? '')
    const utm = first?.utm_source ? { source: first.utm_source, medium: first.utm_medium, campaign: first.utm_campaign } : null
    await db
      .update(users)
      .set({
        registeredAt: new Date(),
        signupMethod: method,
        signupIp: clientIp(req),
        signupCountry: first?.country ?? (req.headers['cf-ipcountry'] ? String(req.headers['cf-ipcountry']).slice(0, 2) : null),
        signupDevice: ua.device,
        signupBrowser: ua.browser,
        signupOs: ua.os,
        signupSource: first?.source ?? 'direct',
        signupReferrer: first?.referrer ?? null,
        signupUtm: utm,
        signupLanding: first?.path ?? null,
        visitorId,
      })
      .where(eq(users.id, user.id))
  }

  /** Everything the Statistika page shows for the last `days` days (and the period before, for deltas). */
  async function stats(days) {
    const from = localDayStart(days - 1)
    const prevFrom = localDayStart(days * 2 - 1)
    const today = localDayStart(0)
    const q = async (query) => rowsOf(await db.execute(query))
    const one = async (query) => (await q(query))[0] ?? {}

    const period = (a, b) => sql`created_at >= ${a.toISOString()} AND created_at < ${b.toISOString()}`
    const now = new Date(Date.now() + 60_000)
    const cur = period(from, now)

    const [k, kPrev, kToday, online, u, uPrev, uToday, totals] = await Promise.all([
      one(sql`SELECT count(*) AS views, count(DISTINCT visitor_id) AS visitors, count(DISTINCT session_id) AS sessions FROM page_views WHERE ${cur}`),
      one(sql`SELECT count(*) AS views, count(DISTINCT visitor_id) AS visitors, count(DISTINCT session_id) AS sessions FROM page_views WHERE ${period(prevFrom, from)}`),
      one(sql`SELECT count(*) AS views, count(DISTINCT visitor_id) AS visitors FROM page_views WHERE ${period(today, now)}`),
      one(sql`SELECT count(DISTINCT visitor_id) AS n FROM page_views WHERE created_at >= ${new Date(Date.now() - 5 * 60_000).toISOString()}`),
      one(sql`SELECT count(*) AS n FROM users WHERE registered_at >= ${from.toISOString()}`),
      one(sql`SELECT count(*) AS n FROM users WHERE registered_at >= ${prevFrom.toISOString()} AND registered_at < ${from.toISOString()}`),
      one(sql`SELECT count(*) AS n FROM users WHERE registered_at >= ${today.toISOString()}`),
      one(sql`SELECT count(*) FILTER (WHERE NOT is_guest) AS users, count(*) FILTER (WHERE is_guest) AS guests,
        count(*) FILTER (WHERE NOT is_guest AND last_seen_at >= now() - interval '1 day') AS active24,
        count(*) FILTER (WHERE NOT is_guest AND last_seen_at >= now() - interval '7 days') AS active7,
        count(*) FILTER (WHERE coins_purchased_at IS NOT NULL) AS buyers FROM users`),
    ])

    const bounce = await one(sql`SELECT count(*) FILTER (WHERE n = 1) AS one, count(*) AS total FROM (SELECT session_id, count(*) AS n FROM page_views WHERE ${cur} GROUP BY session_id) s`)

    const [daily, dailySignups, countries, sources, referrers, engines, terms, pages, devices, browsers, oses, langs, heat, utm, entries] = await Promise.all([
      q(sql`SELECT to_char(${LOCAL()}, 'YYYY-MM-DD') AS day, count(*) AS views, count(DISTINCT visitor_id) AS visitors FROM page_views WHERE ${cur} GROUP BY 1`),
      q(sql`SELECT to_char(${LOCAL('registered_at')}, 'YYYY-MM-DD') AS day, count(*) AS n FROM users WHERE registered_at >= ${from.toISOString()} GROUP BY 1`),
      q(sql`SELECT coalesce(country, '??') AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`),
      q(sql`SELECT source AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} AND entry AND source IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`),
      q(sql`SELECT referrer AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} AND entry AND referrer IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      q(sql`SELECT search_engine AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} AND entry AND search_engine IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      q(sql`SELECT search_term AS key, count(*) AS n FROM page_views WHERE ${cur} AND search_term IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      q(sql`SELECT path AS key, count(*) AS n, count(DISTINCT visitor_id) AS visitors FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`),
      q(sql`SELECT device AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC`),
      q(sql`SELECT browser AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      q(sql`SELECT os AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      q(sql`SELECT lower(split_part(lang, '-', 1)) AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} AND lang IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      q(sql`SELECT extract(isodow FROM ${LOCAL()})::int AS dow, extract(hour FROM ${LOCAL()})::int AS hour, count(*) AS n FROM page_views WHERE ${cur} GROUP BY 1, 2`),
      q(sql`SELECT utm_source || coalesce(' / ' || utm_campaign, '') AS key, count(DISTINCT visitor_id) AS n FROM page_views WHERE ${cur} AND entry AND utm_source IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      q(sql`SELECT path AS key, count(*) AS n FROM page_views WHERE ${cur} AND entry GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
    ])

    // one point per day, zeros included
    const byDay = new Map(daily.map((r) => [r.day, r]))
    const suByDay = new Map(dailySignups.map((r) => [r.day, num(r.n)]))
    const series = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(localDayStart(i).getTime() + 5 * 3600_000).toISOString().slice(0, 10)
      series.push({ day: d, visitors: num(byDay.get(d)?.visitors), views: num(byDay.get(d)?.views), signups: suByDay.get(d) ?? 0 })
    }
    const list = (rows) => rows.map((r) => ({ key: r.key ?? '—', n: num(r.n), ...(r.visitors != null ? { visitors: num(r.visitors) } : {}) }))

    const visitors = num(k.visitors)
    const signups = num(u.n)
    return {
      range: { days, from, to: now },
      kpi: {
        visitors,
        views: num(k.views),
        sessions: num(k.sessions),
        signups,
        conversion: visitors ? signups / visitors : 0,
        bounce: num(bounce.total) ? num(bounce.one) / num(bounce.total) : 0,
        viewsPerVisit: num(k.sessions) ? num(k.views) / num(k.sessions) : 0,
        prev: { visitors: num(kPrev.visitors), views: num(kPrev.views), sessions: num(kPrev.sessions), signups: num(uPrev.n) },
        today: { visitors: num(kToday.visitors), views: num(kToday.views), signups: num(uToday.n) },
        online: num(online.n),
        users: num(totals.users),
        guests: num(totals.guests),
        active24: num(totals.active24),
        active7: num(totals.active7),
        buyers: num(totals.buyers),
      },
      series,
      countries: list(countries),
      sources: list(sources),
      referrers: list(referrers),
      searchEngines: list(engines),
      searchTerms: list(terms),
      pages: list(pages),
      entryPages: list(entries),
      devices: list(devices),
      browsers: list(browsers),
      os: list(oses),
      langs: list(langs),
      utm: list(utm),
      heatmap: heat.map((r) => ({ dow: num(r.dow), hour: num(r.hour), n: num(r.n) })),
    }
  }

  /** Sign-up breakdowns for the Foydalanuvçilar page. */
  async function userStats(days) {
    const from = localDayStart(days - 1).toISOString()
    const q = async (query) => rowsOf(await db.execute(query))
    const list = (rows) => rows.map((r) => ({ key: r.key ?? '—', n: num(r.n) }))
    const [methods, countries, sources, devices, hours, daily, totals] = await Promise.all([
      q(sql`SELECT coalesce(signup_method, 'password') AS key, count(*) AS n FROM users WHERE registered_at >= ${from} GROUP BY 1 ORDER BY 2 DESC`),
      q(sql`SELECT coalesce(signup_country, '??') AS key, count(*) AS n FROM users WHERE registered_at >= ${from} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      q(sql`SELECT coalesce(signup_referrer, signup_source, 'direct') AS key, count(*) AS n FROM users WHERE registered_at >= ${from} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      q(sql`SELECT coalesce(signup_device, '—') AS key, count(*) AS n FROM users WHERE registered_at >= ${from} GROUP BY 1 ORDER BY 2 DESC`),
      q(sql`SELECT extract(hour FROM ${LOCAL('registered_at')})::int AS hour, count(*) AS n FROM users WHERE registered_at >= ${from} GROUP BY 1`),
      q(sql`SELECT to_char(${LOCAL('registered_at')}, 'YYYY-MM-DD') AS day, count(*) AS n FROM users WHERE registered_at >= ${from} GROUP BY 1`),
      q(sql`SELECT count(*) FILTER (WHERE NOT is_guest) AS users,
        count(*) FILTER (WHERE registered_at >= ${localDayStart(0).toISOString()}) AS today,
        count(*) FILTER (WHERE registered_at >= ${from}) AS period,
        count(*) FILTER (WHERE NOT is_guest AND last_seen_at >= now() - interval '1 day') AS active24,
        count(*) FILTER (WHERE phone_verified_at IS NOT NULL) AS verified,
        count(*) FILTER (WHERE coins_purchased_at IS NOT NULL) AS buyers FROM users`),
    ])
    const byDay = new Map(daily.map((r) => [r.day, num(r.n)]))
    const series = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(localDayStart(i).getTime() + 5 * 3600_000).toISOString().slice(0, 10)
      series.push({ day: d, signups: byDay.get(d) ?? 0 })
    }
    const byHour = Array.from({ length: 24 }, (_, h) => num(hours.find((r) => num(r.hour) === h)?.n))
    const t = totals[0] ?? {}
    return {
      totals: { users: num(t.users), today: num(t.today), period: num(t.period), active24: num(t.active24), verified: num(t.verified), buyers: num(t.buyers) },
      methods: list(methods),
      countries: list(countries),
      sources: list(sources),
      devices: list(devices),
      byHour,
      series,
    }
  }

  /** The pages one visitor opened (oldest first). */
  async function journey(visitorId, limit = 60) {
    if (!visitorId) return []
    const rows = rowsOf(
      await db.execute(sql`SELECT path, created_at, source, referrer, country, device, browser, os FROM page_views WHERE visitor_id = ${visitorId} ORDER BY created_at ASC LIMIT ${limit}`),
    )
    return rows.map((r) => ({ path: r.path, at: r.created_at, source: r.source, referrer: r.referrer, country: r.country, device: r.device, browser: r.browser, os: r.os }))
  }

  return { track, recordSignup, stats, userStats, journey }
}
