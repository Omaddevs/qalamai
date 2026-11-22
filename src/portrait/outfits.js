// Clothes drawn as SVG over the person: a suit, shirt, tie, turtleneck… shaped to the body that
// analysis found. Everything is drawn in the body frame: origin under the chin (neck centre),
// one unit = the eye distance, y down. Two layers: `back` goes behind the person (collar backs,
// a stand-in for the neck below a T-shirt's neckline), `front` over them.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/** #rrggbb → [r, g, b] */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
/** Lighter (k > 0) or darker (k < 0) version of a colour. */
export const shade = (h, k) => toHex(rgb(h).map((v) => (k > 0 ? v + (255 - v) * k : v * (1 + k))))
const lum = (h) => {
  const [r, g, b] = rgb(h)
  return (0.3 * r + 0.59 * g + 0.11 * b) / 255
}

export const JACKETS = {
  navy: '#1d2840',
  charcoal: '#36393f',
  black: '#141518',
  grey: '#6a6e75',
  beige: '#b39a78',
  brown: '#57402f',
  burgundy: '#5a1e2a',
  white: '#e9e6e0',
}
export const SHIRTS = { white: '#f3f4f6', blue: '#cddff1', pink: '#f1d9dc', black: '#1a1b1e', grey: '#c9ccd1' }
export const TIES = { navy: '#1c2a4d', burgundy: '#6a1626', black: '#121316', silver: '#8b9098', green: '#29473a', blue: '#2a4f8f', gold: '#a3823b' }
export const KNITS = { black: '#17181b', charcoal: '#3a3c41', camel: '#b08d62', cream: '#e6dfd1', navy: '#1f2a42' }
export const TOPS = { white: '#f2f2f0', black: '#18191b', cream: '#ece3d3', blush: '#e8c9c3', sky: '#cfe0ee' }

/**
 * Outfits: which pieces each one has. `jacket` / `shirt` / `tie` / `knit` / `top` name the colour
 * option that applies; `fit` narrows the shoulders a little for a women's cut.
 */
export const OUTFITS = {
  keep: {},
  suit: { jacket: 'navy', shirt: 'white', tie: 'burgundy' },
  suitOpen: { jacket: 'charcoal', shirt: 'white' },
  shirt: { shirt: 'white', tie: null, bare: true },
  turtleneck: { knit: 'black' },
  blazerKnit: { jacket: 'charcoal', knit: 'black' },
  blazerTop: { jacket: 'black', top: 'white', fit: 0.9 },
}

/* ───────── shapes (body units) ───────── */

const f = (v) => Math.round(v * 1000) / 1000
const pt = (x, y) => `${f(x)},${f(y)}`
/** Mirror a path given for the right half (x > 0) to the left half. */
const mirror = (fn) => [fn(1), fn(-1)]

/**
 * A whole torso shape: neckline from the left neck point to the right one (`neckline`, default a
 * straight line), down the right shoulder and arm, across the bottom, up the left side.
 */
function torso(S, nw, neckY, slope, neckline = `L${pt(nw, neckY)}`) {
  return `M${pt(-nw, neckY)} ${neckline} ${shoulderPath(1, S, nw, { neckY, slope }).replace(/^L\S+ /, '')} L${pt(-(S + 0.48), 16)} ${reverseShoulder(S, nw, neckY, slope)} Z`
}

/** Shoulder line of a garment, right side going out: neck point → over the trapezius → down the arm. */
function shoulderPath(s, S, nw, { neckY, slope = 1, pad = 0 }) {
  const x = (v) => v * s
  const top = 1.45 + (1 - slope) * 0.25 - pad * 0.1
  return [
    `L${pt(x(nw), neckY)}`,
    `C${pt(x(nw + 0.62), neckY + 0.18)} ${pt(x(S - 0.7), top - 0.48)} ${pt(x(S + 0.02), top)}`,
    `Q${pt(x(S + 0.36 + pad * 0.05), top + 0.1)} ${pt(x(S + 0.4 + pad * 0.05), top + 0.85)}`,
    `L${pt(x(S + 0.48), 16)}`,
  ].join(' ')
}

/** Jacket front panel (right or left): lapel edge from the collar down to the button, out to the shoulder. */
function jacketPanel(s, S, nw, B) {
  const x = (v) => v * s
  return [
    `M${pt(x(nw + 0.14), 0.6)}`,
    `C${pt(x(nw + 0.58), 1.6)} ${pt(x(0.72), 3.3)} ${pt(x(0.02), B)}`,
    `L${pt(x(-0.22), B + 0.35)} L${pt(x(-0.22), 16)}`,
    `L${pt(x(S + 0.5), 16)} L${pt(x(S + 0.42), 2.3)}`,
    `Q${pt(x(S + 0.4), 1.52)} ${pt(x(S + 0.06), 1.4)}`,
    `C${pt(x(S - 0.6), 0.98)} ${pt(x(nw + 0.68), 0.6)} ${pt(x(nw + 0.4), 0.42)}`,
    'Z',
  ].join(' ')
}

/** Lapel + upper collar of one side. */
function lapelPath(s, nw, B, notch = true) {
  const x = (v) => v * s
  const peak = notch
    ? `L${pt(x(1.78), 2.02)} L${pt(x(1.47), 1.9)} L${pt(x(1.58), 1.66)}`
    : `Q${pt(x(1.7), 1.8)} ${pt(x(1.4), 1.5)}`
  return [
    `M${pt(x(nw + 0.14), 0.6)}`,
    `C${pt(x(nw + 0.58), 1.6)} ${pt(x(0.72), 3.3)} ${pt(x(0.02), B)}`,
    `C${pt(x(0.85), B - 0.9)} ${pt(x(1.5), 3.0)} ${pt(x(1.8), 2.1)}`,
    peak,
    `Q${pt(x(nw + 0.8), 0.98)} ${pt(x(nw + 0.4), 0.42)}`,
    'Z',
  ].join(' ')
}

/** Shirt collar leaf (spread collar), one side. */
function collarLeaf(s, nw, spread = 1) {
  const x = (v) => v * s
  return [
    `M${pt(x(0.02), 0.97)}`,
    `Q${pt(x(nw * 0.8), 0.9)} ${pt(x(nw + 0.03), 0.34)}`,
    `Q${pt(x(nw + 0.42), 0.46)} ${pt(x(nw + 0.5), 0.98)}`,
    `L${pt(x(0.58 + 0.34 * spread), 1.62 + 0.14 * (1 - spread))}`,
    `L${pt(x(0.3), 1.3)}`,
    `Q${pt(x(0.13), 1.12)} ${pt(x(0.02), 0.97)}`,
    'Z',
  ].join(' ')
}

/** The collar's top edge round the neck (for its contact shadow). */
const collarTopEdge = (nw) => `M${pt(-(nw + 0.03), 0.34)} Q${pt(-nw * 0.8, 0.9)} ${pt(0, 0.97)} Q${pt(nw * 0.8, 0.9)} ${pt(nw + 0.03, 0.34)}`

const tieKnot = () => `M${pt(-0.27, 0.9)} L${pt(0.27, 0.9)} Q${pt(0.25, 1.25)} ${pt(0.15, 1.5)} L${pt(-0.16, 1.5)} Q${pt(-0.25, 1.25)} ${pt(-0.27, 0.9)} Z`
const tieBlade = () => `M${pt(-0.16, 1.46)} L${pt(0.15, 1.46)} L${pt(0.45, 5.4)} L${pt(0, 5.8)} L${pt(-0.45, 5.4)} Z`

/* ───────── SVG pieces ───────── */

function defs(id, j) {
  // filters in body units: soft shadows a garment casts on what's under it
  return `<defs>
<filter id="${id}sh" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.07"/><feOffset dx="0.03" dy="0.07" result="o"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${id}sh2" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.13"/><feOffset dx="0.05" dy="0.1"/><feComponentTransfer><feFuncA type="linear" slope="0.6"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${id}bl"><feGaussianBlur stdDeviation="0.09"/></filter>
<filter id="${id}soft"><feGaussianBlur stdDeviation="0.035"/></filter>
<filter id="${id}bl2"><feGaussianBlur stdDeviation="0.22"/></filter>
<filter id="${id}nz" filterUnits="userSpaceOnUse" x="-8" y="-1" width="16" height="18"><feTurbulence type="fractalNoise" baseFrequency="34" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 -0.62"/></filter>
<linearGradient id="${id}lr" gradientUnits="userSpaceOnUse" x1="-4" y1="0" x2="4" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="${j ? 0.1 : 0.14}"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.26"/></linearGradient>
<linearGradient id="${id}tb" gradientUnits="userSpaceOnUse" x1="0" y1="0.5" x2="0" y2="9"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.32"/></linearGradient>
<radialGradient id="${id}sl" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1.6"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}v" gradientUnits="userSpaceOnUse" x1="0" y1="0.8" x2="0" y2="5"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient>
<linearGradient id="${id}tie" gradientUnits="userSpaceOnUse" x1="-0.45" y1="0" x2="0.45" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="0.38" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.04"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient>
<linearGradient id="${id}knot" gradientUnits="userSpaceOnUse" x1="0" y1="0.9" x2="0" y2="1.5"><stop offset="0" stop-color="#fff" stop-opacity="0.14"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient>
<pattern id="${id}rib" patternUnits="userSpaceOnUse" width="0.11" height="1"><rect width="0.05" height="1" fill="#000" opacity="0.16"/></pattern>
<pattern id="${id}twill" patternUnits="userSpaceOnUse" width="0.06" height="0.06" patternTransform="rotate(35)"><rect width="0.025" height="0.06" fill="#fff" opacity="0.035"/></pattern>
</defs>`
}

/** Light and shade over a filled shape (the shape is given again as a clip). */
function lighting(id, clip, { shoulders = [], S, folds = true, color = '#333333' }) {
  // fabric grain: plain darkening specks, much lighter on pale cloth where they'd show as dirt
  const grain = f(0.05 + 0.45 * (1 - lum(color)) ** 1.5)
  return `<g clip-path="url(#${clip})">
<rect x="-8" y="-1" width="16" height="18" filter="url(#${id}nz)" opacity="${grain}"/>
${folds ? mirror((s) => `<path d="M${pt(s * (S - 0.25), 2.3)} Q${pt(s * (S - 0.9), 3.1)} ${pt(s * 1.55, 3.9)}" stroke="#000" stroke-opacity="0.22" stroke-width="0.2" fill="none" filter="url(#${id}bl2)"/><path d="M${pt(s * (S - 0.3), 2.05)} Q${pt(s * (S - 1), 2.8)} ${pt(s * 1.65, 3.5)}" stroke="#fff" stroke-opacity="0.07" stroke-width="0.14" fill="none" filter="url(#${id}bl)"/>`).join('') : ''}
<rect x="-8" y="-1" width="16" height="18" fill="url(#${id}lr)"/>
<rect x="-8" y="-1" width="16" height="18" fill="url(#${id}tb)"/>
${shoulders.map(([cx, cy]) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.6" fill="url(#${id}sl)"/>`).join('')}
${S ? mirror((s) => `<path d="M${pt(s * (S - 0.12), 1.55)} Q${pt(s * (S - 0.42), 3)} ${pt(s * (S - 0.36), 9)}" stroke="#000" stroke-opacity="0.35" stroke-width="0.12" fill="none" filter="url(#${id}bl)"/>`).join('') : ''}
</g>`
}

function shirtPieces(id, o, nw, { tie, bare, S }) {
  const shirt = o.shirt
  const dark = lum(shirt) < 0.25
  const out = []
  // body of the shirt (shoulders too, for a shirt worn on its own)
  // its neckline follows the collar round the neck, so the neck shows inside the collar
  const body = torso(S, nw + 0.03, 0.34, 0.85, `Q${pt(-nw * 0.8, 0.9)} ${pt(0, 0.97)} Q${pt(nw * 0.8, 0.9)} ${pt(nw + 0.03, 0.34)}`)
  out.push(`<clipPath id="${id}shc"><path d="${body}"/></clipPath>`)
  out.push(`<path d="${body}" fill="${shirt}"/>`)
  if (bare) {
    // a shirt on its own: placket, buttons, folds
    out.push(`<g clip-path="url(#${id}shc)">
<rect x="-0.17" y="0.9" width="0.34" height="15" fill="${shade(shirt, dark ? 0.06 : -0.03)}"/>
<path d="M${pt(-0.17, 0.95)} L${pt(-0.17, 16)} M${pt(0.17, 0.95)} L${pt(0.17, 16)}" stroke="${shade(shirt, dark ? 0.12 : -0.14)}" stroke-width="0.022"/>
${[1.75, 3.2, 4.65].map((y) => `<circle cx="0" cy="${y}" r="0.075" fill="${shade(shirt, dark ? 0.2 : -0.08)}" stroke="${shade(shirt, dark ? 0.3 : -0.22)}" stroke-width="0.015"/>`).join('')}
${mirror((s) => `<path d="M${pt(s * 1.3, 1.6)} Q${pt(s * 1.05, 3.2)} ${pt(s * 1.25, 5.5)}" stroke="#000" stroke-opacity="0.1" stroke-width="0.25" fill="none" filter="url(#${id}bl2)"/><path d="M${pt(s * (nw + 0.55), 0.72)} Q${pt(s * 2.1, 1.3)} ${pt(s * (S - 0.1), 1.55)}" stroke="${shade(shirt, dark ? 0.1 : -0.12)}" stroke-width="0.025" fill="none"/>`).join('')}
</g>`)
    out.push(lighting(id, `${id}shc`, { shoulders: [[-(S - 0.4), 1.6], [S - 0.4, 1.6]], S, color: shirt }))
  } else {
    // only the V shows under the jacket: shade it deeper towards the bottom
    out.push(`<path d="${body}" fill="url(#${id}v)"/>`)
    if (!tie) {
      out.push(`<rect x="-0.16" y="0.95" width="0.32" height="15" fill="${shade(shirt, dark ? 0.05 : -0.03)}"/>`)
      out.push(`<path d="M${pt(-0.16, 1)} L${pt(-0.16, 16)} M${pt(0.16, 1)} L${pt(0.16, 16)}" stroke="${shade(shirt, dark ? 0.12 : -0.13)}" stroke-width="0.02"/>`)
      out.push([1.18, 2.6, 4].map((y) => `<circle cx="0" cy="${y}" r="0.07" fill="${shade(shirt, dark ? 0.2 : -0.07)}" stroke="${shade(shirt, dark ? 0.3 : -0.2)}" stroke-width="0.014"/>`).join(''))
    }
  }
  return out.join('\n')
}

/** Left half of a shoulder line, coming back up to the neck (to close a shape). */
function reverseShoulder(S, nw, neckY, slope) {
  const top = 1.45 + (1 - slope) * 0.25
  return [
    `L${pt(-(S + 0.4), top + 0.85)}`,
    `Q${pt(-(S + 0.36), top + 0.1)} ${pt(-(S + 0.02), top)}`,
    `C${pt(-(S - 0.7), top - 0.48)} ${pt(-(nw + 0.62), neckY + 0.18)} ${pt(-nw, neckY)}`,
  ].join(' ')
}

function collarPieces(id, shirt, nw, spread) {
  const dark = lum(shirt) < 0.25
  const edge = shade(shirt, dark ? 0.16 : -0.16)
  return `<path d="${collarTopEdge(nw)}" stroke="#000" stroke-opacity="0.3" stroke-width="0.2" fill="none" filter="url(#${id}bl)" transform="translate(0,-0.06)"/>
<g filter="url(#${id}sh)">${mirror((s) => `<path d="${collarLeaf(s, nw, spread)}" fill="${shirt}" stroke="${edge}" stroke-width="0.018"/>`).join('')}</g>
${mirror((s) => `<path d="M${pt(s * (nw + 0.07), 0.45)} Q${pt(s * (nw + 0.38), 0.56)} ${pt(s * (nw + 0.42), 0.98)} L${pt(s * (0.55 + 0.34 * spread), 1.52)}" stroke="${edge}" stroke-opacity="0.55" stroke-width="0.012" stroke-dasharray="0.035 0.025" fill="none"/><path d="${collarLeaf(s, nw, spread)}" fill="url(#${id}knot)" opacity="0.5"/>`).join('')}`
}

function tiePieces(id, color) {
  return `<g filter="url(#${id}sh)">
<path d="${tieBlade()}" fill="${color}"/><path d="${tieBlade()}" fill="url(#${id}tie)"/>
<path d="${tieBlade()}" fill="url(#${id}twill)"/>
<ellipse cx="0" cy="1.62" rx="0.08" ry="0.2" fill="#000" opacity="0.35" filter="url(#${id}bl)"/>
<path d="${tieKnot()}" fill="${color}"/><path d="${tieKnot()}" fill="url(#${id}knot)"/><path d="${tieKnot()}" fill="url(#${id}twill)"/>
<path d="M${pt(-0.2, 0.98)} Q${pt(0.02, 1.2)} ${pt(0.1, 1.48)}" stroke="#000" stroke-opacity="0.22" stroke-width="0.035" fill="none"/>
</g>`
}

function jacketPieces(id, color, S, nw, B) {
  const dark = lum(color) < 0.2
  const panels = mirror((s) => jacketPanel(s, S, nw, B))
  const lapels = mirror((s) => lapelPath(s, nw, B))
  const line = shade(color, dark ? 0.12 : -0.3)
  return `<clipPath id="${id}jc">${panels.map((p) => `<path d="${p}"/>`).join('')}</clipPath>
<g filter="url(#${id}sh2)">${panels.map((p) => `<path d="${p}" fill="${color}"/>`).join('')}</g>
<g clip-path="url(#${id}jc)"><rect x="-8" y="-1" width="16" height="18" fill="url(#${id}twill)"/></g>
${lighting(id, `${id}jc`, { shoulders: [[-(S - 0.45), 1.55], [S - 0.45, 1.55]], S, color })}
<g clip-path="url(#${id}jc)">${mirror((s) => `<path d="M${pt(s * 1.8, 2.1)} C${pt(s * 1.5, 3)} ${pt(s * 0.85, B - 0.9)} ${pt(s * 0.02, B)}" stroke="#000" stroke-opacity="0.45" stroke-width="0.14" fill="none" filter="url(#${id}bl)" transform="translate(${f(s * 0.05)},0.04)"/>`).join('')}</g>
${lapels.map((p) => `<path d="${p}" fill="${shade(color, dark ? 0.05 : 0.04)}"/><path d="${p}" fill="url(#${id}lr)" opacity="0.8"/>`).join('')}
${mirror((s) => `<path d="M${pt(s * (nw + 0.16), 0.66)} C${pt(s * (nw + 0.58), 1.62)} ${pt(s * 0.72, 3.3)} ${pt(s * 0.04, B)}" stroke="#fff" stroke-opacity="${dark ? 0.14 : 0.18}" stroke-width="0.03" fill="none"/>
<path d="M${pt(s * 1.47, 1.9)} L${pt(s * (nw + 0.62), 1.02)}" stroke="${line}" stroke-width="0.022" opacity="0.7"/>
<path d="M${pt(s * 1.62, 2.28)} C${pt(s * 1.35, 3)} ${pt(s * 0.82, B - 0.95)} ${pt(s * 0.08, B - 0.12)}" stroke="${line}" stroke-opacity="0.35" stroke-width="0.012" stroke-dasharray="0.03 0.03" fill="none"/>`).join('')}
<path d="M${pt(1.18, 2.62)} L${pt(1.42, 2.52)}" stroke="${line}" stroke-width="0.035" stroke-linecap="round" opacity="0.8"/>
<g clip-path="url(#${id}jc)"><path d="M${pt(1.95, 4.15)} L${pt(2.95, 3.98)}" stroke="${line}" stroke-width="0.05" opacity="0.65"/><path d="M${pt(1.95, 4.2)} L${pt(2.95, 4.03)}" stroke="#fff" stroke-opacity="0.08" stroke-width="0.03"/></g>`
}

function knitPieces(id, color, S, nw) {
  const dark = lum(color) < 0.2
  const body = torso(S, nw + 0.1, 0.42, 0.7)
  // the rolled collar, a tube round the neck seen from the front: its top edge dips in the middle
  const w0 = nw + 0.16
  const w1 = nw + 0.24
  const tube = `M${pt(-w0, -0.02)} Q${pt(0, 0.5)} ${pt(w0, -0.02)} L${pt(w1, 0.72)} Q${pt(0, 1.22)} ${pt(-w1, 0.72)} Z`
  const fold = `M${pt(-w0, 0.2)} Q${pt(0, 0.7)} ${pt(w0, 0.2)}`
  return `<clipPath id="${id}kc"><path d="${body}"/></clipPath>
<clipPath id="${id}tc"><path d="${tube}"/></clipPath>
<path d="${body}" fill="${color}"/>
${lighting(id, `${id}kc`, { shoulders: [[-(S - 0.5), 1.6], [S - 0.5, 1.6]], S, color })}
<g filter="url(#${id}sh)"><path d="${tube}" fill="${shade(color, dark ? 0.05 : 0.03)}"/></g>
<g clip-path="url(#${id}tc)">
<rect x="-3" y="-1" width="6" height="3" fill="url(#${id}rib)" opacity="0.9"/>
<rect x="-3" y="-1" width="6" height="3" fill="url(#${id}lr)"/>
<path d="${fold}" stroke="#000" stroke-opacity="0.35" stroke-width="0.12" fill="none" filter="url(#${id}bl)" transform="translate(0,0.08)"/>
<path d="${fold}" stroke="#fff" stroke-opacity="${dark ? 0.1 : 0.16}" stroke-width="0.06" fill="none" filter="url(#${id}bl)" transform="translate(0,-0.04)"/>
<rect x="-3" y="-1" width="6" height="3" filter="url(#${id}nz)" opacity="${f(0.1 + 0.4 * (1 - lum(color)))}"/>
</g>
<path d="M${pt(-w0, -0.02)} Q${pt(0, 0.5)} ${pt(w0, -0.02)}" stroke="#000" stroke-opacity="0.45" stroke-width="0.14" fill="none" filter="url(#${id}bl)" transform="translate(0,-0.07)"/>
<path d="M${pt(-w1, 0.72)} Q${pt(0, 1.22)} ${pt(w1, 0.72)}" stroke="#000" stroke-opacity="0.3" stroke-width="0.08" fill="none" filter="url(#${id}bl)" transform="translate(0,0.07)"/>`
}

function topPieces(id, color, S, nw) {
  // a plain crew-neck top: its neckline sits at the base of the neck, with a narrow binding
  const neck = 0.95
  const body = torso(S, nw + 0.25, 0.55, 0.85, `Q${pt(0, neck + 0.55)} ${pt(nw + 0.25, 0.55)}`)
  const dark = lum(color) < 0.2
  return `<clipPath id="${id}pc"><path d="${body}"/></clipPath>
<path d="M${pt(-(nw + 0.25), 0.5)} Q${pt(0, neck + 0.5)} ${pt(nw + 0.25, 0.5)}" stroke="#000" stroke-opacity="0.35" stroke-width="0.14" fill="none" filter="url(#${id}bl)"/>
<path d="${body}" fill="${color}"/>
${lighting(id, `${id}pc`, { S, folds: true, color })}
<g clip-path="url(#${id}pc)">
<path d="M${pt(-(nw + 0.25), 0.62)} Q${pt(0, neck + 0.62)} ${pt(nw + 0.25, 0.62)}" stroke="${shade(color, dark ? 0.14 : -0.1)}" stroke-width="0.1" fill="none"/>
<path d="M${pt(-(nw + 0.25), 0.69)} Q${pt(0, neck + 0.69)} ${pt(nw + 0.25, 0.69)}" stroke="#000" stroke-opacity="0.18" stroke-width="0.05" fill="none" filter="url(#${id}bl)"/>
<path d="${body}" fill="url(#${id}v)"/>
</g>`
}

/* ───────── assembly ───────── */

/**
 * SVG layers for an outfit. `g` is the body geometry (from core.bodyGeometry) and `t` maps the
 * body frame into the output: { tx, ty, k } (translate, then scale by k = eye distance in px).
 * Returns { back, front } SVG documents of size W×H, or null for "keep my clothes".
 */
export function outfitSvg(g, choice, W, H, t) {
  const o = OUTFITS[choice.outfit]
  if (!o || !Object.keys(o).length) return null
  const id = 'q'
  const fit = o.fit ?? 1
  const S = g.S * fit
  const nw = clamp(g.nw, 0.62, 0.98)
  const B = 4.6
  // only the pieces this outfit has (the colour choices for the others stay remembered)
  const shirt = o.shirt ? SHIRTS[choice.shirt] ?? SHIRTS[o.shirt] : null
  const tie = o.tie && choice.tie !== 'none' ? TIES[choice.tie] ?? TIES[o.tie] : null
  const jacket = o.jacket ? JACKETS[choice.jacket] ?? JACKETS[o.jacket] : null
  const knit = o.knit ? KNITS[choice.knit] ?? KNITS[o.knit] : null
  const top = o.top ? TOPS[choice.top] ?? TOPS[o.top] : null
  const skin = choice.skin

  const back = []
  const front = []
  if (jacket) {
    // the jacket's collar seen round the back of the neck
    back.push(`<path d="M${pt(-(nw + 0.44), 0.8)} Q${pt(-(nw + 0.32), 0.26)} ${pt(-(nw - 0.2), 0.22)} L${pt(nw - 0.2, 0.22)} Q${pt(nw + 0.32, 0.26)} ${pt(nw + 0.44, 0.8)} Z" fill="${shade(jacket, -0.25)}"/>`)
  }
  if (shirt) {
    // the inside of the shirt collar behind the neck
    back.push(`<path d="M${pt(-(nw + 0.14), 0.75)} Q${pt(-(nw + 0.1), 0.28)} ${pt(-(nw - 0.25), 0.25)} L${pt(nw - 0.25, 0.25)} Q${pt(nw + 0.1, 0.28)} ${pt(nw + 0.14, 0.75)} Z" fill="${shade(shirt, lum(shirt) < 0.25 ? 0.06 : -0.12)}"/>`)
  }

  // where the photo's own neck stops (a T-shirt's neckline) it goes on in the skin's colour, in
  // front of the collar backs (it is the neck)
  back.push(`<linearGradient id="${id}nk" gradientUnits="userSpaceOnUse" x1="${-nw}" y1="0" x2="${nw}" y2="0"><stop offset="0" stop-color="${shade(skin, -0.38)}"/><stop offset="0.2" stop-color="${shade(skin, -0.08)}"/><stop offset="0.45" stop-color="${skin}"/><stop offset="0.8" stop-color="${shade(skin, -0.12)}"/><stop offset="1" stop-color="${shade(skin, -0.42)}"/></linearGradient>`)
  // a neck's shape: tucked in under the jaw at the top, a little wider where it meets the shoulders
  const n0 = Math.max(0.08, Math.min(g.neckEnd, ...(g.neckEnds ?? [])) - 0.3)
  const nf = nw + 0.05
  const neck = `M${pt(-nf * 0.75, n0 + 0.16)} Q${pt(0, n0 - 0.12)} ${pt(nf * 0.75, n0 + 0.16)} L${pt(nf, n0 + 0.55)} L${pt(nf + 0.3, 2.2)} L${pt(-(nf + 0.3), 2.2)} L${pt(-nf, n0 + 0.55)} Z`
  back.push(`<linearGradient id="${id}nd" gradientUnits="userSpaceOnUse" x1="0" y1="${f(n0)}" x2="0" y2="2"><stop offset="0" stop-color="#000" stop-opacity="0.2"/><stop offset="0.12" stop-color="#000" stop-opacity="0.03"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient>`)
  back.push(`<g filter="url(#${id}soft)"><path d="${neck}" fill="url(#${id}nk)"/><path d="${neck}" fill="url(#${id}nd)"/></g>`)

  if (shirt) {
    front.push(shirtPieces(id, { shirt }, nw, { tie, bare: o.bare, S }))
    if (tie) front.push(tiePieces(id, tie))
    front.push(collarPieces(id, shirt, nw, tie ? 1 : 0.8))
  }
  if (knit) front.push(knitPieces(id, knit, jacket ? S - 0.08 : S, nw))
  if (top) front.push(topPieces(id, top, S, nw))
  if (jacket) front.push(jacketPieces(id, jacket, S, nw, B))

  const wrap = (parts) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(id, !!jacket)}<g transform="translate(${f(t.tx)},${f(t.ty)}) scale(${f(t.k)})">${parts.join('\n')}</g></svg>`
  return { back: wrap(back), front: wrap(front) }
}

/** Where the photo of the person may show (body frame): the head, and the neck down to the collar. */
export function personClip(g, choice) {
  const o = OUTFITS[choice.outfit]
  if (!o || !Object.keys(o).length) return null
  const nw = clamp(g.nw, 0.62, 0.98)
  // the neck shows down to the garment's own neckline, or to where the photo's bare neck ends
  const low = o.knit ? 0.5 : o.top ? 1.3 : 1.4
  return { neck: nw + 0.06, neckBottom: low }
}
