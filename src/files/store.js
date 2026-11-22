// The file studio's files live on the user's device (IndexedDB), and tools run in the browser
// (src/tools/worker.js) — the server never receives them. The server is only asked to check the
// plan's limits (POST /tools/:id/local-runs). Tools the browser can't do yet (PDF → Word/Excel/
// PowerPoint, Word → PDF, PDF compression, background removal, …) still run on the server: their
// files are uploaded at that moment, exactly as before.
//
// A record looks the same wherever it lives, so the UI doesn't care:
//   { id, name, ext, mime, kind, size, meta, source, createdAt, url, downloadUrl, thumbUrl, local? }
// Local records add `blob` and use object URLs; server records come from the API as before.
import {
  ApiError, api, currentUser, deleteFile as deleteServerFile, errorText, listFiles as listServerFiles, onUser, runTool as runServerTool, uploadFiles,
} from '../api.js'
import { t } from '../i18n/index.js'
import { PDF_ASSETS, loadPdfjs } from './pdfjs.js'

/** Tools that run on the device (the rest go to the server). */
export const LOCAL_TOOLS = new Set([
  'pdf-merge', 'pdf-split', 'pdf-rotate', 'pdf-watermark', 'pdf-page-numbers', 'pdf-edit', 'images-to-pdf',
  'image-convert', 'image-compress', 'image-resize',
])

/** Images every current browser decodes (SVG, TIFF and HEIC go to the server). */
const DECODABLE = new Set(['jpg', 'png', 'webp', 'gif', 'bmp', 'avif'])
const ENCODABLE = new Set(['jpg', 'png', 'webp'])

const KEEP_DAYS = 30
const MAX_BYTES = 2 * 1024 ** 3 // oldest files make room beyond this

/* ───────── IndexedDB ───────── */

const DB = 'qalamai-files' // api.logout() deletes it by this name
const STORE = 'files'
let dbp = null

function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

async function tx(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tr = d.transaction(STORE, mode)
    const req = fn(tr.objectStore(STORE))
    tr.oncomplete = () => resolve(req?.result)
    tr.onerror = () => reject(tr.error)
    tr.onabort = () => reject(tr.error)
  })
}

const idbPut = (row) => tx('readwrite', (s) => s.put(row)).catch((err) => console.warn('files: could not keep on device', err))
const idbDelete = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {})
const idbAll = () => tx('readonly', (s) => s.getAll()).catch(() => [])

/* ───────── records ───────── */

const records = new Map() // id → record (local and server ones the UI has seen)
const urls = new Map() // id → object URL of a local blob
const thumbs = new Map() // id → Promise<object URL> of a local PDF's first page

const uid = () => `loc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
const owner = () => currentUser()?.id ?? 'anon'

function hydrate(row) {
  let url = urls.get(row.id)
  if (!url) {
    url = URL.createObjectURL(row.blob)
    urls.set(row.id, url)
  }
  const rec = {
    ...row,
    local: true,
    url,
    downloadUrl: url,
    thumbUrl: row.kind === 'image' ? url : null,
  }
  records.set(rec.id, rec)
  return rec
}

const toRow = (rec) => ({
  id: rec.id, userId: rec.userId, name: rec.name, ext: rec.ext, mime: rec.mime, kind: rec.kind, size: rec.size, meta: rec.meta,
  source: rec.source, parentId: rec.parentId ?? null, createdAt: rec.createdAt, blob: rec.blob,
})

const remember = (serverRecs) => {
  for (const r of serverRecs) records.set(r.id, r)
  return serverRecs
}

export const getRecord = (id) => records.get(id)

function forget(id) {
  records.delete(id)
  thumbs.delete(id)
  const url = urls.get(id)
  if (url) URL.revokeObjectURL(url)
  urls.delete(id)
}

// Files are kept per account (rows carry userId; another account never lists them). When the session
// ends, let go of what is in memory; a deliberate sign-out also deletes the database (api.logout).
onUser((u) => {
  if (u) return
  for (const [id, r] of records) if (r.local) forget(id)
  const open = dbp
  dbp = null
  open?.then((d) => d.close()).catch(() => {})
})

/* ───────── the tool worker ───────── */

// written out in full each time: that's the form Vite recognises and bundles
const spawn = () => new Worker(new URL('../tools/worker.js', import.meta.url), { type: 'module' })
let prober = null
let seq = 0

function call(worker, msg, { onProgress } = {}) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    const onMessage = ({ data }) => {
      if (data.id !== id) return
      if (data.type === 'progress') return onProgress?.(data.pct, data.stage)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (data.type === 'done') resolve(data.result)
      else reject(Object.assign(new Error(data.message), { code: data.code }))
    }
    const onError = (e) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(Object.assign(new Error(e.message || 'worker failed'), { code: 'WORKER_CRASHED' }))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ ...msg, id })
  })
}

const probe = (file) => {
  prober ??= spawn()
  return call(prober, { op: 'probe', file })
}

/* ───────── adding, listing, removing ───────── */

async function save(rec) {
  await idbPut(toRow(rec))
  prune()
  return rec
}

/** Keep files picked by the user on this device. Same contract as uploadFiles(): resolves to records. */
export async function addLocalFiles(list, onProgress) {
  const files = [...list]
  const out = []
  for (const [i, file] of files.entries()) {
    const type = await probe(file)
    if (!type) throw new ApiError(415, 'UNSUPPORTED_FILE', errorText('UNSUPPORTED_FILE', `«${file.name}» — bu fayl turi qöllab-quvvatlanmaydi`))
    const blob = file.type === type.mime ? file : new Blob([file], { type: type.mime })
    const rec = hydrate({
      id: uid(), userId: owner(), name: file.name || `fayl.${type.ext}`, ext: type.ext, mime: type.mime, kind: type.kind,
      size: file.size, meta: type.meta, source: 'upload', createdAt: new Date().toISOString(), blob,
    })
    out.push(await save(rec))
    onProgress?.((i + 1) / files.length)
  }
  return out
}

/** The user's files: those on this device first, then any the server still keeps. */
export async function listFiles() {
  const me = owner()
  const cutoff = Date.now() - KEEP_DAYS * 86400_000
  const rows = (await idbAll()).filter((r) => r.userId === me)
  for (const r of rows) if (Date.parse(r.createdAt) < cutoff) idbDelete(r.id)
  const local = rows.filter((r) => Date.parse(r.createdAt) >= cutoff).map((r) => records.get(r.id) ?? hydrate(r))
  local.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  let server = []
  try {
    server = remember(await listServerFiles({ limit: 120 }))
  } catch (err) {
    if (!local.length) throw err
  }
  return [...local, ...server]
}

export async function removeFile(rec) {
  if (rec.local) {
    forget(rec.id)
    await idbDelete(rec.id)
  } else {
    await deleteServerFile(rec.id)
    records.delete(rec.id)
  }
}

/** Drop the oldest files once the device copy grows past MAX_BYTES. */
async function prune() {
  const rows = (await idbAll()).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  let total = rows.reduce((n, r) => n + (r.size ?? 0), 0)
  for (const r of rows) {
    if (total <= MAX_BYTES) break
    total -= r.size ?? 0
    forget(r.id)
    idbDelete(r.id)
  }
}

/** First page of a local PDF as an image (thumbnails), rendered once per file. */
export function pdfThumb(rec) {
  if (!thumbs.has(rec.id)) {
    const p = (async () => {
      const lib = await loadPdfjs()
      const doc = await lib.getDocument({ data: new Uint8Array(await rec.blob.arrayBuffer()), ...PDF_ASSETS }).promise
      try {
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 360 / Math.max(base.width, base.height) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.8))
        return URL.createObjectURL(blob)
      } finally {
        doc.loadingTask.destroy()
      }
    })()
    p.catch(() => thumbs.delete(rec.id))
    thumbs.set(rec.id, p)
  }
  return thumbs.get(rec.id)
}

/* ───────── running tools ───────── */

/** Can these files, with these options, be handled by the browser? */
export function runsHere(toolId, files, options = {}) {
  if (!LOCAL_TOOLS.has(toolId) || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return false
  if (!files.every((f) => f.local)) return false
  const images = files.filter((f) => f.kind === 'image')
  if (!images.every((f) => DECODABLE.has(f.ext))) return false
  switch (toolId) {
    case 'image-convert':
      // animation would be lost (the server keeps GIF / WebP frames)
      return ENCODABLE.has(options.format ?? 'png') && !(options.format === 'webp' && images.some((f) => f.ext === 'gif' || f.ext === 'webp'))
    case 'image-compress':
      // PNG needs palette quantisation, which the server does
      return images.every((f) => f.ext === 'jpg' || f.ext === 'webp')
    case 'image-resize':
      return images.every((f) => ['jpg', 'png', 'webp', 'bmp'].includes(f.ext))
    default:
      return true
  }
}

const NO_ENCRYPTION_CHECK = new Set(['pdf-to-images', 'pdf-to-text'])

async function runHere(toolId, files, options, { onUpdate, signal }) {
  const locked = files.find((f) => f.kind === 'pdf' && f.meta?.encrypted)
  if (locked && !NO_ENCRYPTION_CHECK.has(toolId)) {
    throw new ApiError(422, 'PDF_ENCRYPTED', errorText('PDF_ENCRYPTED', `«${locked.name}» parol bilan himoyalangan. Avval himoyani olib taşlang.`))
  }
  onUpdate?.({ status: 'running', progress: 1, stage: t('tw.queued') })
  // the plan's limits, without sending the files; offline, the device just does the work
  try {
    await api.post(`/tools/${toolId}/local-runs`, { files: files.map((f) => ({ kind: f.kind, ext: f.ext, size: f.size, pages: f.meta?.pages ?? 0 })) })
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== 'OFFLINE') throw err
  }
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')

  const worker = spawn()
  const stop = () => worker.terminate()
  signal?.addEventListener('abort', stop, { once: true })
  try {
    const inputs = files.map((f) => ({ name: f.name, kind: f.kind, ext: f.ext, size: f.size, meta: f.meta, blob: f.blob }))
    const run = call(worker, { op: 'run', tool: toolId, inputs, options }, { onProgress: (progress, stage) => onUpdate?.({ status: 'running', progress, stage }) })
    const aborted = new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }))
    const result = await Promise.race([run, aborted])
    const outputs = []
    for (const o of result.outputs) {
      const blob = new Blob([o.data], { type: typeOf(o.name) })
      const type = await probe(new File([blob], o.name, { type: blob.type }))
      outputs.push(
        await save(
          hydrate({
            id: uid(), userId: owner(), name: o.name, ext: type?.ext ?? o.name.split('.').pop(), mime: type?.mime ?? blob.type, kind: type?.kind ?? 'archive',
            size: blob.size, meta: type?.meta ?? {}, source: 'tool', parentId: files[0].id, createdAt: new Date().toISOString(), blob,
          }),
        ),
      )
    }
    return { status: 'done', progress: 100, stage: t('tw.ready'), outputs, result: result.summary }
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'LOCAL_UNSUPPORTED') throw err
    throw new ApiError(422, err.code ?? 'TOOL_FAILED', errorText(err.code ?? 'TOOL_FAILED', err.message))
  } finally {
    signal?.removeEventListener('abort', stop)
    worker.terminate()
  }
}

const MIME = { pdf: 'application/pdf', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const typeOf = (name) => MIME[name.split('.').pop().toLowerCase()] ?? 'application/octet-stream'

/** Server copy of a local record — uploaded once, when a server tool needs it. */
const uploaded = new Map() // local id → Promise<server record>

async function onServer(files, onUpdate) {
  const pending = files.filter((f) => f.local && !uploaded.has(f.id))
  if (pending.length) {
    const up = uploadFiles(
      pending.map((f) => new File([f.blob], f.name, { type: f.mime })),
      (p) => onUpdate?.({ status: 'queued', progress: Math.round(p * 100), stage: t('fs.uploadingPct', { n: Math.round(p * 100) }) }),
    )
    pending.forEach((f, i) => {
      const one = up.then((list) => remember([list[i]])[0])
      one.catch(() => uploaded.delete(f.id))
      uploaded.set(f.id, one)
    })
  }
  return Promise.all(files.map((f) => (f.local ? uploaded.get(f.id) : f)))
}

/**
 * Run a tool on files (records or their ids) — on the device when it can, otherwise on the server.
 * Same contract as api.runTool: resolves to the finished job `{ status: 'done', outputs, result }`.
 */
export async function runTool(toolId, fileIds, options = {}, { onUpdate, signal } = {}) {
  const files = fileIds.map((x) => (typeof x === 'string' ? records.get(x) : x))
  if (files.some((f) => !f)) throw new ApiError(404, 'NOT_FOUND', t('err.fetchFile'))
  if (runsHere(toolId, files, options)) {
    try {
      return await runHere(toolId, files, options, { onUpdate, signal })
    } catch (err) {
      if (err.code !== 'LOCAL_UNSUPPORTED') throw err
      // this browser can't (e.g. Safari has no WebP encoder): the server does it
    }
  }
  const remote = await onServer(files, onUpdate)
  const job = await runServerTool(toolId, remote.map((f) => f.id), options, { onUpdate, signal })
  remember(job.outputs ?? [])
  return job
}
