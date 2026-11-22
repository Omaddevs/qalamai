import { publicCatalog } from '../tools/catalog.js'

const jobParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^job_[A-Za-z0-9]{16}$' } } }
const TERMINAL = new Set(['done', 'failed', 'canceled'])

/** Tool catalog + job creation:  /api/v1/tools */
export async function toolRoutes(app) {
  const { jobs } = app.ctx
  const catalog = publicCatalog()

  app.get('/', { schema: { tags: ['tools'], summary: 'Barça vositalar va ularning sozlamalari (JSON Schema)' } }, async (req, reply) => {
    reply.header('Cache-Control', 'public, max-age=300')
    return { tools: catalog }
  })

  app.post(
    '/:tool/jobs',
    {
      preHandler: app.authenticate,
      bodyLimit: 40 * 1048576, // PDF editor sends signatures/images as data URLs
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['tools'],
        summary: 'Vositani işga tuşiriş → vazifa (202)',
        params: { type: 'object', properties: { tool: { type: 'string', maxLength: 40 } } },
        body: {
          type: 'object',
          required: ['fileIds'],
          additionalProperties: false,
          properties: {
            fileIds: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'string', pattern: '^fil_[A-Za-z0-9]{16}$' } },
            options: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const job = await jobs.create(req.user, req.params.tool, req.body)
      reply.status(202)
      return jobs.publicJob(job)
    },
  )
}

/** Tools that run on the user's device report here first: limits are checked, no file is sent. */
export async function localRunRoutes(app) {
  const { jobs } = app.ctx
  app.post(
    '/:tool/local-runs',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['tools'],
        summary: 'Brauzerda işlaydigan vosita: limitni tekşiriş va hisoblaş (fayl yuborilmaydi)',
        params: { type: 'object', properties: { tool: { type: 'string', maxLength: 40 } } },
        body: {
          type: 'object',
          required: ['files'],
          additionalProperties: false,
          properties: {
            files: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                required: ['kind', 'size'],
                additionalProperties: false,
                properties: {
                  kind: { type: 'string', maxLength: 20 },
                  ext: { type: 'string', maxLength: 10 },
                  size: { type: 'integer', minimum: 0 },
                  pages: { type: 'integer', minimum: 0, maximum: 100000 },
                },
              },
            },
          },
        },
      },
    },
    async (req) => jobs.checkLocal(req.user, req.params.tool, req.body),
  )
}

/** Job status:  /api/v1/jobs */
export async function jobRoutes(app) {
  const { jobs } = app.ctx
  app.addHook('preHandler', app.authenticate)

  app.get(
    '/',
    { schema: { tags: ['jobs'], summary: 'Sönggi vazifalar', querystring: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 } } } } },
    async (req) => ({ jobs: await Promise.all((await jobs.list(req.user, req.query.limit)).map(jobs.publicJob)) }),
  )

  app.get(
    '/:id',
    {
      schema: {
        tags: ['jobs'],
        summary: 'Vazifa holati',
        description: '`wait` (ms) berilsa — holat özgargunça yoki vaqt tugagunça kutadi (long-poll).',
        params: jobParams,
        querystring: { type: 'object', properties: { wait: { type: 'integer', minimum: 0, maximum: 25000, default: 0 } } },
      },
    },
    async (req) => {
      let job = await jobs.get(req.user, req.params.id)
      if (req.query.wait && !TERMINAL.has(job.status)) {
        const before = `${job.status}:${job.progress}:${job.stage}`
        const closed = new Promise((r) => req.raw.once('close', r))
        await Promise.race([jobs.waitForChange(job.id, req.query.wait), closed])
        job = await jobs.get(req.user, req.params.id)
        if (`${job.status}:${job.progress}:${job.stage}` === before) req.log.trace('long-poll timed out without change')
      }
      return jobs.publicJob(job)
    },
  )

  app.post('/:id/cancel', { schema: { tags: ['jobs'], summary: 'Vazifani bekor qiliş', params: jobParams } }, async (req) => jobs.publicJob(await jobs.cancel(req.user, req.params.id)))
}
