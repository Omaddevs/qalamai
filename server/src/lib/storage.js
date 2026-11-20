// Local-disk object storage. Keys look like "usr_x/fil_y.pdf".
// The interface (put / stream / path / remove) is what an S3 driver would implement;
// tools run on local paths, so a remote driver would download into the job's work dir.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { tooLarge } from './errors.js'

export function createStorage(root) {
  const base = resolve(root)

  const pathOf = (key) => {
    const p = resolve(base, key)
    if (!p.startsWith(base + sep)) throw new Error(`storage key escapes root: ${key}`)
    return p
  }

  return {
    root: base,
    pathOf,
    tmpDir: join(base, '.tmp'),

    async init() {
      await mkdir(join(base, '.tmp'), { recursive: true })
    },

    /** Stream into storage, enforcing a byte limit. Returns { size, sha256, head } (head = first 8 KB). */
    async putStream(key, readable, { maxBytes } = {}) {
      const dest = pathOf(key)
      await mkdir(dirname(dest), { recursive: true })
      const hash = createHash('sha256')
      let size = 0
      const headChunks = []
      let headLen = 0
      const meter = new Transform({
        transform(chunk, _enc, cb) {
          size += chunk.length
          if (maxBytes && size > maxBytes) return cb(tooLarge(`Fayl hajmi ${Math.round(maxBytes / 1048576)} MB dan oşmasligi kerak`))
          if (headLen < 8192) {
            headChunks.push(chunk)
            headLen += chunk.length
          }
          hash.update(chunk)
          cb(null, chunk)
        },
      })
      try {
        await pipeline(readable, meter, createWriteStream(dest, { flags: 'wx' }))
      } catch (err) {
        await rm(dest, { force: true })
        throw err
      }
      // multipart streams flag truncation instead of erroring
      if (readable.truncated) {
        await rm(dest, { force: true })
        throw tooLarge(`Fayl hajmi ${Math.round(maxBytes / 1048576)} MB dan oşmasligi kerak`)
      }
      return { size, sha256: hash.digest('hex'), head: Buffer.concat(headChunks).subarray(0, 8192) }
    },

    /** Move a file produced by a tool (inside the storage volume) under its final key. */
    async putFile(key, srcPath) {
      const dest = pathOf(key)
      await mkdir(dirname(dest), { recursive: true })
      try {
        await rename(srcPath, dest)
      } catch (err) {
        if (err.code !== 'EXDEV') throw err
        await copyFile(srcPath, dest)
        await rm(srcPath, { force: true })
      }
      return dest
    },

    stream: (key, opts) => createReadStream(pathOf(key), opts),

    async size(key) {
      return (await stat(pathOf(key))).size
    },

    async exists(key) {
      try {
        await stat(pathOf(key))
        return true
      } catch {
        return false
      }
    },

    async remove(key) {
      await rm(pathOf(key), { force: true })
      await rm(pathOf(`${key}.thumb.webp`), { force: true })
    },
  }
}
