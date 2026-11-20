// Merge, split and rotate.
import { PDFDocument, degrees } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { parsePageRange, parseRangeGroups } from '../../modules/tools/catalog.js'
import { baseName } from '../../lib/filetypes.js'
import { emit, pad, renameExt, zip } from '../lib/util.js'
import { loadPdf } from './edit.js'
import { addImagePage } from '../image/to-pdf.js'

const MAX_SEPARATE = 30

export async function merge({ inputs, outDir }, { progress }) {
  const out = await PDFDocument.create()
  out.setProducer('QalamAI')
  for (const [i, input] of inputs.entries()) {
    progress(5 + (85 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    if (input.kind === 'image') {
      await addImagePage(out, input.path, { pageSize: 'a4', orientation: 'auto', margin: 'small' })
      continue
    }
    const src = await loadPdf(input.path)
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
  }
  progress(93, 'Saqlanmoqda')
  const bytes = await out.save({ useObjectStreams: true })
  return {
    outputs: [await emit(outDir, `${baseName(inputs[0].name)}-birlashtirilgan.pdf`, bytes)],
    summary: { files: inputs.length, pages: out.getPageCount() },
  }
}

async function subset(src, indexes) {
  const out = await PDFDocument.create()
  out.setProducer('QalamAI')
  for (const p of await out.copyPages(src, indexes)) out.addPage(p)
  return out.save({ useObjectStreams: true })
}

export async function split({ inputs: [input], options, outDir }, { progress }) {
  const src = await loadPdf(input.path)
  const total = src.getPageCount()
  const base = baseName(input.name)
  let groups
  if (options.mode === 'every') groups = [...Array(total).keys()].map((i) => [i])
  else {
    if (!options.ranges) throw new ToolError('BAD_OPTIONS', 'Sahifalarni kiriting, masalan: 1-3, 5')
    groups = options.mode === 'ranges' ? parseRangeGroups(options.ranges, total) : [parsePageRange(options.ranges, total)]
  }
  groups = groups.filter((g) => g.length)
  if (!groups.length) throw new ToolError('BAD_OPTIONS', `Bu PDF da ${total} ta sahifa bor — oraliqni tekşiring`)

  const w = String(total).length
  const parts = []
  for (const [i, g] of groups.entries()) {
    progress(5 + (85 * i) / groups.length, `Qism ${i + 1} / ${groups.length}`)
    const label = g.length === 1 ? pad(g[0] + 1, w) : `${pad(g[0] + 1, w)}-${pad(g.at(-1) + 1, w)}`
    parts.push({ name: options.mode === 'extract' ? `${base}-tanlangan.pdf` : `${base}-${label}.pdf`, data: await subset(src, g) })
  }
  const outputs = []
  if (parts.length === 1) outputs.push(await emit(outDir, parts[0].name, parts[0].data))
  else {
    outputs.push(await emit(outDir, `${base}-qismlar.zip`, zip(parts)))
    if (parts.length <= MAX_SEPARATE) for (const p of parts) outputs.push(await emit(outDir, p.name, p.data))
  }
  return { outputs, summary: { parts: parts.length, pages: total } }
}

export async function rotate({ inputs: [input], options, outDir }, { progress }) {
  progress(10, 'PDF oçilmoqda')
  const doc = await loadPdf(input.path)
  const pages = doc.getPages()
  const pick = new Set(parsePageRange(options.pages, pages.length))
  pages.forEach((p, i) => {
    if (pick.has(i)) p.setRotation(degrees((p.getRotation().angle + options.angle) % 360))
  })
  progress(85, 'Saqlanmoqda')
  return { outputs: [await emit(outDir, renameExt(input.name, 'pdf'), await doc.save({ useObjectStreams: true }))], summary: { rotated: pick.size } }
}
