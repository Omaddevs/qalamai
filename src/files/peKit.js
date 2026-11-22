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
