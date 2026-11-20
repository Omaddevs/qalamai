// Own, privacy-friendly site analytics: one small beacon per page view (POST /api/v1/t).
// An anonymous visitor id (localStorage + a first-party cookie, so sign-up can be attributed
// to the visit that brought the user) and a session id that ends after 30 idle minutes.
// If an admin set a Google Analytics id, the beacon's answer switches gtag on as well.

const ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const VID = 'qalam.vid'
const SID = 'qalam.sid'
const IDLE_MS = 30 * 60_000

const rid = (p) => `${p}_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20)}`

function visitorId() {
  let v = null
  try {
    v = localStorage.getItem(VID)
    if (!v) localStorage.setItem(VID, (v = rid('v')))
  } catch {
    v ??= rid('v')
  }
  document.cookie = `qalam_vid=${v}; path=/; max-age=63072000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
  return v
}

/** { id, entry } — entry is true for the first view of a new session. */
function session() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SID) || localStorage.getItem(SID) || 'null')
    const fresh = !saved || Date.now() - saved.at > IDLE_MS
    const id = fresh ? rid('s') : saved.id
    const json = JSON.stringify({ id, at: Date.now() })
    sessionStorage.setItem(SID, json)
    localStorage.setItem(SID, json)
    return { id, entry: fresh }
  } catch {
    return { id: rid('s'), entry: true }
  }
}

/** The address as a readable page path: landing "/", app "/app", editor "/d/:id" … */
export function currentPath() {
  const h = location.hash
  if (!h || h === '#' || h === '#/welcome') return location.pathname.replace(/(.)\/+$/, '$1') // "/" or a public page ("/narxlar")
  if (/^#\/d\//.test(h)) return '/editor'
  if (h === '#/') return '/app'
  return h.slice(1).split('?')[0]
}

let last = null
let gaLoaded = false

export function trackView(path = currentPath()) {
  if (location.pathname.startsWith('/admin')) return
  if (path === last) return
  last = path
  const { id, entry } = session()
  const params = new URLSearchParams(location.search)
  const utm = {}
  for (const k of ['source', 'medium', 'campaign']) if (params.get(`utm_${k}`)) utm[k] = params.get(`utm_${k}`)
  const body = {
    v: visitorId(),
    s: id,
    p: path,
    e: entry,
    r: entry ? document.referrer : '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    l: navigator.language,
    sc: `${screen.width}x${screen.height}`,
    ...(Object.keys(utm).length ? { u: utm } : {}),
  }
  fetch(`${ORIGIN}/api/v1/t`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true, credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => res?.ga && loadGa(res.ga, path))
    .catch(() => {})
  if (gaLoaded) window.gtag?.('event', 'page_view', { page_path: path })
}

function loadGa(id, path) {
  if (gaLoaded) return
  gaLoaded = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id, { page_path: path })
}

/** Start: the first view now, then one per route change. */
export function startTracking() {
  trackView()
  window.addEventListener('hashchange', () => trackView())
  window.addEventListener('popstate', () => trackView())
}
