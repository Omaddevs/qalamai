// /api/v1/notifications — the signed-in user's Bildirişnomalar (guests included: they get the
// welcome bonus notice too).
import { notFound } from '../../lib/errors.js'

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 64 } } }

/** @param {import('fastify').FastifyInstance} app */
export default async function notificationRoutes(app) {
  const { notifier } = app.ctx
  app.addHook('preHandler', app.authenticate)

  app.get(
    '/',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Bildirişnomalar (yangilari avval)',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 },
            before: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (req) => notifier.list(req.user, { limit: req.query.limit, before: req.query.before ? new Date(req.query.before) : null }),
  )

  app.get('/unread', { schema: { tags: ['notifications'], summary: 'Öqilmagan bildirişnomalar soni' } }, async (req) => ({ unread: await notifier.unread(req.user) }))

  app.post('/:id/read', { schema: { tags: ['notifications'], summary: 'Öqildi deb belgilaş', params: idParams } }, async (req) => {
    if (!(await notifier.markRead(req.user, req.params.id))) throw notFound('Bildirişnoma topilmadi')
    return { unread: await notifier.unread(req.user) }
  })

  app.post('/read-all', { schema: { tags: ['notifications'], summary: 'Hammasini öqildi deb belgilaş' } }, async (req) => {
    await notifier.markAllRead(req.user)
    return { unread: 0 }
  })
}
