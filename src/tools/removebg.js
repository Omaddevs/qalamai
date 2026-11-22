// Background removal on the user's device: U²-Netp (the rembg model the server uses) on
// onnxruntime-web, image work on OffscreenCanvas. Mirrors server/src/converters/image/remove-bg.js
// — the maths is shared (core/segment.js); options, names and summary are the same.
import { MODELS, maskBounds, modelInput, predictionToMask, tightenMask } from '../../server/src/converters/core/segment.js'
import { renameExt } from '../../server/src/converters/core/util.js'
import { ToolError } from '../../server/src/lib/errors.js'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { bytesOf, canvasBlob, decode, unsupportedHere } from './platform.js'

const SPEC = MODELS.u2netp
const MODEL_URL = '/models/u2netp.onnx'
const MAX_SIDE = 4096

let sessionPromise = null

async function session(progress) {
  sessionPromise ??= (async () => {
    const ort = await import('onnxruntime-web/wasm').catch(() => {
      throw unsupportedHere('onnxruntime-web did not load')
    })
    ort.env.wasm.wasmPaths = { wasm: wasmUrl }
    ort.env.wasm.numThreads = 1 // threads need cross-origin isolation, which the site doesn't have
    const res = await fetch(MODEL_URL).catch(() => null)
    // no model on this site (or an HTML page in its place): the server does the job
    if (!res?.ok || /text\/html/.test(res.headers.get('content-type') ?? '')) throw unsupportedHere(`model HTTP ${res?.status}`)
    // the model is ~4.6 MB: show its download, then the browser caches it
    const total = Number(res.headers.get('content-length')) || SPEC.mb * 1048576
    const reader = res.body.getReader()
    const parts = []
    let got = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      got += value.length
      progress?.(3 + Math.min(1, got / total) * 17, `AI model yuklanmoqda: ${Math.round(Math.min(1, got / total) * 100)}%`)
    }
    const model = new Uint8Array(got)
    let at = 0
    for (const p of parts) {
      model.set(p, at)
      at += p.length
    }
    let s
    try {
      s = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    } catch {
      throw unsupportedHere('onnxruntime-web could not start')
    }
    return { ort, s }
  })()
  sessionPromise.catch(() => (sessionPromise = null))
  return sessionPromise
}

/** Alpha mask (8-bit, the canvas's size) for the picture on `canvas`. */
async function predictMask(canvas, progress) {
  const { ort, s } = await session(progress)
  const S = SPEC.size
  const small = new OffscreenCanvas(S, S)
  const sc = small.getContext('2d', { willReadFrequently: true })
  sc.imageSmoothingQuality = 'high'
  sc.drawImage(canvas, 0, 0, S, S)
  const input = modelInput(sc.getImageData(0, 0, S, S).data, S, SPEC, 4)
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, S, S]) })
  const plane = predictionToMask(out[s.outputNames[0]].data, S * S)

  // back to full size (smooth scaling of a gray image), then tighten the soft edge band
  const tiny = new ImageData(S, S)
  for (let i = 0; i < plane.length; i++) {
    tiny.data[i * 4] = tiny.data[i * 4 + 1] = tiny.data[i * 4 + 2] = plane[i]
    tiny.data[i * 4 + 3] = 255
  }
  const t = new OffscreenCanvas(S, S)
  t.getContext('2d').putImageData(tiny, 0, 0)
  const { width, height } = canvas
  const big = new OffscreenCanvas(width, height)
  const bc = big.getContext('2d', { willReadFrequently: true })
  bc.imageSmoothingQuality = 'high'
  bc.drawImage(t, 0, 0, width, height)
  const rgba = bc.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4]
  return tightenMask(mask)
}

const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' }

export async function run({ inputs, options }, { progress }) {
  progress(3, 'AI model tayyorlanmoqda')
  await session(progress)
  const outputs = []
  for (const [i, input] of inputs.entries()) {
    const base = 20 + (75 * i) / inputs.length
    const span = 75 / inputs.length
    progress(base, inputs.length > 1 ? `${i + 1} / ${inputs.length}: obyekt ajratilmoqda` : 'Obyekt ajratilmoqda')
    let bmp
    try {
      bmp = await decode(input.blob)
    } catch {
      throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» rasmini öqib bölmadi.`)
    }
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    const width = Math.max(1, Math.round(bmp.width * k))
    const height = Math.max(1, Math.round(bmp.height * k))
    // the photo without its own transparency, like the server's removeAlpha()
    const photo = new OffscreenCanvas(width, height)
    const pc = photo.getContext('2d', { willReadFrequently: true })
    pc.fillStyle = '#000'
    pc.fillRect(0, 0, width, height)
    pc.imageSmoothingQuality = 'high'
    pc.drawImage(bmp, 0, 0, width, height)
    bmp.close()

    const mask = await predictMask(photo, progress)
    progress(base + span * 0.7, 'Natija tayyorlanmoqda')

    const px = pc.getImageData(0, 0, width, height)
    for (let p = 0; p < mask.length; p++) px.data[p * 4 + 3] = mask[p]
    let box = { left: 0, top: 0, right: width - 1, bottom: height - 1 }
    if (options.crop) {
      // crop to the subject's bounding box (+2% padding)
      const b = maskBounds(mask, width, height)
      if (b) {
        const pad = Math.round(Math.max(width, height) * 0.02)
        box = { left: Math.max(0, b.left - pad), top: Math.max(0, b.top - pad), right: Math.min(width - 1, b.right + pad), bottom: Math.min(height - 1, b.bottom + pad) }
      }
    }
    const cw = box.right - box.left + 1
    const ch = box.bottom - box.top + 1
    const cut = new OffscreenCanvas(cw, ch)
    const cc = cut.getContext('2d')
    cc.putImageData(px, -box.left, -box.top)
    const fmt = options.background === 'color' && options.format === 'png' ? 'png' : options.format
    if (options.background === 'color' || fmt === 'jpg') {
      cc.globalCompositeOperation = 'destination-over'
      cc.fillStyle = options.background === 'color' ? options.color : '#ffffff'
      cc.fillRect(0, 0, cw, ch)
    }
    const blob = await canvasBlob(cut, MIME[fmt], fmt === 'png' ? undefined : 0.92)
    outputs.push({ name: renameExt(input.name, fmt, '-fonsiz'), data: await bytesOf(blob) })
  }
  return { outputs, summary: { files: outputs.length, model: 'u2netp' } }
}
