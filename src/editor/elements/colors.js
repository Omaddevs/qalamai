// Small colour helpers for element renderers (tables, charts, mockups).

/** '#abc' / '#aabbcc' / 'rgb(…)' → [r, g, b] or null. */
export function rgbOf(c) {
  if (typeof c !== 'string') return null
  const s = c.trim()
  let m = /^#([0-9a-f]{3})$/i.exec(s)
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16))
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s)
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  m = /^rgba?\(([^)]+)\)$/i.exec(s)
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((v) => Math.round(parseFloat(v)))
    return p.length === 3 && p.every((v) => Number.isFinite(v)) ? p : null
  }
  return null
}

/** The colour with opacity `a` (0–1). */
export function alpha(c, a) {
  const rgb = rgbOf(c)
  if (rgb) return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`
  return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`
}

/** True when the colour is light (dark text reads on it). */
export function isLight(c) {
  const rgb = rgbOf(c)
  if (!rgb) return false
  const [r, g, b] = rgb.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42
}

/** Readable text colour on a fill. */
export const inkOn = (c) => (isLight(c) ? '#111111' : '#ffffff')

/** Default series colours: the design's accent first, then a balanced set. */
export const SERIES = ['#5271ff', '#ff914d', '#00bf63', '#ff66c4', '#ffbd2e', '#0cc0df', '#8c52ff', '#ff5757']

/** Rough distance between two colours (0 = same); unknown colours count as far apart. */
function distance(a, b) {
  const x = rgbOf(a)
  const y = rgbOf(b)
  if (!x || !y) return 999
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

export function seriesColors(el, theme) {
  // the accent leads; palette colours too close to it are skipped so series stay apart
  const base = [theme.accent, ...SERIES.filter((c) => distance(c, theme.accent) > 110)]
  return base.map((c, i) => el.colors?.[i] ?? c)
}
