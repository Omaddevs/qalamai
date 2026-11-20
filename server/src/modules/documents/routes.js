// Rich-text documents (Fayl muharriri) and slide designs (dizayn muharriri).
// The frontend keeps working offline in localStorage; these endpoints let it sync
// and move a guest's work into a real account.
import { and, asc, eq, gt, lte } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, notFound } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'

const MAX_HTML = 5 * 1048576
// Server ids (doc_…, dsn_…) and the ids the browser made offline (f_…, d-…-…) are both accepted.
const idParam = () => ({ type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{3,80}$' } } })

/** Shared CRUD for a user-owned table. */
function crud(app, { table, prefix, tag, label, bodyProps, required, toRow, toPublic }) {
  const { db } = app.ctx
  const owned = (req) => and(eq(table.id, req.params.id), eq(table.userId, req.user.id))

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
      if (row) return toPublic(row, { brief: true })
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
    bodyProps: { name: { type: 'string', minLength: 1, maxLength: 200 }, html: { type: 'string', maxLength: MAX_HTML } },
    toRow: (b) => pick(b, ['name', 'html']),
    toPublic: (r, { summary, brief } = {}) =>
      brief
        ? { id: r.id, updatedAt: r.updatedAt }
        : { id: r.id, name: r.name, ...(summary ? { size: r.html.length } : { html: r.html }), createdAt: r.createdAt, updatedAt: r.updatedAt },
  })
}

export async function designRoutes(app) {
  app.addHook('preHandler', app.authenticate)
  crud(app, {
    table: schema.designs,
    prefix: ID_PREFIX.design,
    tag: 'designs',
    label: 'Dizayn',
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
      ...(summary ? { slides: r.data?.slides?.length ?? 0 } : { data: r.data }),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    },
  })
}
