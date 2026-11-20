import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { baseName } from '../../lib/filetypes.js'

/** Write a buffer into the job's out dir and describe it as a tool output. */
export async function emit(outDir, name, data) {
  const safe = name.replace(/[\\/]/g, '_')
  const path = join(outDir, `${String(Math.random()).slice(2, 8)}-${safe}`)
  await writeFile(path, data)
  return { path, name: safe }
}

export const renameExt = (name, ext, suffix = '') => `${baseName(name)}${suffix}.${ext}`

/** Zip several named buffers (stored, not deflated, for already-compressed formats). */
export function zip(entries, { compress = false } = {}) {
  const used = new Set()
  const files = {}
  for (const { name, data } of entries) {
    let n = name
    for (let i = 2; used.has(n); i++) n = name.replace(/(\.[^.]+)?$/, `-${i}$1`)
    used.add(n)
    files[n] = [data instanceof Uint8Array ? data : new Uint8Array(data), { level: compress ? 6 : 0 }]
  }
  return Buffer.from(zipSync(files))
}

export function hexToRgb01(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export const pad = (n, width) => String(n).padStart(width, '0')

export const formatBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
