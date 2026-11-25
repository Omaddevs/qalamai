// PDF → DOCX. Text pages are rebuilt as real Word paragraphs (headings, lists,
// bold/italic runs, alignment, embedded images in reading order). Pages with almost
// no text — scans — are placed as a full-width picture so nothing is lost.
// Portable (server worker threads and the browser tool worker).
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { closePdf, openPdf, pageImages, pageText, renderPage } from './pdfjs.js'
import { LEADING_BULLET, findTables, median, readingOrder, toLines, toParagraphs } from './layout.js'
import { parsePageRange } from './ranges.js'
import { renameExt, u8 } from './util.js'

const PX_PER_PT = 96 / 72
const HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }

const FONT_NAMES = [
  [/times/i, 'Times New Roman'],
  [/arial|helvetica|liberationsans/i, 'Arial'],
  [/calibri/i, 'Calibri'],
  [/cambria/i, 'Cambria'],
  [/georgia/i, 'Georgia'],
  [/verdana/i, 'Verdana'],
  [/courier/i, 'Courier New'],
  [/roboto/i, 'Roboto'],
]
const wordFont = (run) => FONT_NAMES.find(([re]) => re.test(run.font ?? ''))?.[1] ?? (run.serif ? 'Times New Roman' : 'Arial')

async function imageRun(img, maxWidthPt, platform) {
  const png = await platform.rawToPng(img)
  const wPt = Math.min(img.w, maxWidthPt)
  const hPt = img.h * (wPt / img.w)
  return new ImageRun({ type: 'png', data: png, transformation: { width: Math.round(wPt * PX_PER_PT), height: Math.round(hPt * PX_PER_PT) } })
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' }

/** A detected table → a Word table with the page's column proportions. */
function wordTable(tb, contentWidthPt) {
  const total = tb.widths.reduce((s, w) => s + w, 0)
  const twips = Math.round(contentWidthPt * 20)
  const widths = tb.widths.map((w) => Math.round((w / total) * twips))
  return new Table({
    width: { size: twips, type: WidthType.DXA },
    columnWidths: widths,
    rows: tb.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell, k) =>
              new TableCell({
                width: { size: widths[k], type: WidthType.DXA },
                borders: { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER },
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    children: cell
                      .filter((r) => r.text)
                      .map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, size: Math.round(r.size * 2), font: wordFont(r) })),
                  }),
                ],
              }),
          ),
        }),
    ),
  })
}

export async function run({ inputs: [input], options }, { progress, platform }) {
  const { OPS } = await platform.pdfjs()
  const pdf = await openPdf(await input.read(), platform)
  try {
    const pages = parsePageRange(options.pages, pdf.numPages)
    const children = []
    let pageSize = null
    let fontVotes = new Map()

    for (const [n, idx] of pages.entries()) {
      progress(5 + (85 * n) / pages.length, `Sahifa ${idx + 1} / ${pdf.numPages}`)
      const page = await pdf.getPage(idx + 1)
      const { width, height, items } = await pageText(page)
      pageSize ??= { width, height }
      const textChars = items.reduce((s, i) => s + i.str.trim().length, 0)
      const contentWidth = width * 0.8

      if (n > 0) children.push(new Paragraph({ children: [new PageBreak()] }))

      if (textChars < 25) {
        // scanned / image-only page → the page itself, as a picture
        const canvas = await renderPage(pdf, idx + 1, 2)
        const jpg = await platform.encodeCanvas(canvas, 'jpg', 85)
        const wPt = contentWidth
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: 'jpg', data: jpg, transformation: { width: Math.round(wPt * PX_PER_PT), height: Math.round(((wPt * canvas.height) / canvas.width) * PX_PER_PT) } })],
          }),
        )
        page.cleanup()
        continue
      }

      for (const it of items) fontVotes.set(wordFont(it), (fontVotes.get(wordFont(it)) ?? 0) + it.str.length)

      const allLines = toLines(items)
      // tables become real Word tables; their lines leave the paragraph flow
      const { tables, used } = findTables(allLines, width)
      const lines = allLines.filter((l) => !used.has(l))
      const rows = lines.length ? readingOrder(lines, width) : []
      const body = median(items.filter((i) => i.str.trim().length > 2).map((i) => i.size))
      const blocks = rows.length ? toParagraphs(rows, width, body).map((b) => ({ ...b, top: b.y + b.size })) : []

      // embedded pictures, placed between paragraphs by vertical position
      let images = []
      try {
        images = (await pageImages(page, OPS)).filter((im) => im.w > 24 && im.h > 24 && im.w * im.h < width * height * 0.85)
      } catch {
        images = []
      }
      const flow = [
        ...blocks.map((b) => ({ type: 'text', top: b.top, b })),
        ...images.map((im) => ({ type: 'image', top: im.y + im.h, im })),
        ...tables.map((tb) => ({ type: 'table', top: tb.top, tb })),
      ]
      // keep reading order of text (columns!) and slot each image / table before the first block below it
      const ordered = []
      const pendingImgs = flow.filter((f) => f.type !== 'text').sort((a, b) => b.top - a.top)
      for (const f of flow.filter((f) => f.type === 'text')) {
        while (pendingImgs.length && pendingImgs[0].top > f.top + 2) ordered.push(pendingImgs.shift())
        ordered.push(f)
      }
      ordered.push(...pendingImgs)

      for (const f of ordered) {
        if (f.type === 'table') {
          children.push(wordTable(f.tb, contentWidth))
          children.push(new Paragraph({ spacing: { after: 60 }, children: [] }))
          continue
        }
        if (f.type === 'image') {
          try {
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [await imageRun(f.im, contentWidth, platform)] }))
          } catch {
            /* skip an image we can't decode */
          }
          continue
        }
        const b = f.b
        const glyph = b.kind === 'list' && LEADING_BULLET.test(b.text)
        const text = glyph ? b.runs.map((r, i) => ({ ...r, text: i === 0 ? r.text.replace(LEADING_BULLET, '') : r.text })) : b.runs
        const runs = text
          .filter((r) => r.text)
          .map(
            (r) =>
              new TextRun({
                text: r.text,
                bold: b.kind === 'heading' ? true : r.bold,
                italics: r.italic,
                size: Math.round(r.size * 2),
                font: wordFont(r),
              }),
          )
        children.push(
          new Paragraph({
            children: runs,
            heading: b.kind === 'heading' ? HEADING[b.level] : undefined,
            bullet: glyph ? { level: 0 } : undefined,
            alignment: ALIGN[b.align] ?? AlignmentType.LEFT,
            indent: b.firstIndent ? { firstLine: Math.round(b.size * 2.5 * 20) } : undefined,
            spacing: { after: b.kind === 'heading' ? 160 : 100, line: 276 },
          }),
        )
      }
      page.cleanup()
    }

    progress(92, 'Word hujjat yiğilmoqda')
    const mainFont = [...fontVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Times New Roman'
    const twips = (pt) => Math.round(pt * 20)
    const doc = new Document({
      creator: 'QalamAI',
      title: input.name,
      styles: {
        default: { document: { run: { font: mainFont, size: 24 } } },
        paragraphStyles: [1, 2, 3].map((l) => ({
          id: `Heading${l}`,
          name: `Heading ${l}`,
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, color: '111111', font: mainFont },
          paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
        })),
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: twips(pageSize?.width ?? 595), height: twips(pageSize?.height ?? 842) },
              margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
            },
          },
          children: children.length ? children : [new Paragraph('')],
        },
      ],
    })
    const data = u8(await Packer.toArrayBuffer(doc))
    progress(98, 'Saqlanmoqda')
    return { outputs: [{ name: renameExt(input.name, 'docx'), data }], summary: { pages: pages.length } }
  } finally {
    await closePdf(pdf)
  }
}
