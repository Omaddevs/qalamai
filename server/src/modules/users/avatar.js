// Profile pictures: GET /api/v1/avatars/:userId — public (like any avatar), cached by the
// ?v= stamp that publicUser() puts in avatarUrl, so a new picture gets a new URL.
import { eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { notFound } from '../../lib/errors.js'
import { isStoredAvatar } from '../../lib/avatars.js'

/** @param {import('fastify').FastifyInstance} app */
export default async function avatarRoutes(app) {
  const { db, storage } = app.ctx
  app.get(
    '/:id',
    { schema: { tags: ['me'], summary: 'Profil rasmi', params: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 40 } } } } },
    async (req, reply) => {
      const [u] = await db.select({ key: schema.users.avatarKey }).from(schema.users).where(eq(schema.users.id, req.params.id)).limit(1)
      if (!isStoredAvatar(u?.key) || !(await storage.exists(u.key))) throw notFound('Rasm topilmadi')
      return reply
        .header('content-type', 'image/jpeg')
        .header('cache-control', req.query?.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
        .header('x-content-type-options', 'nosniff')
        .send(storage.stream(u.key))
    },
  )
}
