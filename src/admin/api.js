// Admin API client. The session is an httpOnly cookie (path /api/v1/admin) — no tokens in JS.
const ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const BASE = `${ORIGIN}/api/v1/admin`

export class AdminError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const listeners = new Set()
/** Called when the server says the admin session is over. */
export const onSignedOut = (fn) => (listeners.add(fn), () => listeners.delete(fn))

async function request(method, path, json) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: { 'x-lang': 'uz', ...(json !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    })
  } catch {
    throw new AdminError(0, 'OFFLINE', 'Server bilan bağlanib bölmadi. Internetni tekşiring.')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') listeners.forEach((fn) => fn())
    throw new AdminError(res.status, body?.error?.code ?? 'HTTP', body?.error?.message ?? 'Xatolik yuz berdi')
  }
  return body
}

export const admin = {
  me: () => request('GET', '/me'),
  login: (password) => request('POST', '/login', { password }),
  logout: () => request('POST', '/logout'),
  changePassword: (current, next) => request('POST', '/password', { current, next }),
  stats: (days) => request('GET', `/stats?days=${days}`),
  userStats: (days) => request('GET', `/users/stats?days=${days}`),
  users: (params) => request('GET', `/users?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}`),
  user: (id) => request('GET', `/users/${encodeURIComponent(id)}`),
  grantCoins: (id, amount, note) => request('POST', `/users/${encodeURIComponent(id)}/coins`, { amount, note }),
  chat: (params) => request('GET', `/chat?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}`),
  setChatStatus: (id, status) => request('PATCH', `/chat/${encodeURIComponent(id)}`, { status }),
  settings: () => request('GET', '/settings'),
  saveSettings: (patch) => request('PATCH', '/settings', patch),
}

export const apiUrl = (path) => (path?.startsWith('http') ? path : `${ORIGIN}${path}`)
