// Studio backdrops: a lit spot behind the head fading to darker edges, like a painted canvas
// backdrop with a background light. Drawn as SVG at the output size.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t))

/** [centre, middle, edge] colours; `flat` = one even colour (document photos). */
export const BACKDROPS = {
  studio: { stops: ['#c3c7cc', '#8d9298', '#5b6067'] },
  charcoal: { stops: ['#5d6167', '#2d3034', '#141518'] },
  white: { stops: ['#ffffff', '#f2f3f5', '#dfe2e6'] },
  cream: { stops: ['#f1ebe2', '#d9cfc1', '#b0a390'] },
  blue: { stops: ['#9cc0ea', '#5a8bc6', '#2d5b93'] },
  navy: { stops: ['#45577a', '#232f47', '#111723'] },
  green: { stops: ['#8fa99a', '#56705f', '#2c3d33'] },
  brand: { stops: ['#3a3d33', '#17181a', '#0b0b0d'], glow: '#C6F432' },
  docWhite: { flat: '#ffffff' },
  docBlue: { flat: '#dbe7f5' },
  docGrey: { flat: '#e6e7e9' },
}

/** Stops for a custom colour: lighter in the middle, deeper at the edges. */
export function customStops(hex) {
  return [mix(hex, '#ffffff', 0.28), hex, mix(hex, '#000000', 0.45)]
}

/** The backdrop as an SVG document. `cx`, `cy` = where the light falls (behind the head), in px. */
export function backdropSvg(key, W, H, cx, cy, custom) {
  const b = key === 'custom' ? { stops: customStops(custom) } : BACKDROPS[key] ?? BACKDROPS.studio
  if (b.flat) return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${b.flat}"/></svg>`
  const [c0, c1, c2] = b.stops
  const r = Math.hypot(W, H) * 0.62
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
<radialGradient id="bg" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}" fx="${cx}" fy="${cy}"><stop offset="0" stop-color="${c0}"/><stop offset="0.5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
<radialGradient id="vg" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${H * 0.45}" r="${Math.hypot(W, H) * 0.62}"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient>
${b.glow ? `<radialGradient id="gl" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r * 0.55}"><stop offset="0" stop-color="${b.glow}" stop-opacity="0.22"/><stop offset="1" stop-color="${b.glow}" stop-opacity="0"/></radialGradient>` : ''}
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${b.glow ? `<rect width="${W}" height="${H}" fill="url(#gl)"/>` : ''}
<rect width="${W}" height="${H}" fill="url(#vg)"/>
</svg>`
}

/** Swatch preview for the picker (CSS background). */
export function backdropCss(key, custom) {
  if (key === 'custom') {
    const [a, b, c] = customStops(custom)
    return `radial-gradient(circle at 50% 38%, ${a}, ${b} 55%, ${c})`
  }
  const b = BACKDROPS[key]
  if (!b) return '#ccc'
  if (b.flat) return b.flat
  return `radial-gradient(circle at 50% 38%, ${b.stops[0]}, ${b.stops[1]} 55%, ${b.stops[2]})`
}
