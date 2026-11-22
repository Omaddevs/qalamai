// Small helpers for the portable tool core. No Node APIs here: this code also runs in the
// browser (src/tools/worker.js), where files are processed on the user's own device.
import { zipSync } from 'fflate'
import { baseName } from '../../lib/filetypes.js'

export const renameExt = (name, ext, suffix = '') => `${baseName(name)}${suffix}.${ext}`

export const pad = (n, width) => String(n).padStart(width, '0')

export function hexToRgb01(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

/** Zip several named byte arrays (stored, not deflated, for already-compressed formats). */
export function zip(entries, { compress = false } = {}) {
  const used = new Set()
  const files = {}
  for (const { name, data } of entries) {
    let n = name
    for (let i = 2; used.has(n); i++) n = name.replace(/(\.[^.]+)?$/, `-${i}$1`)
    used.add(n)
    files[n] = [data instanceof Uint8Array ? data : new Uint8Array(data), { level: compress ? 6 : 0 }]
  }
  return zipSync(files)
}

/** base64 → bytes (a fresh, zero-offset array: pdf-lib's JPEG reader needs that). */
export function fromBase64(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'))
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
