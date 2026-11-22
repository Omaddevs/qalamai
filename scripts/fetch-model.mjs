// The background-removal model the browser runs (U²-Netp, Apache-2.0, from the rembg project),
// served as a static file: public/models/u2netp.onnx. Uses the server's copy when there is one,
// otherwise downloads it once; the checksum is verified either way. Never fails the install:
// without the file the tool simply runs on the server.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const OUT = 'public/models/u2netp.onnx'
const SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'
const URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'
const ok = (buf) => createHash('sha256').update(buf).digest('hex') === SHA256

try {
  if (existsSync(OUT) && ok(readFileSync(OUT))) process.exit(0)
  let buf = existsSync('server/models/u2netp.onnx') ? readFileSync('server/models/u2netp.onnx') : null
  if (!buf || !ok(buf)) {
    const res = await fetch(URL, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    buf = Buffer.from(await res.arrayBuffer())
  }
  if (!ok(buf)) throw new Error('checksum mismatch')
  mkdirSync('public/models', { recursive: true })
  writeFileSync(OUT, buf)
  console.log('background-removal model → public/models')
} catch (err) {
  console.warn(`fetch-model: ${err.message} — background removal will run on the server`)
}
