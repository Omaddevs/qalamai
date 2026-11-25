// POST /api/v1/ai/deck — an AI presentation, streamed as JSON Lines:
//   {"type":"start","total":10} {"type":"outline",…} {"type":"slide",…} {"type":"image",…} … {"type":"done"}
//   or, if it fails part-way, {"type":"error","code":…,"message":…} (the coins are given back).
// The charge happens before the stream starts, so "not enough coins" is an ordinary error answer.
import { PassThrough } from 'node:stream'
import { AppError } from '../../lib/errors.js'
import { createAi } from './service.js'
import { DECK_LANGS, PLAN_FIXED, PLAN_MAX, SOURCE_MAX } from './deck.js'

const off = () => new AppError(503, 'AI_OFF', 'AI hozirça ulanmagan')

/** @param {import('fastify').FastifyInstance} app */
export default async function aiRoutes(app) {
  const { config, coins } = app.ctx
  const ai = app.ctx.ai ?? (config.ai ? createAi(config.ai, { log: app.log }) : null)

  app.addHook('preHandler', app.authenticate)

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
            plans: { type: 'integer', minimum: 1, maximum: PLAN_MAX },
            slides: { type: 'integer', minimum: 5, maximum: 30 },
            lang: { type: 'string', enum: DECK_LANGS },
            ref: { type: 'string', minLength: 6, maxLength: 80, pattern: '^[A-Za-z0-9:_-]+$' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!ai) throw off()
      const { plans, lang, ref, source = null } = req.body
      const topic = (req.body.topic ?? '').trim()
      if (topic.length < 2 && !source) throw new AppError(400, 'TOPIC_REQUIRED', 'Mavzuni yozing')
      const slides = Math.max(req.body.slides, plans + PLAN_FIXED)
      const ACTION = source ? 'prezentatsiya-fayl' : 'prezentatsiya'

      // one paid ref = one presentation: a ref that was seen before (used, or refunded) is not free again
      const paid = await coins.spend(req.user, ACTION, { ref, meta: { topic: (topic || source.name).slice(0, 300), ai: true } })
      if (paid.repeated) throw new AppError(409, 'REF_USED', 'Bu tölov allaqaçon işlatilgan')

      const out = new PassThrough()
      const send = (event) => {
        if (!out.writableEnded) out.write(`${JSON.stringify(event)}\n`)
      }
      // the browser closed the page or pressed "Bekor qiliş": stop writing (and paying Claude)
      const abort = new AbortController()
      reply.raw.on('close', () => {
        if (!out.writableEnded) abort.abort()
      })

      ;(async () => {
        send({ type: 'start', balance: paid.balance })
        try {
          const res = await ai.deck({ topic, plans, slides, lang, source }, { emit: send, signal: abort.signal })
          send({ type: 'done', slides: res.slides.length })
        } catch (err) {
          if (abort.signal.aborted) req.log.info('ai deck cancelled by the client')
          else req.log.error({ err }, 'ai deck failed')
          const back = await coins.refund(req.user, ref).catch(() => null)
          send({
            type: 'error',
            code: err.code?.startsWith?.('AI_') ? err.code : 'AI_FAILED',
            message: err.code?.startsWith?.('AI_') ? err.message : 'AI javob bermadi — coin qaytarildi, birozdan keyin qayta urinib köring.',
            balance: back?.balance,
          })
        } finally {
          out.end()
        }
      })()

      reply
        .header('content-type', 'application/x-ndjson; charset=utf-8')
        .header('cache-control', 'no-cache, no-transform')
        .header('x-accel-buffering', 'no')
      return reply.send(out)
    },
  )
}
