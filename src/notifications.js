// Bildirişnomalar on the client: the list API and one shared unread count, which the bell in the
// rail and the notifications page both follow.
import { api } from './api.js'

let unread = 0
const subs = new Set()
const setUnread = (n) => {
  unread = Math.max(0, n | 0)
  subs.forEach((fn) => fn(unread))
}

/** Calls `fn` with the unread count now and after every change; returns the unsubscribe. */
export function onUnread(fn) {
  subs.add(fn)
  fn(unread)
  return () => subs.delete(fn)
}

export async function refreshUnread() {
  try {
    setUnread((await api.get('/notifications/unread')).unread)
  } catch {
    /* offline or signed out: keep the last count */
  }
}

export async function listNotifications(before = null) {
  const q = new URLSearchParams({ limit: '30', ...(before ? { before } : {}) })
  const res = await api.get(`/notifications?${q}`)
  setUnread(res.unread)
  return res
}

export async function markRead(id) {
  setUnread(unread - 1) // optimistic; the answer brings the true count
  try {
    setUnread((await api.post(`/notifications/${id}/read`)).unread)
  } catch {
    refreshUnread()
  }
}

export async function markAllRead() {
  setUnread(0)
  await api.post('/notifications/read-all').catch(refreshUnread)
}

const POLL_MS = 90_000

/** Keeps the count fresh while the tab is visible. Returns the stop function. */
export function watchUnread() {
  refreshUnread()
  const tick = () => document.visibilityState === 'visible' && refreshUnread()
  const timer = setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', tick)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
  }
}
