// Taklifnoma — invitation websites published at qalamai.uz/<slug>.
//   Authenticated  /api/v1/invites …  check a slug, publish/update, unpublish, upload pictures and music, guests' answers
//   Public         /api/v1/i/media/:file      an uploaded picture or song (Range requests, so phones can play music)
//                  /api/v1/i/:slug/rsvp        a guest's answer
//                  /:slug                      the page itself (nginx sends unknown single-segment addresses here)
// The page is drawn by shared/invite.js — the same renderer the studio previews with.
import { writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { badRequest, conflict, notFound, tooLarge } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { checkInviteSlug, invitePreviewImage, inviteTitle, normalizeInvite, renderInvitePage } from '../../../../shared/invite.js'

const { invitePages, inviteRsvps } = schema

const MEDIA_FILE = /^(img|aud)_[A-Za-z0-9]{16}\.(webp|mp3|m4a|ogg)$/
const AUDIO_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg' }
const MAX_IMAGE = 15 * 1048576
const MAX_AUDIO = 12 * 1048576
const MAX_RSVPS = 3000

const SLUG_REASON = {
  format: '3–40 belgi: kiçik lotin harflari, raqam va «-»',
  reserved: 'Bu nom sayt uçun band qilingan',
}

export const mediaUrl = (file) => `/api/v1/i/media/${file}`

/** Kind of an uploaded song by its first bytes; null when it is not a song we can serve. */
function audioKind(buf) {
  if (buf.length < 12) return null
  if (buf.subarray(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3'
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'm4a'
  if (buf.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg'
  return null
}

/** /api/v1/invites */
export async function inviteApiRoutes(app) {
  const { db, storage, config } = app.ctx
  app.addHook('preHandler', app.authenticate)

  const pageUrl = (slug) => `${config.appUrl}/${slug}`
  const pageOut = async (row) => {
    const [stats] = await db
      .select({
        answers: count(),
        yes: sql`count(*) filter (where ${inviteRsvps.answer} = 'yes')`.mapWith(Number),
        guests: sql`coalesce(sum(${inviteRsvps.guests}) filter (where ${inviteRsvps.answer} = 'yes'), 0)`.mapWith(Number),
      })
      .from(inviteRsvps)
      .where(eq(inviteRsvps.pageId, row.id))
    return { slug: row.slug, designId: row.designId, url: pageUrl(row.slug), views: row.views, updatedAt: row.updatedAt, rsvp: stats }
  }
  const mine = async (req, slug) => {
    const [row] = await db
      .select()
      .from(invitePages)
      .where(and(eq(invitePages.userId, req.user.id), eq(invitePages.slug, String(slug).toLowerCase())))
      .limit(1)
    if (!row) throw notFound('Taklifnoma topilmadi')
    return row
  }

  app.get('/check/:slug', { schema: { tags: ['invites'], summary: 'Manzil böşmi?' } }, async (req) => {
    const c = checkInviteSlug(req.params.slug)
    if (!c.ok) return { slug: c.slug, available: false, reason: SLUG_REASON[c.code], code: c.code }
    const [row] = await db.select({ userId: invitePages.userId, designId: invitePages.designId }).from(invitePages).where(eq(invitePages.slug, c.slug)).limit(1)
    const own = row?.userId === req.user.id
    return { slug: c.slug, available: !row || own, mine: own, designId: own ? row.designId : undefined, code: row && !own ? 'taken' : undefined, reason: row && !own ? 'Bu manzil band' : undefined }
  })

  app.get('/design/:designId', { schema: { tags: ['invites'], summary: 'Dizaynga boğlangan taklifnoma' } }, async (req) => {
    const [row] = await db
      .select()
      .from(invitePages)
      .where(and(eq(invitePages.userId, req.user.id), eq(invitePages.designId, req.params.designId)))
      .limit(1)
    return { page: row ? await pageOut(row) : null }
  })

  app.put(
    '/:slug',
    {
      bodyLimit: 1048576,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['invites'],
        summary: 'Taklifnomani eʼlon qiliş yoki yangilaş',
        body: { type: 'object', required: ['designId', 'data'], properties: { designId: { type: 'string', maxLength: 80 }, data: { type: 'object' } } },
      },
    },
    async (req) => {
      const c = checkInviteSlug(req.params.slug)
      if (!c.ok) throw badRequest(SLUG_REASON[c.code])
      const data = normalizeInvite(req.body.data)
      if (JSON.stringify(data).length > 400_000) throw badRequest('Taklifnoma juda katta')

      const [taken] = await db.select().from(invitePages).where(eq(invitePages.slug, c.slug)).limit(1)
      if (taken && (taken.userId !== req.user.id || taken.designId !== req.body.designId)) {
        if (taken.userId !== req.user.id) throw conflict('Bu manzil band — boşqasini tanlang')
        throw conflict('Bu manzil boşqa taklifnomangizda işlatilgan')
      }
      const [existing] = await db
        .select()
        .from(invitePages)
        .where(and(eq(invitePages.userId, req.user.id), eq(invitePages.designId, req.body.designId)))
        .limit(1)
      let row
      try {
        if (existing) {
          ;[row] = await db.update(invitePages).set({ slug: c.slug, data, updatedAt: new Date() }).where(eq(invitePages.id, existing.id)).returning()
        } else {
          ;[row] = await db.insert(invitePages).values({ id: newId(ID_PREFIX.invite), userId: req.user.id, slug: c.slug, designId: req.body.designId, data }).returning()
        }
      } catch (err) {
        if (String(err.code) === '23505' || /unique/i.test(err.message)) throw conflict('Bu manzil band — boşqasini tanlang')
        throw err
      }
      return pageOut(row)
    },
  )

  app.delete('/:slug', { schema: { tags: ['invites'], summary: 'Taklifnomani olib taşlaş' } }, async (req) => {
    const row = await mine(req, req.params.slug)
    await db.delete(invitePages).where(eq(invitePages.id, row.id))
    return { ok: true }
  })

  app.get('/:slug/rsvps', { schema: { tags: ['invites'], summary: 'Mehmonlar javoblari' } }, async (req) => {
    const row = await mine(req, req.params.slug)
    const rows = await db.select().from(inviteRsvps).where(eq(inviteRsvps.pageId, row.id)).orderBy(desc(inviteRsvps.createdAt)).limit(MAX_RSVPS)
    return { rsvps: rows.map((r) => ({ id: r.id, name: r.name, answer: r.answer, guests: r.guests, note: r.note, createdAt: r.createdAt })) }
  })

  app.delete('/:slug/rsvps/:id', { schema: { tags: ['invites'], summary: 'Javobni öçiriş' } }, async (req) => {
    const row = await mine(req, req.params.slug)
    await db.delete(inviteRsvps).where(and(eq(inviteRsvps.pageId, row.id), eq(inviteRsvps.id, String(req.params.id))))
    return { ok: true }
  })

  // A picture (→ WebP, at most 1600 px) or a song (MP3 / M4A / OGG, as is), sent as multipart field "file".
  app.post('/media', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } }, schema: { tags: ['invites'], summary: 'Rasm yoki musiqa yuklaş' } }, async (req) => {
    const part = await req.file({ limits: { fileSize: MAX_IMAGE, files: 1 } })
    if (!part) throw badRequest('Fayl tanlanmagan')
    const buf = await part.toBuffer().catch((err) => {
      throw err?.code === 'FST_REQ_FILE_TOO_LARGE' ? tooLarge('Fayl hajmi 15 MB dan oşmasin') : err
    })
    let file
    let out
    if (/^audio\//.test(part.mimetype) || /\.(mp3|m4a|aac|ogg)$/i.test(part.filename ?? '')) {
      if (buf.length > MAX_AUDIO) throw tooLarge('Musiqa 12 MB dan oşmasin')
      const kind = audioKind(buf)
      if (!kind) throw badRequest('Musiqa MP3, M4A yoki OGG formatida bölsin')
      file = `aud_${newId('x').slice(2)}.${kind}`
      out = buf
    } else {
      try {
        out = await sharp(buf, { limitInputPixels: 60e6 }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      } catch {
        throw badRequest('Rasmni öqib bölmadi (JPG, PNG, WebP, HEIC)')
      }
      file = `img_${newId('x').slice(2)}.webp`
    }
    const tmp = `${storage.tmpDir}/${file}`
    await writeFile(tmp, out)
    await storage.putFile(`inv/${file}`, tmp)
    return { url: mediaUrl(file), size: out.length }
  })
}

/** /api/v1/i — open to everyone (guests). */
export async function invitePublicApiRoutes(app) {
  const { db, storage } = app.ctx

  app.get('/media/:file', { config: { rateLimit: { max: 1200, timeWindow: '1 minute' } }, schema: { hide: true } }, async (req, reply) => {
    const file = String(req.params.file)
    const key = `inv/${file}`
    if (!MEDIA_FILE.test(file) || !(await storage.exists(key))) throw notFound('Fayl topilmadi')
    const ext = file.split('.').pop()
    const size = await storage.size(key)
    reply
      .header('content-type', ext === 'webp' ? 'image/webp' : AUDIO_TYPES[ext])
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('accept-ranges', 'bytes')
    // phones (Safari above all) play audio only from servers that answer byte ranges
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
      let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
      if (start >= size || start > end) return reply.status(416).header('content-range', `bytes */${size}`).send()
      return reply
        .status(206)
        .header('content-range', `bytes ${start}-${end}/${size}`)
        .header('content-length', end - start + 1)
        .send(storage.stream(key, { start, end }))
    }
    return reply.header('content-length', size).send(storage.stream(key))
  })

  app.post(
    '/:slug/rsvp',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        hide: true,
        body: {
          type: 'object',
          required: ['name', 'answer'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            answer: { type: 'string', enum: ['yes', 'no'] },
            guests: { type: 'integer', minimum: 1, maximum: 20 },
            note: { type: 'string', maxLength: 300 },
          },
        },
      },
    },
    async (req) => {
      const slug = String(req.params.slug).toLowerCase()
      const [page] = checkInviteSlug(slug).ok ? await db.select({ id: invitePages.id }).from(invitePages).where(eq(invitePages.slug, slug)).limit(1) : []
      if (!page) throw notFound('Taklifnoma topilmadi')
      const [{ n }] = await db.select({ n: count() }).from(inviteRsvps).where(eq(inviteRsvps.pageId, page.id))
      if (n >= MAX_RSVPS) throw conflict('Javoblar soni çegarasiga yetdi')
      const name = req.body.name.replace(/\s+/g, ' ').trim()
      if (!name) throw badRequest('Ismingizni yozing')
      await db.insert(inviteRsvps).values({
        id: newId(ID_PREFIX.rsvp),
        pageId: page.id,
        name,
        answer: req.body.answer,
        guests: req.body.answer === 'yes' ? (req.body.guests ?? 1) : 0,
        note: (req.body.note ?? '').trim(),
      })
      return { ok: true }
    },
  )
}

/**
 * The page at the site root: GET /:slug. Answers 404 for anything that is not a published invitation,
 * so nginx can show the site's own "page not found" (proxy_intercept_errors).
 */
export function createInvitePage(app) {
  const { db, config } = app.ctx
  return async function invitePage(req, reply) {
    const raw = String(req.params.slug ?? req.params.file ?? '')
    const slug = raw.toLowerCase()
    const c = checkInviteSlug(slug)
    if (!c.ok) return reply.status(404).type('text/plain; charset=utf-8').send('Not found')
    if (raw !== slug) {
      const q = req.url.indexOf('?')
      return reply.redirect(`/${slug}${q === -1 ? '' : req.url.slice(q)}`, 301)
    }
    const [row] = await db.select().from(invitePages).where(eq(invitePages.slug, slug)).limit(1)
    if (!row) return reply.status(404).type('text/plain; charset=utf-8').send('Not found')
    const preview = req.query?.preview !== undefined
    if (!preview) db.update(invitePages).set({ views: sql`${invitePages.views} + 1` }).where(eq(invitePages.id, row.id)).catch(() => {})
    const nonce = randomBytes(16).toString('base64')
    const img = invitePreviewImage(row.data)
    reply
      .header('content-type', 'text/html; charset=utf-8')
      .header(
        'content-security-policy',
        `default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      )
      .header('x-content-type-options', 'nosniff')
      .header('referrer-policy', 'strict-origin-when-cross-origin')
      // a family's invitation: open to whoever has the link, never in search results
      .header('x-robots-tag', 'noindex, nofollow')
      .header('cache-control', 'no-cache')
    return renderInvitePage(row.data, {
      nonce,
      slug,
      rsvpUrl: `/api/v1/i/${slug}/rsvp`,
      canonicalUrl: `${config.appUrl}/${slug}`,
      ogImage: img ? `${config.appUrl}${img}` : `${config.appUrl}/og-image.png`,
      credit: `${config.appUrl}/`,
      noindex: true,
      title: inviteTitle(row.data),
    })
  }
}
