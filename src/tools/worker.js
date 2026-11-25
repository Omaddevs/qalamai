// Tool worker: runs file tools on the user's own device, off the main thread.
// Every tool the server has runs here too. The PDF and document tools are the very same code the
// server runs (server/src/converters/core); image tools and background removal use OffscreenCanvas
// and onnxruntime-web. Files never leave the browser.
//
// in:  { id, op: 'run', tool, inputs: [{ name, kind, ext, size, meta, blob }], options }
//      { id, op: 'probe', file }                  → type + meta of a picked file
// out: { id, type: 'progress', pct, stage } | { id, type: 'done', result } | { id, type: 'error', code, message }
import { detectType } from '../../server/src/lib/filetypes.js'
import { browserPlatform } from './platform.js'

const TOOLS = {
  'pdf-merge': () => import('../../server/src/converters/core/organize.js').then((m) => m.merge),
  'pdf-split': () => import('../../server/src/converters/core/organize.js').then((m) => m.split),
  'pdf-rotate': () => import('../../server/src/converters/core/organize.js').then((m) => m.rotate),
  'images-to-pdf': () => import('../../server/src/converters/core/organize.js').then((m) => m.imagesToPdf),
  'pdf-watermark': () => import('../../server/src/converters/core/stamp.js').then((m) => m.watermark),
  'pdf-page-numbers': () => import('../../server/src/converters/core/stamp.js').then((m) => m.pageNumbers),
  'pdf-edit': () => import('../../server/src/converters/core/edit.js').then((m) => m.run),
  'pdf-to-docx': () => import('../../server/src/converters/core/docx.js').then((m) => m.run),
  'pdf-to-images': () => import('../../server/src/converters/core/formats.js').then((m) => m.toImages),
  'pdf-to-text': () => import('../../server/src/converters/core/formats.js').then((m) => m.toText),
  'pdf-to-xlsx': () => import('../../server/src/converters/core/formats.js').then((m) => m.toXlsx),
  'pdf-to-pptx': () => import('../../server/src/converters/core/formats.js').then((m) => m.toPptx),
  'pdf-compress': () => import('../../server/src/converters/core/compress.js').then((m) => m.run),
  'doc-to-pdf': () => import('../../server/src/converters/core/office.js').then((m) => m.run),
  'xlsx-to-pdf': () => import('../../server/src/converters/core/sheet.js').then((m) => m.run),
  'pptx-to-pdf': () => import('../../server/src/converters/core/slides.js').then((m) => m.run),
  'image-remove-bg': () => import('./removebg.js').then((m) => m.run),
  'image-convert': () => import('./image.js').then((m) => m.convert),
  'image-compress': () => import('./image.js').then((m) => m.compress),
  'image-resize': () => import('./image.js').then((m) => m.resize),
}

const CHUNK = 4 * 1048576
const latin1 = new TextDecoder('latin1')

/** Page count without parsing the whole PDF (the root /Pages node carries the largest /Count). */
async function pdfInfo(blob) {
  let pages = 0
  // scanned in overlapping chunks: one string for a 200 MB file would need 400 MB
  for (let at = 0; at < blob.size; at += CHUNK) {
    const text = latin1.decode(new Uint8Array(await blob.slice(Math.max(0, at - 512), at + CHUNK).arrayBuffer()))
    for (const m of text.matchAll(/\/Type\s*\/Pages\b[^>]{0,400}?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]{0,400}?\/Type\s*\/Pages\b/g)) pages = Math.max(pages, Number(m[1] ?? m[2]))
  }
  const head = latin1.decode(new Uint8Array(await blob.slice(0, 2048).arrayBuffer()))
  const tail = latin1.decode(new Uint8Array(await blob.slice(Math.max(0, blob.size - 4096)).arrayBuffer()))
  const encrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(tail) || /\/Encrypt\s/.test(head)
  if (!pages) {
    // compressed object streams hide the page tree from a byte scan — parse it properly
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false })
      pages = doc.getPageCount()
    } catch {
      pages = 0
    }
  }
  return { pages, encrypted, version: head.match(/%PDF-(\d\.\d)/)?.[1] }
}

async function probe(file) {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer())
  const type = detectType(head, file.name)
  if (!type || file.size === 0) return null
  let meta = {}
  if (type.kind === 'pdf') meta = await pdfInfo(file)
  else if (type.kind === 'image' && type.ext !== 'svg') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      meta = { width: bmp.width, height: bmp.height, format: type.ext }
      bmp.close()
    } catch {
      meta = { format: type.ext }
    }
  }
  return { ...type, meta }
}

self.onmessage = async ({ data: msg }) => {
  const { id } = msg
  try {
    if (msg.op === 'probe') return self.postMessage({ id, type: 'done', result: await probe(msg.file) })
    const { TOOL_MAP } = await import('../../server/src/modules/tools/catalog.js')
    // preset tools (heic-to-jpg …) run another tool's implementation with fixed options
    const load = TOOLS[TOOL_MAP.get(msg.tool)?.impl ?? msg.tool]
    if (!load) throw Object.assign(new Error(msg.tool), { code: 'LOCAL_UNSUPPORTED' })
    const run = await load()
    // the server's own option schema: same defaults, same validation messages
    const parsed = TOOL_MAP.get(msg.tool).options.safeParse(msg.options ?? {})
    if (!parsed.success) throw Object.assign(new Error(parsed.error.issues[0]?.message ?? 'Sozlamalar notöğri'), { code: 'BAD_OPTIONS' })
    const progress = (pct, stage) => self.postMessage({ id, type: 'progress', pct: Math.max(0, Math.min(100, Math.round(pct))), stage })
    const inputs = msg.inputs.map((i) => ({ ...i, read: async () => new Uint8Array(await i.blob.arrayBuffer()) }))
    const result = await run({ inputs, options: parsed.data }, { progress, platform: browserPlatform })
    progress(99, 'Yakunlanmoqda')
    const outputs = result.outputs.map((o) => ({ name: o.name.replace(/[\\/]/g, '_'), data: o.data }))
    self.postMessage({ id, type: 'done', result: { outputs, summary: result.summary ?? null } }, outputs.map((o) => o.data.buffer).filter((b, i, all) => all.indexOf(b) === i))
  } catch (err) {
    const known = err?.code && /^[A-Z_]+$/.test(err.code)
    if (!known) console.error('tool worker:', err)
    self.postMessage({
      id,
      type: 'error',
      code: known ? err.code : 'TOOL_FAILED',
      message: known ? err.message : 'Faylni qayta işlab bölmadi. U şikastlangan yoki parol bilan himoyalangan bölişi mumkin.',
    })
  }
}
