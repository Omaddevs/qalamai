// Downloading a design as a file — entirely in the browser, nothing is sent to the server.
// The chosen pages are rendered off screen at 1920×1080 with the same <Slide> the editor uses,
// captured to canvases (modern-screenshot inlines computed styles and web fonts), then packed:
// PDF (pdf-lib), PPTX (pptxgenjs), PNG / JPG / WebP / SVG (one file, or a ZIP for several pages),
// GIF (gifenc) and MP4 (WebCodecs H.264 + mp4-muxer).
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import Slide from './Slide.jsx'
import { fontSheetsReady, fontsOfSlides, loadFonts } from './fonts.js'

export const W = 1920
export const H = 1080

/* ───────── what this browser can write ───────── */

const canEncode = (type) => {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 2
    return c.toDataURL(type).startsWith(`data:${type}`)
  } catch {
    return false
  }
}

export const supports = {
  webp: () => canEncode('image/webp'),
  mp4: () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function',
}

/* ───────── rendering the pages ───────── */

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))

/** Mount pages off screen; → { pages: HTMLElement[], dispose } */
export async function mount(slides, theme, indexes, watermark) {
  const host = document.createElement('div')
  host.className = 'export-root'
  host.setAttribute('aria-hidden', 'true')
  document.body.append(host)
  const root = createRoot(host)
  flushSync(() =>
    root.render(
      indexes.map((i) => (
        <div key={slides[i].id} className="export-page">
          <Slide slide={slides[i]} theme={theme} index={i} />
          {watermark && <span className="export-wm">qalam ai</span>}
        </div>
      )),
    ),
  )
  for (const img of host.querySelectorAll('img')) img.loading = 'eager'
  // fonts from the catalog: their stylesheets first, or the faces below can't be asked for
  loadFonts(fontsOfSlides(indexes.map((i) => slides[i])))
  await fontSheetsReady()
  // document.fonts.ready doesn't wait for faces nobody has asked for yet: ask for each one in use
  if (document.fonts?.load) {
    const wanted = new Set()
    for (const el of host.querySelectorAll('*')) {
      if (!el.firstChild || el.firstChild.nodeType !== 3) continue
      const cs = getComputedStyle(el)
      wanted.add(`${cs.fontStyle} ${cs.fontWeight} 40px ${cs.fontFamily}`)
    }
    await Promise.all([...wanted].map((f) => document.fonts.load(f).catch(() => null)))
  }
  await document.fonts?.ready
  await Promise.all([...host.querySelectorAll('img')].map((im) => (im.complete ? null : new Promise((r) => (im.onload = im.onerror = r)))))
  await nextFrame()
  await nextFrame()
  return {
    pages: [...host.querySelectorAll('.export-page')],
    dispose() {
      root.unmount()
      host.remove()
    },
  }
}

let shot
const screenshot = () => (shot ??= import('modern-screenshot'))

/* ───────── web fonts ─────────
 * The capture draws an SVG image, which can't reach the page's web fonts: they must be inlined.
 * The Google Fonts stylesheet is cross-origin (its rules can't be read from document.styleSheets),
 * so it is fetched again, cut down to the families / styles the pages use and the Latin + Cyrillic
 * subsets, and every font file is inlined as a data URL. Cached for the session. */

const fontFiles = new Map() // url → Promise<data URL>
let sheetText = null

const SUBSETS = /\/\*\s*(latin|latin-ext|cyrillic|cyrillic-ext)\s*\*\//

let sheetKey = ''
function sheets() {
  // fetched again when fonts were added since (a font picked from the catalog adds a stylesheet)
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')]
  const key = links.map((l) => l.href).join('\n')
  if (key !== sheetKey) {
    sheetKey = key
    sheetText = null
  }
  sheetText ??= Promise.all(
    links.map((l) =>
      fetch(l.href)
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    ),
  ).then((all) => all.join('\n'))
  sheetText.then((t) => !t && (sheetText = null))
  return sheetText
}

const dataUrl = (url) => {
  if (!fontFiles.has(url)) {
    const p = fetch(url)
      .then((r) => r.blob())
      .then((b) => new Promise((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.readAsDataURL(b)
      }))
    p.catch(() => fontFiles.delete(url))
    fontFiles.set(url, p)
  }
  return fontFiles.get(url)
}

const familyOf = (css) => css.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()

/** @font-face CSS (fonts inlined) for what the pages use. */
export async function fontCss(pages) {
  const used = new Set() // "family|style"
  for (const page of pages) {
    for (const el of [page, ...page.querySelectorAll('*')]) {
      const cs = getComputedStyle(el)
      used.add(`${familyOf(cs.fontFamily)}|${cs.fontStyle === 'normal' ? 'normal' : 'italic'}`)
    }
  }
  const css = await sheets()
  const out = []
  // each face: an optional /* subset */ comment, then the @font-face block
  for (const m of css.matchAll(/(\/\*[^*]*\*\/)?\s*@font-face\s*{([^}]*)}/g)) {
    const [, comment = '', body] = m
    if (comment && !SUBSETS.test(comment)) continue
    const fam = body.match(/font-family:\s*([^;]+);/)?.[1]
    const style = body.match(/font-style:\s*([^;]+);/)?.[1]?.trim() ?? 'normal'
    if (!fam || !used.has(`${familyOf(fam)}|${style === 'normal' ? 'normal' : 'italic'}`)) continue
    const url = body.match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, '')
    if (!url) continue
    try {
      out.push(`@font-face{${body.replace(/url\([^)]+\)/, `url(${await dataUrl(url)})`)}}`)
    } catch {
      /* this face stays out; the browser falls back */
    }
  }
  return out.join('\n')
}

export async function capture(page, scale = 1, fonts = '') {
  const { domToCanvas } = await screenshot()
  return domToCanvas(page, { width: W, height: H, scale, backgroundColor: '#ffffff', font: { cssText: fonts } })
}

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`encode ${type}`))), type, quality))
const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer())

/* ───────── names and saving ───────── */

export function fileBase(name) {
  const clean = String(name ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return clean || 'taqdimot'
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function zipped(files) {
  const { zipSync } = await import('fflate')
  const entries = {}
  for (const f of files) entries[f.name] = [f.data, { level: 0 }]
  return new Blob([zipSync(entries)], { type: 'application/zip' })
}

/* ───────── formats ───────── */

const IMAGE = {
  png: { type: 'image/png' },
  jpg: { type: 'image/jpeg', quality: 0.92 },
  webp: { type: 'image/webp', quality: 0.92 },
}

/**
 * Export pages of a deck.
 * @param {{ format: 'pdf'|'pptx'|'png'|'jpg'|'webp'|'svg'|'gif'|'mp4', slides, theme, indexes: number[], name: string,
 *           watermark: boolean, scale?: number, seconds?: number, onProgress?: (done: number, total: number) => void }} job
 * @returns {Promise<{ blob: Blob, name: string }>}
 */
export async function exportDeck({ format, slides, theme, indexes, name, watermark, scale = 1, seconds = 3, onProgress }) {
  const base = fileBase(name)
  const { pages, dispose } = await mount(slides, theme, indexes, watermark)
  const fonts = await fontCss(pages)
  const shoot = (page, scale) => capture(page, scale, fonts)
  const total = pages.length
  const tick = (n) => onProgress?.(n, total)
  tick(0)
  try {
    switch (format) {
      case 'png':
      case 'jpg':
      case 'webp': {
        const { type, quality } = IMAGE[format]
        const files = []
        for (const [k, page] of pages.entries()) {
          const blob = await toBlob(await shoot(page, scale), type, quality)
          files.push({ name: `${base}-${indexes[k] + 1}.${format}`, data: await bytes(blob), blob })
          tick(k + 1)
        }
        if (files.length === 1) return { blob: files[0].blob, name: files[0].name }
        return { blob: await zipped(files), name: `${base}-${format}.zip` }
      }

      case 'svg': {
        // real SVG: the page's markup and styles in a <foreignObject>, fonts embedded — text stays text
        // (domToSvg would only wrap a PNG)
        const { domToForeignObjectSvg } = await screenshot()
        const files = []
        for (const [k, page] of pages.entries()) {
          const svg = await domToForeignObjectSvg(page, { width: W, height: H, backgroundColor: '#ffffff', font: { cssText: fonts } })
          const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`], { type: 'image/svg+xml' })
          files.push({ name: `${base}-${indexes[k] + 1}.svg`, data: await bytes(blob), blob })
          tick(k + 1)
        }
        if (files.length === 1) return { blob: files[0].blob, name: files[0].name }
        return { blob: await zipped(files), name: `${base}-svg.zip` }
      }

      case 'pdf': {
        const { PDFDocument } = await import('pdf-lib')
        const doc = await PDFDocument.create()
        doc.setTitle(base)
        doc.setProducer('QalamAI')
        doc.setCreator('QalamAI')
        // 16 × 9 inches, like the print layout; pages are 2× images so text stays crisp
        const [pw, ph] = [1152, 648]
        for (const [k, page] of pages.entries()) {
          const jpg = await doc.embedJpg(await bytes(await toBlob(await shoot(page, 2), 'image/jpeg', 0.9)))
          doc.addPage([pw, ph]).drawImage(jpg, { x: 0, y: 0, width: pw, height: ph })
          tick(k + 1)
        }
        return { blob: new Blob([await doc.save()], { type: 'application/pdf' }), name: `${base}.pdf` }
      }

      case 'pptx': {
        const { default: PptxGenJS } = await import('pptxgenjs')
        const pptx = new PptxGenJS()
        pptx.layout = 'LAYOUT_WIDE' // 13.333 × 7.5 in, 16:9
        pptx.author = 'QalamAI'
        pptx.title = base
        for (const [k, page] of pages.entries()) {
          const canvas = await shoot(page, 1.5)
          const slide = pptx.addSlide()
          slide.addImage({ data: canvas.toDataURL('image/jpeg', 0.92), x: 0, y: 0, w: 13.333, h: 7.5 })
          // the page's text goes into the speaker notes, so it can still be copied
          const text = page.innerText.replace(/\n{3,}/g, '\n\n').trim()
          if (text) slide.addNotes(text.slice(0, 20_000))
          tick(k + 1)
        }
        const data = await pptx.write({ outputType: 'blob' })
        return { blob: new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), name: `${base}.pptx` }
      }

      case 'gif': {
        const m = await import('gifenc')
        // the ESM build exports names; the CommonJS one hangs them off the default export
        const { GIFEncoder, quantize, applyPalette } = m.GIFEncoder ? m : m.default
        const gif = GIFEncoder()
        const [w, h] = [960, 540]
        for (const [k, page] of pages.entries()) {
          const canvas = await shoot(page, w / W)
          const { data } = canvas.getContext('2d').getImageData(0, 0, w, h)
          const palette = quantize(data, 256)
          gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: seconds * 1000 })
          tick(k + 1)
        }
        gif.finish()
        return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), name: `${base}.gif` }
      }

      case 'mp4':
        return { blob: await video(pages, seconds, tick, shoot), name: `${base}.mp4` }

      default:
        throw new Error(`unknown format ${format}`)
    }
  } finally {
    dispose()
  }
}

/* ───────── MP4: each page for `seconds`, with a short cross-fade ───────── */

export const FPS = 30
const FADE = 0.5 // seconds

export async function encoderConfig() {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    const config = { codec, width: W, height: H, bitrate: 8_000_000, framerate: FPS, avc: { format: 'avc' } }
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return config
    } catch {
      /* try the next profile */
    }
  }
  throw new Error('H.264 encoding is not supported')
}

async function video(pages, seconds, tick, shoot) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const config = await encoderConfig()
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' })
  let failure = null
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) })
  encoder.configure(config)

  const frame = document.createElement('canvas')
  frame.width = W
  frame.height = H
  const ctx = frame.getContext('2d')
  const per = Math.round(seconds * FPS)
  const fade = Math.round(FADE * FPS)
  let n = 0
  let prev = null
  for (const [k, page] of pages.entries()) {
    const cur = await shoot(page, 1)
    for (let f = 0; f < per; f++) {
      if (failure) throw failure
      ctx.globalAlpha = 1
      if (prev && f < fade) {
        ctx.drawImage(prev, 0, 0, W, H)
        ctx.globalAlpha = (f + 1) / fade
      }
      ctx.drawImage(cur, 0, 0, W, H)
      const vf = new VideoFrame(frame, { timestamp: Math.round((n * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
      encoder.encode(vf, { keyFrame: n % (FPS * 2) === 0 })
      vf.close()
      n++
      // don't run ahead of the encoder
      while (encoder.encodeQueueSize > 8 && !failure) await new Promise((r) => setTimeout(r, 4))
    }
    prev = cur
    tick(k + 1)
  }
  await encoder.flush()
  encoder.close()
  if (failure) throw failure
  muxer.finalize()
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}
