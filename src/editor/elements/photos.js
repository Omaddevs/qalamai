// Free photos for the Elements panel: Unsplash (through our API, which holds the Access Key) and,
// when Unsplash isn't set up or its hourly limit is spent, Openverse (openverse.org — openly
// licensed photographs: public domain, CC0 and CC BY; CC BY photos carry their author's credit).
import { api } from '../../api.js'
import { downscale } from '../layouts.jsx'

const API = 'https://api.openverse.org/v1/images/'
const PAGE = 20 // Openverse's limit for anonymous requests
const cache = new Map() // `${q}|${page}` → result

export class PhotoError extends Error {
  constructor(code) {
    super(code)
    this.code = code // 'limit' | 'network'
  }
}

/* ───────── Unsplash, through our API (the key stays on the server) ───────── */

// After PHOTOS_OFF (no key on the server) Unsplash isn't asked again this visit;
// after PHOTOS_LIMIT (hourly limit spent) it is skipped for ten minutes.
let unsplashOff = false
let unsplashPauseUntil = 0

async function searchUnsplash(q, page, signal) {
  if (unsplashOff || Date.now() < unsplashPauseUntil) return null
  try {
    const r = await api.get(`/photos/search?${new URLSearchParams({ q: q.trim(), page: String(page) })}`, { signal })
    return r?.provider === 'unsplash' ? r : null
  } catch (e) {
    if (e.name === 'AbortError') throw e
    if (e.code === 'PHOTOS_OFF') unsplashOff = true
    if (e.code === 'PHOTOS_LIMIT') unsplashPauseUntil = Date.now() + 10 * 60 * 1000
    return null // any other problem: this search goes to Openverse
  }
}

/* ───────── Openverse (no key; public domain, CC0, CC BY) ───────── */

async function searchOpenverse(q, page, signal) {
  const url = new URL(API)
  url.search = new URLSearchParams({
    q: q.trim(),
    page: String(page),
    page_size: String(PAGE),
    license: 'cc0,pdm,by',
    category: 'photograph',
    mature: 'false',
    extension: 'jpg,jpeg,png,webp',
  }).toString()
  let res
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new PhotoError('network')
  }
  if (res.status === 429) throw new PhotoError('limit')
  if (!res.ok) throw new PhotoError('network')
  const json = await res.json()
  return {
    provider: 'openverse',
    items: (json.results ?? [])
      .filter((r) => r.id && (r.thumbnail || r.url))
      .map((r) => ({
        id: r.id,
        provider: 'openverse',
        thumb: r.thumbnail || r.url,
        url: r.url,
        w: r.width || 4,
        h: r.height || 3,
        title: r.title ?? '',
        // CC BY asks for the author's name and the licence; public domain / CC0 need nothing
        ...(r.license === 'by' && r.creator
          ? { author: r.creator, authorUrl: r.creator_url || r.foreign_landing_url, link: r.foreign_landing_url, license: `CC BY ${r.license_version ?? ''}`.trim() }
          : {}),
      })),
    more: page < Math.min(json.page_count ?? 1, 20),
  }
}

/** Unsplash first, Openverse when Unsplash isn't set up or is busy.
 *  → { provider, items: [{ id, provider, thumb, url, w, h, title, author?, authorUrl?, link? }], more } */
export async function searchPhotos(q, page = 1, signal) {
  const key = `${q.trim().toLowerCase()}|${page}`
  if (cache.has(key)) return cache.get(key)
  const out = (await searchUnsplash(q, page, signal)) ?? (await searchOpenverse(q, page, signal))
  cache.set(key, out)
  return out
}

async function fetchImage(src) {
  const res = await fetch(src, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`http ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('not an image')
  return downscale(blob, 1600)
}

/**
 * What goes into the design for a photo: { src, credit? }.
 * Unsplash photos keep Unsplash's own address (their guidelines ask for hotlinking; the image
 * CDN allows cross-origin use, so downloads still work) and their photographer's credit; the
 * use is reported to Unsplash. Openverse photos are copied into the design (full size when the
 * host allows it, else the preview).
 */
export async function photoData(p) {
  if (p.provider === 'unsplash') {
    api.post(`/photos/${encodeURIComponent(p.id)}/download`).catch(() => {})
    return { src: p.url, credit: { name: p.author, url: p.authorUrl, link: p.link, by: 'Unsplash' } }
  }
  const extra = p.author ? { credit: { name: p.author, url: p.authorUrl, link: p.link, by: p.license ?? 'Openverse' } } : {}
  try {
    return { src: await fetchImage(p.url), ...extra }
  } catch {
    return { src: await fetchImage(p.thumb), ...extra }
  }
}
