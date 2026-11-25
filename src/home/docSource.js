// "Fayldan taqdimot": a PDF / Word / PowerPoint / text file is read here, in the browser, into
// headings and paragraphs. The file itself is never uploaded or stored — not on the server, not in
// this browser's storage; once the deck is built the File object is simply dropped.
// (When the AI backend is connected it receives only this extracted text, never the file.)
import { loadPdfjs, PDF_ASSETS } from '../files/pdfjs.js'

export const ACCEPT = '.pdf,.docx,.pptx,.txt,.md'
export const MAX_MB = 30
const MAX_PAGES = 120
const MAX_CHARS = 400_000 // ≈ 100k tokens — more than any deck needs

export class DocError extends Error {
  constructor(code) {
    super(code)
    this.code = code // 'type' | 'size' | 'empty' | 'read'
  }
}

const clean = (s) => s.replace(/\s+/g, ' ').trim()
const extOf = (name) => name.split('.').pop().toLowerCase()

/**
 * → { name, title, blocks: [{ h: level } | { p: text }], words, pages }
 * blocks: { kind: 'h', level, text } | { kind: 'p', text }
 */
export async function readDocument(file) {
  const ext = extOf(file.name)
  if (!ACCEPT.split(',').includes(`.${ext}`)) throw new DocError('type')
  if (file.size > MAX_MB * 1024 * 1024) throw new DocError('size')
  let out
  try {
    if (ext === 'pdf') out = await readPdf(file)
    else if (ext === 'docx') out = await readDocx(file)
    else if (ext === 'pptx') out = await readPptx(file)
    else out = readText(await file.text(), ext === 'md')
  } catch (e) {
    if (e instanceof DocError) throw e
    throw new DocError('read')
  }
  let chars = 0
  const blocks = []
  for (const b of out.blocks) {
    const text = clean(b.text)
    if (!text) continue
    chars += text.length
    if (chars > MAX_CHARS) break
    blocks.push({ ...b, text })
  }
  const words = blocks.reduce((n, b) => n + b.text.split(' ').length, 0)
  if (words < 20) throw new DocError('empty')
  const name = file.name.replace(/\.[^.]+$/, '')
  // only a real title (PDF metadata, Word's Title style); fileDeck falls back to a lone top heading, then the name
  const title = clean(out.title ?? '') || null
  return { name, fileName: file.name, ext, title, blocks, words, pages: out.pages ?? null }
}

/* ───────── PDF: lines by position, headings by font size ───────── */

async function readPdf(file) {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), ...PDF_ASSETS }).promise
  const lines = []
  const pages = Math.min(doc.numPages, MAX_PAGES)
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n)
    const { items } = await page.getTextContent()
    let cur = null
    for (const it of items) {
      if (!('str' in it)) continue
      const size = Math.hypot(it.transform[0], it.transform[1])
      const y = it.transform[5]
      if (!cur || Math.abs(cur.y - y) > size * 0.6) {
        if (cur && cur.text.trim()) lines.push(cur)
        cur = { text: '', size, y, page: n }
      }
      cur.text += it.str + (it.hasEOL ? ' ' : '')
      cur.size = Math.max(cur.size, size)
    }
    if (cur && cur.text.trim()) lines.push(cur)
    page.cleanup?.()
  }
  const title = (await doc.getMetadata().catch(() => null))?.info?.Title
  doc.destroy?.()
  if (!lines.length) throw new DocError('empty') // a scanned PDF: pictures of text only

  const sizes = lines.map((l) => Math.round(l.size * 10) / 10).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)]
  const blocks = []
  let para = ''
  let prev = null
  const flush = () => {
    if (para.trim()) blocks.push({ kind: 'p', text: para })
    para = ''
  }
  for (const l of lines) {
    const text = clean(l.text)
    if (!text || /^\d{1,4}$/.test(text)) continue // page numbers
    const big = l.size >= body * 1.18
    if (big && text.length <= 110) {
      flush()
      blocks.push({ kind: 'h', level: l.size >= body * 1.6 ? 1 : 2, text })
    } else {
      // a new paragraph after a gap, or after a line that ended a sentence and was short
      const gap = prev && prev.page === l.page && Math.abs(prev.y - l.y) > l.size * 1.9
      if (gap || (para && /[.!?:]$/.test(para.trim()) && prev && clean(prev.text).length < 60)) flush()
      para += (para ? ' ' : '') + text
    }
    prev = l
  }
  flush()
  return { title, blocks, pages: doc.numPages }
}

/* ───────── Word ───────── */

async function readDocx(file) {
  const { default: mammoth } = await import('mammoth/mammoth.browser.js')
  // Word's "Title" style is the document's name, not a section
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { styleMap: ["p[style-name='Title'] => p.doc-title:fresh"] })
  const dom = new DOMParser().parseFromString(value, 'text/html')
  const blocks = []
  let title = null
  for (const el of dom.body.querySelectorAll('h1,h2,h3,h4,p,li')) {
    const text = el.textContent
    if (el.classList.contains('doc-title')) title ??= text
    else if (/^H\d$/.test(el.tagName)) blocks.push({ kind: 'h', level: Number(el.tagName[1]), text })
    else if (el.tagName === 'P' && el.querySelector('strong') && clean(el.textContent) === clean(el.querySelector('strong').textContent) && clean(text).length <= 100)
      blocks.push({ kind: 'h', level: 3, text }) // a bold-only short line works as a heading
    else blocks.push({ kind: 'p', text })
  }
  return { title, blocks }
}

/* ───────── PowerPoint: one section per slide ───────── */

async function readPptx(file) {
  const { unzipSync, strFromU8 } = await import('fflate')
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) })
  const names = Object.keys(zip).sort((a, b) => Number(a.match(/\d+/g).pop()) - Number(b.match(/\d+/g).pop()))
  const blocks = []
  for (const n of names) {
    const xml = new DOMParser().parseFromString(strFromU8(zip[n]), 'application/xml')
    const paras = [...xml.getElementsByTagName('a:p')].map((p) => [...p.getElementsByTagName('a:t')].map((t) => t.textContent).join('')).map(clean).filter(Boolean)
    if (!paras.length) continue
    blocks.push({ kind: 'h', level: 2, text: paras[0] })
    for (const p of paras.slice(1)) blocks.push({ kind: 'p', text: p })
  }
  return { blocks, pages: names.length }
}

/* ───────── plain text and Markdown ───────── */

function readText(text, md) {
  const blocks = []
  const parts = text.replace(/\r/g, '').split(/\n\s*\n/)
  for (const part of parts) {
    const lines = part.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    const head = md ? lines[0].match(/^(#{1,4})\s+(.*)$/) : null
    if (head) {
      blocks.push({ kind: 'h', level: head[1].length, text: head[2] })
      if (lines.length > 1) blocks.push({ kind: 'p', text: lines.slice(1).join(' ').replace(/^[-*]\s+/gm, '') })
    } else if (!md && lines.length === 1 && lines[0].length <= 80 && !/[.!?,;:]$/.test(lines[0])) {
      blocks.push({ kind: 'h', level: 2, text: lines[0] }) // a short line on its own reads as a heading
    } else {
      blocks.push({ kind: 'p', text: lines.join(' ').replace(/(^|\s)[-*•]\s+/g, '$1') })
    }
  }
  return { blocks }
}
