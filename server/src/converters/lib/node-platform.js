// Runs a portable tool (converters/core) inside the server's worker threads:
// inputs are read from disk, fonts come from assets/, images are prepared with sharp,
// and the outputs are written into the job's out dir.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { emit } from './util.js'

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
