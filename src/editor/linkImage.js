// Pictures from links: an image address, a Google/Bing image result or a web page (its preview
// picture), fetched through the server; `data:image/…` links are read right here. The result is a
// File, handled like an uploaded one (downscaled and kept on this device).
import { fetchImageLink } from '../api.js'

/** True for text that can be turned into a picture. */
export const isImageLink = (text) => /^\s*(https?:\/\/\S+|data:image\/[a-z+.-]+;base64,)/i.test(String(text ?? ''))

/** An SVG drawn into a PNG (the browser's image decoder for uploads does not read SVG). */
async function rasterize(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const w = img.naturalWidth || 1200
    const h = img.naturalHeight || 800
    const k = Math.min(4, 1600 / Math.max(w, h)) // vectors are drawn sharp
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * k))
    c.height = Math.max(1, Math.round(h * k))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return await new Promise((r) => c.toBlob(r, 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The picture behind a link, as a File. Throws an ApiError (with a user-facing message) when there is none. */
export async function fileFromLink(text) {
  const link = String(text).trim()
  let blob = /^data:image\//i.test(link) ? await (await fetch(link)).blob() : await fetchImageLink(link)
  if (blob.type === 'image/svg+xml') blob = await rasterize(blob)
  const name = (() => {
    try {
      return decodeURIComponent(new URL(link).pathname.split('/').pop() || 'image')
    } catch {
      return 'image'
    }
  })()
  return new File([blob], name, { type: blob.type || 'image/png' })
}

/**
 * A picture (File) or picture link on the system clipboard, or null. The browser may ask the
 * user's permission; a refusal or an unsupported browser simply gives null.
 * `peek`: only tells whether there is one (a link is returned as is, nothing is fetched).
 */
export async function readClipboardPicture({ peek = false } = {}) {
  try {
    // peeking never triggers a permission prompt: without a granted permission the answer is "maybe"
    if (peek) {
      const state = await navigator.permissions?.query({ name: 'clipboard-read' }).then((p) => p.state).catch(() => null)
      if (state !== 'granted') return 'maybe'
    }
    if (navigator.clipboard?.read) {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((x) => x.startsWith('image/'))
        if (type) {
          if (peek) return true
          const blob = await item.getType(type)
          return new File([blob], 'clipboard', { type })
        }
        if (item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text()
          if (isImageLink(text)) return text.trim()
        }
      }
      return null
    }
    const text = await navigator.clipboard?.readText?.()
    return isImageLink(text) ? text.trim() : null
  } catch {
    return null
  }
}
