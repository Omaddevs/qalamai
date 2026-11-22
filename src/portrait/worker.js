// Portrait studio worker: finds the face, levels the head, cuts the person out (MODNet) and
// measures the body — once per photo, off the main thread. The photo never leaves the device.
//
// in:  { id, file: Blob }
// out: { id, type: 'progress', pct, stage } | { id, type: 'done', result } | { id, type: 'error', code }
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import {
  FACE_MODEL, MATTE_MODEL, bodyGeometry, decontaminate, hairMask, keepConnected, levelPlan, mainFace, matteSize,
  modnetInput, resizePlane, toWork, yunetDecode, yunetInput,
} from './core.js'

class Fail extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

let ortPromise = null
const loadOrt = () =>
  (ortPromise ??= import('onnxruntime-web/wasm').then((ort) => {
    ort.env.wasm.wasmPaths = { wasm: wasmUrl }
    ort.env.wasm.numThreads = 1 // threads need cross-origin isolation, which the site doesn't have
    return ort
  }))

const sessions = new Map()

/** A model's session, downloading it once (with progress); the browser caches the file. */
function session(spec, onBytes) {
  if (!sessions.has(spec.url)) {
    const p = (async () => {
      const ort = await loadOrt().catch(() => {
        throw new Fail('UNSUPPORTED')
      })
      const res = await fetch(spec.url).catch(() => null)
      if (!res?.ok || /text\/html/.test(res.headers.get('content-type') ?? '')) throw new Fail('NO_MODEL')
      const total = Number(res.headers.get('content-length')) || 0
      const reader = res.body.getReader()
      const parts = []
      let got = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        parts.push(value)
        got += value.length
        if (total) onBytes?.(got / total)
      }
      const model = new Uint8Array(got)
      let at = 0
      for (const part of parts) {
        model.set(part, at)
        at += part.length
      }
      try {
        return { ort, s: await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }) }
      } catch {
        throw new Fail('UNSUPPORTED')
      }
    })()
    p.catch(() => sessions.delete(spec.url))
    sessions.set(spec.url, p)
  }
  return sessions.get(spec.url)
}

const MAX_SIDE = 4096

async function analyze(file, progress) {
  progress(2, 'load')
  const [face, matte] = [
    session(FACE_MODEL),
    session(MATTE_MODEL, (k) => progress(4 + k * 36, 'model', Math.round(k * 100))),
  ]
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Fail('BAD_IMAGE')
  }
  // very large photos: work from a 4K copy
  const k0 = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const iw = Math.round(bmp.width * k0)
  const ih = Math.round(bmp.height * k0)

  // 1. the face (YuNet looks at a 640×640 letterboxed copy)
  const { ort, s: faceS } = await face
  const S = FACE_MODEL.size
  const k = S / Math.max(iw, ih)
  const box = new OffscreenCanvas(S, S)
  const bc = box.getContext('2d', { willReadFrequently: true })
  bc.fillStyle = '#000'
  bc.fillRect(0, 0, S, S)
  bc.imageSmoothingQuality = 'high'
  bc.drawImage(bmp, 0, 0, Math.round(iw * k), Math.round(ih * k))
  const fo = await faceS.run({ [faceS.inputNames[0]]: new ort.Tensor('float32', yunetInput(bc.getImageData(0, 0, S, S).data, S), [1, 3, S, S]) })
  const faces = yunetDecode(Object.fromEntries(Object.entries(fo).map(([n, v]) => [n, v.data])), S, k)
  // decoded in the 4K copy's pixels → original pixels
  for (const f of faces) {
    f.x /= k0
    f.y /= k0
    f.w /= k0
    f.h /= k0
    f.kps = f.kps.map(([x, y]) => [x / k0, y / k0])
  }
  const main = mainFace(faces)
  if (!main) throw new Fail('NO_FACE')
  const plan = levelPlan(main, bmp.width, bmp.height)
  if (plan.d < 18) throw new Fail('SMALL_FACE')
  progress(42, 'face')

  // 2. level the eyes and cut around the person; at most ~200 px between the eyes is plenty
  const b = plan.box
  const origin = { x: Math.max(0, Math.floor(b.left)), y: Math.max(0, Math.floor(b.top)) }
  const right = Math.min(bmp.width, Math.ceil(b.right))
  const bottom = Math.min(bmp.height, Math.ceil(b.bottom))
  const sc = Math.min(1, 200 / plan.d, 1800 / Math.max(right - origin.x, bottom - origin.y))
  const W = Math.max(16, Math.round((right - origin.x) * sc))
  const H = Math.max(16, Math.round((bottom - origin.y) * sc))
  const work = new OffscreenCanvas(W, H)
  const wc = work.getContext('2d', { willReadFrequently: true })
  wc.imageSmoothingQuality = 'high'
  wc.scale(sc, sc)
  wc.translate(-origin.x + plan.cx, -origin.y + plan.cy)
  wc.rotate(-plan.angle)
  wc.translate(-plan.cx, -plan.cy)
  wc.drawImage(bmp, 0, 0)
  bmp.close()
  wc.setTransform(1, 0, 0, 1, 0, 0)
  const img = wc.getImageData(0, 0, W, H)
  const kps = main.kps.map((p) => toWork(plan, origin, p).map((v) => v * sc))
  const fb = { x: (main.x - origin.x) * sc, y: (main.y - origin.y) * sc, w: main.w * sc, h: main.h * sc }

  // 3. the person's matte
  const { s: matteS } = await matte
  progress(48, 'matte')
  const [mw, mh] = matteSize(W, H)
  const small = new OffscreenCanvas(mw, mh)
  const sc2 = small.getContext('2d', { willReadFrequently: true })
  sc2.imageSmoothingQuality = 'high'
  sc2.drawImage(work, 0, 0, mw, mh)
  const mo = await matteS.run({ [matteS.inputNames[0]]: new ort.Tensor('float32', modnetInput(sc2.getImageData(0, 0, mw, mh).data, mw, mh), [1, 3, mh, mw]) })
  const alpha = resizePlane(mo[matteS.outputNames[0]].data, mw, mh, W, H)
  const eye = [(kps[0][0] + kps[1][0]) / 2, (kps[0][1] + kps[1][1]) / 2]
  keepConnected(alpha, W, H, eye[0], eye[1])
  progress(80, 'edges')

  // 4. clean edges, then measure the body
  const orig = new ImageData(new Uint8ClampedArray(img.data), W, H)
  decontaminate(img, alpha)
  progress(90, 'body')
  const g = bodyGeometry(img, alpha, kps, fb)
  const hair = hairMask(img, alpha, g)
  progress(98, 'done')
  // levelling turns the picture: its bottom corners are empty for this many pixels
  const tilt = Math.abs(Math.tan(plan.angle)) * W
  return { img, orig, alpha, hair: hair.mask, longHair: hair.amount > 0.6, hairAmount: hair.amount, g, tilt, faces: faces.length }
}

self.onmessage = async ({ data: msg }) => {
  const { id } = msg
  const progress = (pct, stage, n) => self.postMessage({ id, type: 'progress', pct: Math.round(pct), stage, n })
  try {
    const r = await analyze(msg.file, progress)
    self.postMessage({ id, type: 'done', result: r }, [r.img.data.buffer, r.orig.data.buffer, r.alpha.buffer, r.hair.buffer])
  } catch (err) {
    if (!err?.code) console.error('portrait worker:', err)
    self.postMessage({ id, type: 'error', code: err?.code ?? 'FAILED' })
  }
}
