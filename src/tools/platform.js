// What the portable tool core (server/src/converters/core) needs from the browser:
// font bytes and upright, size-capped PNG/JPEG versions of images. Runs inside the tool worker.
import { ToolError } from '../../server/src/lib/errors.js'
import sansRegular from '../../server/assets/fonts/NotoSans-Regular.ttf?url'
import sansBold from '../../server/assets/fonts/NotoSans-Bold.ttf?url'
import sansItalic from '../../server/assets/fonts/NotoSans-Italic.ttf?url'
import sansBoldItalic from '../../server/assets/fonts/NotoSans-BoldItalic.ttf?url'
import serifRegular from '../../server/assets/fonts/NotoSerif-Regular.ttf?url'
import serifBold from '../../server/assets/fonts/NotoSerif-Bold.ttf?url'
import serifItalic from '../../server/assets/fonts/NotoSerif-Italic.ttf?url'
import serifBoldItalic from '../../server/assets/fonts/NotoSerif-BoldItalic.ttf?url'

const FONT_URLS = {
  'NotoSans-Regular.ttf': sansRegular,
  'NotoSans-Bold.ttf': sansBold,
  'NotoSans-Italic.ttf': sansItalic,
  'NotoSans-BoldItalic.ttf': sansBoldItalic,
  'NotoSerif-Regular.ttf': serifRegular,
  'NotoSerif-Bold.ttf': serifBold,
  'NotoSerif-Italic.ttf': serifItalic,
  'NotoSerif-BoldItalic.ttf': serifBoldItalic,
}

/** The browser can't do this one — the caller retries the run on the server. */
export const unsupportedHere = (why) => new ToolError('LOCAL_UNSUPPORTED', why)

const fonts = new Map()

/** Formats that may carry transparency. */
const ALPHA_EXTS = new Set(['png', 'webp', 'gif', 'avif', 'tiff', 'bmp', 'svg'])

/** Decode an image upright (EXIF orientation applied). */
export async function decode(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    // HEIC/HEIF (iPhone photos): only Safari decodes them natively
    const { decodeHeic, isHeic } = await import('./heic.js')
    if (await isHeic(blob)) {
      try {
        return await decodeHeic(blob)
      } catch (err) {
        console.warn('heic decode:', err)
      }
    }
    throw unsupportedHere('image decode')
  }
}

/** Does any pixel of the canvas have alpha below 250? */
export function hasAlpha(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true
  return false
}

export async function canvasBlob(canvas, type, quality) {
  const blob = await canvas.convertToBlob({ type, quality })
  // a browser that can't encode the format quietly hands back a PNG
  if (blob.type !== type) throw unsupportedHere(`encode ${type}`)
  return blob
}

export const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer())

/* ───────── pdf.js inside this worker ─────────
 * No DOM here: canvases are OffscreenCanvas, filters are no-ops (they only matter for
 * high-contrast display), and pdf.js runs its parser in this same thread ("fake worker"). */

class OffscreenCanvasFactory {
  create(width, height) {
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')
    const canvas = new OffscreenCanvas(width, height)
    return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) }
  }

  reset(cc, width, height) {
    cc.canvas.width = width
    cc.canvas.height = height
  }

  destroy(cc) {
    if (cc.canvas) cc.canvas.width = cc.canvas.height = 0
    cc.canvas = null
    cc.context = null
  }

  getNoAlphaContext(canvas) {
    return canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  }
}

class NoFilters {
  addFilter() { return 'none' }
  addHCMFilter() { return 'none' }
  addAlphaFilter() { return 'none' }
  addLuminosityFilter() { return 'none' }
  addKnockoutFilter() { return 'none' }
  addHighlightHCMFilter() { return 'none' }
  addSelectionHCMFilter() { return 'none' }
  addSelectionFilter() { return 'none' }
  createSelectionStyle() { return null }
  destroy() {}
}

let pdfjsLib
const loadPdfjs = () =>
  (pdfjsLib ??= (async () => {
    // the parser, in this thread: pdf.js picks it up from globalThis.pdfjsWorker
    globalThis.pdfjsWorker ??= await import('pdfjs-dist/build/pdf.worker.mjs')
    return import('pdfjs-dist')
  })())

const asset = (path) => new URL(path, self.location.origin).href

const JPEG = 'image/jpeg'

/** RGBA ImageData from raw 1-, 3- or 4-channel pixels. */
function toImageData({ data, width, height, channels }) {
  if (channels === 4) return new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, width * height * 4).slice(), width, height)
  const out = new Uint8ClampedArray(width * height * 4)
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    const r = data[j]
    out[i * 4] = r
    out[i * 4 + 1] = channels === 1 ? r : data[j + 1]
    out[i * 4 + 2] = channels === 1 ? r : data[j + 2]
    out[i * 4 + 3] = 255
  }
  return new ImageData(out, width, height)
}

export const browserPlatform = {
  font(file) {
    if (!fonts.has(file)) {
      const p = fetch(FONT_URLS[file]).then((r) => {
        if (!r.ok) throw new Error(`font ${file}: HTTP ${r.status}`)
        return r.arrayBuffer().then((b) => new Uint8Array(b))
      })
      p.catch(() => fonts.delete(file))
      fonts.set(file, p)
    }
    return fonts.get(file)
  },

  /** Upright, at most 3000 px: PNG when the image has transparency, JPEG otherwise (like the server). */
  async image(input) {
    const bmp = await decode(input.blob)
    const k = Math.min(1, 3000 / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * k))
    const h = Math.max(1, Math.round(bmp.height * k))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    if (ALPHA_EXTS.has(input.ext) && hasAlpha(ctx, w, h)) return { type: 'png', bytes: await bytesOf(await canvasBlob(canvas, 'image/png')) }
    // JPEG has no alpha: paint on white so nothing turns black
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    return { type: 'jpg', bytes: await bytesOf(await canvasBlob(canvas, 'image/jpeg', 0.88)) }
  },

  pdfjs: loadPdfjs,
  get pdfOptions() {
    return {
      CanvasFactory: OffscreenCanvasFactory,
      FilterFactory: NoFilters,
      useWorkerFetch: true,
      standardFontDataUrl: asset('/pdfjs/standard_fonts/'),
      cMapUrl: asset('/pdfjs/cmaps/'),
      cMapPacked: true,
      wasmUrl: asset('/pdfjs/wasm/'),
      iccUrl: asset('/pdfjs/iccs/'),
    }
  },

  async encodeCanvas(canvas, format = 'png', quality = 90) {
    const type = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : JPEG
    return bytesOf(await canvasBlob(canvas, type, type === 'image/png' ? undefined : quality / 100))
  },

  async rawToPng(img) {
    const canvas = new OffscreenCanvas(img.width, img.height)
    canvas.getContext('2d').putImageData(toImageData(img), 0, 0)
    return bytesOf(await canvasBlob(canvas, 'image/png'))
  },

  async toPng(bytes) {
    try {
      const bmp = await createImageBitmap(new Blob([bytes]))
      const canvas = new OffscreenCanvas(bmp.width, bmp.height)
      canvas.getContext('2d').drawImage(bmp, 0, 0)
      bmp.close()
      return bytesOf(await canvasBlob(canvas, 'image/png'))
    } catch {
      return null
    }
  },

  /** A smaller JPEG of a PDF image (JPEG bytes or raw pixels); colour output only. */
  async recompress({ jpeg, raw }, { maxSide, quality }) {
    let src
    let w
    let h
    if (jpeg) {
      try {
        src = await createImageBitmap(new Blob([jpeg], { type: JPEG }))
      } catch {
        return null // CMYK / odd JPEGs: keep the original
      }
      ;({ width: w, height: h } = src)
    } else {
      src = new OffscreenCanvas(raw.width, raw.height)
      src.getContext('2d').putImageData(toImageData(raw), 0, 0)
      ;({ width: w, height: h } = raw)
    }
    const k = Math.min(1, maxSide / Math.max(w, h))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)))
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
    src.close?.()
    return { data: await bytesOf(await canvasBlob(canvas, JPEG, quality / 100)), width: canvas.width, height: canvas.height, gray: false }
  },

  mammoth: () => import('mammoth/mammoth.browser.js').then((m) => m.default ?? m),
}
