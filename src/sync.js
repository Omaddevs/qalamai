// Keeps the browser's copies (localStorage) and the account on the server in step.
//
// The UI keeps reading and writing localStorage — fast, and it still works offline. In the
// background this module:
//   • uploads what changed here (PUT under the browser's own id, last write wins by updatedAt),
//   • downloads what changed on another device,
//   • mirrors deletions both ways (an id we synced before that is now missing on one side was deleted there),
//   • keeps the profile in users.profile.
// When something arrives from the server it fires `qalam:synced` so screens reload their lists.

import { api, currentUser, logout, onUser, request } from './api.js'
import { LOCAL_CHANGE, SYNCED } from './changes.js'
import { t } from './i18n/index.js'
import { readDesignsRaw, writeDesignsRaw } from './store.js'
import { embedAssets, isShared, markShared } from './assets.js'
import { loadDocs, saveDocs } from './docs.js'
import { hasProfile, loadProfile, saveProfile } from './profile.js'

const STATE_KEY = 'qalamai.sync.v1'

const ms = (v) => (typeof v === 'number' ? v : new Date(v).getTime()) || 0

/* ───────── per-account memory: which version of each item both sides last agreed on ───────── */

function loadState(uid) {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY))
    if (s?.uid === uid) return s
  } catch {
    /* corrupted → start over */
  }
  // another account (or first run): nothing is "known synced", so nothing gets deleted by inference
  return { uid, designs: {}, docs: {} }
}
const saveState = (s) => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
  } catch {
    /* quota — next run re-learns it */
  }
}

/* ───────── collections ───────── */

const clip = (s, n) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, n) : undefined)

const COLLECTIONS = {
  designs: {
    path: '/designs',
    read: () => readDesignsRaw(),
    write: (list) => writeDesignsRaw(list),
    skip: (d) => d.seed, // untouched example decks stay local
    // Pictures stay on the device (asset: references); a design shared by link carries small copies.
    body: async (d) => {
      const data = stripBlobs(d)
      if (isShared(d.id)) data.slides = await embedAssets(data.slides)
      return {
        name: clip(d.name, 200) ?? t('design.untitled'),
        ...(clip(d.kind, 60) ? { kind: clip(d.kind, 60) } : {}),
        ...(clip(d.templateId, 60) ? { templateId: clip(d.templateId, 60) } : {}),
        data,
      }
    },
    fromServer: (r) => {
      markShared(r.id, Boolean(r.shareId))
      return { ...r.data, id: r.id, updatedAt: ms(r.updatedAt) }
    },
  },
  docs: {
    path: '/documents',
    read: () => loadDocs(),
    write: (list) => saveDocs(list, { silent: true }),
    skip: () => false,
    body: (d) => ({ name: clip(d.name, 200) ?? t('doc.untitled'), ...(clip(d.kind, 60) ? { kind: clip(d.kind, 60) } : {}), html: d.html ?? '' }),
    fromServer: (r) => ({ id: r.id, name: r.name, ...(r.kind ? { kind: r.kind } : {}), html: r.html, updatedAt: ms(r.updatedAt) }),
  },
}

// Uploaded images are blob: URLs that only live in this tab — never send them.
function stripBlobs(deck) {
  return {
    ...deck,
    slides: (deck.slides ?? []).map((s) => ({ ...s, elements: (s.elements ?? []).filter((e) => !(e.kind === 'image' && e.src?.startsWith('blob:'))) })),
  }
}

const newLocalId = (old) => `${old.split(/[-_]/)[0] || 'x'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Every item on the server. Sync reads "missing from the list" as "deleted", so it must be complete. */
async function listAll(path) {
  const all = []
  let cursor = null
  do {
    const q = new URLSearchParams({ limit: '500', ...(cursor ? { cursor } : {}) })
    const page = await api.get(`${path}?${q}`)
    all.push(...page.items)
    cursor = page.nextCursor
  } while (cursor)
  return all
}

// Network trouble and server errors stop the whole run (retried later); a 4xx is about one item
// (too big, invalid) — that item is reported and skipped so it can't block everything else.
const isItemError = (e) => e?.status >= 400 && e.status < 500 && e.code !== 'UNAUTHORIZED'

async function syncCollection(name, state, uid, rejected) {
  const c = COLLECTIONS[name]
  const known = state[name]
  const items = await listAll(c.path)
  const server = new Map(items.map((r) => [r.id, ms(r.updatedAt)]))
  const local = c.read().filter((x) => !c.skip(x))
  const localIds = new Set(local.map((x) => x.id))

  const puts = [] // items from the server to store locally
  const removes = new Map() // id → the version we last synced; drop locally unless edited since
  const renames = new Map() // old id → new id (id taken by another account)

  for (const item of local) {
    const at = ms(item.updatedAt) || Date.now()
    const s = server.get(item.id)
    if (s === undefined) {
      if (known[item.id] !== undefined && at <= known[item.id]) {
        removes.set(item.id, known[item.id]) // deleted on another device
        delete known[item.id]
        continue
      }
      await push(c, item, at, known, renames, rejected)
    } else if (at > s) {
      await push(c, item, at, known, renames, rejected)
    } else if (s > at) {
      puts.push(c.fromServer(await api.get(`${c.path}/${encodeURIComponent(item.id)}`)))
      known[item.id] = s
    } else {
      known[item.id] = s
    }
  }

  for (const [id, s] of server) {
    if (localIds.has(id)) continue
    if (known[id] !== undefined) {
      // deleted here → delete there
      await api.del(`${c.path}/${encodeURIComponent(id)}`).catch((e) => {
        if (e.status !== 404) throw e
      })
      delete known[id]
    } else {
      puts.push(c.fromServer(await api.get(`${c.path}/${encodeURIComponent(id)}`)))
      known[id] = s
    }
  }

  for (const id of Object.keys(known)) if (!server.has(id) && !localIds.has(id)) delete known[id]

  // The account has real items on the server → the example decks of a fresh browser are noise.
  const dropSeeds = name === 'designs' && server.size > 0

  if (!puts.length && !removes.size && !renames.size && !dropSeeds) return false
  if (currentUser()?.id !== uid) return false // signed out / switched meanwhile — don't write

  // apply on a fresh read, so edits made while we were talking to the server are kept
  const fresh = c.read()
  const byId = new Map(fresh.map((x) => [x.id, x]))
  let changed = false
  for (const p of puts) {
    const cur = byId.get(p.id)
    if (!cur || ms(cur.updatedAt) < p.updatedAt) {
      byId.set(p.id, p)
      changed = true
    }
  }
  for (const [id, syncedAt] of removes) {
    const cur = byId.get(id)
    if (cur && ms(cur.updatedAt) <= syncedAt) {
      byId.delete(id)
      changed = true
    }
  }
  for (const [oldId, newId] of renames) {
    const cur = byId.get(oldId)
    if (cur) {
      byId.delete(oldId)
      byId.set(newId, { ...cur, id: newId })
      changed = true
    }
  }
  if (dropSeeds) {
    for (const [id, x] of byId) {
      if (x.seed) {
        byId.delete(id)
        changed = true
      }
    }
  }
  if (changed) c.write([...byId.values()])
  return changed
}

async function push(c, item, at, known, renames, rejected) {
  let id = item.id
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await request('PUT', `${c.path}/${encodeURIComponent(id)}`, { json: { ...(await c.body({ ...item, id })), updatedAt: Math.round(at) } })
      known[id] = ms(r.updatedAt)
      if (id !== item.id) renames.set(item.id, id)
      return
    } catch (e) {
      // the id is used by another account (a guest's copy) — keep ours under a fresh id
      if (e.code === 'ID_TAKEN' && attempt === 0) {
        id = newLocalId(item.id)
        continue
      }
      if (isItemError(e)) {
        rejected.push({ id: item.id, name: item.name, code: e.code, message: e.message })
        return
      }
      throw e
    }
  }
}

/* ───────── profile ───────── */

async function syncProfile(user, state) {
  // always ask the server: the user object from sign-in goes stale when another device edits
  const serverP = (await api.get('/me')).profile ?? {}
  const serverAt = Number(serverP.updatedAt) || 0
  const local = loadProfile()
  const localAt = Number(local.updatedAt) || 0
  if (serverAt > localAt) {
    if (currentUser()?.id !== user.id) return false
    saveProfile({ ...local, ...serverP }, { touch: false })
    state.profileAt = serverAt
    return true
  }
  if (localAt > serverAt && hasProfile()) {
    const profile = Object.fromEntries(Object.entries(local).map(([k, v]) => [k, String(v ?? '').slice(0, 300)]))
    await api.patch('/me', { profile })
  }
  state.profileAt = Math.max(localAt, serverAt)
  return false
}

/* ───────── what is not on the server yet ───────── */

/** Local edits the server hasn't got yet: changed or new items, local deletions, the profile. */
export function pendingCount() {
  const user = currentUser()
  if (!user) return 0
  const state = loadState(user.id)
  let n = 0
  for (const name of Object.keys(COLLECTIONS)) {
    const c = COLLECTIONS[name]
    const known = state[name]
    const local = c.read().filter((x) => !c.skip(x))
    const ids = new Set(local.map((x) => x.id))
    for (const x of local) if (known[x.id] === undefined || ms(x.updatedAt) > known[x.id]) n++
    for (const id of Object.keys(known)) if (!ids.has(id)) n++ // deleted here, not yet there
  }
  if (hasProfile() && (Number(loadProfile().updatedAt) || 0) > (state.profileAt ?? 0)) n++
  return n
}

/* ───────── status, for the UI ───────── */

// state: 'idle' (all on the server) · 'syncing' · 'offline' (no network / server down) · 'error' (an item was refused)
let status = { state: 'idle', pending: 0, rejected: [], at: null }
const statusListeners = new Set()
const setStatus = (patch) => {
  status = { ...status, ...patch }
  statusListeners.forEach((fn) => fn(status))
}
export const syncStatus = () => status
export function onSyncStatus(fn) {
  statusListeners.add(fn)
  fn(status)
  return () => statusListeners.delete(fn)
}

/* ───────── scheduling ───────── */

let running = null
let again = false
let queued = null // resolves when the follow-up run (requested while one was running) has finished
let debounce = null
let retry = null
let failures = 0
const BACKOFF = [5_000, 15_000, 60_000, 300_000]

/**
 * Sync everything now — or, if a run is in progress, once more right after it (that run may have
 * read the data before the latest edit). The promise settles when the requested run is done. Never throws.
 */
export function syncNow() {
  clearTimeout(debounce)
  debounce = null
  if (running) {
    again = true
    // when the current run ends, `running` is already the follow-up — wait for that one
    queued ??= running.then(() => running)
    return queued
  }
  clearTimeout(retry)
  running = (async () => {
    const user = currentUser()
    if (!user) return
    const state = loadState(user.id)
    const got = { designs: false, docs: false, profile: false }
    const rejected = []
    setStatus({ state: 'syncing' })
    try {
      got.profile = await syncProfile(user, state)
      got.designs = await syncCollection('designs', state, user.id, rejected)
      got.docs = await syncCollection('docs', state, user.id, rejected)
      failures = 0
      if (currentUser()?.id === user.id) saveState(state)
      setStatus({ state: rejected.length ? 'error' : 'idle', rejected, pending: pendingCount(), at: Date.now() })
    } catch (e) {
      // offline or server down — the local copy stays the truth; retry with growing pauses
      if (currentUser()?.id === user.id) saveState(state)
      if (import.meta.env.DEV) console.warn('[sync]', e.message)
      setStatus({ state: 'offline', pending: pendingCount() })
      retry = setTimeout(syncNow, BACKOFF[Math.min(failures++, BACKOFF.length - 1)])
    }
    if (got.designs || got.docs || got.profile) window.dispatchEvent(new CustomEvent(SYNCED, { detail: got }))
  })().finally(() => {
    running = null
    queued = null
    if (again) {
      again = false
      syncNow()
    }
  })
  return running
}

/** Wait until nothing is running or queued — including a pending debounced push. */
async function flush() {
  do {
    await syncNow()
  } while (running)
}

/**
 * Sign out without losing work: push what's left first. If something still isn't on the server
 * (offline, or an item was refused), ask before the local copies are wiped.
 * @param {(n: number) => boolean | Promise<boolean>} confirmLoss  called with the count of unsaved changes
 * @returns {Promise<boolean>} whether the user was signed out
 */
export async function signOutSafely(confirmLoss) {
  await flush()
  const n = pendingCount()
  if (n > 0 && !(await confirmLoss(n))) return false
  await logout()
  setStatus({ state: 'idle', pending: 0, rejected: [], at: null })
  return true
}

let started = false
/** Start background sync once per page. */
export function startSync() {
  if (started) return
  started = true

  let lastUid = null
  onUser((u) => {
    if (u && u.id !== lastUid) {
      lastUid = u.id
      syncNow()
    }
    if (!u) lastUid = null
  })

  // local edits → push shortly after the user stops typing
  window.addEventListener(LOCAL_CHANGE, () => {
    setStatus({ pending: pendingCount() })
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      syncNow()
    }, 1500)
  })

  // coming back to the tab → pick up what other devices did (at most every 30 s)
  let lastFocus = 0
  const onBack = () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastFocus < 30_000) return
    lastFocus = Date.now()
    syncNow()
  }
  document.addEventListener('visibilitychange', onBack)
  window.addEventListener('focus', onBack)
  window.addEventListener('online', () => {
    failures = 0
    syncNow()
  })
  // closing the tab with unsent edits: the browser shows its "leave site?" prompt
  window.addEventListener('beforeunload', (e) => {
    // items the server refused (too big …) can't be fixed by waiting — don't nag about those
    if (status.pending - status.rejected.length > 0 || debounce) {
      syncNow()
      e.preventDefault()
      e.returnValue = ''
    }
  })

  if (currentUser()) syncNow()
}
