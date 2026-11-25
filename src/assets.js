// Design images live on this device, not on the server.
//
// A picture put into a presentation is stored once in IndexedDB (db `qalamai-assets`), keyed by
// a hash of its bytes, and the design only keeps `asset:<id>` — a few dozen bytes. So designs
// stay small in localStorage and on the server, and the server never stores user images.
//   • Another device (or a browser whose data was cleared) gets the design without the picture;
//     the slide shows a "kept on another device" placeholder instead.
//   • A design that is shared by link (/v/…) is the exception: its pictures travel with it,
//     compressed (see embedAssets), because the people opening the link have no copy.
import { useEffect, useState } from 'react'

const DB = 'qalamai-assets'
const STORE = 'assets'
export const ASSET = 'asset:'
export const isAssetRef = (src) => typeof src === 'string' && src.startsWith(ASSET)
// raster photos only — small SVG graphics stay inline (they are tiny and drawn in several ways)
const isDataImage = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif|avif);/.test(v) && v.length > 512

let dbp = null
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function run(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        t.oncomplete = () => resolve(req?.result)
        t.onerror = () => reject(t.error)
      }),
  )
}

/* ───────── object URLs, one per asset for the page's lifetime ───────── */

const urls = new Map() // id → blob: URL | null (null = not on this device)
const waiting = new Map() // id → Promise

function load(id) {
  if (urls.has(id)) return Promise.resolve(urls.get(id))
  if (!waiting.has(id)) {
    waiting.set(
      id,
      run('readonly', (s) => s.get(id))
        .then((row) => {
          const url = row?.blob ? URL.createObjectURL(row.blob) : null
          urls.set(id, url)
          return url
        })
        .catch(() => {
          urls.set(id, null)
          return null
        })
        .finally(() => waiting.delete(id)),
    )
  }
  return waiting.get(id)
}

/** blob: URL for `src` when it is an asset already loaded, else `src` itself (undefined while loading). */
export function resolveNow(src) {
  if (!isAssetRef(src)) return src
  const id = src.slice(ASSET.length)
  return urls.has(id) ? urls.get(id) : undefined
}

/**
 * The address to draw an image from.
 * → { url, missing }: url is null while loading; missing = the picture is not on this device.
 */
export function useAsset(src) {
  const [, bump] = useState(0)
  const now = resolveNow(src)
  useEffect(() => {
    if (!isAssetRef(src) || now !== undefined) return
    let live = true
    load(src.slice(ASSET.length)).then(() => live && bump((n) => n + 1))
    return () => {
      live = false
    }
  }, [src, now])
  if (!isAssetRef(src)) return { url: src, missing: false }
  return { url: now ?? null, missing: now === null }
}

/* ───────── storing ───────── */

async function hashOf(blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(buf).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

let askedToPersist = false
/** Ask the browser not to clear our storage under pressure (one prompt-less request per page). */
function persist() {
  if (askedToPersist) return
  askedToPersist = true
  navigator.storage?.persist?.().catch(() => {})
}

/** Keeps `blob` on this device; returns its `asset:<id>` reference (same bytes → same id). */
export async function putAsset(blob) {
  const id = `a${await hashOf(blob)}`
  await run('readwrite', (s) => s.put({ id, blob, type: blob.type, size: blob.size, createdAt: Date.now() }))
  if (!urls.get(id)) urls.set(id, URL.createObjectURL(blob))
  persist()
  return ASSET + id
}

export async function assetBlob(ref) {
  if (!isAssetRef(ref)) return null
  const row = await run('readonly', (s) => s.get(ref.slice(ASSET.length))).catch(() => null)
  return row?.blob ?? null
}

/** A picked/dropped/downloaded image, scaled to at most `max` px and kept on this device. */
export async function storeImage(file, max = 1280) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * k))
  c.height = Math.max(1, Math.round(bmp.height * k))
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  // WebP keeps transparency and is ~30% smaller than JPEG; old Safari falls back to JPEG
  const blob = (await new Promise((r) => c.toBlob(r, 'image/webp', 0.85))) ?? (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)))
  return putAsset(blob)
}

const dataToBlob = async (data) => (await fetch(data)).blob()

/* ───────── whole designs ───────── */

/** Every string inside the slides, with a function that can replace it. */
function* strings(node, parent, key) {
  if (typeof node === 'string') yield { value: node, set: (v) => (parent[key] = v) }
  else if (Array.isArray(node)) for (let i = 0; i < node.length; i++) yield* strings(node[i], node, i)
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) yield* strings(node[k], node, k)
}

/**
 * Moves pictures stored inside a design (old base64 data URLs) onto this device.
 * Returns the slimmed copy, or null when there was nothing to move.
 */
export async function slimDesign(deck) {
  if (!deck?.slides || !JSON.stringify(deck.slides).includes('data:image/')) return null
  const slides = structuredClone(deck.slides)
  let moved = 0
  for (const s of [...strings(slides, null, null)]) {
    if (!isDataImage(s.value)) continue
    try {
      s.set(await putAsset(await dataToBlob(s.value)))
      moved++
    } catch {
      /* a broken data URL stays as it is */
    }
  }
  return moved ? { ...deck, slides } : null
}

/** A compressed data URL of an asset (for shared designs), or null when it isn't on this device. */
async function embedOne(ref) {
  const blob = await assetBlob(ref)
  if (!blob) return null
  try {
    const bmp = await createImageBitmap(blob)
    const k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height))
    const c = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k)))
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close?.()
    const small = await c.convertToBlob({ type: 'image/webp', quality: 0.72 })
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(small)
    })
  } catch {
    return null
  }
}

/** Slides with every asset reference replaced by a small inline copy (pictures not here stay refs). */
export async function embedAssets(slides) {
  if (!slides || !JSON.stringify(slides).includes(ASSET)) return slides
  const out = structuredClone(slides)
  for (const s of [...strings(out, null, null)]) {
    if (!isAssetRef(s.value)) continue
    const data = await embedOne(s.value)
    if (data) s.set(data)
  }
  return out
}

/* ───────── designs shared by link keep their pictures on the server ───────── */

const SHARED_KEY = 'qalamai.shared.v1'
const readShared = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHARED_KEY)) ?? [])
  } catch {
    return new Set()
  }
}
export const isShared = (id) => readShared().has(id)
export function markShared(id, on) {
  const s = readShared()
  if (on === s.has(id)) return
  if (on) s.add(id)
  else s.delete(id)
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify([...s]))
  } catch {
    /* storage full: the next server read sets it again */
  }
}

/** Loads every picture of a deck, so exports and the slide strip draw them at once. */
export async function preloadDeck(deck) {
  const refs = []
  for (const s of strings(deck?.slides, null, null)) if (isAssetRef(s.value)) refs.push(s.value.slice(ASSET.length))
  await Promise.all(refs.map(load))
}
