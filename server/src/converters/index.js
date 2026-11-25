// Tool id → implementation. Loaded inside worker threads; each tool module is imported
// only when first used.
import { ToolError } from '../lib/errors.js'

const TOOLS = {
  'pdf-to-docx': () => import('./pdf/to-docx.js').then((m) => m.run),
  'pdf-to-images': () => import('./pdf/to-formats.js').then((m) => m.toImages),
  'pdf-to-text': () => import('./pdf/to-formats.js').then((m) => m.toText),
  'pdf-to-xlsx': () => import('./pdf/to-formats.js').then((m) => m.toXlsx),
  'pdf-to-pptx': () => import('./pdf/to-formats.js').then((m) => m.toPptx),
  'pdf-edit': () => import('./pdf/edit.js').then((m) => m.run),
  'pdf-merge': () => import('./pdf/organize.js').then((m) => m.merge),
  'pdf-split': () => import('./pdf/organize.js').then((m) => m.split),
  'pdf-rotate': () => import('./pdf/organize.js').then((m) => m.rotate),
  'pdf-compress': () => import('./pdf/compress.js').then((m) => m.run),
  'pdf-watermark': () => import('./pdf/stamp.js').then((m) => m.watermark),
  'pdf-page-numbers': () => import('./pdf/stamp.js').then((m) => m.pageNumbers),
  'image-remove-bg': () => import('./image/remove-bg.js').then((m) => m.run),
  'image-convert': () => import('./image/basic.js').then((m) => m.convert),
  'image-compress': () => import('./image/basic.js').then((m) => m.compress),
  'image-resize': () => import('./image/basic.js').then((m) => m.resize),
  'images-to-pdf': () => import('./image/to-pdf.js').then((m) => m.run),
  'doc-to-pdf': () => import('./office/to-pdf.js').then((m) => m.run),
  'xlsx-to-pdf': () => portable('./core/sheet.js'),
  'pptx-to-pdf': () => portable('./core/slides.js'),
}

/** A portable core tool (also run in the browser) wrapped for the server's worker threads. */
const portable = (path) => Promise.all([import(path), import('./lib/node-platform.js')]).then(([m, p]) => p.onServer(m.run))

/** @param {{ tool: string, inputs: any[], options: object, outDir: string }} task */
export async function run(task, ctx) {
  // preset tools (heic-to-jpg …) run another tool's implementation with fixed options
  const { TOOL_MAP } = await import('../modules/tools/catalog.js')
  const load = TOOLS[TOOL_MAP.get(task.tool)?.impl ?? task.tool]
  if (!load) throw new ToolError('UNKNOWN_TOOL', `Nomaʼlum vosita: ${task.tool}`)
  const fn = await load()
  const result = await fn(task, ctx)
  ctx.progress(99, 'Yakunlanmoqda')
  return result
}

export const TOOL_IDS = Object.keys(TOOLS)
