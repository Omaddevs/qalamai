// "Detach" a structured template page into free elements (the Canva model: a page is a list of
// elements you can move, resize, rotate, restyle, animate). The page is measured as it is drawn,
// so the result looks exactly like the template: every text leaf becomes a text element with its
// computed font, size, colour and box; every painted box (card, dot, bar, rule) becomes a box; image
// frames become image elements. Positions are in % of the page, lengths in cqw (scale-free).
import { newId } from './templates.js'

const TRANSPARENT = /^(transparent|rgba\([^)]*,\s*0\))$/

/** A CSS transform → { rotate } for a plain rotation, or { tf } (flips, skews, scales) drawn as is. */
function transformOf(transform) {
  const m = /^matrix\(([^)]+)\)/.exec(transform || '')
  if (!m) return {}
  const [a, b, c, d] = m[1].split(',').map(Number)
  const r = (v) => Math.round(v * 10000) / 10000
  const len = Math.hypot(a, b)
  // a rotation: orthonormal and not mirrored
  if (Math.abs(len - 1) < 1e-3 && Math.abs(Math.hypot(c, d) - 1) < 1e-3 && Math.abs(a * c + b * d) < 1e-3 && a * d - b * c > 0) {
    const rotate = Math.round(((Math.atan2(b, a) * 180) / Math.PI) * 10) / 10
    return rotate ? { rotate } : {}
  }
  return { tf: `matrix(${r(a)}, ${r(b)}, ${r(c)}, ${r(d)}, 0, 0)` }
}

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'color']
const NOT_COLOR = /^(none|transparent|inherit|currentcolor|url\(|context-)/i

/**
 * An inline SVG → { svg (standalone markup), colors (the distinct colours it paints with) }.
 * It is drawn as an <img> later, so nothing in it can run.
 */
function vectorOf(node, cs) {
  const clone = node.cloneNode(true)
  const w = parseFloat(cs.width)
  const h = parseFloat(cs.height)
  if (!(w > 0) || !(h > 0)) return null
  clone.removeAttribute('style')
  clone.removeAttribute('class')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // sized by the element's frame; without a viewBox the drawing is in the page's CSS pixels
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${Math.round(w * 100) / 100} ${Math.round(h * 100) / 100}`)
    clone.setAttribute('preserveAspectRatio', 'none')
  }
  clone.setAttribute('width', '100%')
  clone.setAttribute('height', '100%')
  const colors = []
  const note = (v) => {
    const c = v?.trim()
    if (c && !NOT_COLOR.test(c) && !colors.includes(c)) colors.push(c)
  }
  for (const n of [clone, ...clone.querySelectorAll('*')]) {
    for (const a of COLOR_ATTRS) {
      const v = n.getAttribute(a)
      if (v && /currentcolor/i.test(v)) n.setAttribute(a, cs.color)
      note(n.getAttribute(a))
    }
  }
  // a drawing that paints with the inherited fill (no attribute at all): make it explicit
  if (!clone.getAttribute('fill') && ![...clone.querySelectorAll('[fill]')].length) {
    clone.setAttribute('fill', cs.fill && !/^url/.test(cs.fill) ? cs.fill : cs.color)
    note(clone.getAttribute('fill'))
  }
  const svg = clone.outerHTML.replace(/currentColor/g, cs.color)
  return { svg, colors }
}

/** Measures and converts a rendered page's nodes into free elements (positions relative to the page). */
function makeWalker(slideEl, out, extra = {}) {
  const root = slideEl.getBoundingClientRect()
  const W = slideEl.offsetWidth || root.width
  const scale = root.width / W // CSS px → screen px (1 unless the canvas is transformed)
  const cq = (px) => Math.round((px / W) * 100 * 1000) / 1000
  const pxToCq = (str) => (!str || str === 'none' ? undefined : str.replace(/(-?\d*\.?\d+)px/g, (_, n) => `${cq(Number(n))}cqw`))

  // frame in % of the page: unrotated size around the drawn centre
  const frame = (node, cs) => {
    const r = node.getBoundingClientRect()
    // SVG elements have no offsetWidth: their own (untransformed) CSS size
    const ow = node.offsetWidth ?? parseFloat(cs?.width)
    const oh = node.offsetHeight ?? parseFloat(cs?.height)
    const w = ow * scale || r.width
    const h = oh * scale || r.height
    const cx = r.left + r.width / 2 - root.left
    const cy = r.top + r.height / 2 - root.top
    return {
      x: ((cx - w / 2) / root.width) * 100,
      y: ((cy - h / 2) / root.height) * 100,
      w: (w / root.width) * 100,
      h: (h / root.height) * 100,
    }
  }

  const paint = (cs) => {
    const p = {}
    if (!TRANSPARENT.test(cs.backgroundColor)) p.bgc = cs.backgroundColor
    if (cs.backgroundImage !== 'none' && cs.webkitBackgroundClip !== 'text' && cs.backgroundClip !== 'text') p.bgi = cs.backgroundImage
    if (cs.borderRadius && cs.borderRadius !== '0px') p.radius = pxToCq(cs.borderRadius)
    if (cs.boxShadow !== 'none') p.shadow = pxToCq(cs.boxShadow)
    if (cs.clipPath && cs.clipPath !== 'none') p.clip = cs.clipPath
    if (cs.backdropFilter && cs.backdropFilter !== 'none') p.backdrop = pxToCq(cs.backdropFilter)
    if (cs.filter && cs.filter !== 'none') p.filter = pxToCq(cs.filter)
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') p.blend = cs.mixBlendMode
    const mask = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage && cs.webkitMaskImage !== 'none' ? cs.webkitMaskImage : null
    if (mask) p.mask = mask
    if (p.bgi) {
      if (cs.backgroundSize && !/^auto( auto)?$/.test(cs.backgroundSize)) p.bgs = pxToCq(cs.backgroundSize)
      if (cs.backgroundPosition && cs.backgroundPosition !== '0% 0%') p.bgp = pxToCq(cs.backgroundPosition)
      if (cs.backgroundRepeat && cs.backgroundRepeat !== 'repeat') p.bgr = cs.backgroundRepeat
    }
    // borders: one for all sides, or each side its own (a rule drawn by one side only)
    const side = (k) => {
      const w = parseFloat(cs[`border${k}Width`])
      const st = cs[`border${k}Style`]
      const c = cs[`border${k}Color`]
      return w > 0 && st !== 'none' && !TRANSPARENT.test(c) ? `${cq(w)}cqw ${st} ${c}` : null
    }
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(side)
    delete p.border
    if (sides.every((x) => x === sides[0])) {
      if (sides[0]) p.border = sides[0]
    } else if (sides.some(Boolean)) {
      p.borders = sides.map((x) => x ?? 'none')
    }
    return p
  }
  const isPainted = (p) => Boolean(p.bgc || p.bgi || p.border || p.borders || p.shadow)

  const isLeaf = (n) =>
    n.childNodes.length > 0 &&
    [...n.childNodes].every((c) => c.nodeType === 3 || c.nodeName === 'BR') &&
    n.textContent.trim().length > 0

  const common = (node, cs) => {
    const f = frame(node, cs)
    const opacity = Number(cs.opacity)
    return { id: newId('el'), ...f, ...transformOf(cs.transform), ...(opacity < 1 ? { opacity } : {}), fromLayout: true, ...extra }
  }

  const textEl = (n, cs) => {
    const size = parseFloat(cs.fontSize)
    const lh = parseFloat(cs.lineHeight)
    const ls = parseFloat(cs.letterSpacing)
    const p = paint(cs)
    const clipText = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text'
    const centered = /center/.test(`${cs.alignItems} ${cs.placeItems}`) && /grid|flex/.test(cs.display)
    const align = /center/.test(`${cs.justifyContent} ${cs.justifyItems}`) && /grid|flex/.test(cs.display) ? 'center' : cs.textAlign === 'start' ? 'left' : cs.textAlign === 'end' ? 'right' : cs.textAlign
    const el = {
      kind: 'text',
      ...common(n, cs),
      text: [...n.childNodes].map((c) => (c.nodeName === 'BR' ? '\n' : c.textContent)).join(''),
      size: cq(size),
      font: cs.fontFamily,
      weight: Number(cs.fontWeight) || 400,
      italic: cs.fontStyle === 'italic',
      color: clipText ? 'transparent' : cs.color,
      align: ['left', 'center', 'right', 'justify'].includes(align) ? align : 'left',
      lh: Number.isFinite(lh) ? Math.round((lh / size) * 100) / 100 : 1.2,
      ls: Number.isFinite(ls) ? Math.round((ls / size) * 1000) / 1000 : 0,
      upper: cs.textTransform === 'uppercase',
      ...(clipText ? { fill: cs.backgroundImage } : {}),
      ...(cs.textShadow !== 'none' ? { tshadow: pxToCq(cs.textShadow) } : {}),
      ...(parseFloat(cs.webkitTextStrokeWidth) > 0 ? { stroke: `${cq(parseFloat(cs.webkitTextStrokeWidth))}cqw ${cs.webkitTextStrokeColor}` } : {}),
      ...(n.dataset.path ? { path: n.dataset.path } : {}),
    }
    if (isPainted(p) || parseFloat(cs.paddingLeft) > 0) {
      Object.assign(el, p, { pad: pxToCq(cs.padding) })
      if (centered) el.vcenter = true
    } else {
      delete el.h // plain text: height follows the text
    }
    el.w += 0.25 // sub-pixel slack, so the same line breaks survive
    return el
  }

  const walk = (n) => {
    for (const c of n.children) {
      const cs = getComputedStyle(c)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      if (c.offsetWidth === 0 && c.offsetHeight === 0 && c.tagName.toLowerCase() !== 'svg') continue

      // image frame (photo or empty placeholder)
      if (c.classList.contains('ly-img')) {
        const inner = c.querySelector('.ly-img-in') ?? c
        const ics = getComputedStyle(inner)
        const img = c.querySelector('img')
        const p = paint(ics)
        out.push({
          kind: 'image',
          ...common(inner, ics),
          src: img?.getAttribute('src') ?? null,
          ...p,
          ...(img && getComputedStyle(img).filter !== 'none' ? { filter: getComputedStyle(img).filter } : {}),
          ...(c.dataset.path ? { path: c.dataset.path } : {}),
        })
        continue
      }
      // drawing / icon → a vector element whose colours can be changed one by one
      if (c.tagName.toLowerCase() === 'svg') {
        const v = vectorOf(c, cs)
        if (v) out.push({ kind: 'vector', ...common(c, cs), ...v })
        continue
      }
      if (isLeaf(c)) {
        out.push(textEl(c, cs))
        continue
      }
      const p = paint(cs)
      if (isPainted(p) && c.offsetWidth > 0 && c.offsetHeight > 0) out.push({ kind: 'box', ...common(c, cs), ...p })
      walk(c)
    }
  }
  return { walk, paint, isPainted, common, frame, root }
}

/**
 * The template's own page content (`.ly-area`).
 * @param {HTMLElement} slideEl  the rendered `.slide` of the page (in the editor canvas)
 * @returns {object[] | null}   elements, in paint order; null when the page has no layout
 */
export function detachPage(slideEl) {
  // structured layouts draw into .ly-area; the classic cover / text page into .s-classic
  const area = slideEl.querySelector('.ly-area') ?? slideEl.querySelector('.s-classic')
  if (!area) return null
  const out = []
  makeWalker(slideEl, out).walk(area)
  return out
}

const near = (a, b, tol) => Math.abs(a - b) <= tol

/**
 * The page's background artwork (`.s-decor`): every card, ring, blob, doodle and frame becomes an
 * element. Layers that fill (nearly) the whole page are background layers (`bg`): they don't catch
 * clicks on the canvas — they are picked from the page background menu or by double-clicking an
 * empty spot. A plain colour that covers the whole page becomes the page colour.
 * @returns {{ bg: string, elements: object[] }}
 */
export function detachDecor(slideEl) {
  const cs0 = getComputedStyle(slideEl)
  let bg = cs0.backgroundImage !== 'none' ? `${cs0.backgroundImage}, ${cs0.backgroundColor}` : cs0.backgroundColor
  const decor = slideEl.querySelector('.s-decor')
  const out = []
  if (!decor) return { bg, elements: out }
  const w = makeWalker(slideEl, out, { decor: true })
  const before = out.length
  w.walk(decor)
  // the decor's root wrappers are walked too: a full-page paint on them is caught below
  const els = out.slice(before)
  const final = []
  for (const el of els) {
    const full = near(el.x, 0, 1) && near(el.y, 0, 1) && el.w >= 98 && el.h >= 98
    const plain = el.kind === 'box' && el.bgc && !el.bgi && !el.border && !el.borders && !el.shadow && !el.filter && !el.radius && !el.tf && el.opacity == null && !/rgba\([^)]*,\s*0?\.\d+\)/.test(el.bgc)
    // an opaque colour across the whole page, under everything drawn so far: the page colour
    if (full && plain && final.every((x) => x.bg)) {
      bg = el.bgc
      final.length = 0
      continue
    }
    const huge = el.w * el.h >= 80 * 80 && el.w >= 85 && el.h >= 80
    final.push(huge ? { ...el, bg: true, locked: true } : el)
  }
  return { bg, elements: final }
}
