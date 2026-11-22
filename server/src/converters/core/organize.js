// Merge, split, rotate and images → PDF.
// Portable: inputs are { name, kind, read() → bytes }, results are { outputs: [{ name, data }], summary }.
import { PDFDocument, degrees } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { baseName } from '../../lib/filetypes.js'
import { parsePageRange, parseRangeGroups } from './ranges.js'
import { addImagePage, openInput } from './pdf.js'
import { pad, renameExt, zip } from './util.js'

const MAX_SEPARATE = 30
const PAGE_OF_IMAGE = { pageSize: 'a4', orientation: 'auto', margin: 'small' }

export async function merge({ inputs }, { progress, platform }) {
  const out = await PDFDocument.create()
  out.setProducer('QalamAI')
  for (const [i, input] of inputs.entries()) {
    progress(5 + (85 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    if (input.kind === 'image') {
      await addImagePage(out, await platform.image(input), PAGE_OF_IMAGE)
      continue
    }
    const src = await openInput(input)
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
  }
  progress(93, 'Saqlanmoqda')
  const data = await out.save({ useObjectStreams: true })
  return {
    outputs: [{ name: `${baseName(inputs[0].name)}-birlashtirilgan.pdf`, data }],
    summary: { files: inputs.length, pages: out.getPageCount() },
  }
}

async function subset(src, indexes) {
  const out = await PDFDocument.create()
  out.setProducer('QalamAI')
  for (const p of await out.copyPages(src, indexes)) out.addPage(p)
  return out.save({ useObjectStreams: true })
}

export async function split({ inputs: [input], options }, { progress }) {
  const src = await openInput(input)
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
  if (parts.length === 1) outputs.push(parts[0])
  else {
    outputs.push({ name: `${base}-qismlar.zip`, data: zip(parts) })
    if (parts.length <= MAX_SEPARATE) outputs.push(...parts)
  }
  return { outputs, summary: { parts: parts.length, pages: total } }
}

export async function rotate({ inputs: [input], options }, { progress }) {
  progress(10, 'PDF oçilmoqda')
  const doc = await openInput(input)
  const pages = doc.getPages()
  const pick = new Set(parsePageRange(options.pages, pages.length))
  pages.forEach((p, i) => {
    if (pick.has(i)) p.setRotation(degrees((p.getRotation().angle + options.angle) % 360))
  })
  progress(85, 'Saqlanmoqda')
  return { outputs: [{ name: renameExt(input.name, 'pdf'), data: await doc.save({ useObjectStreams: true }) }], summary: { rotated: pick.size } }
}

export async function imagesToPdf({ inputs, options }, { progress, platform }) {
  const doc = await PDFDocument.create()
  doc.setProducer('QalamAI')
  doc.setTitle(baseName(inputs[0].name))
  for (const [i, input] of inputs.entries()) {
    progress(5 + (88 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    await addImagePage(doc, await platform.image(input), options)
  }
  progress(95, 'Saqlanmoqda')
  const name = inputs.length === 1 ? `${baseName(inputs[0].name)}.pdf` : `${baseName(inputs[0].name)}-va-boshqalar.pdf`
  return { outputs: [{ name, data: await doc.save({ useObjectStreams: true }) }], summary: { pages: inputs.length } }
}
