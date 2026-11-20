import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest, conflict, unauthorized } from '../../lib/errors.js'
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'

const { users, sessions } = schema

/** Uzbek phone numbers → +998XXXXXXXXX. Returns null when it isn't one. */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length === 9) return `+998${digits}`
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`
  return null
}

export const normalizeEmail = (input) => {
  const e = String(input ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null
}

/** "login" may be an e-mail or a phone number. */
export function parseLogin(login) {
  const email = normalizeEmail(login)
  if (email) return { email }
  const phone = normalizePhone(login)
  if (phone) return { phone }
  return null
}

export function publicUser(u, limits) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    plan: u.plan,
    planExpiresAt: u.planExpiresAt,
    isGuest: u.isGuest,
    phoneVerified: Boolean(u.phoneVerifiedAt),
    telegramUsername: u.telegramUsername ?? null,
    avatarUrl: u.avatarKey ? `/api/v1/avatars/${u.id}?v=${new Date(u.avatarAt ?? 0).getTime()}` : null,
    /** Sign-in methods linked to the account. */
    linked: { google: Boolean(u.googleId), telegram: Boolean(u.telegramId), password: Boolean(u.passwordHash) },
    coins: u.coins ?? 0,
    /** Bought coins at least once (or was given Pro/Taʼlim by hand): no watermark, Pro templates. */
    premium: limits ? ['premium', 'edu'].includes(limits.plan) : Boolean(u.coinsPurchasedAt),
    /** Start / Pro / Max by the biggest pack bought; null = free. Callers fill u.tier. */
    tier: u.tier ?? null,
    profile: u.profile ?? {},
    createdAt: u.createdAt,
    ...(limits ? { limits } : {}),
  }
}

/** How long an already-rotated refresh token may still be presented (parallel tabs, reloads). */
const REUSE_GRACE_MS = 60_000

export function createAuthService({ db, tokens, config, coins }) {
  const refreshMs = config.auth.refreshDays * 86400_000
  // verified against when the login is unknown, so both paths cost one full scrypt
  let dummyHash = null

  async function issueSession(user, meta, family = newId('fam')) {
    const refreshToken = randomToken()
    const expiresAt = new Date(Date.now() + refreshMs)
    await db.insert(sessions).values({
      id: newId(ID_PREFIX.session),
      userId: user.id,
      tokenHash: sha256(refreshToken),
      family,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
      expiresAt,
    })
    return { accessToken: await tokens.signAccess(user), accessExpiresIn: tokens.accessTtlSec, refreshToken, refreshExpiresAt: expiresAt }
  }

  async function findByLogin({ email, phone }) {
    const where = email ? sql`lower(${users.email}) = ${email}` : eq(users.phone, phone)
    const [u] = await db.select().from(users).where(where).limit(1)
    return u ?? null
  }

  return {
    issueSession,

    async createGuest(meta) {
      const [user] = await db.insert(users).values({ id: newId(ID_PREFIX.user), isGuest: true, name: '' }).returning()
      return { user, ...(await issueSession(user, meta)) }
    },

    /**
     * Register with e-mail or phone. When the caller is a guest, the guest account is
     * upgraded in place so its files, documents and designs carry over.
     */
    async register({ login, password, name }, currentUser, meta) {
      const id = parseLogin(login)
      if (!id) throw badRequest('Email yoki telefon raqamni töğri kiriting (masalan: +998 90 123 45 67)')
      if (await findByLogin(id)) throw conflict(id.email ? 'Bu email bilan hisob allaqaçon bor' : 'Bu telefon raqam bilan hisob allaqaçon bor')
      const passwordHash = await hashPassword(password)
      const fields = { ...id, passwordHash, name: name?.trim() ?? '', isGuest: false, updatedAt: new Date() }

      let user
      try {
        if (currentUser?.isGuest) {
          ;[user] = await db.update(users).set(fields).where(eq(users.id, currentUser.id)).returning()
          // the guest's old refresh tokens must not outlive the upgrade
          await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
        } else {
          ;[user] = await db.insert(users).values({ id: newId(ID_PREFIX.user), ...fields }).returning()
        }
      } catch (err) {
        // lost a race against another registration with the same login
        if (String(err.code) === '23505' || /unique/i.test(err.message)) throw conflict('Bu login bilan hisob allaqaçon bor')
        throw err
      }
      // the welcome bonus is keyed by ref 'signup', so an account can only ever get it once
      const { balance } = await coins.signupBonus(user.id)
      user = { ...user, coins: balance }
      return { user, ...(await issueSession(user, meta)) }
    },

    async login({ login, password }, meta) {
      const id = parseLogin(login)
      const user = id ? await findByLogin(id) : null
      // same answer and similar timing whether the account exists or not
      dummyHash ??= await hashPassword(randomToken())
      const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash)
      if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Login yoki parol notöğri')
      return { user, ...(await issueSession(user, meta)) }
    },

    /**
     * Sign in with a verified Google identity. Order: the account already linked to this
     * Google id → an account with the same (Google-verified) e-mail, which gets linked →
     * the caller's guest account, upgraded in place → a brand-new account.
     * @param {{ sub: string, email: string|null, emailVerified: boolean, name: string }} g
     * @param {string|undefined} refreshToken the browser's current refresh cookie, if any
     */
    async googleSignIn(g, refreshToken, meta) {
      const email = g.emailVerified ? normalizeEmail(g.email) : null

      const [linked] = await db.select().from(users).where(eq(users.googleId, g.sub)).limit(1)
      if (linked) return { user: linked, ...(await issueSession(linked, meta)) }

      if (email) {
        const existing = await findByLogin({ email })
        if (existing) {
          const [user] = await db
            .update(users)
            .set({ googleId: g.sub, isGuest: false, name: existing.name || g.name, updatedAt: new Date() })
            .where(eq(users.id, existing.id))
            .returning()
          return { user, ...(await issueSession(user, meta)) }
        }
      }

      // a guest browsing before sign-up keeps their files, documents and designs
      let guest = null
      if (refreshToken) {
        const [s] = await db.select().from(sessions).where(eq(sessions.tokenHash, sha256(refreshToken))).limit(1)
        if (s && !s.revokedAt && s.expiresAt > new Date()) {
          const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1)
          if (u?.isGuest) guest = u
        }
      }

      const fields = { googleId: g.sub, email, name: g.name, isGuest: false, updatedAt: new Date() }
      let user
      try {
        if (guest) {
          ;[user] = await db.update(users).set(fields).where(eq(users.id, guest.id)).returning()
          await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
        } else {
          ;[user] = await db.insert(users).values({ id: newId(ID_PREFIX.user), ...fields }).returning()
        }
      } catch (err) {
        if (String(err.code) === '23505' || /unique/i.test(err.message)) throw conflict('Bu Google hisobi allaqaçon boşqa hisobga bağlangan')
        throw err
      }
      const { balance } = await coins.signupBonus(user.id)
      user = { ...user, coins: balance }
      return { user, ...(await issueSession(user, meta)) }
    },

    /**
     * Sign in with a phone number proven through the Telegram bot. Order: the account linked
     * to this Telegram user → the account with this phone (gets linked) → the caller's guest
     * account, upgraded in place → a new account.
     * @param {{ phone: string, telegramId: string, name: string }} p
     */
    async phoneSignIn({ phone, telegramId, telegramUsername = null, name }, currentUser, meta) {
      const now = new Date()
      const [linked] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
      const existing = linked ?? (await findByLogin({ phone }))
      if (existing) {
        const [user] = await db
          .update(users)
          .set({
            telegramId,
            telegramUsername,
            isGuest: false,
            name: existing.name || name,
            ...(existing.phone === phone ? { phoneVerifiedAt: now } : {}),
            updatedAt: now,
          })
          .where(eq(users.id, existing.id))
          .returning()
        return { user, ...(await issueSession(user, meta)) }
      }

      const fields = { phone, telegramId, telegramUsername, phoneVerifiedAt: now, name, isGuest: false, updatedAt: now }
      let user
      try {
        if (currentUser?.isGuest) {
          ;[user] = await db.update(users).set(fields).where(eq(users.id, currentUser.id)).returning()
          await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
        } else {
          ;[user] = await db.insert(users).values({ id: newId(ID_PREFIX.user), ...fields }).returning()
        }
      } catch (err) {
        if (String(err.code) === '23505' || /unique/i.test(err.message)) throw conflict('Bu raqam bilan hisob allaqaçon bor — qaytadan urinib köring')
        throw err
      }
      const { balance } = await coins.signupBonus(user.id)
      user = { ...user, coins: balance }
      return { user, ...(await issueSession(user, meta)) }
    },

    /** Rotate a refresh token. Presenting an already-rotated token revokes the whole family. */
    async refresh(refreshToken, meta) {
      if (!refreshToken) throw unauthorized('Sessiya topilmadi — qaytadan kiring')
      const [s] = await db.select().from(sessions).where(eq(sessions.tokenHash, sha256(refreshToken))).limit(1)
      if (!s) throw unauthorized('Sessiya topilmadi — qaytadan kiring')
      if (s.expiresAt < new Date()) throw unauthorized('Sessiya muddati tugagan — qaytadan kiring')
      const [user] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1)
      if (!user) throw unauthorized()

      if (!s.revokedAt) {
        // conditional revoke: of two parallel refreshes with the same token only one rotates it
        const won = await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(sessions.id, s.id), isNull(sessions.revokedAt)))
          .returning({ id: sessions.id })
        if (won.length) return { user, ...(await issueSession(user, meta, s.family)) }
        s.revokedAt = new Date() // the other request rotated it a moment ago
      }

      // The token was already rotated. Two tabs refreshing at once, or a reload that dropped the
      // response, send the old token again a moment later — that is not theft. Within the grace
      // window, and only while the family still has a live successor (logout and password change
      // leave none), give this caller its own session and keep the others.
      const recent = Date.now() - new Date(s.revokedAt).getTime() < REUSE_GRACE_MS
      if (recent) {
        const [live] = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(and(eq(sessions.family, s.family), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
          .limit(1)
        if (live) return { user, ...(await issueSession(user, meta, s.family)) }
      }

      // a long-retired token coming back: treat as stolen and close the whole family
      await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.family, s.family), isNull(sessions.revokedAt)))
      throw new AppError(401, 'SESSION_REUSED', 'Xavfsizlik uçun sessiya yopildi — qaytadan kiring')
    },

    async logout(refreshToken) {
      if (!refreshToken) return
      await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(refreshToken)))
    },

    async changePassword(user, current, next) {
      if (user.passwordHash && !(await verifyPassword(current ?? '', user.passwordHash))) {
        throw new AppError(400, 'INVALID_CREDENTIALS', 'Joriy parol notöğri')
      }
      await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, user.id))
      await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
    },
  }
}
