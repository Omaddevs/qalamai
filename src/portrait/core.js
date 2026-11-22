// Portrait studio maths: no DOM, no canvas. Runs in the portrait worker (analysis) and on the main
// thread (retouch), and in Node for tests. Images are { data: RGBA bytes, width, height }.
//
// Units: after analysis everything is measured in the leveled "work" image, and the body frame
// has its origin under the chin (neck centre, chin height) with the eye distance `d` as one unit.

export const FACE_MODEL = { url: '/models/yunet.onnx', size: 640 }
export const MATTE_MODEL = { url: '/models/modnet.onnx', short: 512, max: 768 }

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t

/* ───────── face detection (YuNet, OpenCV Zoo, MIT) ───────── */

/** S×S RGBA (the image letterboxed at its top-left corner) → YuNet's input: BGR planes, 0…255. */
export function yunetInput(rgba, S) {
  const plane = S * S
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    out[i] = rgba[i * 4 + 2]
    out[plane + i] = rgba[i * 4 + 1]
    out[2 * plane + i] = rgba[i * 4]
  }
  return out
}

const iou = (a, b) => {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (a.w * a.h + b.w * b.h - inter || 1)
}

/**
 * YuNet's 12 outputs → faces in the original image's pixels (`k` = letterbox scale), best first.
 * Landmarks: [image-left eye, image-right eye, nose tip, image-left mouth corner, image-right mouth corner].
 */
export function yunetDecode(out, S, k, threshold = 0.6) {
  const faces = []
  for (const stride of [8, 16, 32]) {
    const cols = S / stride
    const cls = out[`cls_${stride}`]
    const obj = out[`obj_${stride}`]
    const box = out[`bbox_${stride}`]
    const kps = out[`kps_${stride}`]
    for (let i = 0; i < cls.length; i++) {
      const score = Math.sqrt(clamp(cls[i], 0, 1) * clamp(obj[i], 0, 1))
      if (score < threshold) continue
      const r = Math.floor(i / cols)
      const c = i % cols
      const cx = (c + box[i * 4]) * stride
      const cy = (r + box[i * 4 + 1]) * stride
      const w = Math.exp(box[i * 4 + 2]) * stride
      const h = Math.exp(box[i * 4 + 3]) * stride
      const pts = []
      for (let p = 0; p < 5; p++) pts.push([(kps[i * 10 + p * 2] + c) * stride / k, (kps[i * 10 + p * 2 + 1] + r) * stride / k])
      faces.push({ score, x: (cx - w / 2) / k, y: (cy - h / 2) / k, w: w / k, h: h / k, kps: pts })
    }
  }
  faces.sort((a, b) => b.score - a.score)
  const kept = []
  for (const f of faces) if (kept.every((g) => iou(f, g) < 0.3)) kept.push(f)
  return kept
}

/** The face to work with: the biggest of the confident ones (a person behind is smaller). */
export function mainFace(faces) {
  if (!faces.length) return null
  const best = faces[0].score
  return faces.filter((f) => f.score > best - 0.2).sort((a, b) => b.w * b.h - a.w * a.h)[0]
}

/** Head roll (radians) from the eyes, and where to cut the work image out of the original. */
export function levelPlan(face, width, height) {
  const [eL, eR] = face.kps
  const angle = Math.atan2(eR[1] - eL[1], eR[0] - eL[0])
  const d = Math.hypot(eR[0] - eL[0], eR[1] - eL[1])
  const cx = (eL[0] + eR[0]) / 2
  const cy = (eL[1] + eR[1]) / 2
  // around the head: room for hair above and shoulders below (in eye distances)
  const box = { left: cx - 7 * d, top: cy - 5.2 * d, right: cx + 7 * d, bottom: cy + 10 * d }
  return { angle: Math.abs(angle) < 0.5 ? angle : 0, cx, cy, d, box, width, height }
}

/** A point of the original image → the work image (rotated by −angle around the eyes, then cut). */
export function toWork(plan, origin, [x, y]) {
  const c = Math.cos(-plan.angle)
  const s = Math.sin(-plan.angle)
  const dx = x - plan.cx
  const dy = y - plan.cy
  return [plan.cx + dx * c - dy * s - origin.x, plan.cy + dx * s + dy * c - origin.y]
}

/* ───────── portrait matting (MODNet, Apache-2.0) ───────── */

/** Model input size for a w×h image: short side ~512, both multiples of 32. */
export function matteSize(w, h) {
  const k = Math.min(MATTE_MODEL.short / Math.min(w, h), MATTE_MODEL.max / Math.max(w, h))
  const r32 = (v) => Math.max(32, Math.round((v * k) / 32) * 32)
  return [r32(w), r32(h)]
}

/** RGBA → MODNet's input: RGB planes, (v/255 − 0.5) / 0.5. */
export function modnetInput(rgba, w, h) {
  const plane = w * h
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) out[c * plane + i] = rgba[i * 4 + c] / 127.5 - 1
  return out
}

/** Bilinear resize of a float plane (0…1) to 8-bit. */
export function resizePlane(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    const fy = clamp(((y + 0.5) * sh) / dh - 0.5, 0, sh - 1)
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < dw; x++) {
      const fx = clamp(((x + 0.5) * sw) / dw - 0.5, 0, sw - 1)
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const v = lerp(lerp(src[y0 * sw + x0], src[y0 * sw + x1], tx), lerp(src[y1 * sw + x0], src[y1 * sw + x1], tx), ty)
      out[y * dw + x] = clamp(Math.round(v * 255), 0, 255)
    }
  }
  return out
}

/** Keep only the person under the face: drop matte islands not connected to it (in place). */
export function keepConnected(alpha, w, h, seedX, seedY) {
  const seen = new Uint8Array(w * h)
  const stack = []
  const sx = clamp(Math.round(seedX), 0, w - 1)
  const sy = clamp(Math.round(seedY), 0, h - 1)
  if (alpha[sy * w + sx] < 64) return alpha
  stack.push(sy * w + sx)
  seen[sy * w + sx] = 1
  while (stack.length) {
    const i = stack.pop()
    const x = i % w
    const y = (i - x) / w
    if (x > 0 && !seen[i - 1] && alpha[i - 1] >= 24) (seen[i - 1] = 1), stack.push(i - 1)
    if (x < w - 1 && !seen[i + 1] && alpha[i + 1] >= 24) (seen[i + 1] = 1), stack.push(i + 1)
    if (y > 0 && !seen[i - w] && alpha[i - w] >= 24) (seen[i - w] = 1), stack.push(i - w)
    if (y < h - 1 && !seen[i + w] && alpha[i + w] >= 24) (seen[i + w] = 1), stack.push(i + w)
  }
  for (let i = 0; i < alpha.length; i++) if (!seen[i]) alpha[i] = 0
  return alpha
}

/** Box blur of a float plane, radius r, three passes ≈ gaussian (separable, O(n)). */
export function blurPlane(src, w, h, r, passes = 3) {
  if (r < 1) return Float32Array.from(src)
  let a = Float32Array.from(src)
  let b = new Float32Array(a.length)
  const R = Math.round(r)
  const norm = 1 / (2 * R + 1)
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      let acc = 0
      for (let x = -R; x <= R; x++) acc += a[row + clamp(x, 0, w - 1)]
      for (let x = 0; x < w; x++) {
        b[row + x] = acc * norm
        acc += a[row + Math.min(w - 1, x + R + 1)] - a[row + Math.max(0, x - R)]
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let y = -R; y <= R; y++) acc += b[clamp(y, 0, h - 1) * w + x]
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc * norm
        acc += b[Math.min(h - 1, y + R + 1) * w + x] - b[Math.max(0, y - R) * w + x]
      }
    }
  }
  return a
}

/**
 * Remove the old background's colour from the soft edge (hair): estimate the background behind
 * each edge pixel from nearby background pixels, then solve I = αF + (1−α)B for F. In place.
 */
export function decontaminate(img, alpha) {
  const { data, width: w, height: h } = img
  const n = w * h
  const r = Math.max(4, Math.round(Math.max(w, h) / 60))
  const inv = new Float32Array(n)
  for (let i = 0; i < n; i++) inv[i] = alpha[i] < 250 ? 1 - alpha[i] / 255 : 0
  const wsum = blurPlane(inv, w, h, r, 2)
  const bg = [0, 1, 2].map((c) => {
    const p = new Float32Array(n)
    for (let i = 0; i < n; i++) p[i] = data[i * 4 + c] * inv[i]
    return blurPlane(p, w, h, r, 2)
  })
  // the foreground's own colour near the edge, from solid neighbours
  const solid = new Float32Array(n)
  for (let i = 0; i < n; i++) solid[i] = alpha[i] > 235 ? 1 : 0
  const fsum = blurPlane(solid, w, h, r, 2)
  const fg = [0, 1, 2].map((c) => {
    const p = new Float32Array(n)
    for (let i = 0; i < n; i++) p[i] = data[i * 4 + c] * solid[i]
    return blurPlane(p, w, h, r, 2)
  })
  for (let i = 0; i < n; i++) {
    const a = alpha[i] / 255
    if (a <= 0.02 || a >= 0.98 || wsum[i] < 1e-3) continue
    for (let c = 0; c < 3; c++) {
      const B = bg[c][i] / wsum[i]
      let F = (data[i * 4 + c] - (1 - a) * B) / Math.max(a, 0.15)
      // thin, nearly transparent strands: lean on the nearby solid colour
      if (fsum[i] > 1e-3) F = lerp(fg[c][i] / fsum[i], F, clamp(a * 1.6, 0, 1))
      data[i * 4 + c] = clamp(Math.round(F), 0, 255)
    }
  }
  return img
}

/* ───────── body geometry ───────── */

/** Horizontal run of opaque matte through x0 on row y: [left, right] or null. */
function runAt(alpha, w, y, x0, min = 128) {
  const row = y * w
  let x = Math.round(x0)
  if (x < 0 || x >= w || alpha[row + x] < min) {
    // the neck may sit a little to the side of the chin: look nearby
    let found = -1
    for (let dx = 1; dx < w / 8 && found < 0; dx++) {
      if (x - dx >= 0 && alpha[row + x - dx] >= min) found = x - dx
      else if (x + dx < w && alpha[row + x + dx] >= min) found = x + dx
    }
    if (found < 0) return null
    x = found
  }
  let l = x
  let r = x
  while (l > 0 && alpha[row + l - 1] >= min) l--
  while (r < w - 1 && alpha[row + r + 1] >= min) r++
  return [l, r]
}

/** Mean colour over the matte inside a rectangle (work pixels). */
function meanColor(img, alpha, x0, y0, x1, y1) {
  const { data, width: w, height: h } = img
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(h, Math.round(y1)); y++) {
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(w, Math.round(x1)); x++) {
      const i = y * w + x
      if (alpha[i] < 200) continue
      r += data[i * 4]
      g += data[i * 4 + 1]
      b += data[i * 4 + 2]
      n++
    }
  }
  return n ? [r / n, g / n, b / n] : null
}

const colorDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** RGB → [Y, Cb, Cr] */
const ycc = ([r, g, b]) => [0.299 * r + 0.587 * g + 0.114 * b, 128 - 0.169 * r - 0.331 * g + 0.5 * b, 128 + 0.5 * r - 0.419 * g - 0.081 * b]

/**
 * Where the head, neck and shoulders are in the work image.
 * `kps` are the landmarks in work pixels; `alpha` is the matte.
 */
export function bodyGeometry(img, alpha, kps, faceBox) {
  const { width: w, height: h } = img
  const [eL, eR, nose, mL, mR] = kps
  const d = Math.hypot(eR[0] - eL[0], eR[1] - eL[1])
  const eye = [(eL[0] + eR[0]) / 2, (eL[1] + eR[1]) / 2]
  const mouth = [(mL[0] + mR[0]) / 2, (mL[1] + mR[1]) / 2]
  const down = clamp(mouth[1] - eye[1], 0.55 * d, 1.25 * d)
  const box = faceBox.y + faceBox.h
  const chinY = clamp(Math.max(box, mouth[1] + 0.72 * d), mouth[1] + 0.6 * d, mouth[1] + 1.05 * d)
  const chinX = mouth[0] + (mouth[0] - eye[0]) * 0.55
  const skin = meanColor(img, alpha, eye[0] - 0.55 * d, eye[1] + 0.35 * d, eye[0] + 0.55 * d, eye[1] + 0.7 * d) ?? [200, 160, 140]
  const neckRef = meanColor(img, alpha, chinX - 0.35 * d, chinY + 0.15 * d, chinX + 0.35 * d, chinY + 0.45 * d) ?? skin

  // skin, judged by chroma (Cb, Cr) against the face's own: shading changes brightness, not
  // chroma, so a neck in the chin's shadow is still skin while a grey or black T-shirt is not
  const [sY, sCb, sCr] = ycc(skin)
  const isSkin = (i) => {
    if (alpha[i] < 128) return false
    const [Y, cb, cr] = ycc([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]])
    return Y > sY * 0.28 && Math.hypot(cb - sCb, cr - sCr) < 13 + Math.max(0, 40 - Y) * 0.25
  }

  // neck: the run of skin across each row under the chin; its median width, if it looks like a neck
  const widths = []
  const centers = []
  for (let y = Math.round(chinY + 0.2 * d); y < Math.min(h, chinY + 0.75 * d); y += 2) {
    const x = Math.round(chinX)
    if (x < 0 || x >= w || !isSkin(y * w + x)) continue
    let l = x
    let r = x
    let miss = 0
    while (l > 0 && miss < 3) (l--, (miss = isSkin(y * w + l) ? 0 : miss + 1))
    miss = 0
    while (r < w - 1 && miss < 3) (r++, (miss = isSkin(y * w + r) ? 0 : miss + 1))
    widths.push(r - l - 4)
    centers.push((l + r) / 2)
  }
  const median = (a) => [...a].sort((p, q) => p - q)[a.length >> 1]
  const measured = widths.length >= 3 ? median(widths) / d : null
  const good = measured !== null && measured > 1.15 && measured < 2.1
  const nw = (good ? clamp(measured, 1.3, 1.95) : 1.58) / 2
  const cx = good ? clamp(median(centers), chinX - 0.35 * d, chinX + 0.35 * d) : chinX

  // shoulders: the silhouette's width a little lower down (a raised arm makes it too wide: clamped)
  let S = 3.0
  const sy = Math.round(chinY + 2.1 * d)
  if (sy < h) {
    const run = runAt(alpha, w, sy, cx)
    if (run) {
      const left = run[0] <= 1 ? Infinity : cx - run[0]
      const right = run[1] >= w - 2 ? Infinity : run[1] - cx
      const half = Math.min(left, right)
      if (Number.isFinite(half)) S = clamp(half / d, 2.55, 3.45)
    }
  }

  // crown: the highest matte pixel over the head (hair included)
  let crownY = null
  const x0 = Math.max(0, Math.round(eye[0] - 1.3 * d))
  const x1 = Math.min(w, Math.round(eye[0] + 1.3 * d))
  for (let y = Math.max(0, Math.round(eye[1] - 3.6 * d)); y < eye[1] - 1.2 * d && crownY === null; y++) {
    let n = 0
    for (let x = x0; x < x1; x++) if (alpha[y * w + x] > 140) n++
    if (n > 0.12 * d) crownY = y
  }
  if (crownY === null) crownY = eye[1] - 2.3 * d
  crownY = clamp(crownY, eye[1] - 3.4 * d, eye[1] - 1.5 * d)
  // the picture starts right at the head: there is more of it above
  const cutTop = crownY <= 1

  // where the bare neck ends (a T-shirt's neckline, a hood's edges), column by column across it
  const profile = []
  for (let k = -8; k <= 8; k++) {
    const x = Math.round(cx + (k / 8) * (nw + 0.1) * d)
    let endBy = 1.6
    let run = 0
    let seen = 0
    const start = Math.round(chinY + 0.05 * d)
    for (let y = start; y < Math.min(h, chinY + 1.6 * d); y++) {
      let n = 0
      for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && xx < w && isSkin(y * w + xx)) n++
      // a beard under the chin isn't skin either: the neck's end is only looked for below some skin
      if (n >= 2) seen++
      if (seen < Math.max(2, 0.08 * d)) {
        if (y - start > 0.6 * d) {
          endBy = 0.05
          break
        }
        continue
      }
      run = n < 2 ? run + 1 : 0
      if (run >= Math.max(2, Math.round(0.05 * d))) {
        endBy = (y - run + 1 - chinY) / d
        break
      }
    }
    // the picture ends first: the neck goes on below it
    profile.push(endBy)
  }
  // an edge of clothing is cut a little generously: each column takes its neighbours' minimum
  const ends = profile.map((v, i) => Math.min(v, profile[i - 1] ?? v, profile[i + 1] ?? v))
  const neckEnd = clamp(median(ends.slice(5, 12)), 0.05, 1.6)
  // the neck's colour just above where it ends (skin pixels only)
  let acc = [0, 0, 0]
  let cnt = 0
  for (let y = Math.max(0, Math.round(chinY + (neckEnd - 0.35) * d)); y < Math.min(h, chinY + (neckEnd - 0.03) * d); y++) {
    for (let x = Math.round(cx - nw * d * 0.6); x < cx + nw * d * 0.6; x++) {
      const i = y * w + x
      if (x < 0 || x >= w || !isSkin(i)) continue
      acc = acc.map((v, c) => v + img.data[i * 4 + c])
      cnt++
    }
  }
  // no bare neck to sample: the face's skin a little deeper (a neck is usually in shade)
  const neckLow = cnt > 10 ? acc.map((v) => v / cnt) : skin.map((v) => v * 0.88)
  // the picture ends before the neck does
  const bottomGap = (h - 1 - chinY) / d

  // hair colour: the top of the head
  const hair = meanColor(img, alpha, eye[0] - 0.8 * d, crownY + 0.1 * d, eye[0] + 0.8 * d, crownY + 0.45 * d)

  return {
    d,
    eye,
    mouth,
    nose,
    chin: [cx, chinY],
    crownY,
    cutTop,
    nw,
    S,
    yaw: clamp((nose[0] - eye[0]) / d, -0.6, 0.6),
    down: down / d,
    skin,
    neckSkin: neckLow,
    hair,
    neckEnd,
    neckEnds: ends.map((v) => Math.round(clamp(v, 0.05, 1.6) * 100) / 100),
    bottomGap,
  }
}

/**
 * Long hair falling in front of the shoulders: a soft mask (work pixels). Hair only counts when it
 * runs down unbroken from beside the eyes — a dark T-shirt next to the neck never does.
 */
export function hairMask(img, alpha, g) {
  const { data, width: w, height: h } = img
  const mask = new Uint8Array(w * h)
  if (!g.hair) return { mask, amount: 0 }
  const { d } = g
  const [cx, chinY] = g.chin
  const ex = g.eye[0]
  const top = Math.max(0, Math.round(g.eye[1]))
  const bottom = Math.min(h, Math.round(chinY + 6 * d))
  const hl = g.hair[0] * 0.3 + g.hair[1] * 0.59 + g.hair[2] * 0.11
  const like = (i) => {
    const r = data[i * 4]
    const gg = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const l = r * 0.3 + gg * 0.59 + b * 0.11
    return Math.hypot(r - g.hair[0], gg - g.hair[1], b - g.hair[2]) < 46 && Math.abs(l - hl) < 38
  }
  // the band where long hair hangs: beside the face above the chin, beside the neck below it
  const band = (x, y) => {
    if (y < chinY) {
      const off = Math.abs(x - ex) / d
      return off > 1.3 && off < 2.7
    }
    const off = Math.abs(x - cx) / d
    return off > g.nw + 0.05 && off < g.S - 0.15
  }
  let prev = new Uint8Array(w)
  let below = 0
  for (let y = top; y < bottom; y++) {
    const cur = new Uint8Array(w)
    let n = 0
    for (let x = 1; x < w - 1; x++) {
      if (!band(x, y)) continue
      const i = y * w + x
      if (alpha[i] < 100 || !like(i)) continue
      // seeds in the first rows beside the eyes; after that it has to touch hair just above
      if ((y - top < 0.15 * d) || prev[x] || prev[x - 1] || prev[x + 1]) {
        cur[x] = 1
        n++
      }
    }
    // a row with only a few stray pixels ends it
    if (n < Math.max(2, 0.04 * d) && y > top + 0.15 * d) break
    for (let x = 0; x < w; x++) if (cur[x]) mask[y * w + x] = 255
    if (y > chinY + 0.4 * d) below += n
    prev = cur
  }
  const soft = blurPlane(Float32Array.from(mask, (v) => v / 255), w, h, Math.max(1, d * 0.04), 2)
  for (let i = 0; i < mask.length; i++) mask[i] = Math.min(alpha[i], clamp(Math.round(soft[i] * 300), 0, 255))
  return { mask, amount: below / (d * d) }
}

/* ───────── framing ───────── */

/**
 * Picture formats: aspect, how much of the height the head (crown → chin) takes, the margin above
 * the crown, and the output size. Print formats are at 600 dpi.
 */
export const FORMATS = {
  portrait: { aspect: 3 / 4, head: 0.4, top: 0.11, out: [1200, 1600] },
  square: { aspect: 1, head: 0.47, top: 0.12, out: [1200, 1200] },
  social: { aspect: 4 / 5, head: 0.39, top: 0.11, out: [1080, 1350] },
  doc3x4: { aspect: 3 / 4, head: 0.6, top: 0.08, out: [709, 945], mm: [30, 40], print: true },
  doc35x45: { aspect: 35 / 45, head: 0.74, top: 0.07, out: [827, 1063], mm: [35, 45], print: true },
}

/** The crop (work pixels) for a format, with the user's zoom (1 = auto) and offset (in eye distances). */
export function framing(g, fmt, zoom = 1, dx = 0, dy = 0) {
  const f = FORMATS[fmt] ?? FORMATS.portrait
  const head = g.chin[1] - g.crownY
  const H = head / f.head / zoom
  const W = H * f.aspect
  const cx = lerp(g.eye[0], g.chin[0], 0.5) - dx * g.d
  const top = g.crownY - f.top * H - dy * g.d
  return { left: cx - W / 2, top, width: W, height: H }
}

/* ───────── retouch ───────── */

const toLin = new Float32Array(256).map((_, i) => i / 255)

/**
 * Colour and light: gentle white balance from the face (skin keeps its own tone, only the cast
 * goes), exposure towards a well-lit face, warmth and brightness from the sliders. Returns a
 * per-channel 256-entry lookup table.
 */
export function toneCurves(g, { auto = true, brightness = 0, warmth = 0, contrast = 0 }) {
  const curves = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)]
  let gain = [1, 1, 1]
  let gamma = 1
  if (auto) {
    const [r, gg, b] = g.skin
    const l = (r + gg + b) / 3
    // a typical lit skin tone has r > g > b; pull a green/blue/magenta cast part of the way back
    const target = [l * 1.16, l * 0.98, l * 0.86]
    gain = [0, 1, 2].map((c) => clamp(lerp(1, target[c] / Math.max(1, g.skin[c]), 0.45), 0.85, 1.18))
    const ln = 0.3 * r * gain[0] + 0.59 * gg * gain[1] + 0.11 * b * gain[2]
    // face luminance → about 0.6
    gamma = clamp(Math.log(0.6) / Math.log(clamp(ln / 255, 0.05, 0.95)), 0.7, 1.45)
  }
  const warm = warmth / 100
  const bright = brightness / 100
  const con = contrast / 100
  for (let i = 0; i < 256; i++) {
    for (let c = 0; c < 3; c++) {
      let v = clamp(toLin[i] * gain[c], 0, 1)
      v = Math.pow(v, 1 / gamma)
      v = clamp(v + bright * 0.18 * (1 - v) * (bright > 0 ? 1 : v * 2), 0, 1)
      if (c === 0) v *= 1 + warm * 0.06
      if (c === 2) v *= 1 - warm * 0.07
      // gentle S-curve for contrast around the middle
      v = clamp(v + con * 0.25 * (v - 0.5) * (1 - Math.abs(2 * v - 1)), 0, 1)
      curves[c][i] = clamp(Math.round(v * 255), 0, 255)
    }
  }
  return curves
}

/** Which pixels are skin (0…1), from the face's own colour. */
export function skinMask(img, alpha, g) {
  const { data, width: w, height: h } = img
  const out = new Float32Array(w * h)
  const ref = g.skin
  const toYcc = (r, gg, b) => [0.299 * r + 0.587 * gg + 0.114 * b, 128 - 0.169 * r - 0.331 * gg + 0.5 * b, 128 + 0.5 * r - 0.419 * gg - 0.081 * b]
  const [, cb0, cr0] = toYcc(...ref)
  const { d } = g
  const [ex, ey] = g.eye
  for (let y = 0; y < h; y++) {
    // the face and neck only
    if (y < ey - 1.9 * d || y > g.chin[1] + 1.6 * d) continue
    for (let x = Math.max(0, Math.round(ex - 1.8 * d)); x < Math.min(w, Math.round(ex + 1.8 * d)); x++) {
      const i = y * w + x
      if (alpha[i] < 128) continue
      const [Y, cb, cr] = toYcc(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
      const dist = Math.hypot(cb - cb0, cr - cr0)
      if (Y < 35) continue
      out[i] = clamp(1.4 - dist / 14, 0, 1)
    }
  }
  return blurPlane(out, w, h, Math.max(1, d * 0.05), 2)
}

/**
 * Skin smoothing that keeps pores and edges: a blurred copy replaces the original only where the
 * difference is small (blemishes, uneven tone), and only on skin. `amount` 0…1. In place.
 */
export function smoothSkin(img, skin, g, amount) {
  // a small face has little detail to spare: smooth it less
  amount *= clamp(g.d / 160, 0.3, 1)
  if (amount <= 0) return img
  const { data, width: w, height: h } = img
  const r = Math.max(2, g.d * 0.09)
  const planes = [0, 1, 2].map((c) => {
    const p = new Float32Array(w * h)
    for (let i = 0; i < p.length; i++) p[i] = data[i * 4 + c]
    return blurPlane(p, w, h, r, 2)
  })
  const fine = [0, 1, 2].map((c) => {
    const p = new Float32Array(w * h)
    for (let i = 0; i < p.length; i++) p[i] = data[i * 4 + c]
    return blurPlane(p, w, h, Math.max(1, r * 0.18), 1)
  })
  for (let i = 0; i < w * h; i++) {
    const s = skin[i]
    if (s < 0.02) continue
    for (let c = 0; c < 3; c++) {
      const v = data[i * 4 + c]
      const diff = Math.abs(v - planes[c][i])
      // edges (eyes, lips, beard lines) have big differences: leave them
      const keep = clamp((diff - 10) / 22, 0, 1)
      const k = s * amount * (1 - keep) * 0.85
      // a whisper of fine texture stays so skin doesn't look plastic
      const smooth = planes[c][i] + (fine[c][i] - planes[c][i]) * 0.35
      data[i * 4 + c] = clamp(Math.round(lerp(v, smooth, k)), 0, 255)
    }
  }
  return img
}

/** Unsharp mask (luma-safe, per channel), `amount` 0…1. In place. */
export function sharpen(img, amount, radius = 1.2) {
  if (amount <= 0) return img
  const { data, width: w, height: h } = img
  for (let c = 0; c < 3; c++) {
    const p = new Float32Array(w * h)
    for (let i = 0; i < p.length; i++) p[i] = data[i * 4 + c]
    const b = blurPlane(p, w, h, radius, 1)
    for (let i = 0; i < p.length; i++) {
      const d = p[i] - b[i]
      if (Math.abs(d) < 2) continue
      data[i * 4 + c] = clamp(Math.round(p[i] + d * amount * 1.2), 0, 255)
    }
  }
  return img
}

/** Apply per-channel curves. In place. */
export function applyCurves(img, curves) {
  const { data } = img
  for (let i = 0; i < data.length; i += 4) {
    data[i] = curves[0][data[i]]
    data[i + 1] = curves[1][data[i + 1]]
    data[i + 2] = curves[2][data[i + 2]]
  }
  return img
}

export const hex = (rgb) => '#' + Array.from(rgb, (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')

/**
 * Which part of the photo stays when new clothes go on (0…1 per work pixel): the head, and the
 * neck down to the collar. `clip` comes from outfits.personClip(); null keeps everything.
 */
/** Where the bare neck ends at a horizontal offset (body units) from the neck's centre. */
export function neckEndAt(g, bx) {
  const ends = g.neckEnds
  if (!ends?.length) return g.neckEnd
  const n = ends.length - 1
  const t = clamp((bx / (g.nw + 0.1) + 1) / 2, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(t))
  return lerp(ends[i], ends[i + 1], t - i)
}

export function clipPlane(img, g, clip) {
  const { data, width: w, height: h } = img
  const out = new Float32Array(w * h)
  if (!clip) return out.fill(1)
  const { d } = g
  const [cx, cy] = g.chin
  const ex = g.eye[0]
  const eyeBy = (g.eye[1] - cy) / d
  const mouthBy = (g.mouth[1] - cy) / d
  // how far the head reaches each side, row by row: hair and ears above the eyes, cheeks, then
  // the jaw narrowing into the neck; the centre moves from the eyes' to the neck's on the way
  const neckHalf = clip.neck
  const row = (by) => {
    if (by < eyeBy) return [ex, 2.1]
    if (by < mouthBy) return [ex, lerp(1.8, 1.55, (by - eyeBy) / (mouthBy - eyeBy))]
    if (by < 0) {
      const k = (by - mouthBy) / -mouthBy
      return [lerp(ex, cx, k), lerp(1.55, neckHalf, k)]
    }
    return [cx, neckHalf]
  }
  for (let y = 0; y < h; y++) {
    const by = (y - cy) / d
    const [mid, reach] = row(by)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const off = Math.abs(x - mid) / d
      let keep
      if (by < 0) {
        keep = off < reach
        // beside the jaw a hood or collar often touches the face: keep only warm, skin-like pixels
        if (keep && by > mouthBy - 0.2 && off > 0.75) {
          const r = data[i * 4]
          const gg = data[i * 4 + 1]
          const b = data[i * 4 + 2]
          keep = colorDist([r, gg, b], g.skin) < 70 || (r - b > 18 && r >= gg)
        }
      } else {
        // under the chin: the neck, down to where the bare neck (or the collar) ends; the chin's
        // own rounded bottom (a beard) is kept too
        const u = off / reach
        keep = off < reach && (by < Math.min(clip.neckBottom, neckEndAt(g, (x - cx) / d)) || by < 0.16 * (1 - u * u))
      }
      out[i] = keep ? 1 : 0
    }
  }
  return blurPlane(out, w, h, Math.max(1, d * 0.045), 2)
}
