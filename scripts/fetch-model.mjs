// The AI models the browser runs, served as static files from public/models:
//   u2netp.onnx  background removal (U²-Netp, Apache-2.0, from the rembg project)
//   modnet.onnx  portrait matting for the portrait studio (MODNet fp16, Apache-2.0, Xenova/modnet)
//   yunet.onnx   face + landmark detection for the portrait studio (YuNet 2023mar, MIT, OpenCV Zoo)
// Downloaded once at install (pinned revisions); the checksum is verified either way. Never fails
// the install: without u2netp background removal runs on the server, without the portrait models
// the portrait studio says it can't start.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const MODELS = [
  {
    out: 'public/models/u2netp.onnx',
    local: 'server/models/u2netp.onnx',
    sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
  },
  {
    out: 'public/models/modnet.onnx',
    sha256: '25f165da9bfd30830a575f1f0490f1acd995975cb349bc02f3d79332e1fe5cf6',
    url: 'https://huggingface.co/Xenova/modnet/resolve/fa2fa546052fba4c08921230a26cc69a333fca12/onnx/model_fp16.onnx',
  },
  {
    out: 'public/models/yunet.onnx',
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
    url: 'https://github.com/opencv/opencv_zoo/raw/f12e12798e8314f7c074a6656816c048dcc95b7a/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
  },
]

const ok = (buf, sha) => createHash('sha256').update(buf).digest('hex') === sha

for (const m of MODELS) {
  try {
    if (existsSync(m.out) && ok(readFileSync(m.out), m.sha256)) continue
    let buf = m.local && existsSync(m.local) ? readFileSync(m.local) : null
    if (!buf || !ok(buf, m.sha256)) {
      const res = await fetch(m.url, { redirect: 'follow', signal: AbortSignal.timeout(300_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      buf = Buffer.from(await res.arrayBuffer())
    }
    if (!ok(buf, m.sha256)) throw new Error('checksum mismatch')
    mkdirSync('public/models', { recursive: true })
    writeFileSync(m.out, buf)
    console.log(`${m.out.split('/').pop()} → public/models`)
  } catch (err) {
    console.warn(`fetch-model: ${m.out.split('/').pop()}: ${err.message}`)
  }
}
