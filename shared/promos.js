// Aksiyalar — the two coin promotions, shared by the server, the web app and the admin panel.
//   Juma sovğasi:   every Friday (Tashkent time) each registered account can take free coins once.
//   Döst taklifi:   an account shares its link; when someone signs up through it, the inviter gets coins
//                   (and, if the admin sets it, the new friend gets extra coins on top of the welcome bonus).
// The admin turns each one on/off and sets the amounts (admin_settings key 'promos').

export const PROMO_DEFAULTS = {
  friday: { enabled: true, coins: 20 },
  referral: { enabled: true, coins: 30, friendCoins: 0, maxPerUser: 0 },
}

/** Allowed ranges for the admin's numbers. maxPerUser 0 = no limit; friendCoins 0 = no extra for the friend. */
export const PROMO_LIMITS = {
  fridayCoins: { min: 1, max: 1000 },
  referralCoins: { min: 1, max: 1000 },
  friendCoins: { min: 0, max: 1000 },
  maxPerUser: { min: 0, max: 10000 },
}

/** ?ref=<code> on any page of the site; the browser keeps it in this cookie until sign-up. */
export const REF_PARAM = 'ref'
export const REF_COOKIE = 'qalam_ref'
export const REF_DAYS = 30
export const REF_CODE_RE = /^[A-Z2-9]{6,10}$/
/** Code letters: no 0/O, 1/I/L — easy to read aloud and type. */
export const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** The sign-up address a code is shared with. */
export const referralLink = (origin, code) => `${origin.replace(/\/+$/, '')}/royxatdan-otish?${REF_PARAM}=${code}`

/** Settings as saved, filled with the defaults for anything missing. */
export function promoSettings(saved) {
  const s = saved ?? {}
  return {
    friday: { ...PROMO_DEFAULTS.friday, ...(s.friday ?? {}) },
    referral: { ...PROMO_DEFAULTS.referral, ...(s.referral ?? {}) },
  }
}

/* ───────── Friday in Tashkent time (UTC+5, no daylight saving) ───────── */

const TZ_MS = 5 * 3600_000
const DAY_MS = 24 * 3600_000
const FRIDAY = 5

/** 'YYYY-MM-DD' of the Tashkent day `at` falls on. */
export const tashkentDay = (at = new Date()) => new Date(at.getTime() + TZ_MS).toISOString().slice(0, 10)
const tashkentWeekday = (at) => new Date(at.getTime() + TZ_MS).getUTCDay()
/** Start of the Tashkent day `at` falls on, as a UTC instant. */
const dayStart = (at) => new Date(Math.floor((at.getTime() + TZ_MS) / DAY_MS) * DAY_MS - TZ_MS)

/** Is it Friday in Tashkent right now? */
export const isFriday = (at = new Date()) => tashkentWeekday(at) === FRIDAY

/**
 * { today, key, startsAt, endsAt, nextAt }: `key` is today's date when it is Friday (else null),
 * `startsAt`/`endsAt` bound this Friday, `nextAt` is the start of the next Friday after now.
 */
export function fridayWindow(at = new Date()) {
  const start = dayStart(at)
  const wd = tashkentWeekday(at)
  const today = wd === FRIDAY
  const ahead = (FRIDAY - wd + 7) % 7 || 7 // days to the next Friday (a full week on Friday itself)
  return {
    today,
    key: today ? tashkentDay(at) : null,
    startsAt: today ? start : null,
    endsAt: today ? new Date(start.getTime() + DAY_MS) : null,
    nextAt: new Date(start.getTime() + ahead * DAY_MS),
  }
}

/** The last `n` Fridays up to today (newest first), as 'YYYY-MM-DD'. */
export function lastFridays(n, at = new Date()) {
  const back = (tashkentWeekday(at) - FRIDAY + 7) % 7
  const last = dayStart(at).getTime() - back * DAY_MS
  return Array.from({ length: n }, (_, i) => tashkentDay(new Date(last - i * 7 * DAY_MS + 12 * 3600_000)))
}
