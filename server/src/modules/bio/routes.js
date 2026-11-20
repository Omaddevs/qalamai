// Link-in-Bio publishing.
//   Authenticated:  /api/v1/bio …  check a slug, publish/update, unpublish, stats, HTML export
//   Public:         /b/:slug        the page itself;  /b/:slug/l/:linkId  counted redirect
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '../../db/index.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { BIO_FONTS, BIO_THEMES, BUTTON_STYLES, RESERVED_SLUGS, SLUG_RE, SOCIAL_IDS, normalizeUrl } from '../../../../shared/bio.js'
import { hasContent, renderBioPage } from './render.js'

const { bioPages } = schema

const bioData = z.object({
  name: z.string().trim().max(60).default(''),
  bio: z.string().trim().max(300).default(''),
  avatar: z
    .string()
    .max(600_000, 'Rasm juda katta')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Rasm formati notöğri')
    .nullable()
    .default(null),
  theme: z.enum(Object.keys(BIO_THEMES)).default('qalam'),
  buttonStyle: z.enum(Object.keys(BUTTON_STYLES)).default('fill'),
  font: z.enum(Object.keys(BIO_FONTS)).nullable().default(null),
  links: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
        title: z.string().trim().min(1).max(80),
        url: z.string().trim().max(500).refine((u) => normalizeUrl(u), 'Havola notöğri — masalan: https://sayt.uz'),
        highlight: z.boolean().default(false),
        enabled: z.boolean().default(true),
      }),
    )
    .max(30)
    .default([]),
  socials: z.partialRecord(z.enum(SOCIAL_IDS), z.string().trim().max(200)).default({}),
})

// Version 2 (element-by-element design). The renderer only ever turns style values into CSS through
// strict colour / number / enum checks, so the style object is bounded by size, not field by field.
const dataImage = (max) => z.string().max(max, 'Rasm juda katta').regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, 'Rasm formati notöğri')
const bioData2 = z.object({
  v: z.literal(2),
  name: z.string().trim().max(60).default(''),
  role: z.string().trim().max(80).default(''),
  headline: z.string().trim().max(120).default(''),
  brand: z.string().trim().max(40).default(''),
  bio: z.string().trim().max(300).default(''),
  footer: z.string().trim().max(120).default(''),
  avatar: dataImage(600_000).nullable().default(null),
  links: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
        title: z.string().trim().min(1).max(80),
        sub: z.string().trim().max(80).optional(),
        url: z.string().trim().max(500).refine((u) => normalizeUrl(u), 'Havola notöğri — masalan: https://sayt.uz'),
        icon: z.string().max(24).nullable().optional(),
        bg: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
        highlight: z.boolean().default(false),
        enabled: z.boolean().default(true),
      }),
    )
    .max(30)
    .default([]),
  socials: z.partialRecord(z.enum(SOCIAL_IDS), z.string().trim().max(200)).default({}),
  stats: z.array(z.object({ id: z.string().max(24), value: z.string().trim().max(16), label: z.string().trim().max(30), icon: z.string().max(24).nullable().optional() })).max(4).default([]),
  cta: z.object({ title: z.string().trim().max(60), text: z.string().trim().max(120).optional(), button: z.string().trim().max(30).optional(), url: z.string().trim().max(500).optional(), placeholder: z.string().trim().max(40).optional() }).nullable().default(null),
  style: z
    .record(z.string(), z.any())
    .refine((st) => {
      const { page = {}, ...rest } = st
      const { image, ...pageRest } = page ?? {}
      if (image != null && !dataImage(1_200_000).safeParse(image).success) return false
      return JSON.stringify({ ...rest, page: pageRest }).length < 60_000
    }, 'Dizayn sozlamalari notöğri')
    .default({}),
})
// the version decides the schema — a v2 design that fails validation must be refused, never
// silently saved as a stripped-down v1 page
const anyBioData = { safeParse: (d) => (d?.v === 2 ? bioData2 : bioData).safeParse(d) }

function checkSlug(raw) {
  const slug = String(raw ?? '').trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return { slug, ok: false, reason: '3–30 belgi: kiçik lotin harflari, raqam, «-» yoki «_»' }
  if (RESERVED_SLUGS.has(slug)) return { slug, ok: false, reason: 'Bu nom band qilingan' }
  return { slug, ok: true }
}

const publicUrl = (req, slug) => `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers['x-forwarded-host'] ?? req.headers.host}/b/${slug}`

/** /api/v1/bio */
export async function bioApiRoutes(app) {
  const { db } = app.ctx
  app.addHook('preHandler', app.authenticate)

  const pageOut = (req, row) => ({
    slug: row.slug,
    designId: row.designId,
    url: publicUrl(req, row.slug),
    views: row.views,
    clicks: Object.values(row.clicks ?? {}).reduce((a, b) => a + b, 0),
    clicksByLink: row.clicks ?? {},
    updatedAt: row.updatedAt,
  })

  app.get('/', { schema: { tags: ['bio'], summary: 'Mening sahifalarim' } }, async (req) => {
    const rows = await db.select().from(bioPages).where(eq(bioPages.userId, req.user.id))
    return { pages: rows.map((r) => pageOut(req, r)) }
  })

  app.get('/check/:slug', { schema: { tags: ['bio'], summary: 'Manzil böşmi?' } }, async (req) => {
    const c = checkSlug(req.params.slug)
    if (!c.ok) return { slug: c.slug, available: false, reason: c.reason }
    const [row] = await db.select({ userId: bioPages.userId, designId: bioPages.designId }).from(bioPages).where(eq(bioPages.slug, c.slug)).limit(1)
    const mine = row?.userId === req.user.id
    return { slug: c.slug, available: !row || mine, mine, designId: mine ? row.designId : undefined, reason: row && !mine ? 'Bu manzil band' : undefined }
  })

  app.get('/design/:designId', { schema: { tags: ['bio'], summary: 'Dizaynga boğlangan sahifa' } }, async (req) => {
    const [row] = await db
      .select()
      .from(bioPages)
      .where(and(eq(bioPages.userId, req.user.id), eq(bioPages.designId, req.params.designId)))
      .limit(1)
    return { page: row ? pageOut(req, row) : null }
  })

  app.put(
    '/:slug',
    {
      bodyLimit: 4 * 1048576,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['bio'],
        summary: 'Sahifani eʼlon qiliş yoki yangilaş',
        body: { type: 'object', required: ['designId', 'data'], properties: { designId: { type: 'string', maxLength: 80 }, data: { type: 'object' } } },
      },
    },
    async (req) => {
      const c = checkSlug(req.params.slug)
      if (!c.ok) throw badRequest(c.reason)
      const parsed = anyBioData.safeParse(req.body.data)
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Maʼlumotlar notöğri', parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })))

      const [taken] = await db.select().from(bioPages).where(eq(bioPages.slug, c.slug)).limit(1)
      if (taken && (taken.userId !== req.user.id || taken.designId !== req.body.designId)) {
        if (taken.userId !== req.user.id) throw conflict('Bu manzil band — boşqasini tanlang')
        throw conflict('Bu manzil boşqa sahifangizda işlatilgan')
      }
      const [existing] = await db
        .select()
        .from(bioPages)
        .where(and(eq(bioPages.userId, req.user.id), eq(bioPages.designId, req.body.designId)))
        .limit(1)
      let row
      try {
        if (existing) {
          ;[row] = await db.update(bioPages).set({ slug: c.slug, data: parsed.data, updatedAt: new Date() }).where(eq(bioPages.id, existing.id)).returning()
        } else {
          ;[row] = await db.insert(bioPages).values({ id: newId(ID_PREFIX.bio), userId: req.user.id, slug: c.slug, designId: req.body.designId, data: parsed.data }).returning()
        }
      } catch (err) {
        if (String(err.code) === '23505' || /unique/i.test(err.message)) throw conflict('Bu manzil band — boşqasini tanlang')
        throw err
      }
      return pageOut(req, row)
    },
  )

  app.delete('/:slug', { schema: { tags: ['bio'], summary: 'Sahifani olib taşlaş' } }, async (req) => {
    const rows = await db
      .delete(bioPages)
      .where(and(eq(bioPages.userId, req.user.id), eq(bioPages.slug, String(req.params.slug).toLowerCase())))
      .returning({ id: bioPages.id })
    if (!rows.length) throw notFound('Sahifa topilmadi')
    return { ok: true }
  })

  app.post(
    '/export',
    { bodyLimit: 4 * 1048576, schema: { tags: ['bio'], summary: 'Bitta faylli HTML (yuklab oliş uçun)', body: { type: 'object', required: ['data'], properties: { data: { type: 'object' } } } } },
    async (req, reply) => {
      const parsed = anyBioData.safeParse(req.body.data)
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Maʼlumotlar notöğri')
      reply.header('Content-Type', 'text/html; charset=utf-8').header('Content-Disposition', 'attachment; filename="link-in-bio.html"')
      return renderBioPage(parsed.data, { track: false, homeUrl: 'https://qalam.uz' })
    },
  )
}

/** Public pages: /b/:slug  ·  sitemap: /b/sitemap.xml */
export async function bioPublicRoutes(app) {
  const { db, config } = app.ctx
  const CSP = "default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  // Canonical addresses always use the public domain (APP_URL), never the host a request came through.
  const pageUrl = (slug) => `${config.appUrl}/b/${slug}`
  const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  /*
   * Sitemap of published pages. One file holds up to 50 000 URLs (Google's limit); past that
   * /b/sitemap.xml becomes an index of /b/sitemap-1.xml, /b/sitemap-2.xml … Unpublished
   * (deleted) pages disappear on the next request because the list is read from the database.
   */
  const PER_SITEMAP = 50_000
  const urlset = async (page) => {
    const rows = await db
      .select({ slug: bioPages.slug, data: bioPages.data, updatedAt: bioPages.updatedAt })
      .from(bioPages)
      .orderBy(asc(bioPages.createdAt), asc(bioPages.id))
      .limit(PER_SITEMAP)
      .offset((page - 1) * PER_SITEMAP)
    const urls = rows
      .filter((r) => hasContent(r.data))
      .map((r) => `  <url><loc>${xml(pageUrl(r.slug))}</loc><lastmod>${new Date(r.updatedAt).toISOString()}</lastmod></url>`)
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}${urls.length ? '\n' : ''}</urlset>\n`
  }
  const sendXml = (reply, body) => reply.header('Content-Type', 'application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=3600').send(body)

  app.get('/sitemap.xml', { schema: { hide: true } }, async (req, reply) => {
    const [{ n }] = await db.select({ n: count() }).from(bioPages)
    if (n <= PER_SITEMAP) return sendXml(reply, await urlset(1))
    const parts = Array.from({ length: Math.ceil(n / PER_SITEMAP) }, (_, i) => `  <sitemap><loc>${xml(`${config.appUrl}/b/sitemap-${i + 1}.xml`)}</loc></sitemap>`)
    return sendXml(reply, `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.join('\n')}\n</sitemapindex>\n`)
  })

  app.get('/sitemap-:part.xml', { schema: { hide: true } }, async (req, reply) => {
    const part = Number(req.params.part)
    const [{ n }] = await db.select({ n: count() }).from(bioPages)
    if (!Number.isInteger(part) || part < 1 || (part - 1) * PER_SITEMAP >= Math.max(n, 1)) throw notFound('Sitemap topilmadi')
    return sendXml(reply, await urlset(part))
  })

  // One address per page: "/b/Name" and "/b/name/" permanently move to "/b/name".
  app.get('/:slug/', { schema: { hide: true } }, async (req, reply) => reply.redirect(`/b/${encodeURIComponent(String(req.params.slug).toLowerCase())}`, 301))

  app.get('/:slug', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } }, schema: { hide: true } }, async (req, reply) => {
    const raw = String(req.params.slug)
    const slug = raw.toLowerCase()
    if (raw !== slug && SLUG_RE.test(slug)) {
      const q = req.url.indexOf('?')
      return reply.redirect(`/b/${slug}${q === -1 ? '' : req.url.slice(q)}`, 301)
    }
    const [row] = SLUG_RE.test(slug) ? await db.select().from(bioPages).where(eq(bioPages.slug, slug)).limit(1) : []
    reply.header('Content-Type', 'text/html; charset=utf-8').header('Content-Security-Policy', CSP).header('X-Content-Type-Options', 'nosniff')
    if (!row) {
      reply.status(404)
      return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sahifa topilmadi</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#fbfaf7;color:#16181d"><div style="text-align:center"><h1 style="font-size:22px">Sahifa topilmadi</h1><p style="color:#6b717a">Bu manzilda hali sahifa yöq.</p><p><a href="/" style="color:inherit">QalamAI bosh sahifasi</a></p></div></body>`
    }
    const preview = req.query.preview !== undefined
    const noindex = preview || !hasContent(row.data)
    if (!preview) db.update(bioPages).set({ views: sql`${bioPages.views} + 1` }).where(eq(bioPages.id, row.id)).catch(() => {})
    if (noindex) reply.header('X-Robots-Tag', 'noindex')
    reply.header('Cache-Control', 'public, max-age=30')
    return renderBioPage(row.data, { slug, track: true, homeUrl: `${config.appUrl}/`, canonicalUrl: pageUrl(slug), noindex })
  })

  app.get('/:slug/l/:linkId', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } }, schema: { hide: true } }, async (req, reply) => {
    const slug = String(req.params.slug).toLowerCase()
    const [row] = SLUG_RE.test(slug) ? await db.select().from(bioPages).where(eq(bioPages.slug, slug)).limit(1) : []
    const link = row?.data.links?.find((l) => l.id === req.params.linkId && l.enabled !== false)
    const target = link && normalizeUrl(link.url)
    if (!target) return reply.redirect(`/b/${encodeURIComponent(slug)}`, 302)
    db.update(bioPages)
      .set({ clicks: sql`jsonb_set(${bioPages.clicks}, ${`{${link.id}}`}::text[], to_jsonb(coalesce((${bioPages.clicks} ->> ${link.id})::int, 0) + 1))` })
      .where(eq(bioPages.id, row.id))
      .catch(() => {})
    reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex')
    return reply.redirect(target, 302)
  })
}
