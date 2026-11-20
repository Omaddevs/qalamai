// Profile pictures. users.avatar_key is either
//   'preset:N'           — one of the drawn avatars the web app serves at /avatars/NN.webp (N = 1…AVATAR_PRESETS)
//   'avatars/<id>.jpg'   — a picture in storage (uploaded, or the Telegram photo), served by GET /api/v1/avatars/:id
// Every new account gets the next preset in turn (1, 2 … 15, 1 …), so neighbours rarely look alike.
import { and, eq, isNull, sql } from 'drizzle-orm'
import { schema } from '../db/index.js'

export const AVATAR_PRESETS = 15
const PRESET = /^preset:(\d{1,2})$/

export const presetKey = (n) => `preset:${n}`
export const presetOf = (key) => {
  const m = PRESET.exec(key ?? '')
  const n = m ? Number(m[1]) : 0
  return n >= 1 && n <= AVATAR_PRESETS ? n : null
}
export const isStoredAvatar = (key) => typeof key === 'string' && key.startsWith('avatars/')

/** The URL a client shows for this avatar, or null when there is none. */
export function avatarUrlOf(id, key, at) {
  if (!key) return null
  const n = presetOf(key)
  if (n) return `/avatars/${String(n).padStart(2, '0')}.webp`
  return `/api/v1/avatars/${id}?v=${new Date(at ?? 0).getTime()}`
}

/** Next preset number in the round: an atomic counter kept in admin_settings. */
export async function nextPreset(db) {
  const res = await db.execute(sql`
    INSERT INTO admin_settings (key, value, updated_at) VALUES ('avatar_seq', '1'::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = to_jsonb(COALESCE((admin_settings.value #>> '{}')::bigint, 0) + 1), updated_at = now()
    RETURNING value`)
  const v = Number((res.rows ?? res)[0]?.value) || 1
  return ((v - 1) % AVATAR_PRESETS) + 1
}

/**
 * A registered account without a picture gets the next preset. Returns the user with the
 * new avatar fields (other fields such as coins are kept). Guests are left as they are.
 */
export async function ensureAvatar(db, user) {
  if (!user || user.isGuest || user.avatarKey) return user
  const n = await nextPreset(db)
  const [u] = await db
    .update(schema.users)
    .set({ avatarKey: presetKey(n), avatarAt: new Date() })
    .where(and(eq(schema.users.id, user.id), isNull(schema.users.avatarKey)))
    .returning({ avatarKey: schema.users.avatarKey, avatarAt: schema.users.avatarAt })
  return u ? { ...user, ...u } : user
}
