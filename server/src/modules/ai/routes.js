// AI endpoints, streamed as JSON Lines:
//   {"type":"start","balance":…} … events … {"type":"done"}
//   or, if it fails part-way, {"type":"error","code":…,"message":…} (the coins are given back).
// The charge happens before the stream starts, so "not enough coins" is an ordinary error answer.
// A {"type":"ping"} line every 15 s keeps proxies from closing a quiet stream while the model thinks.
//
//   POST /ai/deck — a presentation (topic or a document's text)
//   POST /ai/fill — the missing pieces of a document type (referat, kurs ishi …) or a small slide document
import { PassThrough } from 'node:stream'
import { AppError } from '../../lib/errors.js'
import { ACTION_BY_TYPE } from '../../../../shared/coins.js'
import { createAi } from './service.js'
import { DECK_LANGS, PLAN_FIXED, PLAN_MAX, SOURCE_MAX } from './deck.js'
import { KIND_NAMES } from './fill.js'

const off = () => new AppError(503, 'AI_OFF', 'AI hozirça ulanmagan')
const REF = { type: 'string', minLength: 6, maxLength: 80, pattern: '^[A-Za-z0-9:_-]+$' }
const DOC_KINDS = ['Referat', 'Kurs işi', 'Mustaqil iş', 'Dars işlanma', 'Biznes reja'] // i18n-ignore (type ids)
const CARD_KINDS = ['Hisobot', 'Portfolio', 'Taklifnoma']

/** @param {import('fastify').FastifyInstance} app */
export default async function aiRoutes(app) {
  const { config, coins } = app.ctx
  const ai = app.ctx.ai ?? (config.ai ? createAi(config.ai, { log: app.log }) : null)

  app.addHook('preHandler', app.authenticate)

  /**
   * Charges `action` once for `ref`, then streams what `work(send, signal)` emits. Refunds on failure
   * or when the browser goes away before the end.
   */
  async function streamJob(req, reply, { action, ref, topic }, work) {
    if (!ai) throw off()
    // one paid ref = one result: a ref that was seen before (used, or refunded) is not free again
    const paid = await coins.spend(req.user, action, { ref, meta: { topic: String(topic ?? '').slice(0, 300), ai: true } })
    if (paid.repeated) throw new AppError(409, 'REF_USED', 'Bu tölov allaqaçon işlatilgan')

    const out = new PassThrough()
    const send = (event) => {
      if (!out.writableEnded) out.write(`${JSON.stringify(event)}\n`)
    }
    const abort = new AbortController()
    reply.raw.on('close', () => {
      if (!out.writableEnded) abort.abort()
    })
    const ping = setInterval(() => send({ type: 'ping' }), 15_000)

    ;(async () => {
      send({ type: 'start', balance: paid.balance })
      try {
        const res = await work(send, abort.signal)
        send({ type: 'done', ...res })
      } catch (err) {
        if (abort.signal.aborted) req.log.info({ action }, 'ai cancelled by the client')
        else req.log.error({ err, action }, 'ai failed')
        const back = await coins.refund(req.user, ref).catch(() => null)
        const own = err.code?.startsWith?.('AI_')
        send({
          type: 'error',
          code: own ? err.code : 'AI_FAILED',
          message: own ? err.message : 'AI javob bermadi — coin qaytarildi, birozdan keyin qayta urinib köring.',
          balance: back?.balance,
        })
      } finally {
        clearInterval(ping)
        out.end()
      }
    })()

    reply
      .header('content-type', 'application/x-ndjson; charset=utf-8')
      .header('cache-control', 'no-cache, no-transform')
      .header('x-accel-buffering', 'no')
    return reply.send(out)
  }

  app.post(
    '/deck',
    {
      config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
      schema: {
        tags: ['ai'],
        summary: 'AI taqdimot (slaydlar birma-bir keladi, JSON Lines)',
        body: {
          type: 'object',
          required: ['plans', 'slides', 'lang', 'ref'],
          additionalProperties: false,
          properties: {
            topic: { type: 'string', maxLength: 300 },
            plans: { type: 'integer', minimum: 1, maximum: PLAN_MAX },
            slides: { type: 'integer', minimum: 5, maximum: 30 },
            lang: { type: 'string', enum: DECK_LANGS },
            ref: REF,
            // a document read in the browser: only its text comes here, and it is not stored
            source: {
              type: 'object',
              required: ['name', 'text'],
              additionalProperties: false,
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 200 },
                text: { type: 'string', minLength: 50, maxLength: SOURCE_MAX },
                outline: { type: 'array', maxItems: PLAN_MAX, items: { type: 'string', maxLength: 120 } },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { plans, lang, ref, source = null } = req.body
      const topic = (req.body.topic ?? '').trim()
      if (topic.length < 2 && !source) throw new AppError(400, 'TOPIC_REQUIRED', 'Mavzuni yozing')
      const slides = Math.max(req.body.slides, plans + PLAN_FIXED)
      const action = source ? 'prezentatsiya-fayl' : 'prezentatsiya'
      return streamJob(req, reply, { action, ref, topic: topic || source.name }, async (send, signal) => {
        const res = await ai.deck({ topic, plans, slides, lang, source }, { emit: send, signal })
        return { slides: res.slides.length }
      })
    },
  )

  const task = {
    type: 'object',
    required: ['id', 't'],
    additionalProperties: false,
    properties: {
      id: { type: 'integer', minimum: 0, maximum: 999 },
      t: { type: 'string', enum: ['p', 'list', 'inline', 'cell'] },
      h: { type: 'string', maxLength: 200 },
      hint: { type: 'string', maxLength: 600 },
      lead: { type: 'string', maxLength: 120 },
      row: { type: 'string', maxLength: 160 },
      col: { type: 'string', maxLength: 120 },
      items: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 300 } },
    },
  }
  const card = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', maxLength: 200 },
      subtitle: { type: 'string', maxLength: 300 },
      bullets: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 400 } },
    },
  }

  app.post(
    '/fill',
    {
      config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
      schema: {
        tags: ['ai'],
        summary: 'AI hujjat: referat, kurs işi, dars işlanma, biznes reja … (bölaklar birma-bir keladi)',
        body: {
          type: 'object',
          required: ['kind', 'topic', 'lang', 'ref'],
          additionalProperties: false,
          properties: {
            kind: { type: 'string', enum: [...DOC_KINDS, ...CARD_KINDS] },
            topic: { type: 'string', minLength: 2, maxLength: 300 },
            lang: { type: 'string', enum: DECK_LANGS },
            ref: REF,
            pages: { type: 'integer', minimum: 1, maximum: 120 },
            extra: { type: 'string', maxLength: 300 },
            tasks: { type: 'array', minItems: 1, maxItems: 400, items: task },
            slides: { type: 'array', minItems: 1, maxItems: 20, items: card },
          },
        },
      },
    },
    async (req, reply) => {
      const { kind, lang, ref, extra } = req.body
      const topic = req.body.topic.trim()
      const action = ACTION_BY_TYPE[kind]
      if (!action || !KIND_NAMES[kind]) throw new AppError(400, 'BAD_KIND', 'Bunday hujjat turi yöq')
      if (DOC_KINDS.includes(kind)) {
        if (!req.body.tasks?.length) throw new AppError(400, 'BAD_REQUEST', 'Hujjat tuzilmasi kelmadi')
        const pages = req.body.pages ?? 10
        return streamJob(req, reply, { action, ref, topic }, (send, signal) => ai.doc({ kind, topic, lang, pages, tasks: req.body.tasks, extra }, { emit: send, signal }))
      }
      if (!req.body.slides?.length) throw new AppError(400, 'BAD_REQUEST', 'Slaydlar kelmadi')
      return streamJob(req, reply, { action, ref, topic }, (send, signal) => ai.cards({ kind, topic, lang, slides: req.body.slides, extra }, { emit: send, signal }))
    },
  )
}
