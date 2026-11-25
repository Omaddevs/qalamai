// Excel (XLSX) / CSV → PDF. Every sheet with data is drawn as a printed table: Excel's own
// column widths and row heights, merged cells, fills, bold / italic / colour, alignment,
// wrapped text and number formats. Wide sheets turn the page to landscape and shrink to fit
// the width (down to a readable minimum); wider still, the columns continue on further pages.
// Portable: runs in the server's worker threads and in the browser tool worker.
import { PDFDocument, rgb } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { baseName } from '../../lib/filetypes.js'
import { fontSet, printable } from './fonts.js'
import { csvRows } from './office.js'

const PAGE = { a4: [595.28, 841.89], letter: [612, 792] }
const MARGIN = 28
const PAD = 3
const MIN_SCALE = 0.55
const GRID = rgb(0.78, 0.8, 0.83)
const EDGE = rgb(0.2, 0.2, 0.22)

/** Excel's column width unit (characters of the default font) → points. */
const colPoints = (w) => Math.max(4, (w ?? 8.43) * 5.6 + 5)

function argb(c) {
  const v = c?.argb
  if (typeof v !== 'string' || v.length < 6) return null
  const hex = v.slice(-6)
  const n = parseInt(hex, 16)
  if (Number.isNaN(n)) return null
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/* ───────── values as Excel shows them ───────── */

const pad2 = (n) => String(n).padStart(2, '0')

function formatNumber(v, fmt = '') {
  const f = fmt.split(';')[0]
  if (/%/.test(f)) {
    const dec = f.match(/0\.(0+)%/)?.[1].length ?? 0
    return `${(v * 100).toFixed(dec)}%`
  }
  if (/[dmyhs]/i.test(f) && !/[#0]/.test(f.replace(/\[[^\]]*\]/g, ''))) return null // a date format on a serial number
  const dec = f.match(/\.(0+)/)?.[1].length
  const grouped = /#,##0|,0/.test(f)
  let s = dec != null ? v.toFixed(dec) : Number.isInteger(v) ? String(v) : String(+v.toPrecision(12))
  if (grouped) {
    const [i, d] = s.split('.')
    s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? `.${d}` : '')
  }
  const cur = f.match(/\[\$([^\]-]+)/)?.[1] ?? (/"([^"]+)"/.test(f) ? f.match(/"([^"]+)"/)[1] : '')
  return cur ? (f.indexOf(cur) < f.indexOf('0') ? `${cur}${s}` : `${s}${cur.startsWith(' ') ? '' : ' '}${cur}`) : s
}

function formatDate(d, fmt = '') {
  const hasTime = /h/i.test(fmt) || (!fmt && (d.getUTCHours() || d.getUTCMinutes()))
  const date = `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
  return hasTime ? `${date} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` : date
}

export function cellText(cell) {
  let v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) v = v.result // formula: its cached result
    else if (v.richText) return v.richText.map((r) => r.text).join('')
    else if ('text' in v) return String(v.text) // hyperlink
    else if (v.error) return String(v.error)
    if (v == null) return ''
    if (typeof v === 'object' && !(v instanceof Date)) return ''
  }
  if (v instanceof Date) return formatDate(v, cell.numFmt)
  if (typeof v === 'number') return formatNumber(v, cell.numFmt) ?? String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

/* ───────── workbook → plain grids ───────── */

/** @returns {Array<{ name, cols: number[], rows: Array<{ h, cells: Array<cell|null> }>, merges, header }>} */
async function readXlsx(bytes) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes)
  } catch {
    throw new ToolError('UNSUPPORTED_FILE', 'Excel faylni öqib bölmadi — u şikastlangan yoki eski .xls formatida bölişi mumkin.')
  }
  const sheets = []
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== 'visible') return
    let maxR = 0
    let maxC = 0
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (cellText(cell).trim() || argb(cell.fill?.fgColor)) {
          maxR = Math.max(maxR, r)
          maxC = Math.max(maxC, c)
        }
      })
    })
    if (!maxR) return
    const area = ws.pageSetup?.printArea
    const merges = []
    for (const range of Object.values(ws._merges ?? {})) {
      const m = range.model ?? range
      if (m?.top) merges.push({ top: m.top, left: m.left, bottom: m.bottom, right: m.right })
    }
    const cols = []
    for (let c = 1; c <= maxC; c++) {
      const col = ws.getColumn(c)
      cols.push(col.hidden ? 0 : colPoints(col.width ?? ws.properties?.defaultColWidth))
    }
    const rows = []
    for (let r = 1; r <= maxR; r++) {
      const row = ws.getRow(r)
      const cells = []
      for (let c = 1; c <= maxC; c++) {
        const cell = row.getCell(c)
        const fill = cell.fill?.type === 'pattern' && cell.fill.pattern !== 'none' ? argb(cell.fill.fgColor) : null
        cells.push({
          text: cellText(cell),
          bold: !!cell.font?.bold,
          italic: !!cell.font?.italic,
          size: cell.font?.size ?? 11,
          color: argb(cell.font?.color),
          fill,
          align: cell.alignment?.horizontal ?? (typeof cell.value === 'number' || cell.value instanceof Date || typeof cell.value?.result === 'number' ? 'right' : 'left'),
          valign: cell.alignment?.vertical ?? 'bottom',
          wrap: !!cell.alignment?.wrapText,
          border: !!(cell.border && Object.values(cell.border).some((b) => b?.style)),
        })
      }
      rows.push({ h: row.hidden ? 0 : row.height ?? ws.properties?.defaultRowHeight ?? 15, cells })
    }
    sheets.push({ name: ws.name, cols, rows, merges, area, header: ws.pageSetup?.printTitlesRow })
  })
  return sheets
}

function readCsv(bytes, name) {
  const text = new TextDecoder().decode(bytes).replace(/^﻿/, '')
  const grid = csvRows(text)
  if (!grid.length) return []
  const width = Math.max(...grid.map((r) => r.length))
  const longest = Array.from({ length: width }, (_, c) => Math.max(...grid.map((r) => String(r[c] ?? '').length)))
  const num = (s) => /^-?[\d\s.,]+%?$/.test(s.trim()) && /\d/.test(s)
  return [
    {
      name,
      cols: longest.map((n) => colPoints(Math.min(48, Math.max(6, n + 1)))),
      rows: grid.map((r, i) => ({
        h: 15,
        cells: Array.from({ length: width }, (_, c) => {
          const text = String(r[c] ?? '')
          return { text, bold: i === 0, italic: false, size: 10, color: null, fill: i === 0 ? rgb(0.93, 0.94, 0.96) : null, align: i && num(text) ? 'right' : 'left', valign: 'bottom', wrap: text.length > 48, border: true }
        }),
      })),
      merges: [],
      header: '1:1',
    },
  ]
}

/* ───────── drawing ───────── */

export async function toPdf(input, options, platform) {
  const bytes = await input.read()
  const sheets = input.ext === 'csv' ? readCsv(bytes, baseName(input.name)) : await readXlsx(bytes)
  if (!sheets.length) throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» da ma'lumot topilmadi — varaqlar böş.`)

  const doc = await PDFDocument.create()
  doc.setProducer('QalamAI')
  doc.setTitle(baseName(input.name))
  const font = fontSet(doc, platform.font)
  let pages = 0

  for (const sheet of sheets) {
    const fullW = sheet.cols.reduce((s, w) => s + w, 0)
    const [pw, ph] = PAGE[options.pageSize] ?? PAGE.a4
    // portrait when it fits, landscape when that helps, then shrink to fit (not below MIN_SCALE)
    const portraitW = pw - 2 * MARGIN
    const landscape = options.orientation === 'landscape' || (options.orientation !== 'portrait' && fullW > portraitW)
    const [W, H] = landscape ? [ph, pw] : [pw, ph]
    const availW = W - 2 * MARGIN
    const scale = options.fitWidth ? Math.min(1, Math.max(MIN_SCALE, availW / fullW)) : 1

    // columns too wide even when shrunk continue on further pages (Excel's "down, then over")
    const bands = []
    let start = 0
    let acc = 0
    sheet.cols.forEach((w, c) => {
      if (acc + w * scale > availW + 0.5 && c > start) {
        bands.push([start, c])
        start = c
        acc = 0
      }
      acc += w * scale
    })
    bands.push([start, sheet.cols.length])

    // merged areas: the top-left cell draws the whole area, the others are skipped
    const covered = new Set()
    const span = new Map()
    for (const m of sheet.merges) {
      span.set(`${m.top - 1}:${m.left - 1}`, m)
      for (let r = m.top - 1; r < m.bottom; r++) for (let c = m.left - 1; c < m.right; c++) if (r !== m.top - 1 || c !== m.left - 1) covered.add(`${r}:${c}`)
    }
    const headerRows = (() => {
      const m = String(sheet.header ?? '').match(/^\$?(\d+):\$?(\d+)$/)
      return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) - 1 + i) : []
    })()

    for (const [bi, [c0, c1]] of bands.entries()) {
      const colX = [MARGIN]
      for (let c = c0; c < c1; c++) colX.push(colX.at(-1) + sheet.cols[c] * scale)
      const xOf = (c) => colX[Math.min(c, c1) - c0]

      // measure: lines of each cell and the height its row needs
      const layouts = []
      for (const [r, row] of sheet.rows.entries()) {
        let need = row.h * scale
        const cells = []
        for (let c = c0; c < c1; c++) {
          const cell = row.cells[c]
          if (!cell?.text || covered.has(`${r}:${c}`) || !row.h) {
            cells.push(null)
            continue
          }
          const m = span.get(`${r}:${c}`)
          const cw = (m ? xOf(m.right) - xOf(c) : sheet.cols[c] * scale) - 2 * PAD * scale
          const f = await font({ family: 'sans', bold: cell.bold, italic: cell.italic })
          const size = Math.max(4, cell.size * scale * 0.92)
          const text = printable(f, cell.text)
          const lines = cell.wrap ? wrapText(f, text, size, Math.max(cw, size)) : text.split('\n')
          if (!m) need = Math.max(need, lines.length * size * 1.22 + 2 * PAD * scale)
          cells.push({ cell, f, size, lines, merge: m })
        }
        layouts.push({ r, h: need, cells })
      }

      let page = null
      let y = 0
      let bandPages = 0
      let current = null
      const newPage = async () => {
        page = doc.addPage([W, H])
        pages++
        bandPages++
        y = H - MARGIN
        page.drawText(printable(await font({ family: 'sans' }), `${sheet.name}${bands.length > 1 ? ` (${bi + 1}/${bands.length})` : ''}`), {
          x: MARGIN, y: H - MARGIN + 10, size: 7, font: await font({ family: 'sans' }), color: rgb(0.5, 0.52, 0.56),
        })
        // header rows repeat on every page
        if (bandPages > 1 && !headerRows.includes(current?.r)) for (const hr of headerRows) if (layouts[hr]) drawRow(layouts[hr])
      }
      const drawRow = (L) => {
        if (L.h <= 0) return
        const top = y
        // fills and grid first, text on top
        for (const [i, item] of L.cells.entries()) {
          const c = c0 + i
          if (covered.has(`${L.r}:${c}`)) continue
          const m = item?.merge ?? span.get(`${L.r}:${c}`)
          const x = xOf(c)
          const w = (m ? xOf(m.right) : xOf(c + 1)) - x
          let h = L.h
          if (m) for (let r = L.r + 1; r < m.bottom; r++) h += layouts[r]?.h ?? 0
          const cell = sheet.rows[L.r].cells[c]
          if (w <= 0) continue
          if (cell?.fill) page.drawRectangle({ x, y: top - h, width: w, height: h, color: cell.fill })
          if (options.gridlines || cell?.border) page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: cell?.border ? EDGE : GRID, borderWidth: cell?.border ? 0.6 : 0.35 })
        }
        for (const [i, item] of L.cells.entries()) {
          if (!item) continue
          const c = c0 + i
          const { cell, f, size, lines, merge } = item
          const x = xOf(c)
          let w = (merge ? xOf(merge.right) : xOf(c + 1)) - x
          let h = L.h
          if (merge) for (let r = L.r + 1; r < merge.bottom; r++) h += layouts[r]?.h ?? 0
          // unwrapped text spills into empty neighbours on the right, like Excel
          if (!cell.wrap && !merge && cell.align === 'left') {
            for (let n = c + 1; n < c1 && !L.cells[n - c0] && !covered.has(`${L.r}:${n}`); n++) w += xOf(n + 1) - xOf(n)
          }
          const inner = w - 2 * PAD * scale
          const textH = lines.length * size * 1.22
          let ty = cell.valign === 'top' ? top - PAD * scale - size : cell.valign === 'middle' || cell.valign === 'center' ? top - (h - textH) / 2 - size * 0.98 : top - h + PAD * scale + textH - size * 1.04
          for (let line of lines) {
            let lw = f.widthOfTextAtSize(line, size)
            if (!cell.wrap && lw > inner) {
              // clip what doesn't fit, as Excel hides it
              while (line.length > 1 && f.widthOfTextAtSize(line, size) > inner) line = line.slice(0, -1)
              lw = f.widthOfTextAtSize(line, size)
            }
            const tx = cell.align === 'right' ? x + w - PAD * scale - lw : cell.align === 'center' || cell.align === 'centerContinuous' ? x + (w - lw) / 2 : x + PAD * scale
            if (line) page.drawText(line, { x: tx, y: ty, size, font: f, color: cell.color ?? rgb(0.07, 0.07, 0.08) })
            ty -= size * 1.22
          }
        }
        y -= L.h
      }

      await newPage()
      for (const L of layouts) {
        current = L
        if (y - L.h < MARGIN && y < H - MARGIN - 1) await newPage()
        drawRow(L)
      }
    }
  }
  return { data: await doc.save(), pages }
}

function wrapText(f, text, size, maxW) {
  const out = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      const next = line + word
      if (line.trim() && f.widthOfTextAtSize(next.trimEnd(), size) > maxW) {
        out.push(line.trimEnd())
        line = word.trimStart()
      } else line = next
    }
    out.push(line.trimEnd())
  }
  return out
}

export async function run({ inputs, options }, { progress, platform }) {
  const outputs = []
  let pages = 0
  for (const [i, input] of inputs.entries()) {
    progress(5 + (88 * i) / inputs.length, inputs.length > 1 ? `${i + 1} / ${inputs.length}: ${input.name}` : 'Jadval sahifalanmoqda')
    const res = await toPdf(input, options, platform)
    pages += res.pages
    outputs.push({ name: `${baseName(input.name)}.pdf`, data: res.data })
  }
  return { outputs, summary: { files: outputs.length, pages } }
}
