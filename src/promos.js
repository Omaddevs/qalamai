// Aksiyalar on the client: Juma sovğasi and Döst taklifi (rules in shared/promos.js).
import { useEffect, useState } from 'react'
import { api, apiUrl, currentUser, onUser, updateUser } from './api.js'
import { REF_COOKIE, REF_CODE_RE, REF_DAYS, REF_PARAM, referralLink } from '../shared/promos.js'

export { referralLink }

/**
 * A visitor who opened someone's invite link (?ref=CODE on any page): keep the code in a cookie
 * the API reads at sign-up, and take it out of the address bar. The first link wins for 30 days.
 */
export function captureReferral() {
  try {
    const url = new URL(window.location.href)
    const raw = url.searchParams.get(REF_PARAM)
    if (raw == null) return
    const code = raw.trim().toUpperCase()
    if (REF_CODE_RE.test(code) && !readRefCode()) {
      document.cookie = `${REF_COOKIE}=${code}; path=/; max-age=${REF_DAYS * 86400}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
    }
    url.searchParams.delete(REF_PARAM)
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* cookies or history unavailable */
  }
}

/** The invite code this browser came with, if any. */
export function readRefCode() {
  const m = document.cookie.match(new RegExp(`(?:^|; )${REF_COOKIE}=([A-Z2-9]{6,10})`))
  return m?.[1] ?? null
}

/** Who invites this browser: { name, enabled, friendCoins } or null. */
// public: the visitor has no session yet on the sign-up page
export const checkInvite = (code) =>
  fetch(apiUrl(`/api/v1/promos/invite/${encodeURIComponent(code)}`))
    .then((r) => (r.ok ? r.json() : null))
    .then((r) => r?.invite ?? null, () => null)

export const getPromos = () => api.get('/promos')

export async function claimFriday() {
  const r = await api.post('/promos/friday/claim', {})
  updateUser({ coins: r.balance })
  emit()
  return r
}

/* ───────── "the Friday gift is waiting" — for the rail dot and the one-time popup ───────── */

const EVENT = 'qalam:promos'
const emit = () => window.dispatchEvent(new Event(EVENT))
/** Tell every listener to read the promotions again (after a claim). */
export const promosChanged = emit

/** { canClaim, coins, key } for the signed-in account; re-read after a claim and every 10 minutes. */
export function useFridayGift() {
  const [state, setState] = useState(null)
  const [uid, setUid] = useState(() => currentUser()?.id ?? null)
  useEffect(() => onUser((u) => setUid(u && !u.isGuest ? u.id : null)), [])
  useEffect(() => {
    if (!uid) return setState(null)
    let live = true
    const load = () =>
      getPromos().then(
        (r) => live && setState({ canClaim: r.friday.canClaim, coins: r.friday.coins, endsAt: r.friday.endsAt }),
        () => {},
      )
    load()
    const id = setInterval(load, 10 * 60_000)
    window.addEventListener(EVENT, load)
    return () => {
      live = false
      clearInterval(id)
      window.removeEventListener(EVENT, load)
    }
  }, [uid])
  return state
}

/** Countdown parts until `to`: { d, h, m, s, done }. Ticks every second. */
export function useCountdown(to) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!to) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [to])
  const left = to ? Math.max(0, new Date(to).getTime() - now) : 0
  return {
    d: Math.floor(left / 86_400_000),
    h: Math.floor(left / 3_600_000) % 24,
    m: Math.floor(left / 60_000) % 60,
    s: Math.floor(left / 1000) % 60,
    done: Boolean(to) && left === 0,
  }
}

// the popup shows once per Friday per browser
const SEEN_KEY = 'qalam.friday.seen'
export function fridaySeen(endsAt) {
  try {
    return localStorage.getItem(SEEN_KEY) === String(endsAt)
  } catch {
    return true
  }
}
export function markFridaySeen(endsAt) {
  try {
    localStorage.setItem(SEEN_KEY, String(endsAt))
  } catch {
    /* storage unavailable */
  }
}
