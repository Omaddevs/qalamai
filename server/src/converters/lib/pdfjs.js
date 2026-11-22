// pdf.js on the server (worker threads): the logic is portable (core/pdfjs.js); this file
// keeps the path-or-bytes API the tools and tests use.
import { readFile } from 'node:fs/promises'
import * as core from '../core/pdfjs.js'
import { nodePlatform } from './node-platform.js'

export { closePdf, renderPage, pageText, pageImages } from '../core/pdfjs.js'
export const pdfjs = () => nodePlatform.pdfjs()

export async function openPdf(source) {
  const data = typeof source === 'string' ? new Uint8Array(await readFile(source)) : new Uint8Array(source)
  return core.openPdf(data, nodePlatform)
}

/** Canvas → encoded image (png | jpeg | webp). */
export const encodeCanvas = (canvas, format = 'png', quality = 90) => nodePlatform.encodeCanvas(canvas, format, quality).then((b) => Buffer.from(b.buffer, b.byteOffset, b.byteLength))
