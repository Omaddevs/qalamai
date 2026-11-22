// Dragging from the Elements panel (or photos / image files from the computer) onto the page.
import { useRef, useState } from 'react'
import { t } from '../../i18n/index.js'
import { downscale } from '../layouts.jsx'
import { newId } from '../templates.js'
import { PhotoError, photoData } from './photos.js'

export const DND_ITEM = 'application/x-qalam-element'
export const DND_PHOTO = 'application/x-qalam-photo'

/* ───────── recently used (per browser; a convenience only) ───────── */

const RECENT_KEY = 'qalam.el.recent'
const RECENT_EVENT = 'qalam:el-recent'

export function loadRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 12) : []
  } catch {
    return []
  }
}

export function remember(id) {
  if (!id) return
  const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 12)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* not remembered — fine */
  }
  window.dispatchEvent(new CustomEvent(RECENT_EVENT))
}

export const onRecent = (fn) => {
  window.addEventListener(RECENT_EVENT, fn)
  return () => window.removeEventListener(RECENT_EVENT, fn)
}

/* ───────── placing ───────── */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const r2 = (v) => Math.round(v * 100) / 100

/**
 * Give new elements ids and a place. Elements that already have x/y (collage cells) keep it;
 * the others are centred on `at` (page %) or, without it, on the page with a small cascade.
 */
export function placeEls(specs, at, existing = 0) {
  const shift = at ? 0 : (existing % 5) * 2
  return specs.map((s) => {
    const w = s.w ?? 20
    const h = s.h ?? 20
    const pos =
      s.x != null && s.y != null
        ? {}
        : {
            x: r2(clamp((at?.x ?? 50) - w / 2 + shift, w >= 100 ? 0 : -w / 2, w >= 100 ? 0 : 100 - w / 2)),
            y: r2(clamp((at?.y ?? 50) - h / 2 + shift, h >= 100 ? 0 : -h / 2, h >= 100 ? 0 : 100 - h / 2)),
          }
    return { ...structuredClone(s), ...pos, id: newId('el') }
  })
}

/** An image element sized to the picture's own proportions (`size` = known { w, h } in pixels). */
export async function imageSpec(src, size, maxW = 40, maxH = 62) {
  let ratio = size?.w > 0 && size?.h > 0 ? size.w / size.h : 0
  if (!ratio) {
    const img = new Image()
    img.src = src
    try {
      await img.decode()
    } catch {
      /* keep the default ratio */
    }
    ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4 / 3
  }
  let w = maxW
  let h = (w * 16) / 9 / ratio
  if (h > maxH) {
    h = maxH
    w = (h * 9 * ratio) / 16
  }
  return { kind: 'image', src, fit: 'cover', radius: 0, w: r2(w), h: r2(h) }
}

export const photoErrorText = (e) => (e instanceof PhotoError && e.code === 'limit' ? t('el.ph.limit') : t('el.ph.fail'))

/**
 * Drop target for the editor's stage.
 * @param {{ page: () => HTMLElement|null, onInsert: (specs, at) => void, onFill: (id, src, extra) => boolean, onError: (msg) => void }} o
 */
export function useElementDrop(o) {
  const [busy, setBusy] = useState(false)
  const cb = useRef(o)
  cb.current = o

  const accepts = (dt) => [...(dt?.types ?? [])].some((x) => x === DND_ITEM || x === DND_PHOTO || x === 'Files')

  const onDragOver = (e) => {
    if (!accepts(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = async (e) => {
    const dt = e.dataTransfer
    if (!accepts(dt)) return
    e.preventDefault()
    const page = cb.current.page()
    if (!page) return
    const r = page.getBoundingClientRect()
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    const at = inside ? { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 } : null
    const hit = inside ? document.elementsFromPoint(e.clientX, e.clientY).find((n) => page.contains(n) && n.closest('[data-eid]')) : null
    const targetId = hit?.closest('[data-eid]')?.dataset.eid ?? null

    const item = dt.getData(DND_ITEM)
    if (item) {
      try {
        const { id, els } = JSON.parse(item)
        cb.current.onInsert(els, at)
        remember(id)
      } catch {
        /* not ours */
      }
      return
    }

    const photo = dt.getData(DND_PHOTO)
    const file = photo ? null : [...dt.files].find((f) => f.type.startsWith('image/'))
    if (!photo && !file) return
    setBusy(true)
    let got
    let size
    try {
      if (photo) {
        const p = JSON.parse(photo)
        size = p
        got = await photoData(p)
      } else got = { src: await downscale(file) }
    } catch (err) {
      cb.current.onError?.(photo ? photoErrorText(err) : t('el.ph.badFile'))
      return
    } finally {
      setBusy(false)
    }
    const extra = got.credit ? { credit: got.credit } : {}
    if (targetId && cb.current.onFill(targetId, got.src, extra)) return
    cb.current.onInsert([{ ...(await imageSpec(got.src, size)), ...extra }], at)
  }

  return { busy, props: { onDragOver, onDrop } }
}
