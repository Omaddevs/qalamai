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
const listeners = new Map() // model url → progress callbacks (0…1) of whoever waits for it
const ready = new Set() // model urls whose session is up

// Models are kept in the Cache API: after the first download they load from the device, with no
// request to the server at all (the HTTP cache alone forgets them after a week or under pressure).
const CACHE = 'qalam-models-v1'
const cached = async (url) => {
  try {
    const hit = await (await caches.open(CACHE)).match(url)
    return hit ? new Uint8Array(await hit.arrayBuffer()) : null
  } catch {
    return null
  }
}
const keep = async (url, bytes) => {
  try {
    await (await caches.open(CACHE)).put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }))
  } catch {
    /* private mode, quota: next time it downloads again */
  }
}

/**
 * Download a model with progress. A dropped connection resumes where it stopped (Range), up to a
 * few times, instead of failing the whole photo; a server that ignores Range starts over.
 */
async function download(url, onBytes) {
  const parts = []
  let got = 0
  let total = 0
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, got ? { headers: { Range: `bytes=${got}-` } } : undefined)
      if (res.status === 404 || /text\/html/.test(res.headers.get('content-type') ?? '')) throw new Fail('NO_MODEL')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (got && res.status !== 206) {
        parts.length = 0
        got = 0
      }
      if (!total) total = Number(res.headers.get('content-length')) || 0
      const reader = res.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        parts.push(value)
        got += value.length
        if (total) onBytes(Math.min(1, got / total))
      }
      if (total && got < total) throw new Error('short read')
      break
    } catch (err) {
      if (err instanceof Fail || attempt >= 4) throw new Fail('NETWORK')
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }
  const model = new Uint8Array(got)
  let at = 0
  for (const part of parts) {
    model.set(part, at)
    at += part.length
  }
  return model
}

/** A model's session: from the device's cache, or downloaded once (with progress). */
function session(spec, onBytes) {
  if (onBytes && !ready.has(spec.url)) {
    if (!listeners.has(spec.url)) listeners.set(spec.url, new Set())
    listeners.get(spec.url).add(onBytes)
  }
  if (!sessions.has(spec.url)) {
    const report = (k) => listeners.get(spec.url)?.forEach((f) => f(k))
    const p = (async () => {
      const [ort, hit] = await Promise.all([
        loadOrt().catch(() => {
          throw new Fail('UNSUPPORTED')
        }),
        cached(spec.url),
      ])
      let model = hit
      if (!model) {
        model = await download(spec.url, report)
        keep(spec.url, model)
      }
      report(1)
      try {
        return { ort, s: await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }) }
      } catch {
        // a damaged copy in the cache must not stick
        if (hit) caches.open(CACHE).then((c) => c.delete(spec.url)).catch(() => {})
        throw new Fail('UNSUPPORTED')
      }
    })()
    p.then(() => ready.add(spec.url), () => sessions.delete(spec.url)).finally(() => listeners.delete(spec.url))
    sessions.set(spec.url, p)
  }
  return sessions.get(spec.url)
}

// One photo at a time: an ONNX session must not run twice at once (a second photo, or React
// running the opening effect twice in development, would otherwise collide).
let queue = Promise.resolve()
const serial = (fn) => {
  const run = queue.then(fn, fn)
  queue = run.catch(() => {})
  return run
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

self.onmessage = ({ data: msg }) => {
  // the studio opened: fetch the engine and the models while the person picks a photo
  if (msg.type === 'warm') {
    session(FACE_MODEL).catch(() => {})
    session(MATTE_MODEL).catch(() => {})
    return
  }
  const { id } = msg
  const progress = (pct, stage, n) => self.postMessage({ id, type: 'progress', pct: Math.round(pct), stage, n })
  serial(async () => {
    let r
    try {
      r = await analyze(msg.file, progress)
    } catch (err) {
      if (err?.code) throw err
      // something unexpected (a model run that went wrong): once more on fresh sessions
      console.warn('portrait worker, retrying:', err)
      sessions.clear()
      ready.clear()
      r = await analyze(msg.file, progress)
    }
    self.postMessage({ id, type: 'done', result: r }, [r.img.data.buffer, r.orig.data.buffer, r.alpha.buffer, r.hair.buffer])
  }).catch((err) => {
    if (!err?.code) console.error('portrait worker:', err)
    self.postMessage({ id, type: 'error', code: err?.code ?? 'FAILED', detail: err?.code ? undefined : String(err?.message ?? err).slice(0, 200) })
  })
}
