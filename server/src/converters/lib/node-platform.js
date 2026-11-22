// Runs a portable tool (converters/core) inside the server's worker threads:
// inputs are read from disk, fonts come from assets/, images are prepared with sharp,
// and the outputs are written into the job's out dir.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { emit } from './util.js'

const require = createRequire(import.meta.url)
const PDFJS_ROOT = dirname(require.resolve('pdfjs-dist/package.json'))
const pdfjsDir = (p) => join(PDFJS_ROOT, p) + '/'
let pdfjsLib

const FONT_DIR = fileURLToPath(new URL('../../../assets/fonts/', import.meta.url))
const fonts = new Map()

const bytesOf = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

export const nodePlatform = {
  font(file) {
    if (!fonts.has(file)) fonts.set(file, readFile(FONT_DIR + file).then(bytesOf))
    return fonts.get(file)
  },

  /** Upright (EXIF), at most 3000 px: PNG when the image has alpha, JPEG otherwise. */
  async image(input) {
    const img = sharp(input.path, { failOn: 'none', limitInputPixels: 268_402_689 }).rotate()
    const meta = await img.metadata()
    const resized = img.resize(3000, 3000, { fit: 'inside', withoutEnlargement: true })
    if (meta.hasAlpha) return { type: 'png', bytes: bytesOf(await resized.png({ compressionLevel: 8 }).toBuffer()) }
    return { type: 'jpg', bytes: bytesOf(await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer()) }
  },

  pdfjs: () => (pdfjsLib ??= import('pdfjs-dist/legacy/build/pdf.mjs')),
  pdfOptions: {
    standardFontDataUrl: pdfjsDir('standard_fonts'),
    cMapUrl: pdfjsDir('cmaps'),
    cMapPacked: true,
    wasmUrl: pdfjsDir('wasm'),
    iccUrl: pdfjsDir('iccs'),
  },

  /** @napi-rs/canvas → png | jpg | webp bytes */
  async encodeCanvas(canvas, format = 'png', quality = 90) {
    return bytesOf(await (format === 'png' ? canvas.encode('png') : canvas.encode(format === 'jpg' ? 'jpeg' : format, quality)))
  },

  /** Raw pixels (1, 3 or 4 channels) → PNG. */
  async rawToPng({ data, width, height, channels }) {
    return bytesOf(await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels } }).png({ compressionLevel: 8 }).toBuffer())
  },

  /** Any image sharp reads (GIF, WebP, SVG …) → PNG, or null. */
  async toPng(bytes) {
    try {
      return bytesOf(await sharp(Buffer.from(bytes)).png().toBuffer())
    } catch {
      return null
    }
  },

  /**
   * Re-encode a PDF image as a smaller JPEG: `jpeg` bytes, or `raw` { data, width, height, channels }.
   * Keeps gray images gray. → { data, width, height, gray }
   */
  async recompress({ jpeg, raw }, { maxSide, quality, channels }) {
    const input = jpeg ? sharp(Buffer.from(jpeg)) : sharp(Buffer.from(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), { raw: { width: raw.width, height: raw.height, channels: raw.channels } })
    const { data, info } = await input
      .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
      .toColourspace(channels === 1 ? 'b-w' : 'srgb')
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer({ resolveWithObject: true })
    return { data: bytesOf(data), width: info.width, height: info.height, gray: channels === 1 }
  },

  mammoth: () => import('mammoth').then((m) => m.default ?? m),
}

/** Wrap a portable tool `(task, ctx) → { outputs: [{ name, data }], summary }` for the worker pool. */
export const onServer = (fn) =>
  async function run(task, ctx) {
    const inputs = task.inputs.map((i) => ({ ...i, read: async () => bytesOf(await readFile(i.path)) }))
    const result = await fn({ ...task, inputs }, { ...ctx, platform: nodePlatform })
    const outputs = []
    for (const o of result.outputs) outputs.push(await emit(task.outDir, o.name, o.data))
    return { outputs, summary: result.summary }
  }
