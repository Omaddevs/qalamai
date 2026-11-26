// Public site content, read by the landing pages (/haqimizda, /jamoa, /yangiliklar, /hamkorlar):
//   GET /api/v1/site/news            published posts, newest first (title + excerpt in every language)
//   GET /api/v1/site/news/:slug      one published post with its body, plus a few more to read
//   GET /api/v1/site/team            visible team members in their order
//   GET /api/v1/site/partners        visible partners in their order
//   GET /api/v1/site/summary         latest news, team and partners at once (the "About" page)
//   GET /api/v1/site/media/:file     a picture uploaded in the admin panel (WebP, never changes)
// Everything is edited in the admin panel (admin.js).
import { and, asc, count, desc, eq, lte, ne } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { notFound } from '../../lib/errors.js'
import { SLUG_RE } from '../../../../shared/siteContent.js'

const { siteNews, sitePartners, siteTeam } = schema

export const MEDIA_RE = /^img_[A-Za-z0-9]{16}\.webp$/
export const mediaUrl = (key) => (key ? `/api/v1/site/media/${key.slice('site/'.length)}` : null)

/** Only the short texts of each language (no body): what a list needs. */
const shortI18n = (i18n) =>
  Object.fromEntries(Object.entries(i18n ?? {}).map(([l, t]) => [l, { title: t?.title ?? '', excerpt: t?.excerpt ?? '' }]))

export const newsCard = (n) => ({ id: n.id, slug: n.slug, i18n: shortI18n(n.i18n), cover: mediaUrl(n.coverKey), publishedAt: n.publishedAt })
export const newsFull = (n) => ({ ...newsCard(n), i18n: n.i18n, updatedAt: n.updatedAt })
export const memberOut = (m) => ({ id: m.id, name: m.name, i18n: m.i18n, photo: mediaUrl(m.photoKey), links: m.links ?? {} })
export const partnerOut = (p) => ({ id: p.id, name: p.name, i18n: p.i18n, logo: mediaUrl(p.logoKey), url: p.url })

/** Published = switched on and its date has come (a post can be scheduled). */
export const isLive = () => and(eq(siteNews.published, true), lte(siteNews.publishedAt, new Date()))

export async function siteRoutes(app) {
  const { db, storage } = app.ctx
  const cache = (reply, s = 60) => reply.header('cache-control', `public, max-age=${s}`)

  const listNews = (limit, offset = 0) =>
    db.select().from(siteNews).where(isLive()).orderBy(desc(siteNews.publishedAt)).limit(limit).offset(offset)
  const listTeam = () => db.select().from(siteTeam).where(eq(siteTeam.visible, true)).orderBy(asc(siteTeam.sort), asc(siteTeam.createdAt))
  const listPartners = () => db.select().from(sitePartners).where(eq(sitePartners.visible, true)).orderBy(asc(sitePartners.sort), asc(sitePartners.createdAt))

  app.get(
    '/news',
    {
      schema: {
        tags: ['site'],
        summary: 'Yangiliklar röyxati', // i18n-ignore (the client words errors by code)
        querystring: {
          type: 'object',
          properties: { page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 12 } },
        },
      },
    },
    async (req, reply) => {
      const { page, limit } = req.query
      const [rows, [{ total }]] = await Promise.all([listNews(limit, (page - 1) * limit), db.select({ total: count() }).from(siteNews).where(isLive())])
      cache(reply)
      return { items: rows.map(newsCard), total: Number(total), page, limit }
    },
  )

  app.get(
    '/news/:slug',
    { schema: { tags: ['site'], summary: 'Bitta yangilik', params: { type: 'object', properties: { slug: { type: 'string', maxLength: 100 } } } } },
    async (req, reply) => {
      const slug = String(req.params.slug).toLowerCase()
      if (!SLUG_RE.test(slug)) throw notFound('Yangilik topilmadi') // i18n-ignore (the client words errors by code)
      const [n] = await db.select().from(siteNews).where(and(eq(siteNews.slug, slug), isLive())).limit(1)
      if (!n) throw notFound('Yangilik topilmadi') // i18n-ignore (the client words errors by code)
      const more = await db.select().from(siteNews).where(and(isLive(), ne(siteNews.id, n.id))).orderBy(desc(siteNews.publishedAt)).limit(3)
      cache(reply)
      return { item: newsFull(n), more: more.map(newsCard) }
    },
  )

  app.get('/team', { schema: { tags: ['site'], summary: 'Jamoa' } }, async (req, reply) => {
    cache(reply)
    return { items: (await listTeam()).map(memberOut) }
  })

  app.get('/partners', { schema: { tags: ['site'], summary: 'Hamkorlar' } }, async (req, reply) => {
    cache(reply)
    return { items: (await listPartners()).map(partnerOut) }
  })

  app.get('/summary', { schema: { tags: ['site'], summary: 'Biz haqimizda sahifasi uçun: oxirgi yangiliklar, jamoa, hamkorlar' } }, async (req, reply) => { // i18n-ignore (the client words errors by code)
    const [news, team, partners, [{ total }]] = await Promise.all([listNews(3), listTeam(), listPartners(), db.select({ total: count() }).from(siteNews).where(isLive())])
    cache(reply)
    return { news: news.map(newsCard), newsTotal: Number(total), team: team.map(memberOut), partners: partners.map(partnerOut) }
  })

  app.get(
    '/media/:file',
    { schema: { hide: true, params: { type: 'object', properties: { file: { type: 'string', maxLength: 40 } } } } },
    async (req, reply) => {
      const file = String(req.params.file)
      const key = `site/${file}`
      if (!MEDIA_RE.test(file) || !(await storage.exists(key))) throw notFound('Rasm topilmadi') // i18n-ignore (the client words errors by code)
      // a new picture always gets a new name, so a stored one never changes
      return reply.header('content-type', 'image/webp').header('cache-control', 'public, max-age=31536000, immutable').send(storage.stream(key))
    },
  )
}
