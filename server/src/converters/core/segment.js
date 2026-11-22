// Background removal maths shared by the server (onnxruntime-node + sharp) and the browser
// (onnxruntime-web + OffscreenCanvas): model specs, input normalisation, the raw prediction →
// 8-bit mask step and the subject's bounding box.

export const MODELS = {
  u2netp: { file: 'u2netp.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], mb: 4.6 },
  silueta: { file: 'silueta.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], mb: 43 },
  u2net: { file: 'u2net.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], mb: 176 },
  'isnet-general-use': { file: 'isnet-general-use.onnx', size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1], mb: 178 },
}

/**
 * S×S pixels (`stride` 3 = RGB, 4 = RGBA) → the model's planar float input.
 * @returns {Float32Array} length 3·S·S
 */
export function modelInput(pixels, S, spec, stride = 3) {
  const plane = S * S
  let max = 1e-6
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) if (pixels[i * stride + c] > max) max = pixels[i * stride + c]
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = (pixels[i * stride + c] / max - spec.mean[c]) / spec.std[c]
  }
  return input
}

/** The model's first output plane → 0…255 (min–max stretched). */
export function predictionToMask(pred, plane) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < plane; i++) {
    if (pred[i] < lo) lo = pred[i]
    if (pred[i] > hi) hi = pred[i]
  }
  const range = hi - lo || 1
  const small = new Uint8Array(plane)
  for (let i = 0; i < plane; i++) small[i] = Math.round(((pred[i] - lo) / range) * 255)
  return small
}

/** Tighten the soft edge band of a full-size mask a little, to avoid halos (in place). */
export function tightenMask(mask) {
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
