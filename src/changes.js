// Tiny event bus between the local stores and the sync layer (src/sync.js), kept separate so the
// stores don't import sync.js (which imports them).
export const LOCAL_CHANGE = 'qalam:local-change'
export const SYNCED = 'qalam:synced'

/** A collection changed in this browser: 'designs' | 'docs' | 'profile'. */
export const markChanged = (what) => window.dispatchEvent(new CustomEvent(LOCAL_CHANGE, { detail: what }))

/** Run fn whenever data arrived from the server. Returns an unsubscribe function. */
export function onSynced(fn) {
  const h = (e) => fn(e.detail)
  window.addEventListener(SYNCED, h)
  return () => window.removeEventListener(SYNCED, h)
}
