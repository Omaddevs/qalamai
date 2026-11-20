// Image format conversion, compression and resizing (sharp / libvips).
import { copyFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { ToolError } from '../../lib/errors.js'
import { emit, renameExt } from '../lib/util.js'

const LIMIT = { limitInputPixels: 268_402_689, failOn: 'none' }

export function open(path, { animated = false } = {}) {
  return sharp(path, { ...LIMIT, animated }).rotate() // apply EXIF orientation
}

/** Encoder settings per output format. */
export function encode(pipeline, format, { quality = 90, background = '#ffffff', effort } = {}) {
  switch (format) {
    case 'jpg':
      return pipeline.flatten({ background }).jpeg({ quality, mozjpeg: true })
    case 'png':
      return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: effort ?? 7 })
    case 'webp':
      return pipeline.webp({ quality, effort: effort ?? 5, smartSubsample: true })
    case 'avif':
      return pipeline.avif({ quality: Math.round(quality * 0.75), effort: effort ?? 4 })
    case 'gif':
      return pipeline.gif({ effort: effort ?? 7 })
    case 'tiff':
      return pipeline.tiff({ quality, compression: 'lzw' })
    default:
      throw new ToolError('BAD_OPTIONS', `Format qöllab-quvvatlanmaydi: ${format}`)
  }
}

const OUT_EXT = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', heif: 'jpg', heic: 'jpg', gif: 'gif', tiff: 'tiff', bmp: 'png', svg: 'png' }

function guard(err, input) {
  if (/unsupported image format|heif/i.test(err.message)) {
    throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» formatini öqib bölmadi (HEIC rasmlarni telefoningizda JPG qilib yuboring).`)
  }
  throw err
}

export async function convert({ inputs, options, outDir }, { progress }) {
  const outputs = []
  for (const [i, input] of inputs.entries()) {
    progress(5 + (90 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    const animated = (options.format === 'gif' || options.format === 'webp') && (input.meta?.frames ?? 1) > 1
    try {
      const buf = await encode(open(input.path, { animated }), options.format, options).toBuffer()
      outputs.push(await emit(outDir, renameExt(input.name, options.format), buf))
    } catch (err) {
      guard(err, input)
    }
  }
  return { outputs, summary: { files: outputs.length, format: options.format } }
}

const COMPRESS = { low: { quality: 85, png: 95 }, medium: { quality: 74, png: 80 }, high: { quality: 58, png: 60 } }

export async function compress({ inputs, options, outDir }, { progress }) {
  const level = COMPRESS[options.level]
  const outputs = []
  let before = 0
  let after = 0
  for (const [i, input] of inputs.entries()) {
    progress(5 + (90 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    const size = (await stat(input.path)).size
    const fmt = OUT_EXT[input.meta?.format] ?? OUT_EXT[input.ext] ?? 'jpg'
    try {
      let p = open(input.path, { animated: fmt === 'gif' })
      if (options.maxSide) p = p.resize(options.maxSide, options.maxSide, { fit: 'inside', withoutEnlargement: true })
      p = fmt === 'png' ? p.png({ palette: true, quality: level.png, effort: 10, compressionLevel: 9 }) : encode(p, fmt, { quality: level.quality, effort: 6 })
      let buf = await p.toBuffer()
      const name = renameExt(input.name, fmt)
      if (buf.length >= size && !options.maxSide) {
        // already optimal — keep the original bytes
        const path = join(outDir, `${i}-${name}`)
        await copyFile(input.path, path)
        outputs.push({ path, name })
        before += size
        after += size
        continue
      }
      outputs.push(await emit(outDir, name, buf))
      before += size
      after += buf.length
    } catch (err) {
      guard(err, input)
    }
  }
  return { outputs, summary: { before, after, saved: before ? Math.max(0, Math.round((1 - after / before) * 100)) : 0 } }
}

export async function resize({ inputs, options, outDir }, { progress }) {
  if (options.mode === 'size' && !options.width && !options.height) throw new ToolError('BAD_OPTIONS', 'Kenglik yoki balandlikni kiriting')
  const outputs = []
  for (const [i, input] of inputs.entries()) {
    progress(5 + (90 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    const fmt = OUT_EXT[input.meta?.format] ?? OUT_EXT[input.ext] ?? 'png'
    try {
      const meta = input.meta?.width ? input.meta : await sharp(input.path, LIMIT).metadata()
      let width
      let height
      if (options.mode === 'percent') {
        width = Math.max(1, Math.round((meta.width * options.percent) / 100))
        height = Math.max(1, Math.round((meta.height * options.percent) / 100))
      } else {
        width = options.width
        height = options.height
      }
      const fit = options.mode === 'percent' ? 'fill' : options.fit
      const p = open(input.path).resize(width, height, { fit, kernel: 'lanczos3' })
      const buf = await encode(p, fmt, { quality: 92 }).toBuffer({ resolveWithObject: true })
      outputs.push(await emit(outDir, renameExt(input.name, fmt, `-${buf.info.width}x${buf.info.height}`), buf.data))
    } catch (err) {
      guard(err, input)
    }
  }
  return { outputs, summary: { files: outputs.length } }
}
