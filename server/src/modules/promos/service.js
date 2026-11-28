// Aksiyalar: Juma sovğasi and Döst taklifi (rules and defaults in shared/promos.js).
//   - Friday coins are taken by the user (one ledger row per account per Friday, ref friday:<date>),
//     so nothing runs on a timer and inactive accounts do not pile up coins.
//   - A referral is settled once, when an account that came through someone's link stops being a
//     guest (auth routes call onSignup). The inviter is paid with ref ref:<friend id>.
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError } from '../../lib/errors.js'
import { avatarUrlOf } from '../../lib/avatars.js'
import { randomBytes } from 'node:crypto'
import { REF_ALPHABET, REF_CODE_RE, fridayWindow, promoSettings } from '../../../../shared/promos.js'

const { users, adminSettings, coinLedger, referrals } = schema

const SETTINGS_KEY = 'promos'
const CACHE_MS = 15_000
const isUnique = (err) => String(err.code ?? err.cause?.code) === '23505' || /unique/i.test(err.message)

function newCode(len = 7) {
  const b = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += REF_ALPHABET[b[i] % REF_ALPHABET.length]
  return s
}

/** "Aziz Karimov" → "Aziz K." — what an inviter sees of the friends who joined. */
const shortName = (name) => {
  const [a, b] = String(name ?? '').trim().split(/\s+/)
  return a ? (b ? `${a} ${b[0]}.` : a) : ''
}

export function createPromoService({ db, coins, notifier, log }) {
  let cache = null

  async function settings() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value
    const [row] = await db.select().from(adminSettings).where(eq(adminSettings.key, SETTINGS_KEY)).limit(1)
    const value = promoSettings(row?.value)
    cache = { at: Date.now(), value }
    return value
  }

  async function save(next) {
    const value = promoSettings(next)
    await db
      .insert(adminSettings)
      .values({ key: SETTINGS_KEY, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: adminSettings.key, set: { value, updatedAt: new Date() } })
    cache = { at: Date.now(), value }
    return value
  }

  /** The account's invite code, made on first use. */
  async function codeFor(userId) {
    const [u] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1)
    if (u?.code) return u.code
    for (let i = 0; i < 6; i++) {
      try {
        const [row] = await db
          .update(users)
          .set({ referralCode: newCode(i < 3 ? 7 : 8) })
          .where(and(eq(users.id, userId), sql`${users.referralCode} IS NULL`))
          .returning({ code: users.referralCode })
        if (row) return row.code
        // another request made it in the meantime
        const [again] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1)
        return again?.code ?? null
      } catch (err) {
        if (!isUnique(err)) throw err // a code that is taken: try another one
      }
    }
    throw new AppError(500, 'CODE_FAILED', 'Taklif kodini yaratib bölmadi')
  }

  async function fridayClaimed(userId, key) {
    if (!key) return false
    const [row] = await db.select({ id: coinLedger.id }).from(coinLedger).where(and(eq(coinLedger.userId, userId), eq(coinLedger.ref, `friday:${key}`))).limit(1)
    return Boolean(row)
  }

  return {
    settings,
    save,

    /** Everything the user's «Aksiyalar» page shows. */
    async state(user) {
      const s = await settings()
      const w = fridayWindow()
      const registered = !user.isGuest
      const [claimed, code, mine, friends] = registered
        ? await Promise.all([
            fridayClaimed(user.id, w.key),
            codeFor(user.id),
            db
              .select({
                invited: count(),
                rewarded: sql`count(*) FILTER (WHERE ${referrals.status} = 'rewarded')`.mapWith(Number),
                earned: sql`coalesce(sum(${referrals.coins}), 0)`.mapWith(Number),
              })
              .from(referrals)
              .where(eq(referrals.referrerId, user.id)),
            db
              .select({ name: users.name, status: referrals.status, coins: referrals.coins, at: referrals.createdAt })
              .from(referrals)
              .innerJoin(users, eq(users.id, referrals.friendId))
              .where(eq(referrals.referrerId, user.id))
              .orderBy(desc(referrals.createdAt))
              .limit(20),
          ])
        : [false, null, [{ invited: 0, rewarded: 0, earned: 0 }], []]
      const [{ count: fridays } = { count: 0 }] = registered
        ? await db.select({ count: count() }).from(coinLedger).where(and(eq(coinLedger.userId, user.id), eq(coinLedger.reason, 'promo'), eq(coinLedger.item, 'friday')))
        : []
      const m = mine[0] ?? {}
      const cap = s.referral.maxPerUser
      return {
        registered,
        friday: {
          enabled: s.friday.enabled,
          coins: s.friday.coins,
          today: w.today,
          claimed,
          canClaim: registered && s.friday.enabled && w.today && !claimed,
          endsAt: w.endsAt,
          nextAt: w.nextAt,
          taken: Number(fridays ?? 0),
        },
        referral: {
          enabled: s.referral.enabled,
          coins: s.referral.coins,
          friendCoins: s.referral.friendCoins,
          maxPerUser: cap,
          left: cap ? Math.max(0, cap - Number(m.rewarded ?? 0)) : null,
          code,
          invited: Number(m.invited ?? 0),
          rewarded: Number(m.rewarded ?? 0),
          earned: Number(m.earned ?? 0),
          friends: friends.map((f) => ({ name: shortName(f.name), status: f.status, coins: f.coins, at: f.at })),
        },
      }
    },

    /** Take this Friday's coins. Twice on the same Friday gives nothing more. */
    async claimFriday(user) {
      if (user.isGuest) throw new AppError(403, 'REGISTER_REQUIRED', 'Juma sovğasini oliş uçun röyxatdan öting.')
      const s = await settings()
      if (!s.friday.enabled) throw new AppError(409, 'PROMO_OFF', 'Juma aksiyasi hozir öçirilgan.')
      const w = fridayWindow()
      if (!w.today) throw new AppError(409, 'NOT_FRIDAY', 'Juma sovğasini faqat juma kuni oliş mumkin.', { nextAt: w.nextAt })
      const res = await coins.award(user.id, s.friday.coins, 'promo', { item: 'friday', ref: `friday:${w.key}`, meta: { day: w.key } })
      if (res.repeated) throw new AppError(409, 'ALREADY_CLAIMED', 'Bu juma sovğasini allaqaçon olgansiz.', { nextAt: w.nextAt, balance: res.balance })
      await notifier?.send(user.id, 'promo.friday', { coins: s.friday.coins, balance: res.balance })
      return { coins: s.friday.coins, balance: res.balance, nextAt: w.nextAt }
    },

    /** Is this a code someone can be invited with? (sign-up page banner) */
    async checkCode(code) {
      if (!REF_CODE_RE.test(code)) return null
      const s = await settings()
      const [u] = await db.select({ name: users.name, isGuest: users.isGuest }).from(users).where(eq(users.referralCode, code)).limit(1)
      if (!u || u.isGuest) return null
      return { name: shortName(u.name), enabled: s.referral.enabled, friendCoins: s.referral.enabled ? s.referral.friendCoins : 0 }
    },

    /**
     * A new account finished signing up. `code` comes from the ref cookie, `visitorId` from the
     * analytics cookie of the browser it signed up in. Never throws: sign-up must not fail on this.
     */
    async onSignup(friend, { code, visitorId }) {
      try {
        if (!code || !REF_CODE_RE.test(code) || friend.isGuest) return null
        const [ref] = await db
          .select({ id: users.id, isGuest: users.isGuest, visitorId: users.visitorId })
          .from(users)
          .where(eq(users.referralCode, code))
          .limit(1)
        if (!ref || ref.isGuest || ref.id === friend.id) return null
        const s = (await settings()).referral

        let reason = null
        if (!s.enabled) reason = 'off'
        else if (visitorId && ref.visitorId && visitorId === ref.visitorId) reason = 'same_device' // inviting yourself from the same browser
        else if (s.maxPerUser) {
          const [{ n }] = await db
            .select({ n: count() })
            .from(referrals)
            .where(and(eq(referrals.referrerId, ref.id), eq(referrals.status, 'rewarded')))
          if (Number(n) >= s.maxPerUser) reason = 'limit'
        }
        const rewarded = !reason
        const row = { friendId: friend.id, referrerId: ref.id, code, status: rewarded ? 'rewarded' : 'skipped', reason, coins: rewarded ? s.coins : 0, friendCoins: rewarded ? s.friendCoins : 0 }
        const [saved] = await db.insert(referrals).values(row).onConflictDoNothing().returning()
        if (!saved) return null // this account was already counted
        if (!rewarded) return saved

        const paid = await coins.award(ref.id, s.coins, 'referral', { item: 'inviter', ref: `ref:${friend.id}`, meta: { friend: friend.id } })
        if (!paid.repeated) await notifier?.send(ref.id, 'referral.reward', { coins: s.coins, balance: paid.balance, name: shortName(friend.name) })
        if (s.friendCoins > 0) {
          const extra = await coins.award(friend.id, s.friendCoins, 'referral', { item: 'friend', ref: 'referral:friend', meta: { referrer: ref.id } })
          if (!extra.repeated) await notifier?.send(friend.id, 'referral.welcome', { coins: s.friendCoins, balance: extra.balance })
          return { ...saved, balance: extra.balance }
        }
        return saved
      } catch (err) {
        log?.warn({ err }, 'promos: referral not settled')
        return null
      }
    },

    /** Numbers and lists for the admin «Aksiyalar» page. */
    async adminStats(fridays) {
      const q = async (query) => {
        const r = await db.execute(query)
        return r.rows ?? r
      }
      const refs = fridays.map((d) => `friday:${d}`)
      const [byFriday, fTotal, rTotal, rDays, top, recent, reach] = await Promise.all([
        q(sql`SELECT substr(ref, 8) AS day, count(*)::int AS users, coalesce(sum(delta), 0)::int AS coins
              FROM coin_ledger WHERE reason = 'promo' AND item = 'friday' AND ref IN (${sql.join(refs.map((r) => sql`${r}`), sql`, `)})
              GROUP BY 1`),
        q(sql`SELECT count(*)::int AS claims, count(DISTINCT user_id)::int AS users, coalesce(sum(delta), 0)::int AS coins
              FROM coin_ledger WHERE reason = 'promo' AND item = 'friday'`),
        q(sql`SELECT count(*)::int AS total,
                     count(*) FILTER (WHERE status = 'rewarded')::int AS rewarded,
                     count(*) FILTER (WHERE status = 'skipped')::int AS skipped,
                     count(DISTINCT referrer_id)::int AS referrers,
                     coalesce(sum(coins + friend_coins), 0)::int AS coins,
                     count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week
              FROM referrals`),
        q(sql`SELECT to_char(created_at + interval '5 hours', 'YYYY-MM-DD') AS day, count(*)::int AS n
              FROM referrals WHERE created_at >= now() - interval '30 days' GROUP BY 1`),
        q(sql`SELECT r.referrer_id AS id, u.name, u.email, u.phone, u.avatar_key, u.avatar_at,
                     count(*)::int AS invited, count(*) FILTER (WHERE r.status = 'rewarded')::int AS rewarded,
                     coalesce(sum(r.coins), 0)::int AS coins
              FROM referrals r JOIN users u ON u.id = r.referrer_id
              GROUP BY r.referrer_id, u.name, u.email, u.phone, u.avatar_key, u.avatar_at
              ORDER BY invited DESC, coins DESC LIMIT 10`),
        q(sql`SELECT r.friend_id, f.name AS friend_name, f.email AS friend_email, f.phone AS friend_phone,
                     r.referrer_id, p.name AS referrer_name, r.status, r.reason, r.coins, r.friend_coins, r.created_at
              FROM referrals r JOIN users f ON f.id = r.friend_id JOIN users p ON p.id = r.referrer_id
              ORDER BY r.created_at DESC LIMIT 25`),
        q(sql`SELECT count(*)::int AS registered FROM users WHERE NOT is_guest`),
      ])
      const per = Object.fromEntries(byFriday.map((r) => [r.day, r]))
      const days = Object.fromEntries(rDays.map((r) => [r.day, r.n]))
      const today = Date.now()
      return {
        registered: reach[0]?.registered ?? 0,
        friday: {
          weeks: fridays.map((d) => ({ day: d, users: per[d]?.users ?? 0, coins: per[d]?.coins ?? 0 })),
          ...(fTotal[0] ?? { claims: 0, users: 0, coins: 0 }),
        },
        referral: {
          ...(rTotal[0] ?? {}),
          daily: Array.from({ length: 30 }, (_, i) => {
            const d = new Date(today - (29 - i) * 86_400_000 + 5 * 3600_000).toISOString().slice(0, 10)
            return { day: d, n: days[d] ?? 0 }
          }),
          top: top.map((r) => ({ id: r.id, name: r.name, contact: r.email || r.phone || '', avatarUrl: avatarUrlOf(r.id, r.avatar_key, r.avatar_at), invited: r.invited, rewarded: r.rewarded, coins: r.coins })),
          recent: recent.map((r) => ({
            friend: { id: r.friend_id, name: r.friend_name, contact: r.friend_email || r.friend_phone || '' },
            referrer: { id: r.referrer_id, name: r.referrer_name },
            status: r.status,
            reason: r.reason,
            coins: r.coins,
            friendCoins: r.friend_coins,
            at: r.created_at,
          })),
        },
      }
    },
  }
}
