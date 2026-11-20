import { contentDisposition } from '../../lib/filetypes.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { limitsFor } from '../plans/plans.js'

const fileParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^fil_[A-Za-z0-9]{16}$' } } }
const signedQuery = {
  type: 'object',
  required: ['exp', 'sig'],
  properties: { exp: { type: 'string' }, sig: { type: 'string' }, download: { type: 'string' } },
}

/** @param {import('fastify').FastifyInstance} app */
export default async function fileRoutes(app) {
  const { files, storage, pool } = app.ctx
  const rendering = new Map() // thumbKey → in-flight render, so a burst of requests renders once
  const signedLimit = { rateLimit: { max: 1500, timeWindow: '1 minute' } } // grids load many thumbnails

  /* ── Signed (header-less) routes: <img src>, <a download>, pdf.js ── */

  app.get('/:id/content', { config: signedLimit, schema: { tags: ['files'], summary: 'Fayl mazmuni (imzolangan havola)', params: fileParams, querystring: signedQuery } }, async (req, reply) => {
    const { id } = req.params
    if (!files.verifyUrl(id, 'content', req.query.exp, req.query.sig)) throw notFound('Havola eskirgan — sahifani yangilang')
    const f = await files.getById(id)
    reply
      .header('Content-Type', f.mime)
      .header('Content-Length', f.size)
      .header('Content-Disposition', contentDisposition(f.name, req.query.download === undefined))
      .header('Cache-Control', 'private, max-age=3600')
      .header('X-Content-Type-Options', 'nosniff')
    // never let uploaded HTML/SVG run as a page on the API origin
    if (/html|svg/.test(f.mime)) reply.header('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox")
    return reply.send(storage.stream(f.storageKey))
  })

  app.get('/:id/thumbnail', { config: signedLimit, schema: { tags: ['files'], summary: 'Kiçik rasm (PDF 1-sahifa yoki rasm), WebP', params: fileParams, querystring: signedQuery } }, async (req, reply) => {
    const { id } = req.params
    if (!files.verifyUrl(id, 'thumbnail', req.query.exp, req.query.sig)) throw notFound('Havola eskirgan — sahifani yangilang')
    const f = await files.getById(id)
    if (f.kind !== 'pdf' && f.kind !== 'image') throw notFound('Bu fayl uçun kiçik rasm yöq')
    const thumbKey = `${f.storageKey}.thumb.webp`
    if (!(await storage.exists(thumbKey))) {
      if (!rendering.has(thumbKey)) {
        const task = pool
          .run({ kind: 'thumbnail', input: { path: storage.pathOf(f.storageKey), kind: f.kind }, out: storage.pathOf(thumbKey) }, { priority: true })
          .finally(() => rendering.delete(thumbKey))
        rendering.set(thumbKey, task)
      }
      try {
        await rendering.get(thumbKey)
      } catch {
        throw notFound('Kiçik rasmni yaratib bölmadi')
      }
    }
    reply.header('Content-Type', 'image/webp').header('Cache-Control', 'private, max-age=86400')
    return reply.send(storage.stream(thumbKey))
  })

  /* ── Authenticated routes ── */

  app.register(async (authed) => {
    authed.addHook('preHandler', app.authenticate)

    authed.post(
      '/',
      {
        schema: {
          tags: ['files'],
          summary: 'Fayl(lar) yuklaş — multipart/form-data, maydon nomi: file',
          consumes: ['multipart/form-data'],
        },
      },
      async (req, reply) => {
        if (!req.isMultipart()) throw badRequest('Fayl multipart/form-data körinişida yuborilişi kerak')
        const limits = limitsFor(req.user)
        const saved = []
        try {
          for await (const part of req.files({ limits: { fileSize: limits.maxFileMb * 1048576, files: limits.maxFilesPerJob } })) {
            saved.push(await files.saveUpload(req.user, part))
          }
        } catch (err) {
          // all-or-nothing: drop what this request already stored
          await Promise.all(saved.map((f) => files.remove(req.user, f.id).catch(() => {})))
          throw err
        }
        if (!saved.length) throw badRequest('Heç qanday fayl yuborilmadi')
        reply.status(201)
        return { files: saved.map(files.toPublic) }
      },
    )

    authed.get(
      '/',
      {
        schema: {
          tags: ['files'],
          summary: 'Mening fayllarim',
          querystring: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['pdf', 'image', 'document', 'spreadsheet', 'presentation', 'text', 'archive', 'other'] },
              source: { type: 'string', enum: ['upload', 'tool'] },
              limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
              before: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      async (req) => {
        const rows = await files.list(req.user, req.query)
        return { files: rows.map(files.toPublic), next: rows.length === req.query.limit ? rows.at(-1).createdAt : null }
      },
    )

    authed.get('/:id', { schema: { tags: ['files'], summary: 'Fayl maʼlumoti', params: fileParams } }, async (req) => files.toPublic(await files.get(req.user, req.params.id)))

    authed.patch(
      '/:id',
      {
        schema: {
          tags: ['files'],
          summary: 'Nomini özgartiriş yoki doimiy saqlaş (Premium)',
          params: fileParams,
          body: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, keep: { type: 'boolean' } } },
        },
      },
      async (req) => files.toPublic(await files.update(req.user, req.params.id, req.body)),
    )

    authed.delete('/:id', { schema: { tags: ['files'], summary: 'Faylni öçiriş', params: fileParams } }, async (req) => {
      await files.remove(req.user, req.params.id)
      return { ok: true }
    })
  })
}
