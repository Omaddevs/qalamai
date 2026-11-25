// One-time (and after every download from the server): pictures stored inside designs as base64
// move onto this device (src/assets.js), so designs shrink in localStorage and on the server.
import { api } from './api.js'
import { markShared, slimDesign } from './assets.js'
import { readDesignsRaw, saveDesign } from './store.js'

let running = null

/** → true when any design changed. */
export function slimDesigns() {
  running ??= (async () => {
    let changed = false
    for (const d of readDesignsRaw()) {
      if (!d?.slides || !JSON.stringify(d.slides).includes('data:image/')) continue
      // a design shared before this change must keep its pictures on the server: ask once
      try {
        const r = await api.get(`/designs/${encodeURIComponent(d.id)}`)
        markShared(d.id, Boolean(r.shareId))
      } catch {
        /* not on the server (yet) — not shared */
      }
      const slim = await slimDesign(d)
      if (!slim) continue
      saveDesign({ ...slim, updatedAt: Date.now() })
      changed = true
    }
    return changed
  })().finally(() => {
    running = null
  })
  return running
}
