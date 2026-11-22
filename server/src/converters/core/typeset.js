// A small typesetter: HTML (from DOCX via mammoth, Markdown, TXT, HTML) → paginated PDF.
// Handles headings, paragraphs with mixed bold/italic/underline, justification,
// first-line indents, nested lists, block quotes, tables, images and page numbers —
// with Unicode fonts so Uzbek Latin (oʻ, gʻ, ʼ) and Cyrillic print correctly.
// Portable: fonts and odd image formats come from the platform (server or browser).
import { PDFDocument, rgb } from 'pdf-lib'
import { parse } from 'node-html-parser'
import { fontSet, printable } from './fonts.js'
import { fromBase64 } from './util.js'

const CM = 28.3465
const BLACK = rgb(0, 0, 0)
const LINK = rgb(0.06, 0.32, 0.73)
const GRID = rgb(0.25, 0.25, 0.28)

export const PRESETS = {
  // O‘zbekiston OTMlari: A4, chap 3 sm, o‘ng 1.5 sm, yuqori/pastki 2 sm, 1.5 interval, xatboshi 1.25 sm
  academic: { margins: { top: 2 * CM, right: 1.5 * CM, bottom: 2 * CM, left: 3 * CM }, lineHeight: 1.5, indent: 1.25 * CM, justify: true, pageNumbers: true },
  plain: { margins: { top: 2 * CM, right: 2 * CM, bottom: 2 * CM, left: 2 * CM }, lineHeight: 1.35, indent: 0, justify: false, pageNumbers: false },
}

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'blockquote', 'pre', 'hr', 'section', 'article', 'main', 'header', 'footer', 'body', 'html', 'figure', 'figcaption'])

const alignOf = (el, fallback) => el.getAttribute?.('style')?.match(/text-align:\s*(left|center|right|justify)/i)?.[1]?.toLowerCase() ?? (el.getAttribute?.('align') || fallback)

/** Inline content → styled runs. '\n' runs are hard line breaks. */
function inlineRuns(node, style = {}, out = []) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const t = child.text.replace(/\s+/g, ' ')
      if (t) out.push({ text: t, ...style })
      continue
    }
    if (child.nodeType !== 1) continue
    const tag = child.rawTagName?.toLowerCase()
    if (tag === 'br') out.push({ text: '\n', ...style })
    else if (tag === 'img') continue
    else if (tag === 'b' || tag === 'strong') inlineRuns(child, { ...style, bold: true }, out)
    else if (tag === 'i' || tag === 'em') inlineRuns(child, { ...style, italic: true }, out)
    else if (tag === 'u') inlineRuns(child, { ...style, underline: true }, out)
    else if (tag === 'a') inlineRuns(child, { ...style, link: true, underline: true }, out)
    else if (tag === 'sup' || tag === 'sub') inlineRuns(child, { ...style, small: true }, out)
    else if (tag === 'code') inlineRuns(child, { ...style, mono: true }, out)
    else inlineRuns(child, style, out)
  }
  return out
}

function imagesIn(node) {
  return node.querySelectorAll('img').map((img) => ({ src: img.getAttribute('src') ?? '', alt: img.getAttribute('alt') ?? '' }))
}

/** Flatten the DOM into typesetting blocks. */
export function toBlocks(html) {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, pre: true } })
  const blocks = []
  const walk = (node, ctx) => {
    let inline = []
    const flush = () => {
      if (inline.some((r) => r.text.trim())) blocks.push({ type: 'p', runs: inline, align: ctx.align, quote: ctx.quote, center: ctx.titul })
      inline = []
    }
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (child.text.trim()) inline.push({ text: child.text.replace(/\s+/g, ' ') })
        continue
      }
      if (child.nodeType !== 1) continue
      const tag = child.rawTagName?.toLowerCase()
      if (!BLOCK.has(tag) && tag !== 'img') {
        inlineRuns({ childNodes: [child] }, {}, inline)
        continue
      }
      flush()
      const align = alignOf(child, ctx.align)
      const titul = ctx.titul || /\btitul\b/.test(child.getAttribute?.('class') ?? '')
      if (/^h[1-6]$/.test(tag)) blocks.push({ type: 'h', level: Math.min(3, Number(tag[1])), runs: inlineRuns(child), align })
      else if (tag === 'p' || tag === 'figcaption') {
        blocks.push({ type: 'p', runs: inlineRuns(child), align, quote: ctx.quote, center: titul, hint: /\bhint\b/.test(child.getAttribute?.('class') ?? '') })
        for (const img of imagesIn(child)) blocks.push({ type: 'img', ...img })
      } else if (tag === 'img') blocks.push({ type: 'img', src: child.getAttribute('src') ?? '' })
      else if (tag === 'hr') blocks.push({ type: /\bpb\b/.test(child.getAttribute('class') ?? '') ? 'pagebreak' : 'hr' })
      else if (tag === 'ul' || tag === 'ol') {
        let n = Number(child.getAttribute('start')) || 1
        for (const li of child.childNodes.filter((c) => c.rawTagName?.toLowerCase() === 'li')) {
          const nested = li.childNodes.filter((c) => ['ul', 'ol'].includes(c.rawTagName?.toLowerCase()))
          const own = { childNodes: li.childNodes.filter((c) => !nested.includes(c)) }
          blocks.push({ type: 'li', runs: inlineRuns(own), marker: tag === 'ol' ? `${n++}.` : ['•', '◦', '▪'][ctx.depth % 3], depth: ctx.depth })
          for (const sub of nested) walk({ childNodes: [sub] }, { ...ctx, depth: ctx.depth + 1 })
        }
      } else if (tag === 'table') {
        const rows = child.querySelectorAll('tr').map((tr) =>
          tr.childNodes
            .filter((c) => ['td', 'th'].includes(c.rawTagName?.toLowerCase()))
            .map((c) => ({ runs: inlineRuns(c, c.rawTagName.toLowerCase() === 'th' ? { bold: true } : {}), head: c.rawTagName.toLowerCase() === 'th' })),
        )
        if (rows.length) blocks.push({ type: 'table', rows, borderless: /\b(toc|info)\b/.test(child.getAttribute('class') ?? '') })
      } else if (tag === 'pre') blocks.push({ type: 'pre', text: child.text })
      else if (tag === 'blockquote') walk(child, { ...ctx, quote: true })
      else walk(child, { ...ctx, align, titul })
    }
    flush()
  }
  walk(root, { align: undefined, quote: false, depth: 0, titul: false })
  return blocks
}

export async function typeset(html, { family = 'serif', size = 14, preset = 'academic', title } = {}, platform) {
  const P = PRESETS[preset]
  const doc = await PDFDocument.create()
  doc.setProducer('QalamAI')
  if (title) doc.setTitle(title)
  const font = fontSet(doc, platform.font)
  const [PW, PH] = [595.28, 841.89]
  const M = P.margins
  const width = PW - M.left - M.right
  let page
  let y = 0

  const newPage = () => {
    page = doc.addPage([PW, PH])
    y = PH - M.top
  }
  newPage()

  /** Break styled runs into lines that fit `maxW`. */
  async function layout(runs, { size: sz, bold = false, italic = false, maxW, firstIndent = 0 }) {
    const tokens = []
    for (const r of runs) {
      const f = await font({ family: r.mono ? 'sans' : family, bold: bold || r.bold, italic: italic || r.italic })
      const s = r.small ? sz * 0.75 : sz
      if (r.text === '\n') {
        tokens.push({ br: true })
        continue
      }
      const parts = printable(f, r.text).split(/( )/)
      for (const p of parts) {
        if (p === ' ') {
          if (tokens.length && !tokens.at(-1).br) tokens.at(-1).space = true
          continue
        }
        if (!p) continue
        // glue to the previous token when there was no space between runs (e.g. **bo**ld)
        const prev = tokens.at(-1)
        const tok = { text: p, font: f, size: s, w: f.widthOfTextAtSize(p, s), underline: r.underline, color: r.link ? LINK : r.hint ? rgb(0.42, 0.45, 0.5) : BLACK }
        if (prev && !prev.space && !prev.br && prev.text) tok.glued = true
        tokens.push(tok)
      }
    }
    const lines = []
    let line = { items: [], w: 0, spaces: 0 }
    let avail = maxW - firstIndent
    const spaceW = (t) => t.font.widthOfTextAtSize(' ', t.size)
    for (const t of tokens) {
      if (t.br) {
        lines.push({ ...line, hard: true })
        line = { items: [], w: 0, spaces: 0 }
        avail = maxW
        continue
      }
      const prev = line.items.at(-1)
      const gap = prev && !t.glued ? spaceW(prev) : 0
      if (line.items.length && line.w + gap + t.w > avail) {
        lines.push(line)
        line = { items: [], w: 0, spaces: 0 }
        avail = maxW
      }
      // a single word wider than the line: split it by characters
      if (!line.items.length && t.w > avail) {
        let chunk = ''
        for (const ch of t.text) {
          if (t.font.widthOfTextAtSize(chunk + ch, t.size) > avail && chunk) {
            lines.push({ items: [{ ...t, text: chunk, w: t.font.widthOfTextAtSize(chunk, t.size), gap: 0 }], w: t.font.widthOfTextAtSize(chunk, t.size), spaces: 0 })
            chunk = ''
            avail = maxW
          }
          chunk += ch
        }
        const w = t.font.widthOfTextAtSize(chunk, t.size)
        line = { items: [{ ...t, text: chunk, w, gap: 0 }], w, spaces: 0 }
        continue
      }
      const g = line.items.length && !t.glued ? spaceW(prev) : 0
      line.items.push({ ...t, gap: g })
      line.w += g + t.w
      if (g) line.spaces++
    }
    if (line.items.length) lines.push({ ...line, last: true })
    if (lines.length) lines.at(-1).last = true
    return lines
  }

  function drawLines(lines, { x, maxW, sz, align, firstIndent = 0, lh }) {
    lines.forEach((line, i) => {
      const lineH = Math.max(sz, ...line.items.map((t) => t.size)) * lh
      if (y - lineH < M.bottom) newPage()
      y -= lineH
      const indent = i === 0 ? firstIndent : 0
      const room = maxW - indent
      let cx = x + indent
      let extra = 0
      if (align === 'center') cx += (room - line.w) / 2
      else if (align === 'right') cx += room - line.w
      else if (align === 'justify' && !line.last && !line.hard && line.spaces > 0) extra = (room - line.w) / line.spaces
      const base = y + lineH * 0.22
      for (const t of line.items) {
        cx += t.gap + (t.gap ? extra : 0)
        page.drawText(t.text, { x: cx, y: base, size: t.size, font: t.font, color: t.color })
        if (t.underline) page.drawLine({ start: { x: cx, y: base - t.size * 0.12 }, end: { x: cx + t.w, y: base - t.size * 0.12 }, thickness: Math.max(0.5, t.size / 18), color: t.color })
        cx += t.w
      }
    })
  }

  async function paragraph(runs, { sz = size, bold, italic, align, indent = 0, firstIndent = 0, before = 0, after = 0, lh = P.lineHeight, transform } = {}) {
    if (!runs.some((r) => r.text.trim() || r.text === '\n')) return
    const rr = transform ? runs.map((r) => ({ ...r, text: transform(r.text) })) : runs
    y -= before
    const maxW = width - indent
    const lines = await layout(rr, { size: sz, bold, italic, maxW, firstIndent })
    drawLines(lines, { x: M.left + indent, maxW, sz, align, firstIndent, lh })
    y -= after
  }

  async function image(src) {
    const m = src.match(/^data:image\/([a-z+]+);base64,(.+)$/s)
    if (!m) return
    let bytes = fromBase64(m[2])
    let kind = m[1]
    if (kind !== 'png' && kind !== 'jpeg' && kind !== 'jpg') {
      bytes = await platform.toPng(bytes)
      if (!bytes) return
      kind = 'png'
    }
    const img = kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    let w = img.width * 0.75
    let h = img.height * 0.75
    const k = Math.min(1, width / w, (PH - M.top - M.bottom) * 0.8 / h)
    w *= k
    h *= k
    if (y - h - 6 < M.bottom) newPage()
    y -= h + 6
    page.drawImage(img, { x: M.left + (width - w) / 2, y, width: w, height: h })
    y -= 6
  }

  async function table(rows, borderless) {
    const cols = Math.max(...rows.map((r) => r.length))
    const sz = size * 0.86
    const pad = 4
    // column widths proportional to content length, clamped
    const len = Array(cols).fill(1)
    for (const r of rows) r.forEach((c, i) => (len[i] = Math.max(len[i], Math.min(60, c.runs.map((x) => x.text).join('').length))))
    const total = len.reduce((a, b) => a + b, 0)
    const widths = len.map((l) => Math.max(36, (l / total) * width))
    const k = width / widths.reduce((a, b) => a + b, 0)
    for (let i = 0; i < cols; i++) widths[i] *= k
    y -= 4
    for (const r of rows) {
      const laid = await Promise.all(widths.map((w, i) => (r[i] ? layout(r[i].runs, { size: sz, maxW: w - pad * 2 }) : [])))
      const rowH = Math.max(sz * 1.3, ...laid.map((ls) => ls.reduce((h, l) => h + Math.max(sz, ...l.items.map((t) => t.size)) * 1.25, 0))) + pad * 2
      if (y - rowH < M.bottom) newPage()
      let x = M.left
      const top = y
      for (let i = 0; i < cols; i++) {
        if (!borderless) page.drawRectangle({ x, y: top - rowH, width: widths[i], height: rowH, borderColor: GRID, borderWidth: 0.6 })
        const saveY = y
        y = top - pad
        drawLines(laid[i], { x: x + pad, maxW: widths[i] - pad * 2, sz, align: i === cols - 1 && borderless ? 'right' : 'left', lh: 1.25 })
        y = saveY
        x += widths[i]
      }
      y = top - rowH
    }
    y -= 8
  }

  const academic = preset === 'academic'
  const blocks = toBlocks(html)
  for (const b of blocks) {
    switch (b.type) {
      case 'h': {
        const scale = academic ? [0, 16 / 14, 1, 1][b.level] : [0, 1.6, 1.3, 1.12][b.level]
        if (y < M.bottom + size * 4) newPage() // keep a heading with what follows
        await paragraph(b.runs, {
          sz: size * scale,
          bold: true,
          italic: academic && b.level === 3,
          align: b.align ?? (academic && b.level === 1 ? 'center' : 'left'),
          before: size * (b.level === 1 ? 0.6 : 0.9),
          after: size * 0.5,
          lh: 1.3,
          transform: academic && b.level === 1 ? (t) => t.toLocaleUpperCase('uz') : undefined,
        })
        break
      }
      case 'p': {
        const align = b.center ? 'center' : b.align ?? (P.justify ? 'justify' : 'left')
        await paragraph(b.runs.map((r) => ({ ...r, hint: b.hint })), {
          align,
          italic: b.quote || b.hint,
          indent: b.quote ? 1 * CM : 0,
          firstIndent: b.center || b.quote || align === 'center' ? 0 : P.indent,
          after: academic ? 0 : size * 0.45,
        })
        break
      }
      case 'li':
        await paragraph([{ text: `${b.marker} ` }, ...b.runs], { align: 'left', indent: (b.depth + 1) * 0.75 * CM, after: size * 0.15 })
        break
      case 'pre':
        await paragraph(b.text.split('\n').flatMap((l, i) => (i ? [{ text: '\n' }, { text: l || ' ', mono: true }] : [{ text: l || ' ', mono: true }])), { sz: size * 0.82, align: 'left', lh: 1.25, after: size * 0.4 })
        break
      case 'img':
        await image(b.src)
        break
      case 'table':
        await table(b.rows, b.borderless)
        break
      case 'hr':
        y -= size * 0.5
        page.drawLine({ start: { x: M.left, y }, end: { x: PW - M.right, y }, thickness: 0.6, color: GRID })
        y -= size * 0.5
        break
      case 'pagebreak':
        newPage()
        break
    }
  }

  if (P.pageNumbers) {
    const f = await font({ family })
    doc.getPages().forEach((pg, i) => {
      if (i === 0) return // the title page is counted but not numbered
      const label = String(i + 1)
      const w = f.widthOfTextAtSize(label, 11)
      pg.drawText(label, { x: (PW - w) / 2, y: M.bottom / 2 - 4, size: 11, font: f, color: BLACK })
    })
  }
  return doc.save({ useObjectStreams: true })
}
