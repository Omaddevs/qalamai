// Admin side of the site content (registered inside the admin panel's guarded scope):
//   GET/POST         /admin/site/news           all posts (drafts too) · create
//   PUT/DELETE       /admin/site/news/:id       edit · delete
//   GET/POST         /admin/site/partners       ·  PUT/DELETE /admin/site/partners/:id
//   GET/POST         /admin/site/team           ·  PUT/DELETE /admin/site/team/:id
//   PUT              /admin/site/{partners,team}/order   { ids } in the order to show
//   POST             /admin/site/media          { image: data URL, kind: cover | logo | photo } → { key, url }
// Pictures are uploaded first (media), then saved on the item by key; replaced or deleted items take
// their old pictures out of storage.
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { CONTENT_LANGS, SLUG_RE, slugify } from '../../../../shared/siteContent.js'
import { mediaUrl, memberOut, newsFull, partnerOut } from './routes.js'

const { siteNews, sitePartners, siteTeam } = schema

const idParams = { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } }
const str = (max) => ({ type: 'string', maxLength: max })
/** { uz: {fields}, ru: {...}, en: {...} } with the given fields. */
const i18nSchema = (fields) => ({
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    CONTENT_LANGS.map((l) => [l, { type: 'object', additionalProperties: false, properties: Object.fromEntries(Object.entries(fields).map(([f, max]) => [f, str(max)])) }]),
  ),
})
const mediaKey = { anyOf: [{ type: 'string', pattern: '^site/img_[A-Za-z0-9]{16}\\.webp$' }, { type: 'null' }] }

const NEWS_FIELDS = { title: 160, excerpt: 400, body: 40000 }
// tracks: one direction per line "Mobil ilovalar: Flutter, React Native"; stats: "20+ | Tayyor loyiha" per line
const TEAM_FIELDS = { role: 120, badge: 80, bio: 600, tracks: 1500, stats: 400 }
const PARTNER_FIELDS = { about: 400 }
const LINK_KEYS = ['telegram', 'linkedin', 'instagram', 'github', 'site']

/** Trimmed texts; empty languages dropped; Uzbek `required` fields must be there. */
function cleanI18n(i18n, required = []) {
  const out = {}
  for (const l of CONTENT_LANGS) {
    const t = i18n?.[l]
    if (!t) continue
    const v = Object.fromEntries(Object.entries(t).map(([k, x]) => [k, String(x ?? '').trim()]).filter(([, x]) => x))
    if (Object.keys(v).length) out[l] = v
  }
  for (const f of required) if (!out.uz?.[f]) throw badRequest(`Özbekça "${f}" maydoni şart`)
  return out
}

const httpsUrl = (u, field) => {
  const v = String(u ?? '').trim()
  if (!v) return null
  let url
  try {
    url = new URL(/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`)
  } catch {
    throw badRequest(`${field}: havola notöğri`)
  }
  if (!/^https?:$/.test(url.protocol)) throw badRequest(`${field}: havola http(s) bölsin`)
  return url.href
}

const PRESETS = {
  // news cover: wide, sharp enough for a hero
  cover: (img) => img.resize(1600, 1000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }),
  // partner logo: keeps transparency
  logo: (img) => img.resize(640, 320, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }),
  // team photo: square crop around the face area (top)
  photo: (img) => img.resize(800, 800, { fit: 'cover', position: 'attention' }).webp({ quality: 84 }),
}

/**
 * @param {import('fastify').FastifyInstance} admin  the guarded admin scope
 */
export async function siteAdminRoutes(admin) {
  const { db, storage } = admin.ctx
  const drop = (key) => key && storage.remove(key).catch(() => {})

  admin.post(
    '/site/media',
    {
      bodyLimit: 12 * 1048576,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        hide: true,
        body: {
          type: 'object',
          required: ['image', 'kind'],
          additionalProperties: false,
          properties: { image: { type: 'string', maxLength: 12 * 1048576 }, kind: { type: 'string', enum: Object.keys(PRESETS) } },
        },
      },
    },
    async (req) => {
      const m = /^data:image\/(jpeg|png|webp|gif|avif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(req.body.image)
      if (!m) throw badRequest('Rasm formati notöğri (JPG, PNG, WebP, SVG)')
      let out
      try {
        const img = sharp(Buffer.from(m[2], 'base64'), { limitInputPixels: 60e6, density: m[1] === 'svg+xml' ? 300 : undefined }).rotate()
        out = await PRESETS[req.body.kind](img).toBuffer()
      } catch {
        throw badRequest('Rasmni öqib bölmadi')
      }
      const file = `${newId(ID_PREFIX.media)}.webp`
      const key = `site/${file}`
      const tmp = `${storage.tmpDir}/${file}`
      await writeFile(tmp, out)
      await storage.putFile(key, tmp)
      return { key, url: mediaUrl(key) }
    },
  )

  /* ───────── news ───────── */

  const newsBody = {
    type: 'object',
    additionalProperties: false,
    properties: {
      slug: str(90),
      i18n: i18nSchema(NEWS_FIELDS),
      coverKey: mediaKey,
      published: { type: 'boolean' },
      publishedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
    },
  }

  /** A free slug: the one asked for (or made from the Uzbek title), with -2, -3 … when taken. */
  async function freeSlug(wanted, title, exceptId) {
    const base = (wanted ? slugify(wanted) : slugify(title)) || `yangilik-${Date.now().toString(36)}`
    if (!SLUG_RE.test(base)) throw badRequest('Manzil (slug) faqat lotin harflari, raqam va "-" dan iborat bölsin')
    for (let i = 1; i < 100; i++) {
      const s = i === 1 ? base : `${base}-${i}`
      const cond = exceptId ? and(eq(siteNews.slug, s), ne(siteNews.id, exceptId)) : eq(siteNews.slug, s)
      const [hit] = await db.select({ id: siteNews.id }).from(siteNews).where(cond).limit(1)
      if (!hit) return s
    }
    throw conflict('Bu manzil band')
  }

  const adminNews = (n) => ({ ...newsFull(n), coverKey: n.coverKey, published: n.published, createdAt: n.createdAt })

  admin.get('/site/news', { schema: { hide: true } }, async () => {
    const rows = await db.select().from(siteNews).orderBy(desc(siteNews.createdAt))
    return { items: rows.map(adminNews) }
  })

  admin.post('/site/news', { schema: { hide: true, body: { ...newsBody, required: ['i18n'] } } }, async (req) => {
    const b = req.body
    const i18n = cleanI18n(b.i18n, ['title'])
    const now = new Date()
    const [n] = await db
      .insert(siteNews)
      .values({
        id: newId(ID_PREFIX.news),
        slug: await freeSlug(b.slug, i18n.uz.title),
        i18n,
        coverKey: b.coverKey ?? null,
        published: Boolean(b.published),
        publishedAt: b.publishedAt ? new Date(b.publishedAt) : b.published ? now : null,
      })
      .returning()
    return { item: adminNews(n) }
  })

  admin.put('/site/news/:id', { schema: { hide: true, params: idParams, body: newsBody } }, async (req) => {
    const [old] = await db.select().from(siteNews).where(eq(siteNews.id, req.params.id)).limit(1)
    if (!old) throw notFound('Yangilik topilmadi')
    const b = req.body
    const patch = { updatedAt: new Date() }
    if (b.i18n) patch.i18n = cleanI18n(b.i18n, ['title'])
    if (b.slug !== undefined && b.slug !== old.slug) patch.slug = await freeSlug(b.slug, (patch.i18n ?? old.i18n).uz?.title, old.id)
    if (b.coverKey !== undefined) patch.coverKey = b.coverKey
    if (b.published !== undefined) patch.published = b.published
    if (b.publishedAt !== undefined) patch.publishedAt = b.publishedAt ? new Date(b.publishedAt) : null
    // published for the first time without a date: now
    if ((patch.published ?? old.published) && !(patch.publishedAt ?? old.publishedAt)) patch.publishedAt = new Date()
    const [n] = await db.update(siteNews).set(patch).where(eq(siteNews.id, old.id)).returning()
    if (patch.coverKey !== undefined && old.coverKey !== n.coverKey) drop(old.coverKey)
    return { item: adminNews(n) }
  })

  admin.delete('/site/news/:id', { schema: { hide: true, params: idParams } }, async (req) => {
    const [n] = await db.delete(siteNews).where(eq(siteNews.id, req.params.id)).returning()
    if (!n) throw notFound('Yangilik topilmadi')
    drop(n.coverKey)
    return { ok: true }
  })

  /* ───────── team and partners: same shape ───────── */

  function listRoutes(path, table, { fields, required, out, picture, extra }) {
    const body = {
      type: 'object',
      additionalProperties: false,
      properties: { name: str(120), i18n: i18nSchema(fields), [picture]: mediaKey, visible: { type: 'boolean' }, ...extra.schema },
    }
    const adminOut = (row) => ({ ...out(row), [picture]: row[picture], visible: row.visible, sort: row.sort })
    const all = () => db.select().from(table).orderBy(asc(table.sort), asc(table.createdAt))

    admin.get(`/site/${path}`, { schema: { hide: true } }, async () => ({ items: (await all()).map(adminOut) }))

    admin.post(`/site/${path}`, { schema: { hide: true, body: { ...body, required: ['name'] } } }, async (req) => {
      const b = req.body
      const name = String(b.name).trim()
      if (!name) throw badRequest('Nomi şart')
      const last = await all()
      const [row] = await db
        .insert(table)
        .values({
          id: newId(path === 'team' ? ID_PREFIX.member : ID_PREFIX.partner),
          name,
          i18n: cleanI18n(b.i18n, required),
          [picture]: b[picture] ?? null,
          visible: b.visible ?? true,
          sort: (last.at(-1)?.sort ?? 0) + 1,
          ...extra.values(b),
        })
        .returning()
      return { item: adminOut(row) }
    })

    admin.put(`/site/${path}/:id`, { schema: { hide: true, params: idParams, body } }, async (req) => {
      const [old] = await db.select().from(table).where(eq(table.id, req.params.id)).limit(1)
      if (!old) throw notFound('Topilmadi')
      const b = req.body
      const patch = { updatedAt: new Date(), ...extra.values(b, true) }
      if (b.name !== undefined) {
        if (!b.name.trim()) throw badRequest('Nomi şart')
        patch.name = b.name.trim()
      }
      if (b.i18n) patch.i18n = cleanI18n(b.i18n, required)
      if (b[picture] !== undefined) patch[picture] = b[picture]
      if (b.visible !== undefined) patch.visible = b.visible
      const [row] = await db.update(table).set(patch).where(eq(table.id, old.id)).returning()
      if (b[picture] !== undefined && old[picture] !== row[picture]) drop(old[picture])
      return { item: adminOut(row) }
    })

    admin.delete(`/site/${path}/:id`, { schema: { hide: true, params: idParams } }, async (req) => {
      const [row] = await db.delete(table).where(eq(table.id, req.params.id)).returning()
      if (!row) throw notFound('Topilmadi')
      drop(row[picture])
      return { ok: true }
    })

    admin.put(
      `/site/${path}/order`,
      { schema: { hide: true, body: { type: 'object', required: ['ids'], additionalProperties: false, properties: { ids: { type: 'array', maxItems: 500, items: str(64) } } } } },
      async (req) => {
        await db.transaction(async (tx) => {
          for (const [i, id] of req.body.ids.entries()) await tx.update(table).set({ sort: i + 1 }).where(eq(table.id, id))
        })
        return { items: (await all()).map(adminOut) }
      },
    )
  }

  listRoutes('team', siteTeam, {
    fields: TEAM_FIELDS,
    required: ['role'],
    out: memberOut,
    picture: 'photoKey',
    extra: {
      schema: { links: { type: 'object', additionalProperties: false, properties: Object.fromEntries(LINK_KEYS.map((k) => [k, str(300)])) } },
      values: (b, patch) => {
        if (b.links === undefined) return patch ? {} : { links: {} }
        const links = {}
        for (const k of LINK_KEYS) {
          const v = String(b.links[k] ?? '').trim()
          if (!v) continue
          // a Telegram / Instagram username is fine too
          links[k] = (k === 'telegram' || k === 'instagram') && /^@?[A-Za-z0-9_.]{3,40}$/.test(v)
            ? `https://${k === 'telegram' ? 't.me' : 'instagram.com'}/${v.replace(/^@/, '')}`
            : httpsUrl(v, k)
        }
        return { links }
      },
    },
  })

  listRoutes('partners', sitePartners, {
    fields: PARTNER_FIELDS,
    required: [],
    out: partnerOut,
    picture: 'logoKey',
    extra: {
      schema: { url: { anyOf: [str(500), { type: 'null' }] } },
      values: (b, patch) => (b.url === undefined ? (patch ? {} : { url: null }) : { url: httpsUrl(b.url, 'Sayt') }),
    },
  })
}

