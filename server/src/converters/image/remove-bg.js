// Background removal with a salient-object segmentation model (U²-Net family / IS-Net,
// the models used by the open-source rembg project) running on onnxruntime-node.
// Models are Apache-2.0; they download once into MODELS_DIR on first use.
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import sharp from 'sharp'
import { ToolError } from '../../lib/errors.js'
import { emit, renameExt } from '../lib/util.js'

const RELEASE = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0'
export const MODELS = {
  u2netp: { file: 'u2netp.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], mb: 4.6 },
  silueta: { file: 'silueta.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], mb: 43 },
  u2net: { file: 'u2net.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], mb: 176 },
  'isnet-general-use': { file: 'isnet-general-use.onnx', size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1], mb: 178 },
}

export async function ensureModel(name, dir, { autoDownload = true, onProgress } = {}) {
  const spec = MODELS[name]
  const path = join(dir, spec.file)
  try {
    if ((await stat(path)).size > 1_000_000) return path
  } catch {
    /* missing */
  }
  if (!autoDownload) throw new ToolError('MODEL_MISSING', `AI model topilmadi. Serverda «npm run models» buyruğini bajaring.`)
  await mkdir(dir, { recursive: true })
  const res = await fetch(`${RELEASE}/${spec.file}`, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new ToolError('MODEL_MISSING', 'AI modelni yuklab bölmadi — internet aloqasini tekşiring.')
  const total = Number(res.headers.get('content-length')) || spec.mb * 1048576
  let got = 0
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.part`
  const body = Readable.fromWeb(res.body)
  body.on('data', (c) => {
    got += c.length
    onProgress?.(got / total)
  })
  try {
    await pipeline(body, createWriteStream(tmp))
    await rename(tmp, path)
  } catch (err) {
    await rm(tmp, { force: true })
    throw err
  }
  return path
}

let ortPromise
const sessions = new Map()
async function session(path) {
  ortPromise ??= import('onnxruntime-node').catch(() => {
    ortPromise = null
    throw new ToolError('ENGINE_MISSING', 'Fonni olib taşlaş dvigateli örnatilmagan. Serverda: npm install onnxruntime-node')
  })
  const ort = await ortPromise
  if (!sessions.has(path)) sessions.set(path, ort.InferenceSession.create(path, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' }))
  return { ort, session: await sessions.get(path) }
}

/** Alpha mask (8-bit, original size) for an image. */
export async function predictMask(rgb, width, height, { modelPath, spec }) {
  const { ort, session: s } = await session(modelPath)
  const S = spec.size
  const { data } = await sharp(rgb, { raw: { width, height, channels: 3 } }).resize(S, S, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true })

  let max = 1e-6
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i]
  const plane = S * S
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = (data[i * 3 + c] / max - spec.mean[c]) / spec.std[c]
  }
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, S, S]) })
  const pred = out[s.outputNames[0]].data
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < plane; i++) {
    if (pred[i] < lo) lo = pred[i]
    if (pred[i] > hi) hi = pred[i]
  }
  const range = hi - lo || 1
  const small = Buffer.alloc(plane)
  for (let i = 0; i < plane; i++) small[i] = Math.round(((pred[i] - lo) / range) * 255)

  // back to full size, then tighten the soft edge band a little to avoid halos
  // extractChannel: sharp writes single-channel raw input back out as 3-channel sRGB otherwise
  const mask = await sharp(small, { raw: { width: S, height: S, channels: 1 } }).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer()
  if (mask.length !== width * height) throw new Error(`mask size ${mask.length} ≠ ${width}×${height}`)
  const LO = 18
  const HI = 236
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]
    mask[i] = v <= LO ? 0 : v >= HI ? 255 : Math.round(((v - LO) / (HI - LO)) * 255)
  }
  return mask
}

/** Bounding box of the visibly opaque part of a mask, or null if there is none. */
export function maskBounds(mask, width, height, threshold = 24) {
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (mask[row + x] <= threshold) continue
      if (x < left) left = x
      if (x > right) right = x
      if (top === height) top = y
      bottom = y
    }
  }
  return right < 0 ? null : { left, top, right, bottom }
}

export async function run({ inputs, options, outDir }, { progress, env }) {
  const spec = MODELS[env.bgModel] ?? MODELS.u2netp
  progress(3, 'AI model tayyorlanmoqda')
  const modelPath = await ensureModel(env.bgModel ?? 'u2netp', env.modelsDir, {
    autoDownload: env.modelsAutoDownload,
    onProgress: (f) => progress(3 + f * 17, `AI model yuklanmoqda: ${Math.round(f * 100)}%`),
  })

  const outputs = []
  for (const [i, input] of inputs.entries()) {
    const base = 20 + (75 * i) / inputs.length
    const span = 75 / inputs.length
    progress(base, inputs.length > 1 ? `${i + 1} / ${inputs.length}: obyekt ajratilmoqda` : 'Obyekt ajratilmoqda')
    let rgb
    try {
      // cap the working size; very large photos gain nothing at the model's resolution
      rgb = await sharp(input.path, { failOn: 'none', limitInputPixels: 268_402_689 })
        .rotate()
        .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true })
    } catch {
      throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» rasmini öqib bölmadi.`)
    }
    const { width, height } = rgb.info
    const mask = await predictMask(rgb.data, width, height, { modelPath, spec })
    progress(base + span * 0.7, 'Natija tayyorlanmoqda')

    let img = sharp(rgb.data, { raw: { width, height, channels: 3 } }).joinChannel(mask, { raw: { width, height, channels: 1 } })
    if (options.crop) {
      // crop to the subject's bounding box (+2% padding)
      const box = maskBounds(mask, width, height)
      if (box) {
        const pad = Math.round(Math.max(width, height) * 0.02)
        const left = Math.max(0, box.left - pad)
        const top = Math.max(0, box.top - pad)
        img = sharp(await img.png().toBuffer()).extract({
          left,
          top,
          width: Math.min(width, box.right + 1 + pad) - left,
          height: Math.min(height, box.bottom + 1 + pad) - top,
        })
      }
    }
    const fmt = options.background === 'color' && options.format === 'png' ? 'png' : options.format
    if (options.background === 'color' || fmt === 'jpg') img = img.flatten({ background: options.background === 'color' ? options.color : '#ffffff' })
    const buf =
      fmt === 'jpg' ? await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer() : fmt === 'webp' ? await img.webp({ quality: 92, alphaQuality: 100 }).toBuffer() : await img.png({ compressionLevel: 8 }).toBuffer()
    outputs.push(await emit(outDir, renameExt(input.name, fmt, '-fonsiz'), buf))
  }
  return { outputs, summary: { files: outputs.length, model: env.bgModel } }
}
