// pdf.js (Mozilla) for reading PDFs in Node: text with positions, embedded images,
// and page rendering through @napi-rs/canvas. Runs inside worker threads only.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { ToolError } from '../../lib/errors.js'

const require = createRequire(import.meta.url)
const ROOT = dirname(require.resolve('pdfjs-dist/package.json'))
const dir = (p) => join(ROOT, p) + '/'

let libPromise
export const pdfjs = () => (libPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs'))

export async function openPdf(source) {
  const { getDocument } = await pdfjs()
  const data = typeof source === 'string' ? new Uint8Array(await readFile(source)) : new Uint8Array(source)
  const task = getDocument({
    data,
    standardFontDataUrl: dir('standard_fonts'),
    cMapUrl: dir('cmaps'),
    cMapPacked: true,
    wasmUrl: dir('wasm'),
    iccUrl: dir('iccs'),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    fontExtraProperties: true, // exposes real font names (…-Bold, …Italic)
    verbosity: 0,
  })
  try {
    return await task.promise
  } catch (err) {
    if (err?.name === 'PasswordException') throw new ToolError('PDF_ENCRYPTED', 'PDF parol bilan himoyalangan. Avval himoyani olib taşlang.')
    if (err?.name === 'InvalidPDFException') throw new ToolError('PDF_INVALID', 'PDF fayl şikastlangan yoki notöğri.')
    throw err
  }
}

export async function closePdf(pdf) {
  try {
    await pdf?.loadingTask?.destroy()
  } catch {
    /* already closed */
  }
}

/** Render one page (1-based) to a canvas. `scale` 1 = 72 dpi. */
export async function renderPage(pdf, pageNo, scale, background = '#ffffff') {
  const page = await pdf.getPage(pageNo)
  // keep the bitmap under ~40 MP whatever the page size or dpi
  const base = page.getViewport({ scale: 1 })
  const s = Math.min(scale, Math.sqrt(40e6 / (base.width * base.height)))
  const viewport = page.getViewport({ scale: s })
  const { canvas, context } = pdf.canvasFactory.create(Math.max(1, Math.round(viewport.width)), Math.max(1, Math.round(viewport.height)))
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport, canvas }).promise
  page.cleanup()
  return canvas
}

/** Canvas → encoded image (png | jpeg | webp). */
export async function encodeCanvas(canvas, format = 'png', quality = 90) {
  if (format === 'png') return canvas.encode('png')
  return canvas.encode(format === 'jpg' ? 'jpeg' : format, quality)
}

const fontInfo = (page, fontName, styles) => {
  let name = ''
  let bold = false
  let italic = false
  try {
    const f = page.commonObjs.get(fontName)
    name = f?.name ?? ''
    bold = Boolean(f?.bold || f?.black)
    italic = Boolean(f?.italic)
  } catch {
    /* font not loaded (text-only extraction) */
  }
  const family = styles?.[fontName]?.fontFamily ?? ''
  const clean = name.replace(/^[A-Z]{6}\+/, '')
  return {
    font: clean,
    bold: bold || /bold|black|heavy|semibold|demi/i.test(clean),
    italic: italic || /italic|oblique/i.test(clean),
    serif: family === 'serif' || /times|serif|georgia|garamond|cambria|book|minion|roman/i.test(clean) && !/sans/i.test(clean),
    mono: family === 'monospace' || /courier|mono|consol/i.test(clean),
  }
}

/**
 * Text items of a page in PDF user space.
 * @returns {Promise<{ width: number, height: number, view: number[], items: Array<{ str: string, x: number, y: number, w: number, size: number, angle: number, font: string, bold: boolean, italic: boolean, serif: boolean, mono: boolean }> }>}
 */
export async function pageText(page, { withFonts = true } = {}) {
  if (withFonts) await page.getOperatorList() // loads fonts so their real names are known
  const tc = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false })
  const items = []
  for (const it of tc.items) {
    if (!('str' in it) || !it.str) continue
    const [a, b, c, d, e, f] = it.transform
    const size = Math.hypot(c, d) || Math.hypot(a, b) || 10
    items.push({ str: it.str, x: e, y: f, w: it.width, size, angle: (Math.atan2(b, a) * 180) / Math.PI, ...fontInfo(page, it.fontName, tc.styles) })
  }
  const [x0, y0, x1, y1] = page.view
  return { width: x1 - x0, height: y1 - y0, view: page.view, items }
}

/**
 * Images painted on a page with their placement (user space), as raw pixels.
 * @returns {Promise<Array<{ x: number, y: number, w: number, h: number, width: number, height: number, channels: 1|3|4, data: Uint8Array }>>}
 */
export async function pageImages(page, OPS) {
  const ops = await page.getOperatorList()
  const out = []
  const stack = []
  let ctm = [1, 0, 0, 1, 0, 0]
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  const getObj = (id) =>
    new Promise((resolve) => {
      const objs = id.startsWith('g_') ? page.commonObjs : page.objs
      try {
        objs.get(id, resolve)
      } catch {
        resolve(null)
      }
      setTimeout(() => resolve(null), 5000)
    })

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.transform) ctm = mul(ctm, args)
    else if (fn === OPS.paintFormXObjectBegin && args?.[0]) {
      stack.push(ctm)
      ctm = mul(ctm, args[0])
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const img = fn === OPS.paintImageXObject ? await getObj(args[0]) : args[0]
      if (!img?.data || !img.width || !img.height) continue
      const px = img.width * img.height
      let channels = img.data.length / px
      let data = img.data
      if (img.kind === 1 || channels < 1) {
        // 1 bit per pixel, rows padded to whole bytes → expand to 8-bit gray
        const rowBytes = Math.ceil(img.width / 8)
        const gray = new Uint8Array(px)
        for (let y = 0; y < img.height; y++)
          for (let x = 0; x < img.width; x++) gray[y * img.width + x] = (img.data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0
        data = gray
        channels = 1
      }
      if (![1, 3, 4].includes(channels)) continue
      // the image fills the unit square under the current matrix
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]]
      const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]]
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      out.push({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, width: img.width, height: img.height, channels, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) })
    }
  }
  return out
}
