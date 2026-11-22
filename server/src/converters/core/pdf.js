// Opening PDFs and placing images as pages — the shared ground of the PDF tools.
import { PDFDocument } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'

export async function loadPdf(bytes) {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (err) {
    if (/encrypted/i.test(err.message)) throw new ToolError('PDF_ENCRYPTED', 'PDF parol bilan himoyalangan. Avval himoyani olib taşlang.')
    throw new ToolError('PDF_INVALID', 'PDF faylni oçib bölmadi — u şikastlangan bölişi mumkin.')
  }
}

/** Open a tool input as a PDF. */
export const openInput = async (input) => loadPdf(await input.read())

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] }
const MARGINS = { none: 0, small: 24, large: 56 }

/**
 * Add one image as a page. The platform turns the input into an upright PNG (alpha) or JPEG
 * no larger than 3000 px: `{ type: 'png' | 'jpg', bytes }`.
 */
export async function addImagePage(doc, image, { pageSize, orientation, margin }) {
  const embedded = image.type === 'png' ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes)
  const iw = embedded.width
  const ih = embedded.height
  let pw
  let ph
  if (pageSize === 'fit') {
    // 150 dpi feels natural for photos; cap huge images to A3-ish
    const k = Math.min(72 / 150, 1190 / Math.max(iw, ih))
    pw = iw * k + MARGINS[margin] * 2
    ph = ih * k + MARGINS[margin] * 2
  } else {
    ;[pw, ph] = SIZES[pageSize]
    const landscape = orientation === 'landscape' || (orientation === 'auto' && iw > ih)
    if (landscape) [pw, ph] = [ph, pw]
  }
  const m = MARGINS[margin]
  const k = Math.min((pw - m * 2) / iw, (ph - m * 2) / ih)
  const w = iw * k
  const h = ih * k
  const page = doc.addPage([pw, ph])
  page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
}
