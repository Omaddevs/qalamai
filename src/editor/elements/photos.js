// Free photos for the Elements panel, from Openverse (openverse.org — a WordPress project that
// indexes openly licensed media). Only public-domain / CC0 images are asked for, so a photo can
// be used in any design without credit. The browser talks to Openverse directly; a chosen photo
// is downscaled into the design (like an upload), so it keeps working offline and in exports.
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

/** → { items: [{ id, thumb, url, w, h, title }], more: boolean } */
export async function searchPhotos(q, page = 1, signal) {
  const key = `${q.trim().toLowerCase()}|${page}`
  if (cache.has(key)) return cache.get(key)
  const url = new URL(API)
  url.search = new URLSearchParams({
    q: q.trim(),
    page: String(page),
    page_size: String(PAGE),
    license: 'cc0,pdm',
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
  const out = {
    items: (json.results ?? [])
      .filter((r) => r.id && (r.thumbnail || r.url))
      .map((r) => ({
        id: r.id,
        thumb: r.thumbnail || r.url,
        url: r.url,
        w: r.width || 4,
        h: r.height || 3,
        title: r.title ?? '',
      })),
    more: page < Math.min(json.page_count ?? 1, 20),
  }
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

/** The photo as a data URL kept inside the design (full size when the host allows it, else the preview). */
export async function photoData(p) {
  try {
    return await fetchImage(p.url)
  } catch {
    return fetchImage(p.thumb)
  }
}
