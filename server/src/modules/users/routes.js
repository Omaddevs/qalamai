import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { and, eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { limitsFor, tashkentDay } from '../plans/plans.js'
import { publicUser } from '../auth/service.js'
import { AVATAR_PRESETS, isStoredAvatar, presetKey } from '../../lib/avatars.js'
import { badRequest } from '../../lib/errors.js'

const { users, usage } = schema

// Titul profile fields the frontend keeps (src/profile.js). Unknown keys are dropped.
const PROFILE_KEYS = [
  'workType', 'topic', 'subject', 'uniId', 'uniCustom', 'faculty', 'direction', 'course', 'group', 'fullName',
  'supervisor', 'city', 'year', 'phone', 'company', 'position', 'director', 'stir', 'address', 'bank', 'mfo', 'account',
  // browser clock (ms, as a string) of the last edit — the newer side wins when devices sync
  'updatedAt',
]

/** @param {import('fastify').FastifyInstance} app */
export default async function userRoutes(app) {
  const { db, auth, coins, storage } = app.ctx
  app.addHook('preHandler', app.authenticate)

  app.get('/', { schema: { tags: ['me'], summary: 'Joriy foydalanuvçi, coin balansi va çegaralar' } }, async (req) => publicUser({ ...req.user, tier: await coins.tier(req.user.id) }, limitsFor(req.user)))

  app.patch(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Ism va titul profilini yangilaş',
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', maxLength: 80 },
            profile: { type: 'object', additionalProperties: { type: 'string', maxLength: 300 } },
          },
        },
      },
    },
    async (req) => {
      const set = { updatedAt: new Date() }
      if (req.body.name !== undefined) set.name = req.body.name.trim()
      if (req.body.profile) {
        const clean = Object.fromEntries(Object.entries(req.body.profile).filter(([k]) => PROFILE_KEYS.includes(k)))
        set.profile = { ...(req.user.profile ?? {}), ...clean }
      }
      const [u] = await db.update(users).set(set).where(eq(users.id, req.user.id)).returning()
      return publicUser({ ...u, tier: await coins.tier(u.id) }, limitsFor(u))
    },
  )

  // Profile picture: one of the drawn presets, or the user's own photo (re-encoded here to a square JPEG).
  app.put(
    '/avatar',
    {
      bodyLimit: 4 * 1048576,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['me'],
        summary: 'Profil rasmini özgartiriş (tayyor rasm yoki öz rasmi)',
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            preset: { type: 'integer', minimum: 1, maximum: AVATAR_PRESETS },
            image: { type: 'string', maxLength: 4 * 1048576, description: 'data:image/(jpeg|png|webp);base64,…' },
          },
        },
      },
    },
    async (req) => {
      const { preset, image } = req.body
      const old = req.user.avatarKey
      let avatarKey
      if (preset) {
        avatarKey = presetKey(preset)
      } else if (image) {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image)
        if (!m) throw badRequest('Rasm formati notöğri')
        let jpeg
        try {
          jpeg = await sharp(Buffer.from(m[2], 'base64'), { limitInputPixels: 40e6 })
            .rotate()
            .resize(384, 384, { fit: 'cover' })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 88, mozjpeg: true })
            .toBuffer()
        } catch {
          throw badRequest('Rasmni öqib bölmadi')
        }
        avatarKey = `avatars/${req.user.id}.jpg`
        const tmp = `${storage.tmpDir}/${req.user.id}-${Date.now()}.jpg`
        await writeFile(tmp, jpeg)
        await storage.putFile(avatarKey, tmp)
      } else {
        throw badRequest('Rasm tanlanmadi')
      }
      const [u] = await db.update(users).set({ avatarKey, avatarAt: new Date(), updatedAt: new Date() }).where(eq(users.id, req.user.id)).returning()
      // switching to a preset: the old photo is no longer shown anywhere
      if (isStoredAvatar(old) && old !== avatarKey) await storage.remove(old).catch(() => {})
      return publicUser({ ...u, tier: await coins.tier(u.id) }, limitsFor(u))
    },
  )

  app.get('/usage', { schema: { tags: ['me'], summary: 'Bugungi foydalaniş va çegaralar' } }, async (req) => {
    const day = tashkentDay()
    const rows = await db.select().from(usage).where(and(eq(usage.userId, req.user.id), eq(usage.day, day)))
    return { day, limits: limitsFor(req.user), used: Object.fromEntries(rows.map((r) => [r.metric, r.count])) }
  })

  app.post(
    '/password',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['me'],
        summary: 'Parolni özgartiriş (barça sessiyalar yopiladi)',
        body: {
          type: 'object',
          required: ['next'],
          additionalProperties: false,
          properties: { current: { type: 'string', maxLength: 128 }, next: { type: 'string', minLength: 8, maxLength: 128 } },
        },
      },
    },
    async (req) => {
      await auth.changePassword(req.user, req.body.current, req.body.next)
      return { ok: true }
    },
  )

  app.delete('/', { schema: { tags: ['me'], summary: 'Hisobni butunlay öçiriş (fayllar bilan)' } }, async (req) => {
    await app.ctx.files.removeAllFor(req.user.id)
    await db.delete(users).where(eq(users.id, req.user.id))
    return { ok: true }
  })
}
