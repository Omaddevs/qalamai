// Media library — images the user uploaded or generated, kept in IndexedDB so they
// survive reloads (localStorage is far too small for image blobs).
//
// Item: { id, name, source: 'upload' | 'ai', kind: 'photo' | 'graphic', blob, type, size,
//         w, h, createdAt, fav, prompt? }

const DB = 'qalamai'
const STORE = 'media'
let dbp = null

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

async function tx(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

export const newMediaId = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export async function listMedia() {
  const all = await tx('readonly', (s) => s.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export const putMedia = (items) => tx('readwrite', (s) => items.forEach((it) => s.put(it)))
export const deleteMedia = (ids) => tx('readwrite', (s) => ids.forEach((id) => s.delete(id)))

/** Read pixel size of an image blob. */
export function imageSize(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ w: 1, h: 1 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export const MAX_UPLOAD = 15 * 1024 * 1024

export async function fromFile(file) {
  const { w, h } = await imageSize(file)
  return {
    id: newMediaId(),
    name: file.name.replace(/\.[^.]+$/, '') || 'Rasm',
    source: 'upload',
    kind: /svg|png/.test(file.type) && Math.max(w, h) < 1200 ? 'graphic' : 'photo',
    blob: file,
    type: file.type,
    size: file.size,
    w,
    h,
    createdAt: Date.now(),
    fav: false,
  }
}

/* ───────────── Demo "AI" generator ─────────────
 * No image backend yet, so prompts become seeded vector art in the brand palette.
 * Same prompt + seed → same picture. Swap `generateImages` for a real API later. */

const PALETTES = [
  ['#e6f7f3', '#9fe3d4', '#14b8a6', '#0f766e', '#f5c451'],
  ['#f1edfc', '#c9bdf5', '#8b5cf6', '#4c1d95', '#fb923c'],
  ['#fdf1e3', '#f9cf9b', '#f97316', '#9a3412', '#14b8a6'],
  ['#e8f1fd', '#a9c8f5', '#3b82f6', '#1e3a8a', '#f5c451'],
  ['#fce9ef', '#f5b3c8', '#ec4899', '#831843', '#22c55e'],
  ['#edf7e6', '#bfe3a5', '#22c55e', '#14532d', '#f97316'],
]

function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

const hash = (str) => [...str].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261)

export const ASPECTS = [
  { id: 'square', label: 'Kvadrat', w: 1024, h: 1024 },
  { id: 'land', label: 'Albom', w: 1280, h: 960 },
  { id: 'port', label: 'Portret', w: 960, h: 1280 },
]

export const STYLES = [
  { id: 'scene', label: 'Illyustratsiya' },
  { id: 'abstract', label: 'Abstrakt' },
]

function sceneSvg(r, pal, W, H) {
  const [bg, soft, mid, deep, accent] = pal
  const hill = (y, amp, color, op = 1) => {
    let d = `M0 ${H} L0 ${y}`
    const n = 4
    for (let i = 1; i <= n; i++) {
      const x = (W / n) * i
      const cx = x - W / n / 2
      d += ` Q${cx} ${y - amp * (0.4 + r())} ${x} ${y + amp * (r() - 0.5) * 0.6}`
    }
    return `<path d="${d} L${W} ${H}Z" fill="${color}" opacity="${op}"/>`
  }
  const sunX = W * (0.2 + r() * 0.6)
  const sunY = H * (0.18 + r() * 0.15)
  const trees = Array.from({ length: 4 + Math.floor(r() * 5) }, () => {
    const x = r() * W
    const y = H * (0.68 + r() * 0.18)
    const s = 26 + r() * 40
    return `<rect x="${x - s * 0.08}" y="${y}" width="${s * 0.16}" height="${s * 0.9}" rx="3" fill="${deep}"/><circle cx="${x}" cy="${y}" r="${s * 0.55}" fill="${mid}"/><circle cx="${x - s * 0.18}" cy="${y - s * 0.15}" r="${s * 0.22}" fill="#fff" opacity=".18"/>`
  }).join('')
  const birds = Array.from({ length: 3 }, () => {
    const x = r() * W * 0.8 + W * 0.1
    const y = H * (0.12 + r() * 0.2)
    return `<path d="M${x} ${y}q10 -10 20 0q10 -10 20 0" fill="none" stroke="${deep}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`
  }).join('')
  return `<rect width="${W}" height="${H}" fill="${bg}"/>
<circle cx="${sunX}" cy="${sunY}" r="${H * 0.16}" fill="${accent}" opacity=".9"/>
<circle cx="${sunX}" cy="${sunY}" r="${H * 0.24}" fill="${accent}" opacity=".18"/>
${birds}
${hill(H * 0.55, H * 0.12, soft)}
${hill(H * 0.66, H * 0.1, mid, 0.75)}
${trees}
${hill(H * 0.82, H * 0.07, deep, 0.9)}`
}

function abstractSvg(r, pal, W, H) {
  const [bg, soft, mid, deep, accent] = pal
  const colors = [soft, mid, deep, accent]
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = r() * W
    const cy = r() * H
    const rx = W * (0.15 + r() * 0.25)
    const ry = H * (0.15 + r() * 0.25)
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${colors[i % 4]}" opacity="${0.55 + r() * 0.4}" transform="rotate(${r() * 180} ${cx} ${cy})"/>`
  }).join('')
  const shapes = Array.from({ length: 6 }, () => {
    const x = r() * W
    const y = r() * H
    const s = 30 + r() * 90
    const c = colors[Math.floor(r() * 4)]
    return r() > 0.5
      ? `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.25}" fill="none" stroke="${c}" stroke-width="8" transform="rotate(${r() * 90} ${x} ${y})"/>`
      : `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="none" stroke="${c}" stroke-width="8"/>`
  }).join('')
  const dots = Array.from({ length: 40 }, () => `<circle cx="${r() * W}" cy="${r() * H}" r="${3 + r() * 5}" fill="${deep}" opacity=".35"/>`).join('')
  return `<rect width="${W}" height="${H}" fill="${bg}"/>
<filter id="b"><feGaussianBlur stdDeviation="${Math.min(W, H) * 0.04}"/></filter>
<g filter="url(#b)">${blobs}</g>${shapes}${dots}`
}

/** Returns `count` media items (demo vector art) for a prompt. */
export async function generateImages({ prompt, style = 'scene', aspect = 'square', count = 4 }) {
  const a = ASPECTS.find((x) => x.id === aspect) ?? ASPECTS[0]
  const base = hash(`${prompt}|${style}`)
  const now = Date.now()
  const items = []
  for (let i = 0; i < count; i++) {
    const r = rng(base + i * 7919)
    const pal = PALETTES[Math.floor(r() * PALETTES.length)]
    const body = style === 'abstract' ? abstractSvg(r, pal, a.w, a.h) : sceneSvg(r, pal, a.w, a.h)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.w} ${a.h}" width="${a.w}" height="${a.h}">${body}</svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    items.push({
      id: newMediaId(),
      name: `${prompt.slice(0, 40)}${prompt.length > 40 ? '…' : ''} · ${i + 1}`,
      source: 'ai',
      kind: style === 'abstract' ? 'graphic' : 'photo',
      blob,
      type: blob.type,
      size: blob.size,
      w: a.w,
      h: a.h,
      createdAt: now - i,
      fav: false,
      prompt,
    })
  }
  await new Promise((res) => setTimeout(res, 1100)) // feel of generation
  return items
}
