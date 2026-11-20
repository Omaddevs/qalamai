// PDF editing with pdf-lib: edit existing text (cover + redraw), add text, images,
// signatures, shapes, highlights and freehand ink; then rotate / reorder / delete pages.
// Coordinates arrive in PDF user space (the editor converts with pdf.js
// viewport.convertToPdfPoint), so they are correct for any page box or rotation.
import { readFile } from 'node:fs/promises'
import { BlendMode, LineCapStyle, PDFDocument, degrees, rgb } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { fontSet, printable } from '../lib/fonts.js'
import { emit, hexToRgb01, renameExt } from '../lib/util.js'

const color = (hex) => {
  const { r, g, b } = hexToRgb01(hex)
  return rgb(r, g, b)
}

/** Where to anchor a box so that, drawn with the page's rotation, it looks upright. */
export function uprightBox([x, y, w, h], rotation) {
  switch (rotation) {
    case 90:
      return { x: x + w, y, width: h, height: w, rotate: degrees(90) }
    case 180:
      return { x: x + w, y: y + h, width: w, height: h, rotate: degrees(180) }
    case 270:
      return { x, y: y + h, width: h, height: w, rotate: degrees(270) }
    default:
      return { x, y, width: w, height: h, rotate: degrees(0) }
  }
}

const norm = ([x, y, w, h]) => [w < 0 ? x + w : x, h < 0 ? y + h : y, Math.abs(w), Math.abs(h)]

export async function loadPdf(path) {
  try {
    return await PDFDocument.load(await readFile(path), { updateMetadata: false })
  } catch (err) {
    if (/encrypted/i.test(err.message)) throw new ToolError('PDF_ENCRYPTED', 'PDF parol bilan himoyalangan. Avval himoyani olib taşlang.')
    throw new ToolError('PDF_INVALID', 'PDF faylni oçib bölmadi — u şikastlangan bölişi mumkin.')
  }
}

async function drawTextOp(page, op, font) {
  const rotation = op.angle ?? page.getRotation().angle
  const f = await font({ family: op.font, bold: op.bold, italic: op.italic })
  const text = printable(f, op.text)
  page.drawText(text, {
    x: op.x,
    y: op.y,
    size: op.size,
    font: f,
    color: color(op.color),
    opacity: op.opacity,
    lineHeight: op.size * (op.lineHeight ?? 1.2),
    rotate: degrees(rotation),
  })
}

export async function applyOperations(doc, operations, progress) {
  const font = fontSet(doc)
  const pages = doc.getPages()
  const images = new Map()

  for (const [i, op] of operations.entries()) {
    if (i % 25 === 0) progress?.(10 + (70 * i) / operations.length, 'Özgarişlar qöllanmoqda')
    const page = pages[op.page]
    if (!page) throw new ToolError('BAD_OPERATION', `${op.page + 1}-sahifa mavjud emas`)
    const rotation = page.getRotation().angle

    switch (op.type) {
      case 'replace': {
        const [x, y, w, h] = norm(op.rect)
        page.drawRectangle({ x, y, width: w, height: h, color: color(op.cover), borderWidth: 0 })
        if (op.text.trim()) await drawTextOp(page, op, font)
        break
      }
      case 'text':
        await drawTextOp(page, op, font)
        break
      case 'whiteout': {
        const [x, y, w, h] = norm(op.rect)
        page.drawRectangle({ x, y, width: w, height: h, color: color(op.color), borderWidth: 0 })
        break
      }
      case 'highlight': {
        const [x, y, w, h] = norm(op.rect)
        page.drawRectangle({ x, y, width: w, height: h, color: color(op.color), opacity: op.opacity, blendMode: BlendMode.Multiply, borderWidth: 0 })
        break
      }
      case 'rect':
      case 'ellipse': {
        const [x, y, w, h] = norm(op.rect)
        const style = {
          color: op.fill ? color(op.fill) : undefined,
          borderColor: op.stroke ? color(op.stroke) : undefined,
          borderWidth: op.stroke ? op.strokeWidth : 0,
          opacity: op.opacity,
          borderOpacity: op.opacity,
        }
        if (op.type === 'rect') page.drawRectangle({ x, y, width: w, height: h, ...style })
        else page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, ...style })
        break
      }
      case 'line': {
        const c = color(op.color)
        page.drawLine({ start: { x: op.from[0], y: op.from[1] }, end: { x: op.to[0], y: op.to[1] }, thickness: op.width, color: c, opacity: op.opacity, lineCap: LineCapStyle.Round })
        if (op.arrow) {
          const ang = Math.atan2(op.to[1] - op.from[1], op.to[0] - op.from[0])
          const len = Math.max(8, op.width * 4)
          const p = (a) => `${op.to[0] - len * Math.cos(ang + a)} ${-(op.to[1] - len * Math.sin(ang + a))}`
          page.drawSvgPath(`M ${op.to[0]} ${-op.to[1]} L ${p(0.45)} L ${p(-0.45)} Z`, { x: 0, y: 0, color: c, opacity: op.opacity, borderWidth: 0 })
        }
        break
      }
      case 'ink': {
        // drawSvgPath flips y around its origin; feed it (x, −y) so points stay in user space
        const d = op.points.map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(2)} ${(-y).toFixed(2)}`).join(' ')
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: color(op.color), borderWidth: op.width, borderOpacity: op.opacity, borderLineCap: LineCapStyle.Round })
        break
      }
      case 'image': {
        let img = images.get(op.src)
        if (!img) {
          const [, kind, b64] = op.src.match(/^data:image\/(png|jpeg);base64,(.*)$/s)
          const bytes = Buffer.from(b64, 'base64')
          img = kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
          images.set(op.src, img)
        }
        page.drawImage(img, { ...uprightBox(norm(op.rect), rotation), opacity: op.opacity })
        break
      }
      default:
        throw new ToolError('BAD_OPERATION', `Nomaʼlum amal: ${op.type}`)
    }
  }
}

/** Build the final page list: order, duplicates, deletions and rotation. */
export async function arrangePages(doc, plan) {
  const count = doc.getPageCount()
  for (const p of plan) if (p.src >= count) throw new ToolError('BAD_OPERATION', `${p.src + 1}-sahifa mavjud emas`)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(
    doc,
    plan.map((p) => p.src),
  )
  copied.forEach((page, i) => {
    const r = plan[i].rotate ?? 0
    if (r) page.setRotation(degrees((page.getRotation().angle + r) % 360))
    out.addPage(page)
  })
  out.setTitle(doc.getTitle() ?? '')
  out.setProducer('QalamAI')
  return out
}

export async function run({ inputs: [input], options, outDir }, { progress }) {
  progress(5, 'PDF oçilmoqda')
  let doc = await loadPdf(input.path)
  if (options.operations.length) await applyOperations(doc, options.operations, progress)
  if (options.pages) {
    progress(85, 'Sahifalar tartiblanmoqda')
    doc = await arrangePages(doc, options.pages)
  }
  progress(92, 'Saqlanmoqda')
  doc.setProducer('QalamAI')
  doc.setModificationDate(new Date())
  const bytes = await doc.save({ useObjectStreams: true })
  return {
    outputs: [await emit(outDir, renameExt(input.name, 'pdf'), bytes)],
    summary: { operations: options.operations.length, pages: doc.getPageCount() },
  }
}
