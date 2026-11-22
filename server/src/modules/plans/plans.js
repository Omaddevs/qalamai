// Limits for each kind of account — the single place to change them.
// There are no subscriptions: AI work is paid with QalamCoin (shared/coins.js). Buying coins
// once makes an account "premium" for good: no watermark, Pro templates, bigger files.

// keepFiles is off everywhere: the file studio keeps files on the user's device (IndexedDB). A file
// reaches the server only when a tool has to fall back to it, and that copy expires (FILE_TTL_HOURS).
export const PLAN_LIMITS = {
  guest: { label: 'Mehmon', maxFileMb: 15, maxFilesPerJob: 5, dailyToolRuns: 10, maxPdfPages: 60, keepFiles: false },
  free: { label: 'Bepul', maxFileMb: 25, maxFilesPerJob: 10, dailyToolRuns: 25, maxPdfPages: 150, keepFiles: false },
  premium: { label: 'Premium', maxFileMb: 200, maxFilesPerJob: 50, dailyToolRuns: 1000, maxPdfPages: 2000, keepFiles: false },
  edu: { label: 'Taʼlim', maxFileMb: 200, maxFilesPerJob: 50, dailyToolRuns: 1000, maxPdfPages: 2000, keepFiles: false },
}

const active = (user) => !user.planExpiresAt || new Date(user.planExpiresAt) >= new Date()

/** The limits tier in force. Accounts given 'pro' or 'edu' by hand keep it until it expires. */
export function effectivePlan(user) {
  if (user.isGuest) return 'guest'
  if (user.plan === 'edu' && active(user)) return 'edu'
  if (user.coinsPurchasedAt || (user.plan === 'pro' && active(user))) return 'premium'
  return 'free'
}

export const limitsFor = (user) => ({ plan: effectivePlan(user), ...PLAN_LIMITS[effectivePlan(user)] })

/** Calendar day in Tashkent (UTC+5, no DST) — daily limits reset at local midnight. */
export function tashkentDay(date = new Date()) {
  return new Date(date.getTime() + 5 * 3600_000).toISOString().slice(0, 10)
}
