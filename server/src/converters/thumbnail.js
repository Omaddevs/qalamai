// Small WebP previews for file cards: first page of a PDF, or the image itself.
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import sharp from 'sharp'
import { closePdf, encodeCanvas, openPdf, renderPage } from './lib/pdfjs.js'

const SIZE = 560

export async function run({ input, out }) {
  await mkdir(dirname(out), { recursive: true })
  if (input.kind === 'pdf') {
    const pdf = await openPdf(input.path)
    try {
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 1 })
      const canvas = await renderPage(pdf, 1, SIZE / Math.max(vp.width, vp.height))
      await sharp(await encodeCanvas(canvas, 'png')).webp({ quality: 80 }).toFile(out)
    } finally {
      await closePdf(pdf)
    }
  } else {
    await sharp(input.path, { failOn: 'none', limitInputPixels: 268_402_689, animated: false })
      .rotate()
      .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(out)
  }
  return { ok: true }
}
