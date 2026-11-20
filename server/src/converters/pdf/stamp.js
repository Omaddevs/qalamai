// Watermark and page numbers — positioned in the page as the reader sees it,
// even when the page carries a /Rotate.
import { degrees, rgb } from 'pdf-lib'
import { parsePageRange } from '../../modules/tools/catalog.js'
import { fontSet, printable } from '../lib/fonts.js'
import { emit, hexToRgb01, renameExt } from '../lib/util.js'
import { loadPdf } from './edit.js'

/** Display frame of a page: visible size, display→user mapping, and text angle. */
export function frame(page) {
  const { x: bx, y: by, width: W, height: H } = page.getCropBox?.() ?? page.getMediaBox()
  const rot = ((page.getRotation().angle % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  const toUser = (dx, dy) => {
    switch (rot) {
      case 90:
        return [bx + W - dy, by + dx]
      case 180:
        return [bx + W - dx, by + H - dy]
      case 270:
        return [bx + dy, by + H - dx]
      default:
        return [bx + dx, by + dy]
    }
  }
  return { width: swap ? H : W, height: swap ? W : H, toUser, rot }
}

/** Draw text whose visual centre is at display point (cx, cy), rotated by `angle` on screen. */
function drawCentered(page, fr, text, { font, size, color, opacity, angle = 0 }) {
  const w = font.widthOfTextAtSize(text, size)
  const capH = font.heightAtSize(size, { descender: false }) * 0.72
  const a = (angle * Math.PI) / 180
  // start of the baseline, in display space
  const sx = -w / 2
  const sy = -capH / 2
  const dx = fr.cx + sx * Math.cos(a) - sy * Math.sin(a)
  const dy = fr.cy + sx * Math.sin(a) + sy * Math.cos(a)
  const [x, y] = fr.toUser(dx, dy)
  page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(angle + fr.rot) })
}

export async function watermark({ inputs: [input], options, outDir }, { progress }) {
  const doc = await loadPdf(input.path)
  const font = await fontSet(doc)({ family: 'sans', bold: true })
  const text = printable(font, options.text)
  const { r, g, b } = hexToRgb01(options.color)
  const style = { font, size: options.size, color: rgb(r, g, b), opacity: options.opacity }
  const pages = doc.getPages()
  const pick = parsePageRange(options.pages, pages.length)
  for (const [n, i] of pick.entries()) {
    if (n % 10 === 0) progress(5 + (85 * n) / pick.length, `Sahifa ${i + 1}`)
    const page = pages[i]
    const fr = frame(page)
    if (options.position === 'tile') {
      const w = font.widthOfTextAtSize(text, options.size)
      const stepX = w + options.size * 2.5
      const stepY = options.size * 4
      let row = 0
      for (let y = stepY / 2; y < fr.height + stepY; y += stepY, row++) {
        for (let x = (row % 2) * (stepX / 2); x < fr.width + stepX; x += stepX) {
          drawCentered(page, { ...fr, cx: x, cy: y }, text, { ...style, angle: 30 })
        }
      }
    } else {
      const diag = options.position === 'diagonal' ? (Math.atan2(fr.height, fr.width) * 180) / Math.PI : 0
      drawCentered(page, { ...fr, cx: fr.width / 2, cy: fr.height / 2 }, text, { ...style, angle: diag })
    }
  }
  progress(92, 'Saqlanmoqda')
  return { outputs: [await emit(outDir, renameExt(input.name, 'pdf'), await doc.save({ useObjectStreams: true }))], summary: { pages: pick.length } }
}

export async function pageNumbers({ inputs: [input], options, outDir }, { progress }) {
  const doc = await loadPdf(input.path)
  const font = await fontSet(doc)({ family: 'serif' })
  const pages = doc.getPages()
  const total = pages.length
  const [vert, horiz] = options.position.split('-')
  const margin = 28
  pages.forEach((page, i) => {
    if (i % 20 === 0) progress(5 + (85 * i) / total, `Sahifa ${i + 1}`)
    if (options.skipFirst && i === 0) return
    const n = options.start + i // a skipped title page still counts (kurs ishi convention)
    const last = options.start + total - 1
    const label = options.format === 'n-of-total' ? `${n} / ${last}` : options.format === 'page-n' ? `${n}-bet` : String(n)
    const fr = frame(page)
    const w = font.widthOfTextAtSize(label, options.size)
    const cx = horiz === 'left' ? margin + w / 2 : horiz === 'right' ? fr.width - margin - w / 2 : fr.width / 2
    const cy = vert === 'top' ? fr.height - margin * 0.9 : margin * 0.9
    drawCentered(page, { ...fr, cx, cy }, label, { font, size: options.size, color: rgb(0.1, 0.1, 0.12), opacity: 1 })
  })
  progress(92, 'Saqlanmoqda')
  return { outputs: [await emit(outDir, renameExt(input.name, 'pdf'), await doc.save({ useObjectStreams: true }))], summary: { pages: total } }
}
