// QalamAI API client.
// • Sessions start silently: refresh cookie → else a guest account (no sign-up wall).
// • 401 → one refresh + retry.  • Uploads report progress.  • Jobs are long-polled.
// In development Vite proxies /api to the Node server (see vite.config.js).

import { formatNumber, getLang, has, t } from './i18n/index.js'
import { clearProfile } from './profile.js'
import { pageByPath, pathOf } from './landing/pages.js'
import { go } from './nav.js'

const ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const BASE = `${ORIGIN}/api/v1`

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Every request tells the API the interface language, so its messages come back translated. */
const H = (extra) => ({ 'x-lang': getLang(), ...extra })

let access = null
let user = null
let session = null
const listeners = new Set()

export const onUser = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
// Set once a real (non-guest) account signs in here. A browser that had an account must never be
// switched to a fresh guest behind the user's back — it is sent to the sign-in page instead.
const ACCOUNT_KEY = 'qalamai.account'
const hadAccount = () => {
  try {
    return localStorage.getItem(ACCOUNT_KEY) === '1'
  } catch {
    return false
  }
}
const setSession = (body) => {
  access = body.accessToken
  user = body.user
  try {
    if (user && !user.isGuest) localStorage.setItem(ACCOUNT_KEY, '1')
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(user))
}
export const currentUser = () => user

/** Merge fields into the signed-in user (e.g. a new coin balance) and tell listeners. */
export function updateUser(patch) {
  if (!user) return
  user = { ...user, ...patch }
  listeners.forEach((fn) => fn(user))
}

/** Absolute URL for paths the API returns (signed file links). */
// only API paths go to the API origin; others (e.g. the drawn avatars in /avatars/) are the web app's own files
export const apiUrl = (path) => (path?.startsWith('/api/') ? `${ORIGIN}${path}` : path)

/**
 * The server words its errors in Uzbek. In another interface language, a known error code gets
 * its translated text (with the error's details as variables); unknown codes keep the server's.
 */
export function errorText(code, message, details) {
  if (getLang() === 'uz') return message
  const key = code === 'QUOTA_EXCEEDED' && details?.kind ? `err.code.QUOTA_EXCEEDED.${details.kind}` : `err.code.${code}`
  return has(key) ? t(key, details ?? {}) : message
}

async function parse(res) {
  const type = res.headers.get('content-type') ?? ''
  const body = type.includes('json') ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const e = body?.error
    throw new ApiError(res.status, e?.code ?? 'HTTP_ERROR', e?.message ? errorText(e.code, e.message, e.details) : t('err.network'), e?.details)
  }
  return body
}

function offline() {
  return new ApiError(0, 'OFFLINE', t('err.offline'))
}

/** Run fn with a lock shared by every tab, so two tabs never rotate the same refresh cookie at once. */
const acrossTabs = (fn) => (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('qalam-session', fn) : fn())

async function startSession() {
  session ??= acrossTabs(async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: H() })
      if (r.ok) return setSession(await r.json())
      // Server errors / no network: keep whatever the user had, try again later.
      if (r.status >= 500) throw offline()
      // No account session: nothing in the app works without one (there are no guests). A browser
      // that had an account is told its session ended; anyone else goes to sign-up.
      const had = hadAccount()
      signedOut(had ? 'login' : 'signup')
      throw had ? new ApiError(401, 'SESSION_EXPIRED', t('err.sessionExpired')) : new ApiError(401, 'SIGN_IN_REQUIRED', t('err.signInRequired'))
    } catch (err) {
      throw err instanceof ApiError ? err : offline()
    }
  }).finally(() => {
    session = null
  })
  return session
}

export async function request(method, path, { json, form, signal, retry = true } = {}) {
  if (!access) await startSession()
  const headers = H({ authorization: `Bearer ${access}` })
  if (json !== undefined) headers['content-type'] = 'application/json'
  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, credentials: 'include', signal, body: json !== undefined ? JSON.stringify(json) : form })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw offline()
  }
  if (res.status === 401 && retry) {
    access = null
    await startSession()
    return request(method, path, { json, form, signal, retry: false })
  }
  return parse(res)
}

export const api = {
  get: (p, o) => request('GET', p, o),
  post: (p, json, o) => request('POST', p, { ...o, json }),
  patch: (p, json, o) => request('PATCH', p, { ...o, json }),
  put: (p, json, o) => request('PUT', p, { ...o, json }),
  del: (p, o) => request('DELETE', p, o),
}

/* ───────── auth ───────── */

export async function ensureSession() {
  if (!access) await startSession()
  return user
}

/**
 * The signed-in account, or null — without sending anyone anywhere. For the sign-in pages,
 * which only want to know whether to skip the form.
 */
export async function peekSession() {
  if (access) return user
  try {
    const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: H() })
    if (!r.ok) return null
    setSession(await r.json())
    return user
  } catch {
    return null
  }
}

export async function register({ login, password, name }) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: H({ 'content-type': 'application/json' }),
    body: JSON.stringify({ login, password, name }),
  })
  setSession(await parse(res))
  return user
}

export async function login({ login: id, password }) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', credentials: 'include', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ login: id, password }) })
  setSession(await parse(res))
  return user
}

/**
 * "Google bilan kiriş": a full-page trip to Google and back; the server finishes the session.
 * mode 'login' only enters an existing account, 'signup' only opens a new one.
 */
export function signInWithGoogle(mode) {
  window.location.assign(`${BASE}/auth/google?mode=${mode === 'signup' ? 'signup' : 'login'}&lang=${encodeURIComponent(getLang())}`)
}

/* Telegram: the bot confirms the user's own number and sends a code. */

const TG_AUTOFILL = 'qalam.tg.autofill'
/** "Tasdiqlaş kodini avtomatik kiritiş" — on unless turned off in Sozlamalar. */
export const tgAutofill = () => localStorage.getItem(TG_AUTOFILL) !== 'off'
export const setTgAutofill = (on) => localStorage.setItem(TG_AUTOFILL, on ? 'on' : 'off')

export async function telegramStart(phone, mode) {
  const res = await fetch(`${BASE}/auth/telegram/start`, { method: 'POST', credentials: 'include', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ phone, ...(mode ? { mode } : {}) }) }).catch(() => {
    throw offline()
  })
  return parse(res)
}

export async function telegramStatus(id, { signal } = {}) {
  const res = await fetch(`${BASE}/auth/telegram/${encodeURIComponent(id)}`, { credentials: 'include', headers: H(), signal })
  return parse(res)
}

export async function telegramVerify(id, code, name, mode) {
  const res = await fetch(`${BASE}/auth/telegram/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: H({ 'content-type': 'application/json' }),
    body: JSON.stringify({ code, ...(name ? { name } : {}), ...(mode ? { mode } : {}) }),
  })
  setSession(await parse(res))
  return user
}

/**
 * Change the password. The server closes every session on it, so sign straight back in
 * with the new password — the user stays on the page instead of being thrown out.
 */
export async function changePassword(current, next) {
  await api.post('/me/password', { current, next })
  const id = user?.phone || user?.email
  if (id) await login({ login: id, password: next })
}

/** Forget the session locally and open the sign-in (or sign-up) page — unless one is already open. */
function signedOut(to = 'login') {
  access = null
  user = null
  listeners.forEach((fn) => fn(null))
  if (typeof window === 'undefined' || !window.location) return
  const onAuthPage = /^#\/auth/.test(window.location.hash) || Boolean(pageByPath(window.location.pathname)?.auth)
  if (!onAuthPage) go(pathOf(to === 'signup' ? 'signup' : 'login'), { replace: true })
}

export async function logout() {
  await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include', headers: H() }).catch(() => {})
  access = null
  user = null
  clearProfile()
  // a deliberate sign-out: forget this browser's account and its local copies
  for (const k of ['qalamai.sync.v1', 'qalamai.designs.v1', 'qalamai.docs.v1', ACCOUNT_KEY]) localStorage.removeItem(k)
  listeners.forEach((fn) => fn(null))
  // the file studio's files kept on this device (src/files/store.js closes its connection above)
  try {
    indexedDB.deleteDatabase('qalamai-files')
  } catch {
    /* no IndexedDB */
  }
}

/* ───────── files ───────── */

/**
 * Upload files with progress. Resolves to the stored file records.
 * @param {File[]} files
 * @param {(fraction: number) => void} [onProgress]
 */
export async function uploadFiles(files, onProgress, { signal } = {}) {
  if (!access) await startSession()
  const send = () =>
    new Promise((resolve, reject) => {
      const form = new FormData()
      for (const f of files) form.append('file', f, f.name)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/files`)
      xhr.withCredentials = true
      xhr.setRequestHeader('authorization', `Bearer ${access}`)
      xhr.setRequestHeader('x-lang', getLang())
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () => {
        let body = null
        try {
          body = JSON.parse(xhr.responseText)
        } catch {
          /* not JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.files)
        else reject(new ApiError(xhr.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ? errorText(body.error.code, body.error.message, body.error.details) : t('err.upload')))
      }
      xhr.onerror = () => reject(offline())
      xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'))
      signal?.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(form)
    })
  try {
    return await send()
  } catch (err) {
    if (err.status !== 401) throw err
    access = null
    await startSession()
    return send()
  }
}

export const listFiles = (params = {}) => api.get(`/files?${new URLSearchParams(params)}`).then((r) => r.files)
export const deleteFile = (id) => api.del(`/files/${id}`)
export const renameFile = (id, name) => api.patch(`/files/${id}`, { name })

/** Fetch a stored file's bytes (e.g. to open a DOCX result in the editor). */
export async function fetchFile(file) {
  const res = await fetch(apiUrl(file.url))
  if (!res.ok) throw new ApiError(res.status, 'HTTP_ERROR', t('err.fetchFile'))
  return new File([await res.blob()], file.name, { type: file.mime })
}

/** Trigger a browser download of a stored file. */
export function downloadFile(file) {
  const a = document.createElement('a')
  a.href = apiUrl(file.downloadUrl)
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
}

/* ───────── tools & jobs ───────── */

// The catalog's titles come back in the interface language — keep one per language.
const catalogs = new Map()
export function getTools() {
  const lang = getLang()
  // titles and descriptions come from the server in Uzbek: swap in the interface language's
  const local = (tool) => {
    const key = `fs.tool.${tool.id}`
    if (!has(key)) return tool
    const [title, description] = t(key).split('|')
    return { ...tool, title, description }
  }
  if (!catalogs.has(lang)) catalogs.set(lang, api.get('/tools').then((r) => r.tools.map(local)).catch((e) => (catalogs.delete(lang), Promise.reject(e))))
  return catalogs.get(lang)
}

const TERMINAL = new Set(['done', 'failed', 'canceled'])

/**
 * Start a tool and follow it to the end.
 * @param {(job: object) => void} [onUpdate] called on every progress change
 * @returns {Promise<object>} the finished job (status done) — throws ApiError when it failed
 */
export async function runTool(toolId, fileIds, options = {}, { onUpdate, signal } = {}) {
  let job = await api.post(`/tools/${toolId}/jobs`, { fileIds, options }, { signal })
  onUpdate?.(job)
  while (!TERMINAL.has(job.status)) {
    if (signal?.aborted) {
      await api.post(`/jobs/${job.id}/cancel`).catch(() => {})
      throw new DOMException('aborted', 'AbortError')
    }
    job = await api.get(`/jobs/${job.id}?wait=20000`, { signal })
    onUpdate?.(job)
  }
  if (job.status !== 'done') {
    const code = job.error?.code ?? job.status.toUpperCase()
    throw new ApiError(422, code, job.error?.message ? errorText(code, job.error.message, job.error.details) : t('err.jobFailed'))
  }
  return job
}

/** Change the profile picture: `{ preset: 1…15 }` or `{ image: dataUrl }`. Returns the updated user. */
export async function setAvatar(body) {
  const u = await api.put('/me/avatar', body)
  updateUser({ avatarUrl: u.avatarUrl })
  return u
}

export const getUsage = () => api.get('/me/usage')

/* ───────── helpers ───────── */

export function formatSize(n) {
  if (n == null) return ''
  if (n >= 1048576) return t('size.mb', { n: formatNumber(n / 1048576, { maximumFractionDigits: n >= 10485760 ? 0 : 1 }) })
  if (n >= 1024) return t('size.kb', { n: formatNumber(Math.round(n / 1024)) })
  return t('size.b', { n })
}

export function timeLeft(iso) {
  if (!iso) return null
  const ms = new Date(iso) - Date.now()
  if (ms <= 0) return t('time.expired')
  const h = Math.floor(ms / 3600_000)
  if (h >= 1) return t('time.delHours', { n: h })
  return t('time.delMinutes', { n: Math.max(1, Math.round(ms / 60_000)) })
}

/* ───────── link in bio ───────── */

export const checkBioSlug = (slug) => api.get(`/bio/check/${encodeURIComponent(slug)}`)
export const getBioPage = (designId) => api.get(`/bio/design/${encodeURIComponent(designId)}`).then((r) => r.page)
export const publishBio = (slug, designId, data) => request('PUT', `/bio/${encodeURIComponent(slug)}`, { json: { designId, data } })
export const unpublishBio = (slug) => api.del(`/bio/${encodeURIComponent(slug)}`)

/** Single-file HTML of the page, rendered by the server exactly like the public one. */
export async function exportBioHtml(data) {
  if (!access) await startSession()
  const res = await fetch(`${BASE}/bio/export`, {
    method: 'POST',
    credentials: 'include',
    headers: H({ 'content-type': 'application/json', authorization: `Bearer ${access}` }),
    body: JSON.stringify({ data }),
  })
  if (!res.ok) await parse(res)
  return res.blob()
}

/* ───────── QalamChat ───────── */

/**
 * The signed-in user without side effects: uses the current session or the refresh cookie,
 * but never creates a guest account (the landing page must not make one just by opening the chat).
 */
export async function peekUser() {
  if (user) return user
  try {
    await acrossTabs(async () => {
      if (access) return
      const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: H() })
      if (r.ok) setSession(await r.json())
    })
  } catch {
    /* offline: treat as signed out */
  }
  return user
}

export const supportMessages = () => api.get('/support').then((r) => r.messages)
export const sendSupport = (topic, message, contact) => api.post('/support', { topic, message, contact }).then((r) => r.message)
