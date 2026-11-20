// "Detach" a structured template page into free elements (the Canva model: a page is a list of
// elements you can move, resize, rotate, restyle, animate). The page is measured as it is drawn,
// so the result looks exactly like the template: every text leaf becomes a text element with its
// computed font, size, colour and box; every painted box (card, dot, bar, rule) becomes a box; image
// frames become image elements. Positions are in % of the page, lengths in cqw (scale-free).
import { newId } from './templates.js'

const TRANSPARENT = /^(transparent|rgba\([^)]*,\s*0\))$/

function angleOf(transform) {
  const m = /^matrix\(([^)]+)\)/.exec(transform || '')
  if (!m) return 0
  const [a, b] = m[1].split(',').map(Number)
  return Math.round((Math.atan2(b, a) * 180) / Math.PI * 10) / 10
}

/**
 * @param {HTMLElement} slideEl  the rendered `.slide` of the page (in the editor canvas)
 * @returns {object[] | null}   elements, in paint order; null when the page has no layout
 */
export function detachPage(slideEl) {
  const area = slideEl.querySelector('.ly-area')
  if (!area) return null
  const root = slideEl.getBoundingClientRect()
  const W = slideEl.offsetWidth || root.width
  const scale = root.width / W // CSS px → screen px (1 unless the canvas is transformed)
  const cq = (px) => Math.round((px / W) * 100 * 1000) / 1000
  const pxToCq = (str) => (!str || str === 'none' ? undefined : str.replace(/(-?\d*\.?\d+)px/g, (_, n) => `${cq(Number(n))}cqw`))
  const out = []

  // frame in % of the page: unrotated size around the drawn centre
  const frame = (node) => {
    const r = node.getBoundingClientRect()
    const w = node.offsetWidth * scale || r.width
    const h = node.offsetHeight * scale || r.height
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
    const bw = parseFloat(cs.borderTopWidth)
    if (bw > 0 && cs.borderTopStyle !== 'none' && !TRANSPARENT.test(cs.borderTopColor)) p.border = `${cq(bw)}cqw ${cs.borderTopStyle} ${cs.borderTopColor}`
    if (cs.borderRadius && cs.borderRadius !== '0px') p.radius = pxToCq(cs.borderRadius)
    if (cs.boxShadow !== 'none') p.shadow = pxToCq(cs.boxShadow)
    if (cs.clipPath && cs.clipPath !== 'none') p.clip = cs.clipPath
    if (cs.backdropFilter && cs.backdropFilter !== 'none') p.backdrop = pxToCq(cs.backdropFilter)
    return p
  }
  const isPainted = (p) => Boolean(p.bgc || p.bgi || p.border || p.shadow)

  const isLeaf = (n) =>
    n.childNodes.length > 0 &&
    [...n.childNodes].every((c) => c.nodeType === 3 || c.nodeName === 'BR') &&
    n.textContent.trim().length > 0

  const common = (node, cs) => {
    const f = frame(node)
    const rotate = angleOf(cs.transform)
    const opacity = Number(cs.opacity)
    return { id: newId('el'), ...f, ...(rotate ? { rotate } : {}), ...(opacity < 1 ? { opacity } : {}), fromLayout: true }
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
      // icon → a picture of itself, in its own colour
      if (c.tagName.toLowerCase() === 'svg') {
        const clone = c.cloneNode(true)
        clone.setAttribute('color', cs.color)
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clone.outerHTML.replace(/currentColor/g, cs.color))}`
        out.push({ kind: 'image', ...common(c, cs), src, fit: 'contain' })
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
  walk(area)
  return out
}
