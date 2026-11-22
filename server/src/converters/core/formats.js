// PDF → images, plain text, Excel and PowerPoint.
// Portable (server worker threads and the browser tool worker). Excel and PowerPoint writers
// are loaded only when those tools run.
import { baseName } from '../../lib/filetypes.js'
import { closePdf, openPdf, pageText, renderPage } from './pdfjs.js'
import { lineText, segments, toLines } from './layout.js'
import { parsePageRange } from './ranges.js'
import { pad, renameExt, toBase64, u8, zip } from './util.js'

const MAX_SEPARATE = 30 // beyond this, results come only as a ZIP

export async function toImages({ inputs: [input], options }, { progress, platform }) {
  const pdf = await openPdf(await input.read(), platform)
  try {
    const pages = parsePageRange(options.pages, pdf.numPages)
    const width = String(pdf.numPages).length
    const images = []
    for (const [n, idx] of pages.entries()) {
      progress(5 + (88 * n) / pages.length, `Sahifa ${idx + 1} / ${pdf.numPages}`)
      const canvas = await renderPage(pdf, idx + 1, options.dpi / 72, options.format === 'png' ? '#ffffff' : '#ffffff')
      images.push({ name: `${baseName(input.name)}-${pad(idx + 1, width)}.${options.format}`, data: await platform.encodeCanvas(canvas, options.format, 88) })
    }
    const outputs = []
    if (images.length === 1) outputs.push(images[0])
    else {
      outputs.push({ name: renameExt(input.name, 'zip', '-rasmlar'), data: zip(images) })
      if (images.length <= MAX_SEPARATE) outputs.push(...images)
    }
    return { outputs, summary: { pages: images.length, format: options.format, dpi: options.dpi } }
  } finally {
    await closePdf(pdf)
  }
}

export async function toText({ inputs: [input], options }, { progress, platform }) {
  const pdf = await openPdf(await input.read(), platform)
  try {
    const pages = parsePageRange(options.pages, pdf.numPages)
    const parts = []
    let chars = 0
    for (const [n, idx] of pages.entries()) {
      progress(5 + (90 * n) / pages.length, `Sahifa ${idx + 1} / ${pdf.numPages}`)
      const page = await pdf.getPage(idx + 1)
      const { items } = await pageText(page, { withFonts: false })
      const lines = toLines(items)
      // blank line where the vertical gap says "new paragraph"
      const out = []
      lines.forEach((l, i) => {
        if (i && lines[i - 1].y - l.y > Math.max(l.size, lines[i - 1].size) * 1.8) out.push('')
        out.push(lineText(l, { layout: options.layout }).trimEnd())
      })
      const text = out.join('\n').trim()
      chars += text.length
      parts.push(pages.length > 1 ? `——— ${idx + 1} ———\n\n${text}` : text)
      page.cleanup()
    }
    if (chars < 10) {
      parts.push('[Bu PDF da tanib olinadigan matn topilmadi — ehtimol, u skanerlangan rasm. OCR (rasmdan matn) tez kunda.]')
    }
    const body = '﻿' + parts.join('\n\n\n') + '\n'
    return { outputs: [{ name: renameExt(input.name, 'txt'), data: new TextEncoder().encode(body) }], summary: { pages: pages.length, chars } }
  } finally {
    await closePdf(pdf)
  }
}

const NUMBER = /^[-−]?\d{1,3}([  ]\d{3})*([.,]\d+)?$|^[-−]?\d+([.,]\d+)?$/
const toCell = (text) => {
  const t = text.trim()
  if (NUMBER.test(t)) {
    const n = Number(t.replace(/[  ]/g, '').replace('−', '-').replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return t
}

/** Column anchors: cluster the left edges of all segments on the page. */
function columnAnchors(segRows, tol) {
  const xs = segRows.flatMap((r) => r.map((s) => s.x0)).sort((a, b) => a - b)
  const anchors = []
  for (const x of xs) {
    const last = anchors.at(-1)
    if (last && x - last.max <= tol) {
      last.max = x
      last.n++
    } else anchors.push({ min: x, max: x, n: 1 })
  }
  return anchors.map((a) => a.min)
}

export async function toXlsx({ inputs: [input], options }, { progress, platform }) {
  const { default: ExcelJS } = await import('exceljs')
  const pdf = await openPdf(await input.read(), platform)
  try {
    const pages = parsePageRange(options.pages, pdf.numPages)
    const wb = new ExcelJS.Workbook()
    wb.creator = 'QalamAI'
    let rowsTotal = 0
    for (const [n, idx] of pages.entries()) {
      progress(5 + (85 * n) / pages.length, `Sahifa ${idx + 1} / ${pdf.numPages}`)
      const page = await pdf.getPage(idx + 1)
      const { items } = await pageText(page)
      const lines = toLines(items)
      const segRows = lines.map((l) => segments(l, 0.9))
      const size = lines.length ? lines.reduce((s, l) => s + l.size, 0) / lines.length : 10
      const anchors = columnAnchors(segRows, size * 1.2)
      const ws = wb.addWorksheet(`Sahifa ${idx + 1}`, { views: [{ state: 'frozen', ySplit: 0 }] })
      const widths = new Array(anchors.length).fill(8)
      segRows.forEach((segs, r) => {
        const row = ws.getRow(r + 1)
        for (const s of segs) {
          // rightmost anchor at or left of the segment start
          let col = 0
          for (let i = 0; i < anchors.length; i++) if (anchors[i] <= s.x0 + size * 0.6) col = i
          const cell = row.getCell(col + 1)
          const prev = cell.value
          cell.value = prev == null || prev === '' ? toCell(s.text) : `${prev} ${s.text}`
          if (s.runs.every((x) => x.bold)) cell.font = { bold: true }
          widths[col] = Math.min(60, Math.max(widths[col], String(cell.value).length + 2))
        }
        row.commit()
      })
      widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))
      rowsTotal += segRows.length
      page.cleanup()
    }
    progress(94, 'Excel fayl yiğilmoqda')
    const data = u8(await wb.xlsx.writeBuffer())
    return { outputs: [{ name: renameExt(input.name, 'xlsx'), data }], summary: { pages: pages.length, rows: rowsTotal } }
  } finally {
    await closePdf(pdf)
  }
}

export async function toPptx({ inputs: [input], options }, { progress, platform }) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pdf = await openPdf(await input.read(), platform)
  try {
    const pages = parsePageRange(options.pages, pdf.numPages)
    const first = (await pdf.getPage(pages[0] + 1)).getViewport({ scale: 1 })
    const W = 13.333
    const H = +(W * (first.height / first.width)).toFixed(3)
    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'PDF', width: W, height: H })
    pptx.layout = 'PDF'
    pptx.author = 'QalamAI'
    pptx.title = baseName(input.name)
    for (const [n, idx] of pages.entries()) {
      progress(5 + (85 * n) / pages.length, `Slayd ${n + 1} / ${pages.length}`)
      const canvas = await renderPage(pdf, idx + 1, 2)
      const jpg = await platform.encodeCanvas(canvas, 'jpg', 88)
      const slide = pptx.addSlide()
      const ar = canvas.width / canvas.height
      // letterbox pages whose shape differs from the first one
      const w = Math.min(W, H * ar)
      const h = w / ar
      slide.addImage({ data: `data:image/jpeg;base64,${toBase64(jpg)}`, x: (W - w) / 2, y: (H - h) / 2, w, h })
      const page = await pdf.getPage(idx + 1)
      const { items } = await pageText(page, { withFonts: false })
      const notes = toLines(items).map((l) => lineText(l)).join('\n').trim()
      if (notes) slide.addNotes(notes.slice(0, 20_000))
      page.cleanup()
    }
    progress(94, 'Taqdimot yiğilmoqda')
    const data = u8(await pptx.write({ outputType: 'uint8array' }))
    return { outputs: [{ name: renameExt(input.name, 'pptx'), data }], summary: { slides: pages.length } }
  } finally {
    await closePdf(pdf)
  }
}
