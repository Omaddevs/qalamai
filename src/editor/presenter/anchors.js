// What the presenter can talk about and draw on: the "anchors" of a rendered slide.
//
// Anchors are read from the slide's DOM, not from its data, so every layout (classic, structured,
// pro, free canvas) works the same way: a block of text, a picture or a chart, in reading order.
// The AI script refers to them by number; the text is kept beside the number, so a cue still
// finds its anchor after the page was edited (or says nothing rather than drawing in the wrong place).

export const ANCHORS_MAX = 24
const TEXT_MAX = 160

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
/** The text of an element with its pieces kept apart ("Growth" + "Sales" → "Growth Sales"). */
const textOf = (el) => {
  const parts = []
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) parts.push(w.currentNode.textContent)
  return clean(parts.join(' '))
}
// page counters and list numerals ("01", "02") are decoration, not something to talk about
const COUNTER = /^0\d$/
const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && clean(n.textContent).length > 1)

function visible(el, root) {
  const r = el.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return false
  const box = root.getBoundingClientRect()
  // outside the page (overflowing decorations) is not something to point at
  return r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom
}

/**
 * The anchors of a slide element (`.slide`), in reading order:
 * [{ k: 'text'|'image'|'chart', t, el }]. Decorations and page numbers are left out.
 */
export function collectAnchors(slideEl) {
  const root = slideEl?.querySelector('.slide-inner') ?? slideEl
  if (!root) return []
  const out = []
  const area = root.getBoundingClientRect()
  const big = (el, share) => {
    const r = el.getBoundingClientRect()
    return r.width * r.height >= area.width * area.height * share
  }
  const walk = (el) => {
    if (out.length >= ANCHORS_MAX) return
    if (el.matches('.s-decor, .s-num, .ly-photo-scrim, [aria-hidden="true"], script, style')) return
    if (el.matches('.ly-chart')) {
      if (visible(el, root)) out.push({ k: 'chart', t: (textOf(el.querySelector('.ly-chart-text, h3, h4') ?? el) || clean(el.getAttribute('aria-label'))).slice(0, TEXT_MAX), el })
      return
    }
    if (el.matches('.ly-img')) {
      if (!el.matches('.empty') && visible(el, root) && big(el, 0.01)) out.push({ k: 'image', t: clean(el.querySelector('img')?.alt).slice(0, TEXT_MAX), el })
      return
    }
    if (el.tagName === 'IMG') {
      if (!el.matches('.fx-vector') && visible(el, root) && big(el, 0.02)) out.push({ k: 'image', t: clean(el.alt).slice(0, TEXT_MAX), el })
      return
    }
    if (hasOwnText(el)) {
      const t = textOf(el)
      if (t.length > 1 && !COUNTER.test(t) && visible(el, root)) out.push({ k: 'text', t: t.slice(0, TEXT_MAX), el })
      return
    }
    for (const c of el.children) walk(c)
  }
  for (const c of root.children) walk(c)
  return out
}

/** A short fingerprint of what a slide says, to notice a script that no longer matches its page. */
export function sigOf(anchors) {
  let h = 2166136261
  for (const ch of anchors.map((a) => `${a.k}:${a.t}`).join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0).toString(36)
}

/** The anchor a cue means: by number when its text still matches, else by its text. */
export function findAnchor(anchors, { on, ref }) {
  const a = anchors[on]
  if (a && (!ref || a.t === ref)) return a
  if (!ref) return null
  return anchors.find((x) => x.t === ref) ?? anchors.find((x) => x.t && (x.t.startsWith(ref.slice(0, 24)) || ref.startsWith(x.t.slice(0, 24)))) ?? null
}
