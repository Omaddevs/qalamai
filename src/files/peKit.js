// Helpers for the PDF editor: page "sources" (a page of a PDF, a blank page, an image page),
// stamps drawn to PNG, and printing a PDF blob.

/** A4 in PDF points — blank pages and image pages use it (as the server does). */
export const A4 = [595.28, 841.89]
const IMAGE_MARGIN = 24 // server: images-to-pdf margin "small"

/** Viewport-like converter for pages we draw ourselves (no rotation, origin bottom-left in PDF space). */
export function flatViewport(width, height) {
  return {
    width,
    height,
    convertToPdfPoint: (x, y) => [x, height - y],
    convertToViewportPoint: (x, y) => [x, height - y],
  }
}

/** Page size for an image page: A4, turned landscape for wide images (server: orientation "auto"). */
export function imagePageSize(iw, ih) {
  return iw > ih ? [A4[1], A4[0]] : [...A4]
}

/** Where the image sits on its page, in top-left page units. */
export function imageBox(iw, ih, pw, ph) {
  const k = Math.min((pw - IMAGE_MARGIN * 2) / iw, (ph - IMAGE_MARGIN * 2) / ih)
  const w = iw * k
  const h = ih * k
  return { x: (pw - w) / 2, y: (ph - h) / 2, w, h }
}

/**
 * Draw a page source onto a canvas at `scale` (CSS px per PDF point × device pixels).
 * @returns {{ promise: Promise<void>, cancel: () => void }}
 */
export function renderSource(source, canvas, scale, size) {
  if (source.type === 'pdf') {
    let task
    let canceled = false
    const promise = source.doc.getPage(source.n).then((page) => {
      if (canceled) return
      const vp = page.getViewport({ scale })
      canvas.width = Math.round(vp.width)
      canvas.height = Math.round(vp.height)
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, canvas })
      return task.promise.catch(() => {})
    })
    return {
      promise,
      cancel: () => {
        canceled = true
        task?.cancel()
      },
    }
  }
  canvas.width = Math.round(size.width * scale)
  canvas.height = Math.round(size.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (source.type === 'image') {
    const b = source.box
    ctx.drawImage(source.img, b.x * scale, b.y * scale, b.w * scale, b.h * scale)
  }
  return { promise: Promise.resolve(), cancel: () => {} }
}

/** Load an image element from a File / Blob. */
export function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

/* ───────── stamps ───────── */

export const STAMPS = [
  { id: 'approved', color: '#16a34a' },
  { id: 'paid', color: '#16a34a' },
  { id: 'reviewed', color: '#2563eb' },
  { id: 'copy', color: '#2563eb' },
  { id: 'draft', color: '#6b7280' },
  { id: 'confidential', color: '#dc2626' },
  { id: 'rejected', color: '#dc2626' },
]

/** A rubber-stamp look, drawn at 2× and returned as a PNG data URL. */
export function stampImage(text, color, subline = '') {
  const S = 2
  const font = `800 ${30 * S}px Inter, 'Noto Sans', Arial, sans-serif`
  const small = `700 ${13 * S}px Inter, 'Noto Sans', Arial, sans-serif`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const tw = probe.measureText(text).width
  probe.font = small
  const sw = subline ? probe.measureText(subline).width : 0
  const padX = 22 * S
  const w = Math.ceil(Math.max(tw, sw) + padX * 2)
  const h = Math.ceil((subline ? 74 : 56) * S)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const round = (inset, r) => {
    ctx.beginPath()
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, r)
  }
  ctx.fillStyle = `${color}10`
  round(2 * S, 12 * S)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3.5 * S
  round(2 * S, 12 * S)
  ctx.stroke()
  ctx.lineWidth = 1.2 * S
  round(7 * S, 8 * S)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font
  ctx.fillText(text, w / 2, subline ? h * 0.42 : h / 2 + 1)
  if (subline) {
    ctx.font = small
    ctx.fillText(subline, w / 2, h * 0.75)
  }
  return { src: c.toDataURL('image/png'), w, h }
}

/* ───────── printing ───────── */

/** Print a PDF through the browser's viewer in a hidden frame (falls back to a new tab). */
export function printBlob(blob) {
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow.focus()
      frame.contentWindow.print()
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }
  document.body.appendChild(frame)
  setTimeout(() => {
    frame.remove()
    URL.revokeObjectURL(url)
  }, 120_000)
}

/* ───────── images already in the PDF ───────── */

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]

/**
 * Upright images a page paints, from its operator list, as boxes in viewport units (scale 1).
 * Skipped: rotated / skewed / flipped images (they could not be moved as a plain box),
 * page backgrounds (> 85 % of the page) and specks.
 */
export function findImages(opList, OPS, vp) {
  if (vp.rotation % 360) return []
  const out = []
  let ctm = [1, 0, 0, 1, 0, 0]
  const stack = []
  const area = vp.width * vp.height
  opList.fnArray.forEach((fn, i) => {
    const a = opList.argsArray[i]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
    else if (fn === OPS.transform) ctm = mul(ctm, a)
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm)
      if (Array.isArray(a?.[0]) || ArrayBuffer.isView(a?.[0])) ctm = mul(ctm, [...a[0]])
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const [ca, cb, cc, cd, ce, cf] = ctm
      if (Math.abs(cb) > 1e-3 || Math.abs(cc) > 1e-3 || ca <= 0 || cd <= 0) return
      const [x1, y1] = vp.convertToViewportPoint(ce, cf)
      const [x2, y2] = vp.convertToViewportPoint(ce + ca, cf + cd)
      const box = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
      const vw = Math.min(vp.width, box.x + box.w) - Math.max(0, box.x)
      const vh = Math.min(vp.height, box.y + box.h) - Math.max(0, box.y)
      if (vw < 6 || vh < 6 || vw * vh > area * 0.85) return
      out.push({ id: `img${i}`, ...box, name: typeof a[0] === 'string' ? a[0] : null })
    }
  })
  return out
}

/** Pixels of a decoded pdf.js image object on a canvas, or null when they are not at hand. */
function objToCanvas(obj) {
  if (!obj?.width || !obj?.height) return null
  const c = document.createElement('canvas')
  c.width = obj.width
  c.height = obj.height
  const ctx = c.getContext('2d')
  if (obj.bitmap) {
    ctx.drawImage(obj.bitmap, 0, 0)
    return c
  }
  if (!obj.data) return null
  const px = obj.width * obj.height
  const out = ctx.createImageData(obj.width, obj.height)
  const d = obj.data
  if (d.length === px * 4) out.data.set(d)
  else if (d.length === px * 3) for (let i = 0, j = 0; i < px; i++, j += 3) out.data.set([d[j], d[j + 1], d[j + 2], 255], i * 4)
  else return null
  ctx.putImageData(out, 0, 0)
  return c
}

/** Canvas → data URL the server can embed: JPEG when fully opaque, PNG otherwise; at most 2000 px. */
function canvasUrl(c) {
  const k = Math.min(1, 2000 / Math.max(c.width, c.height))
  let src = c
  if (k < 1) {
    src = document.createElement('canvas')
    src.width = Math.round(c.width * k)
    src.height = Math.round(c.height * k)
    src.getContext('2d').drawImage(c, 0, 0, src.width, src.height)
  }
  const data = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data
  let opaque = true
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) { opaque = false; break }
  return opaque ? src.toDataURL('image/jpeg', 0.92) : src.toDataURL('image/png')
}

/** The part of the rendered page canvas under `box` (viewport units) — a quick stand-in. */
export function cropCanvas(canvas, box, zoom) {
  const f = (canvas.width / (canvas.clientWidth || canvas.width)) * zoom // canvas px per page unit
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(box.w * f))
  c.height = Math.max(1, Math.round(box.h * f))
  c.getContext('2d').drawImage(canvas, box.x * f, box.y * f, box.w * f, box.h * f, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

/** Full-resolution pixels of an image the page paints (by its pdf.js object name). */
export async function imageUrl(page, name) {
  if (!name) return null
  const store = name.startsWith('g_') ? page.commonObjs : page.objs
  const obj = await new Promise((resolve) => {
    try {
      if (store.has(name)) return resolve(store.get(name))
      store.get(name, resolve)
      setTimeout(() => resolve(null), 4000)
    } catch {
      resolve(null)
    }
  })
  const c = objToCanvas(obj)
  return c ? canvasUrl(c) : null
}
