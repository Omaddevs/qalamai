// Image convert / compress / resize on the user's device (OffscreenCanvas), mirroring the
// server's sharp versions (server/src/converters/image/basic.js): same options, names and summaries.
// Formats a browser can't write (AVIF, GIF, TIFF, palette PNG) stay on the server — see LOCAL in local.js.
import { renameExt } from '../../server/src/converters/core/util.js'
import { ToolError } from '../../server/src/lib/errors.js'
import { bytesOf, canvasBlob, decode, unsupportedHere } from './platform.js'

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const OUT_EXT = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', bmp: 'png' }
/** What an input becomes when its own format is kept (compress, resize). */
export const keptFormat = (input) => OUT_EXT[input.ext]

/** Draw `bmp` into a w×h canvas, halving step by step on big reductions so it stays sharp. */
function draw(bmp, w, h, { sx = 0, sy = 0, sw = bmp.width, sh = bmp.height } = {}) {
  let src = bmp
  let cw = sw
  let ch = sh
  let ox = sx
  let oy = sy
  while (cw / 2 >= w && ch / 2 >= h) {
    const half = new OffscreenCanvas(Math.max(1, Math.round(cw / 2)), Math.max(1, Math.round(ch / 2)))
    const hc = half.getContext('2d')
    hc.imageSmoothingQuality = 'high'
    hc.drawImage(src, ox, oy, cw, ch, 0, 0, half.width, half.height)
    src = half
    cw = half.width
    ch = half.height
    ox = 0
    oy = 0
  }
  const canvas = new OffscreenCanvas(Math.max(1, w), Math.max(1, h))
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, ox, oy, cw, ch, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function encode(canvas, format, { quality = 90, background = '#ffffff' } = {}) {
  const type = MIME[format]
  if (!type) throw unsupportedHere(`format ${format}`)
  if (format === 'jpg') {
    // JPEG has no alpha: flatten onto the background colour
    const ctx = canvas.getContext('2d')
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
  }
  return canvasBlob(canvas, type, format === 'png' ? undefined : quality / 100)
}

export async function convert({ inputs, options }, { progress }) {
  const outputs = []
  for (const [i, input] of inputs.entries()) {
    progress(5 + (90 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    const bmp = await decode(input.blob)
    const blob = await encode(draw(bmp, bmp.width, bmp.height), options.format, options)
    bmp.close()
    outputs.push({ name: renameExt(input.name, options.format), data: await bytesOf(blob) })
  }
  return { outputs, summary: { files: outputs.length, format: options.format } }
}

const COMPRESS = { low: 85, medium: 74, high: 58 }

export async function compress({ inputs, options }, { progress }) {
  const quality = COMPRESS[options.level]
  const outputs = []
  let before = 0
  let after = 0
  for (const [i, input] of inputs.entries()) {
    progress(5 + (90 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    const fmt = keptFormat(input)
    if (fmt !== 'jpg' && fmt !== 'webp') throw unsupportedHere(`compress ${input.ext}`)
    const bmp = await decode(input.blob)
    let { width: w, height: h } = bmp
    if (options.maxSide && Math.max(w, h) > options.maxSide) {
      const k = options.maxSide / Math.max(w, h)
      w = Math.round(w * k)
      h = Math.round(h * k)
    }
    const blob = await encode(draw(bmp, w, h), fmt, { quality })
    bmp.close()
    const name = renameExt(input.name, fmt)
    before += input.size
    if (blob.size >= input.size && !options.maxSide) {
      // already optimal — keep the original bytes
      outputs.push({ name, data: await bytesOf(input.blob) })
      after += input.size
      continue
    }
    outputs.push({ name, data: await bytesOf(blob) })
    after += blob.size
  }
  return { outputs, summary: { before, after, saved: before ? Math.max(0, Math.round((1 - after / before) * 100)) : 0 } }
}

/** Target box like sharp's resize(width, height, { fit }): a missing side follows the aspect ratio. */
function plan(iw, ih, width, height, fit) {
  if (!width) width = Math.max(1, Math.round((iw * height) / ih))
  if (!height) height = Math.max(1, Math.round((ih * width) / iw))
  if (fit === 'inside') {
    const k = Math.min(width / iw, height / ih)
    return { w: Math.max(1, Math.round(iw * k)), h: Math.max(1, Math.round(ih * k)) }
  }
  if (fit === 'cover') {
    // scale to cover the box, then cut the centre
    const k = Math.max(width / iw, height / ih)
    const sw = width / k
    const sh = height / k
    return { w: width, h: height, crop: { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh } }
  }
  return { w: width, h: height }
}

export async function resize({ inputs, options }, { progress }) {
  if (options.mode === 'size' && !options.width && !options.height) throw new ToolError('BAD_OPTIONS', 'Kenglik yoki balandlikni kiriting')
  const outputs = []
  for (const [i, input] of inputs.entries()) {
    progress(5 + (90 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    const fmt = keptFormat(input)
    if (!fmt) throw unsupportedHere(`resize ${input.ext}`)
    const bmp = await decode(input.blob)
    const p =
      options.mode === 'percent'
        ? { w: Math.max(1, Math.round((bmp.width * options.percent) / 100)), h: Math.max(1, Math.round((bmp.height * options.percent) / 100)) }
        : plan(bmp.width, bmp.height, options.width, options.height, options.fit)
    const blob = await encode(draw(bmp, p.w, p.h, p.crop), fmt, { quality: 92 })
    bmp.close()
    outputs.push({ name: renameExt(input.name, fmt, `-${p.w}x${p.h}`), data: await bytesOf(blob) })
  }
  return { outputs, summary: { files: outputs.length } }
}
