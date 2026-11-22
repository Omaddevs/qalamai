// Portrait studio, main thread: runs the analysis worker and composes the picture on a canvas —
// backdrop, the clothes' back layer, the retouched person, the clothes, long hair over them, grain.
import { FORMATS, applyCurves, clipPlane, framing, hex, sharpen, skinMask, smoothSkin, toneCurves } from './core.js'
import { outfitSvg, personClip } from './outfits.js'
import { backdropSvg } from './backdrops.js'

/* ───────── analysis ───────── */

let worker = null
let seq = 0

/** Analyse a photo in the worker. onProgress(pct, stage, n). Rejects with an Error whose `code` says why. */
export function analyzePhoto(file, onProgress) {
  worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
  const id = ++seq
  return new Promise((resolve, reject) => {
    const onMessage = ({ data }) => {
      if (data.id !== id) return
      if (data.type === 'progress') return onProgress?.(data.pct, data.stage, data.n)
      worker.removeEventListener('message', onMessage)
      if (data.type === 'done') resolve(data.result)
      else reject(Object.assign(new Error(data.code), { code: data.code }))
    }
    const onError = (e) => {
      worker.removeEventListener('error', onError)
      worker?.terminate()
      worker = null
      reject(Object.assign(new Error(e.message || 'worker'), { code: 'UNSUPPORTED' }))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ id, file })
  })
}

/* ───────── retouch ───────── */

/**
 * The person's colours after retouch: { canvas (work size, alpha = matte × clip), hairCanvas, skin }.
 * Cached per analysis + settings, since sliders move often and outfits change the clip only.
 */
export function retouched(a, tone, clipKey) {
  const key = JSON.stringify(tone)
  a._rt ??= {}
  if (a._rt.key !== key) {
    const img = new ImageData(new Uint8ClampedArray(a.img.data), a.img.width, a.img.height)
    const curves = toneCurves(a.g, tone)
    applyCurves(img, curves)
    if (tone.smooth > 0) smoothSkin(img, skinMask(img, a.alpha, a.g), a.g, tone.smooth / 100)
    if (tone.sharp > 0) sharpen(img, tone.sharp / 100)
    const skin = applyCurves({ data: new Uint8ClampedArray([...a.g.neckSkin.map(Math.round), 255]) }, curves).data
    a._rt = { key, img, skin: hex(skin.slice(0, 3)), clips: {} }
  }
  const rt = a._rt
  if (!rt.clips[clipKey.id]) {
    const { img } = rt
    const { width: w, height: h } = img
    const cp = clipPlane(img, a.g, clipKey.clip)
    const person = new ImageData(new Uint8ClampedArray(img.data), w, h)
    for (let i = 0; i < w * h; i++) person.data[i * 4 + 3] = Math.round(a.alpha[i] * cp[i])
    const c = OffscreenCanvasOr(w, h)
    c.getContext('2d').putImageData(person, 0, 0)
    let hairCanvas = null
    if (clipKey.clip && a.longHair) {
      const hair = new ImageData(new Uint8ClampedArray(img.data), w, h)
      for (let i = 0; i < w * h; i++) hair.data[i * 4 + 3] = Math.round(a.hair[i] * (1 - cp[i]))
      hairCanvas = OffscreenCanvasOr(w, h)
      hairCanvas.getContext('2d').putImageData(hair, 0, 0)
    }
    rt.clips = { [clipKey.id]: { canvas: c, hairCanvas } }
  }
  return { ...rt.clips[clipKey.id], skin: rt.skin }
}

/** A canvas that works on every browser (OffscreenCanvas where there is one). */
function OffscreenCanvasOr(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/* ───────── drawing ───────── */

const svgCache = new Map()

/** SVG text → a decoded image (small LRU: backdrops and outfits repeat while sliders move). */
function svgImage(svg) {
  if (svgCache.has(svg)) return svgCache.get(svg)
  const p = new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('svg'))
    img.src = url
  })
  svgCache.set(svg, p)
  if (svgCache.size > 24) {
    const first = svgCache.keys().next().value
    svgCache.get(first).then((img) => URL.revokeObjectURL(img.src)).catch(() => {})
    svgCache.delete(first)
  }
  return p
}

let noise = null
/** A tile of fine film grain, drawn over everything so photo and drawn clothes share one texture. */
function grainTile() {
  if (noise) return noise
  const n = 192
  const c = OffscreenCanvasOr(n, n)
  const ctx = c.getContext('2d')
  const d = ctx.createImageData(n, n)
  for (let i = 0; i < n * n; i++) {
    const v = 128 + (Math.random() - 0.5) * 90
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v
    d.data[i * 4 + 3] = 255
  }
  ctx.putImageData(d, 0, 0)
  noise = c
  return c
}

/** Can this canvas blur (ctx.filter)? Safari before 18 ignores it. */
let filterOk = null
function canFilter(ctx) {
  if (filterOk === null) {
    const before = ctx.filter
    ctx.filter = 'blur(2px)'
    filterOk = ctx.filter === 'blur(2px)'
    ctx.filter = before ?? 'none'
  }
  return filterOk
}

/** The photo's own background, blurred: by the canvas where it can, else shrunk and stretched back. */
function blurredOriginal(a, ctx) {
  if (a._blur) return a._blur
  const { width: w, height: h } = a.orig
  const src = OffscreenCanvasOr(w, h)
  src.getContext('2d').putImageData(a.orig, 0, 0)
  if (canFilter(ctx)) {
    const out = OffscreenCanvasOr(w, h)
    const oc = out.getContext('2d')
    oc.filter = `blur(${Math.max(4, Math.round(a.g.d * 0.22))}px)`
    // drawn a little larger, so the blur doesn't fade the edges to transparent
    oc.drawImage(src, -w * 0.03, -h * 0.03, w * 1.06, h * 1.06)
    a._blur = out
    return out
  }
  let cur = src
  for (let i = 0; i < 3; i++) {
    const next = OffscreenCanvasOr(Math.max(2, Math.round(cur.width / 2.5)), Math.max(2, Math.round(cur.height / 2.5)))
    const nc = next.getContext('2d')
    nc.imageSmoothingQuality = 'high'
    nc.drawImage(cur, 0, 0, next.width, next.height)
    cur = next
  }
  a._blur = cur
  return cur
}

/** Output size in pixels for a format, scaled to fit `maxSide` (previews). */
export function outputSize(format, maxSide) {
  const [W, H] = FORMATS[format].out
  const k = maxSide ? Math.min(1, maxSide / Math.max(W, H)) : 1
  return [Math.round(W * k), Math.round(H * k)]
}

/**
 * Compose the portrait onto `canvas` (resized to the format at `maxSide`, or full size).
 * `choice` = { outfit, jacket, shirt, tie, knit, top, bg, custom, format, zoom, dx, dy, tone, hairFront }.
 */
export async function compose(a, choice, canvas, maxSide) {
  const [W, H] = outputSize(choice.format, maxSide)
  const g = a.g
  let crop = framing(g, choice.format, choice.zoom, choice.dx, choice.dy)
  if (choice.outfit === 'keep') {
    // own clothes can't continue past the photo's bottom edge: frame tighter instead
    const floor = a.img.height - 2 - (a.tilt ?? 0)
    let zoom = choice.zoom
    for (let i = 0; i < 10 && crop.top + crop.height > floor; i++) {
      zoom *= crop.height / Math.max(1, floor - crop.top)
      crop = framing(g, choice.format, zoom, choice.dx, choice.dy)
    }
  }
  const s = W / crop.width
  const t = { tx: (g.chin[0] - crop.left) * s, ty: (g.chin[1] - crop.top) * s, k: g.d * s }
  const clip = personClip(g, choice)
  const person = retouched(a, choice.tone, { id: clip ? JSON.stringify(clip) : 'keep', clip })
  const svg = outfitSvg(g, { ...choice, skin: person.skin }, W, H, t)
  const bgSvg = choice.bg === 'blur' ? null : backdropSvg(choice.bg, W, H, (g.eye[0] - crop.left) * s, (g.eye[1] - crop.top) * s, choice.custom)
  const [bgImg, backImg, frontImg] = await Promise.all([bgSvg && svgImage(bgSvg), svg && svgImage(svg.back), svg && svgImage(svg.front)])

  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  // SVG layers are drawn 1:1 with smoothing off: Chrome's smoothing rings (a light halo) along the
  // clothes' dark edges. Only the person is scaled, with plain bilinear smoothing.
  const svgDraw = (img) => {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
    ctx.imageSmoothingEnabled = true
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  if (bgImg) svgDraw(bgImg)
  else {
    // the photo's own background, blurred, a little brighter, and stretched to cover the frame
    const b = blurredOriginal(a, ctx)
    const cover = Math.max(W / a.orig.width, H / a.orig.height, s)
    const bx = Math.min(0, Math.max(W - a.orig.width * cover, (g.eye[0] - crop.left) * s - g.eye[0] * cover))
    const by = Math.min(0, Math.max(H - a.orig.height * cover, (g.eye[1] - crop.top) * s - g.eye[1] * cover))
    ctx.drawImage(b, bx, by, a.orig.width * cover, a.orig.height * cover)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, W, H)
  }
  // a soft shadow of the person on the backdrop, for depth
  if (choice.bg !== 'blur' && !/^doc/.test(choice.bg) && canFilter(ctx)) {
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.filter = `blur(${Math.round(g.d * s * 0.35)}px)`
    ctx.drawImage(person.canvas, -crop.left * s + g.d * s * 0.12, -crop.top * s + g.d * s * 0.1, a.img.width * s, a.img.height * s)
    ctx.restore()
    ctx.filter = 'none'
  }
  if (backImg) svgDraw(backImg)
  ctx.drawImage(person.canvas, -crop.left * s, -crop.top * s, a.img.width * s, a.img.height * s)
  if (frontImg) svgDraw(frontImg)
  if (person.hairCanvas && choice.hairFront) ctx.drawImage(person.hairCanvas, -crop.left * s, -crop.top * s, a.img.width * s, a.img.height * s)
  // grain: ties the drawn clothes and the photo together
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.07
  const tile = grainTile()
  const pattern = ctx.createPattern(tile, 'repeat')
  if (pattern) {
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()
  return { W, H }
}

/** The picture as a file. */
export async function exportImage(a, choice, type = 'image/jpeg') {
  const canvas = document.createElement('canvas')
  await compose(a, choice, canvas)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, 0.94))
}

/**
 * A print sheet: copies of a document photo on 10×15 cm photo paper at 600 dpi, with thin cut
 * marks — what a photo kiosk prints.
 */
export async function exportSheet(a, choice) {
  const f = FORMATS[choice.format]
  const one = document.createElement('canvas')
  await compose(a, choice, one)
  const dpmm = 600 / 25.4
  const sheet = document.createElement('canvas')
  sheet.width = Math.round(152 * dpmm)
  sheet.height = Math.round(102 * dpmm)
  const ctx = sheet.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  const pw = f.mm[0] * dpmm
  const ph = f.mm[1] * dpmm
  const gap = 3 * dpmm
  const cols = Math.floor((sheet.width + gap) / (pw + gap))
  const rows = Math.floor((sheet.height + gap) / (ph + gap))
  const x0 = (sheet.width - cols * pw - (cols - 1) * gap) / 2
  const y0 = (sheet.height - rows * ph - (rows - 1) * gap) / 2
  ctx.strokeStyle = '#c8c8c8'
  ctx.lineWidth = 2
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * (pw + gap)
      const y = y0 + r * (ph + gap)
      ctx.drawImage(one, x, y, pw, ph)
      ctx.strokeRect(x - 1, y - 1, pw + 2, ph + 2)
    }
  }
  return {
    count: cols * rows,
    blob: await new Promise((resolve, reject) => sheet.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.95)),
  }
}
