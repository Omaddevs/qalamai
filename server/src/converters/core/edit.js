// PDF editing with pdf-lib (portable core): edit existing text (cover + redraw), add text, images,
// signatures, shapes, highlights and freehand ink; then rotate / reorder / delete pages.
// Coordinates arrive in PDF user space (the editor converts with pdf.js
// viewport.convertToPdfPoint), so they are correct for any page box or rotation.
import { BlendMode, LineCapStyle, PDFDocument, PDFHexString, PDFString, degrees, rgb } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { fontSet, printable } from './fonts.js'
import { addImagePage, openInput } from './pdf.js'
import { fromBase64, hexToRgb01, renameExt } from './util.js'

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

async function drawTextOp(page, op, font) {
  const rotation = op.angle ?? page.getRotation().angle
  const f = await font({ family: op.font, bold: op.bold, italic: op.italic })
  const text = printable(f, op.text)
  if (op.align && op.align !== 'left' && text.includes('\n')) {
    // pdf-lib only left-aligns: place each line by hand against the longest one
    const lines = text.split('\n')
    const widths = lines.map((l) => f.widthOfTextAtSize(l, op.size))
    const block = Math.max(...widths)
    const lh = op.size * (op.lineHeight ?? 1.2)
    const rad = (rotation * Math.PI) / 180
    const [cos, sin] = [Math.cos(rad), Math.sin(rad)]
    lines.forEach((line, i) => {
      if (!line) return
      const dx = (block - widths[i]) * (op.align === 'center' ? 0.5 : 1)
      const dy = -i * lh
      page.drawText(line, {
        x: op.x + dx * cos - dy * sin,
        y: op.y + dx * sin + dy * cos,
        size: op.size,
        font: f,
        color: color(op.color),
        opacity: op.opacity,
        rotate: degrees(rotation),
      })
    })
    return
  }
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

export async function applyOperations(doc, operations, progress, platform) {
  const font = fontSet(doc, platform.font)
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
          const bytes = fromBase64(b64)
          img = kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
          images.set(op.src, img)
        }
        page.drawImage(img, { ...uprightBox(norm(op.rect), rotation), opacity: op.opacity })
        break
      }
      case 'link': {
        const [x, y, w, h] = norm(op.rect)
        const annot = doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x, y, x + w, y + h],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(encodeURI(decodeURI(op.url))) },
        })
        page.node.addAnnot(doc.context.register(annot))
        break
      }
      case 'note': {
        const { r, g, b } = hexToRgb01(op.color)
        const annot = doc.context.obj({
          Type: 'Annot',
          Subtype: 'Text',
          Rect: [op.x, op.y - 22, op.x + 22, op.y],
          Contents: PDFHexString.fromText(op.text),
          T: PDFHexString.fromText('QalamAI'),
          Name: 'Comment',
          C: [r, g, b],
          Open: false,
          F: 4, // print
          M: PDFString.fromDate(new Date()),
        })
        page.node.addAnnot(doc.context.register(annot))
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

/** Pages added after the document's own: blank ones, or a page of another input (PDF or image). */
export async function appendPages(doc, append, inputs, platform) {
  const others = new Map()
  for (const a of append) {
    if (a.type === 'blank') {
      doc.addPage([a.width, a.height])
      continue
    }
    const input = inputs[a.file]
    if (!input) throw new ToolError('BAD_OPERATION', 'Qöşiladigan fayl topilmadi')
    if (input.kind === 'image') {
      await addImagePage(doc, await platform.image(input), { pageSize: 'a4', orientation: 'auto', margin: 'small' })
      continue
    }
    if (!others.has(a.file)) others.set(a.file, await openInput(input))
    const other = others.get(a.file)
    if (a.page >= other.getPageCount()) throw new ToolError('BAD_OPERATION', `${a.page + 1}-sahifa mavjud emas`)
    const [copied] = await doc.copyPages(other, [a.page])
    doc.addPage(copied)
  }
}

export async function run({ inputs, options }, { progress, platform }) {
  const [input] = inputs
  if (input.kind !== 'pdf') throw new ToolError('BAD_OPTIONS', 'Birinçi fayl PDF bölişi kerak')
  progress(5, 'PDF oçilmoqda')
  let doc = await openInput(input)
  if (options.append?.length) await appendPages(doc, options.append, inputs, platform)
  if (options.operations.length) await applyOperations(doc, options.operations, progress, platform)
  if (options.pages) {
    progress(85, 'Sahifalar tartiblanmoqda')
    doc = await arrangePages(doc, options.pages)
  }
  progress(92, 'Saqlanmoqda')
  doc.setProducer('QalamAI')
  doc.setModificationDate(new Date())
  const bytes = await doc.save({ useObjectStreams: true })
  return {
    outputs: [{ name: renameExt(input.name, 'pdf'), data: bytes }],
    summary: { operations: options.operations.length, pages: doc.getPageCount() },
  }
}
