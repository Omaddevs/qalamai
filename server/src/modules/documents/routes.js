// Rich-text documents (Fayl muharriri) and slide designs (dizayn muharriri).
// The frontend keeps working offline in localStorage; these endpoints let it sync
// and move a guest's work into a real account.
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, notFound } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { randomToken } from '../../lib/crypto.js'
import { recordCreation } from '../admin/content.js'

const MAX_HTML = 5 * 1048576
// Server ids (doc_…, dsn_…) and the ids the browser made offline (f_…, d-…-…) are both accepted.
const idParam = () => ({ type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{3,80}$' } } })

/** Shared CRUD for a user-owned table. */
function crud(app, { table, prefix, tag, label, bodyProps, required, toRow, toPublic, source }) {
  const { db } = app.ctx
  const owned = (req) => and(eq(table.id, req.params.id), eq(table.userId, req.user.id))
  // every new item goes into the creations log (admin counts); a repeat for the same id is ignored
  const created = (row) => row && recordCreation(db, { userId: row.userId, itemId: row.id, kind: row.kind, source })

  // Keyset pages ordered by id, so the browser can walk the WHOLE list: sync treats an id missing
  // from the list as deleted, so a silently truncated list would delete real work.
  app.get(
    '/',
    {
      schema: {
        tags: [tag],
        summary: `${label} röyxati (sahifalab: cursor → nextCursor)`,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { cursor: { type: 'string', maxLength: 80 }, limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 } },
        },
      },
    },
    async (req) => {
      const { cursor, limit } = req.query
      const mine = eq(table.userId, req.user.id)
      const rows = await db
        .select()
        .from(table)
        .where(cursor ? and(mine, gt(table.id, cursor)) : mine)
        .orderBy(asc(table.id))
        .limit(limit + 1)
      const page = rows.slice(0, limit)
      return { items: page.map((r) => toPublic(r, { summary: true })), nextCursor: rows.length > limit ? page[page.length - 1].id : null }
    },
  )

  app.get('/:id', { schema: { tags: [tag], summary: `${label} (töliq)`, params: idParam(prefix) } }, async (req) => {
    const [row] = await db.select().from(table).where(owned(req)).limit(1)
    if (!row) throw notFound(`${label} topilmadi`)
    return toPublic(row)
  })

  app.post('/', { bodyLimit: MAX_HTML * 2, schema: { tags: [tag], summary: `${label} yaratish`, body: { type: 'object', required, additionalProperties: false, properties: bodyProps } } }, async (req, reply) => {
    const [row] = await db.insert(table).values({ id: newId(prefix), userId: req.user.id, ...toRow(req.body) }).returning()
    await created(row)
    reply.status(201)
    return toPublic(row)
  })

  app.patch(
    '/:id',
    { bodyLimit: MAX_HTML * 2, schema: { tags: [tag], summary: `${label}ni yangilaş`, params: idParam(prefix), body: { type: 'object', additionalProperties: false, properties: bodyProps } } },
    async (req) => {
      const [row] = await db
        .update(table)
        .set({ ...toRow(req.body, true), updatedAt: new Date() })
        .where(owned(req))
        .returning()
      if (!row) throw notFound(`${label} topilmadi`)
      return toPublic(row)
    },
  )

  // Sync from the browser: create or update under the id the browser chose. Last write wins by
  // the browser's own clock (updatedAt, ms); an older write leaves the row alone and returns it.
  app.put(
    '/:id',
    {
      bodyLimit: MAX_HTML * 2,
      schema: {
        tags: [tag],
        summary: `${label}ni sinxronlaş (brauzer ID'si bilan yaratiş yoki yangilaş)`,
        params: idParam(prefix),
        body: { type: 'object', required: [...required, 'updatedAt'], additionalProperties: false, properties: { ...bodyProps, updatedAt: { type: 'integer', minimum: 0 } } },
      },
    },
    async (req) => {
      const at = new Date(Math.min(req.body.updatedAt, Date.now() + 60_000))
      const values = { ...toRow(req.body), updatedAt: at }
      const [row] = await db
        .insert(table)
        .values({ id: req.params.id, userId: req.user.id, ...values })
        .onConflictDoUpdate({ target: table.id, set: values, where: and(eq(table.userId, req.user.id), lte(table.updatedAt, at)) })
        .returning()
      if (row) {
        await created(row)
        return toPublic(row, { brief: true })
      }
      const [cur] = await db.select().from(table).where(eq(table.id, req.params.id)).limit(1)
      // the id belongs to another account (e.g. a guest's copy) — the browser picks a new id
      if (!cur || cur.userId !== req.user.id) throw new AppError(409, 'ID_TAKEN', 'Bu ID band — yangisi bilan yuboring')
      return { ...toPublic(cur, { brief: true }), stale: true }
    },
  )

  app.delete('/:id', { schema: { tags: [tag], summary: `${label}ni öçiriş`, params: idParam(prefix) } }, async (req) => {
    const rows = await db.delete(table).where(owned(req)).returning({ id: table.id })
    if (!rows.length) throw notFound(`${label} topilmadi`)
    return { ok: true }
  })
}

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]))

export async function documentRoutes(app) {
  app.addHook('preHandler', app.authenticate)
  crud(app, {
    table: schema.documents,
    prefix: ID_PREFIX.document,
    tag: 'documents',
    label: 'Hujjat',
    required: ['name'],
    source: 'document',
    bodyProps: { name: { type: 'string', minLength: 1, maxLength: 200 }, kind: { type: 'string', maxLength: 60 }, html: { type: 'string', maxLength: MAX_HTML } },
    toRow: (b) => pick(b, ['name', 'kind', 'html']),
    toPublic: (r, { summary, brief } = {}) =>
      brief
        ? { id: r.id, updatedAt: r.updatedAt }
        : { id: r.id, name: r.name, kind: r.kind ?? null, ...(summary ? { size: r.html.length } : { html: r.html }), createdAt: r.createdAt, updatedAt: r.updatedAt },
  })
}

export async function designRoutes(app) {
  app.addHook('preHandler', app.authenticate)
  crud(app, {
    table: schema.designs,
    prefix: ID_PREFIX.design,
    tag: 'designs',
    label: 'Dizayn',
    source: 'design',
    required: ['name', 'data'],
    bodyProps: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      kind: { type: 'string', maxLength: 60 },
      templateId: { type: 'string', maxLength: 60 },
      data: { type: 'object', additionalProperties: true, description: 'Butun taqdimot (slides, accent …)' },
    },
    toRow: (b) => pick(b, ['name', 'kind', 'templateId', 'data']),
    toPublic: (r, { summary, brief } = {}) =>
      brief
        ? { id: r.id, updatedAt: r.updatedAt }
        : {
      id: r.id,
      name: r.name,
      kind: r.kind,
      templateId: r.templateId,
      ...(summary ? { slides: r.data?.slides?.length ?? 0 } : { data: r.data, shareId: r.shareId ?? null }),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    },
  })

  // View-only link. The link shows the design as it is on the server, so it follows later edits.
  const { db } = app.ctx
  const { designs } = schema
  const owned = (req) => and(eq(designs.id, req.params.id), eq(designs.userId, req.user.id))

  app.post('/:id/share', { schema: { tags: ['designs'], summary: 'Körish havolasini yoqiş (bor bölsa — öşa havola)', params: idParam() } }, async (req) => {
    const [row] = await db.select({ shareId: designs.shareId }).from(designs).where(owned(req)).limit(1)
    if (!row) throw notFound('Dizayn topilmadi')
    if (row.shareId) return { shareId: row.shareId }
    const shareId = randomToken(12) // 16 url-safe characters — not guessable
    // only one request wins when two arrive at once; the other reads the winner's id
    await db.update(designs).set({ shareId }).where(and(owned(req), isNull(designs.shareId)))
    const [cur] = await db.select({ shareId: designs.shareId }).from(designs).where(owned(req)).limit(1)
    return { shareId: cur.shareId }
  })

  app.delete('/:id/share', { schema: { tags: ['designs'], summary: 'Körish havolasini öçiriş', params: idParam() } }, async (req) => {
    const rows = await db.update(designs).set({ shareId: null }).where(owned(req)).returning({ id: designs.id })
    if (!rows.length) throw notFound('Dizayn topilmadi')
    return { ok: true }
  })
}

/** Public: a shared design by its link id — no account needed, read-only. */
export async function sharedDesignRoutes(app) {
  const { db } = app.ctx
  const { designs } = schema
  app.get(
    '/:shareId',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: { tags: ['designs'], summary: 'Ulaşilgan dizayn (faqat körish)', params: { type: 'object', required: ['shareId'], properties: { shareId: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,40}$' } } } },
    },
    async (req, reply) => {
      const [row] = await db
        .select({ name: designs.name, kind: designs.kind, templateId: designs.templateId, data: designs.data, updatedAt: designs.updatedAt })
        .from(designs)
        .where(eq(designs.shareId, req.params.shareId))
        .limit(1)
      if (!row) throw notFound('Havola topilmadi yoki öçirilgan')
      reply.header('cache-control', 'no-store')
      reply.header('x-robots-tag', 'noindex')
      const d = row.data ?? {}
      return {
        name: row.name,
        kind: row.kind,
        templateId: row.templateId ?? d.templateId ?? null,
        // only what a viewer needs to draw the pages
        deck: { slides: Array.isArray(d.slides) ? d.slides : [], accent: d.accent ?? null, templateId: d.templateId ?? row.templateId ?? null },
        updatedAt: row.updatedAt,
      }
    },
  )
}
