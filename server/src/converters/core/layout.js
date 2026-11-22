// Reading-order reconstruction from positioned PDF text:
// items → lines → segments (cells / columns) → paragraphs with headings and lists.

const median = (xs) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Join items that share a baseline into lines, top to bottom. Only roughly horizontal text. */
export function toLines(items) {
  // whitespace items only bridge gaps (pdf.js emits them between cells) — spacing is
  // re-derived from positions in segments(), so they are dropped here
  const horizontal = items.filter((i) => Math.abs(i.angle) < 3 && i.str.trim() !== '')
  horizontal.sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  for (const it of horizontal) {
    const tol = Math.max(1.5, it.size * 0.35)
    let line = null
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) {
      if (Math.abs(lines[i].y - it.y) <= tol) {
        line = lines[i]
        break
      }
    }
    if (!line) {
      line = { y: it.y, items: [] }
      lines.push(line)
    }
    line.items.push(it)
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    line.size = Math.max(...line.items.map((i) => i.size))
    line.x0 = line.items[0].x
    line.x1 = Math.max(...line.items.map((i) => i.x + i.w))
  }
  return lines.sort((a, b) => b.y - a.y)
}

/**
 * Split a line where the horizontal gap is wide — table cells or text columns.
 * Each segment: { x0, x1, text, runs: [{ text, bold, italic, size, serif, font }] }
 */
export function segments(line, gapFactor = 1.6) {
  const segs = []
  let cur = null
  let prevEnd = -Infinity
  let prev = null
  for (const it of splitSpaced(line.items)) {
    const gap = it.x - prevEnd
    if (!cur || gap > Math.max(it.size, prev?.size ?? 0) * gapFactor) {
      cur = { x0: it.x, x1: it.x + it.w, runs: [] }
      segs.push(cur)
    } else if (gap > it.size * 0.12 && !/\s$/.test(prev.str) && !/^\s/.test(it.str)) {
      addRun(cur, ' ', prev)
    }
    addRun(cur, it.str, it)
    cur.x1 = Math.max(cur.x1, it.x + it.w)
    prevEnd = it.x + it.w
    prev = it
  }
  for (const s of segs) {
    s.text = s.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim()
    s.size = Math.max(...s.runs.map((r) => r.size))
  }
  return segs.filter((s) => s.text)
}

/** Some PDFs lay out columns with runs of spaces inside one text object — split those. */
function splitSpaced(items) {
  const out = []
  for (const it of items) {
    if (!/\S\s{2,}\S/.test(it.str)) {
      out.push(it)
      continue
    }
    const charW = it.w / Math.max(1, it.str.length)
    let offset = 0
    for (const part of it.str.split(/(\s{2,})/)) {
      if (part && !/^\s+$/.test(part)) out.push({ ...it, str: part, x: it.x + offset * charW, w: part.length * charW })
      offset += part.length
    }
  }
  return out
}

function addRun(seg, text, it) {
  const last = seg.runs.at(-1)
  if (last && last.bold === it.bold && last.italic === it.italic && Math.abs(last.size - it.size) < 0.5) last.text += text
  else seg.runs.push({ text, bold: it.bold, italic: it.italic, size: it.size, serif: it.serif, font: it.font })
}

/** Plain text of a line, optionally keeping horizontal positions with spaces. */
export function lineText(line, { layout = false, charW } = {}) {
  if (!layout) return segments(line, 3).map((s) => s.text).join('    ')
  const cw = charW ?? line.size * 0.5
  let out = ''
  for (const s of segments(line, 1.6)) {
    const col = Math.max(out.length + (out ? 1 : 0), Math.round(s.x0 / cw))
    out = out.padEnd(col, ' ') + s.text
  }
  return out
}

/**
 * Detect two-column pages: many lines split into a left and a right part around
 * the same gutter. Returns line parts in reading order (left column, then right).
 */
export function readingOrder(lines, pageWidth) {
  const mid = pageWidth / 2
  const parts = lines.map((l) => ({ line: l, segs: segments(l, 2.2) }))
  const twoCol = parts.filter((p) => p.segs.length === 2 && p.segs[0].x1 < mid + 20 && p.segs[1].x0 > mid - 20).length
  if (twoCol < Math.max(4, lines.length * 0.3)) return parts.map((p) => ({ y: p.line.y, size: p.line.size, segs: p.segs }))
  const left = []
  const right = []
  for (const p of parts) {
    for (const s of p.segs) (s.x0 >= mid - 20 ? right : left).push({ y: p.line.y, size: s.size, segs: [s] })
  }
  return [...left, ...right]
}

const BULLET = /^([•●○◦▪■□–—-]|\d{1,3}[.)]|[a-zа-я][.)])\s+/i

/**
 * Group lines into paragraphs. Returns blocks with `kind` heading|paragraph|list,
 * `level` for headings, alignment, and inline runs.
 */
export function toParagraphs(rows, pageWidth, bodySize) {
  const body = bodySize ?? median(rows.flatMap((r) => r.segs.map((s) => s.size)))
  const left = median(rows.map((r) => r.segs[0]?.x0 ?? 0))
  const right = Math.max(...rows.map((r) => r.segs.at(-1)?.x1 ?? 0), pageWidth * 0.6)
  const blocks = []
  let cur = null
  let prevRow = null

  const close = () => {
    if (cur) blocks.push(finish(cur, body, pageWidth, left, right))
    cur = null
  }

  for (const row of rows) {
    const seg = { ...row.segs[0], runs: row.segs.flatMap((s, i) => (i ? [{ ...s.runs[0], text: '    ' }, ...s.runs] : s.runs)) }
    seg.text = row.segs.map((s) => s.text).join('    ')
    seg.x1 = row.segs.at(-1).x1
    const size = seg.size
    const gap = prevRow ? prevRow.y - row.y : 0
    const indent = seg.x0 - left
    const isBullet = BULLET.test(seg.text)
    const sizeChange = cur && Math.abs(size - cur.size) > Math.max(1, cur.size * 0.12)
    const bigGap = prevRow && (gap > Math.max(prevRow.size, size) * 1.75 || gap < 0)
    const prevShort = cur && cur.lastX1 < right - pageWidth * 0.12 && /[.!?:;»"]$/.test(cur.lastText)
    const newIndent = cur && indent > size * 1.2 && cur.lines > 0 && !cur.centered
    const boldFlip = cur && cur.bold !== seg.runs.every((r) => r.bold)

    if (!cur || bigGap || sizeChange || isBullet || prevShort || newIndent || boldFlip) {
      close()
      cur = { size, runs: [], lines: 0, x0: seg.x0, x1: seg.x1, firstIndent: indent, bullet: isBullet, bold: seg.runs.every((r) => r.bold), y: row.y, centered: false, spans: [] }
    } else {
      // join with the previous line: undo end-of-line hyphenation
      const last = cur.runs.at(-1)
      if (last && /[A-Za-zА-Яа-яЎўҚқҒғҲҳʻʼ]-$/.test(last.text) && /^[a-zа-яўқғҳ]/.test(seg.text)) last.text = last.text.slice(0, -1)
      else if (last) last.text += ' '
    }
    for (const r of seg.runs) {
      const last = cur.runs.at(-1)
      if (last && last.bold === r.bold && last.italic === r.italic && Math.abs(last.size - r.size) < 0.5) last.text += r.text
      else cur.runs.push({ ...r })
    }
    cur.lines++
    cur.spans.push([seg.x0, seg.x1])
    cur.x0 = Math.min(cur.x0, seg.x0)
    cur.x1 = Math.max(cur.x1, seg.x1)
    cur.lastX1 = seg.x1
    cur.lastText = seg.text
    prevRow = row
  }
  close()
  return blocks
}

function finish(p, body, pageWidth, left, right) {
  const text = p.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim()
  const centers = p.spans.map(([a, b]) => (a + b) / 2)
  const centerish = centers.every((c) => Math.abs(c - (left + right) / 2) < pageWidth * 0.06)
  const inset = p.spans.every(([a, b]) => a - left > body * 2 && right - b > body * 2)
  const align = centerish && inset ? 'center' : p.spans.every(([a]) => a - left > pageWidth * 0.35) ? 'right' : 'left'
  let kind = 'paragraph'
  let level = 0
  const ratio = p.size / (body || p.size)
  if (p.bullet) kind = 'list'
  else if (text.length < 160 && (ratio >= 1.18 || (p.bold && p.lines <= 2 && text.length < 120 && !/[.,;]$/.test(text)))) {
    kind = 'heading'
    level = ratio >= 1.7 ? 1 : ratio >= 1.3 ? 2 : 3
  }
  // trim leading/trailing whitespace inside runs
  const runs = p.runs.map((r) => ({ ...r, text: r.text.replace(/\s+/g, ' ') }))
  if (runs[0]) runs[0].text = runs[0].text.trimStart()
  if (runs.at(-1)) runs.at(-1).text = runs.at(-1).text.trimEnd()
  return { kind, level, align, size: p.size, text, runs: runs.filter((r) => r.text), y: p.y, firstIndent: p.firstIndent > body * 1.2 && kind === 'paragraph' }
}

export { median }
