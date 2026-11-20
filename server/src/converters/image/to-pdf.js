// Images → PDF (one image per page).
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { baseName } from '../../lib/filetypes.js'
import { emit } from '../lib/util.js'

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] }
const MARGINS = { none: 0, small: 24, large: 56 }

/** Add one image as a page. Photos are embedded as JPEG, graphics with alpha as PNG. */
export async function addImagePage(doc, path, { pageSize, orientation, margin }) {
  const img = sharp(path, { failOn: 'none', limitInputPixels: 268_402_689 }).rotate()
  const meta = await img.metadata()
  const resized = img.resize(3000, 3000, { fit: 'inside', withoutEnlargement: true })
  const embedded = meta.hasAlpha
    ? await doc.embedPng(await resized.png({ compressionLevel: 8 }).toBuffer())
    : await doc.embedJpg(await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer())
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

export async function run({ inputs, options, outDir }, { progress }) {
  const doc = await PDFDocument.create()
  doc.setProducer('QalamAI')
  doc.setTitle(baseName(inputs[0].name))
  for (const [i, input] of inputs.entries()) {
    progress(5 + (88 * i) / inputs.length, `${i + 1} / ${inputs.length}: ${input.name}`)
    await addImagePage(doc, input.path, options)
  }
  progress(95, 'Saqlanmoqda')
  const name = inputs.length === 1 ? `${baseName(inputs[0].name)}.pdf` : `${baseName(inputs[0].name)}-va-boshqalar.pdf`
  return { outputs: [await emit(outDir, name, await doc.save({ useObjectStreams: true }))], summary: { pages: inputs.length } }
}
