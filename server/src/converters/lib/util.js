import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { zip as coreZip } from '../core/util.js'

export { renameExt, hexToRgb01, pad } from '../core/util.js'

/** Write a buffer into the job's out dir and describe it as a tool output. */
export async function emit(outDir, name, data) {
  const safe = name.replace(/[\\/]/g, '_')
  const path = join(outDir, `${String(Math.random()).slice(2, 8)}-${safe}`)
  await writeFile(path, data)
  return { path, name: safe }
}

/** Zip several named buffers (stored, not deflated, for already-compressed formats). */
export const zip = (entries, opts) => Buffer.from(coreZip(entries, opts))

export const formatBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
