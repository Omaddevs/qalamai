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
}
