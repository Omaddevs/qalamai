// Geometry for shape elements and image frames. Every path lives in a 0–100 box and is
// stretched to the element (preserveAspectRatio="none"), so a shape follows its resize handles.

const f = (n) => Math.round(n * 100) / 100

/** Points scaled so their bounding box fills 0–100 on both axes. */
function fit(points) {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const sx = 100 / (Math.max(...xs) - x0)
  const sy = 100 / (Math.max(...ys) - y0)
  return points.map(([x, y]) => [(x - x0) * sx, (y - y0) * sy])
}

const pathOf = (points) => `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')}Z`

/** Regular polygon with n corners, the first one on top. */
function polygon(n, rot = -90) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180
    return [Math.cos(a), Math.sin(a)]
  })
  return pathOf(fit(pts))
}

/** Star with n points; `inner` = inner radius / outer radius. */
function star(n, inner, rot = -90) {
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? inner : 1
    const a = ((rot + (i * 180) / n) * Math.PI) / 180
    return [r * Math.cos(a), r * Math.sin(a)]
  })
  return pathOf(fit(pts))
}

/** A circle with n round scallops (flower / cloud badge). */
function scallop(n, depth = 0.16) {
  const r = 50 - depth * 50
  let d = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
    const am = (a0 + a1) / 2
    const p0 = [50 + r * Math.cos(a0), 50 + r * Math.sin(a0)]
    const p1 = [50 + r * Math.cos(a1), 50 + r * Math.sin(a1)]
    const rc = r + depth * 50 * 2.05
    const c = [50 + rc * Math.cos(am), 50 + rc * Math.sin(am)]
    d += `${i ? '' : `M${f(p0[0])} ${f(p0[1])}`}Q${f(c[0])} ${f(c[1])} ${f(p1[0])} ${f(p1[1])}`
  }
  return `${d}Z`
}

const ELLIPSE = 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z'
const SQUARE = 'M0 0H100V100H0Z'

export const PATHS = {
  square: SQUARE,
  ellipse: ELLIPSE,
  triangle: 'M50 0L100 100H0Z',
  rtriangle: 'M0 0L100 100H0Z',
  diamond: 'M50 0L100 50L50 100L0 50Z',
  pentagon: polygon(5),
  hexagon: 'M25 0H75L100 50L75 100H25L0 50Z',
  octagon: 'M29.3 0H70.7L100 29.3V70.7L70.7 100H29.3L0 70.7V29.3Z',
  star5: star(5, 0.4),
  star6: star(6, 0.55),
  sparkle: 'M50 0C53 33 67 47 100 50C67 53 53 67 50 100C47 67 33 53 0 50C33 47 47 33 50 0Z',
  burst: star(12, 0.78),
  seal: star(24, 0.88),
  heart: 'M50 96C22 74 0 56 0 31C0 13 13 2 28 2C38 2 46 7 50 16C54 7 62 2 72 2C87 2 100 13 100 31C100 56 78 74 50 96Z',
  cross: 'M33 0H67V33H100V67H67V100H33V67H0V33H33Z',
  parallelogram: 'M25 0H100L75 100H0Z',
  trapezoid: 'M22 0H78L100 100H0Z',
  arrowR: 'M0 28H58V0L100 50L58 100V72H0Z',
  arrowL: 'M100 28H42V0L0 50L42 100V72H100Z',
  arrowUp: 'M28 100V42H0L50 0L100 42H72V100Z',
  arrowLR: 'M0 50L28 0V26H72V0L100 50L72 100V74H28V100Z',
  chevron: 'M0 0H68L100 50L68 100H0L32 50Z',
  tag: 'M0 0H74L100 50L74 100H0Z',
  bubble: 'M10 0H90Q100 0 100 10V64Q100 74 90 74H42L20 100V74H10Q0 74 0 64V10Q0 0 10 0Z',
  bubbleRound: 'M50 0C78 0 100 16 100 37C100 58 78 74 50 74C45 74 40 73.6 35.6 72.8L14 96L19 66C7 59 0 49 0 37C0 16 22 0 50 0Z',
  cloud: 'M25 92C11 92 0 81 0 68C0 56 8 47 19 45C19 44 19 42 19 41C19 23 33 9 51 9C64 9 75 17 80 28C91 30 100 40 100 52C100 59 97 64 93 68C97 72 99 77 99 82C99 87 95 92 90 92Z',
  moon: 'M62 2A49 49 0 1 0 98 74A39 39 0 1 1 62 2Z',
  arch: 'M0 100V50A50 50 0 0 1 100 50V100Z',
  semicircle: 'M0 100A50 100 0 0 1 100 100Z',
  quarter: 'M0 0A100 100 0 0 1 100 100H0Z',
  ring: `${ELLIPSE}M50 24A26 26 0 1 0 50 76A26 26 0 1 0 50 24Z`,
  shield: 'M50 0L96 15V45C96 74 76 91 50 100C24 91 4 74 4 45V15Z',
  bolt: 'M62 0L8 58H44L34 100L92 38H55L66 0Z',
  drop: 'M50 0C50 0 88 42 88 63A38 38 0 0 1 12 63C12 42 50 0 50 0Z',
  leaf: 'M0 100C0 42 40 0 100 0C100 60 58 100 0 100Z',
  flower: scallop(8),
  blob1: 'M54 1C74 3 93 15 97 37C101 59 90 83 68 93C46 103 19 97 8 78C-2 60 2 31 17 16C27 6 40 0 54 1Z',
  blob2: 'M30 4C46 -3 64 6 78 12C94 19 102 38 96 56C90 75 78 95 56 98C34 101 12 90 5 70C-2 50 12 12 30 4Z',
  blob3: 'M48 2C62 0 72 10 84 18C96 27 100 44 96 58C92 74 82 90 64 96C46 102 24 96 12 82C0 68 0 48 6 32C13 16 32 4 48 2Z',
  squircle: 'M50 0C90 0 100 10 100 50S90 100 50 100S0 90 0 50S10 0 50 0Z',
  rounded: 'M14 0H86Q100 0 100 14V86Q100 100 86 100H14Q0 100 0 86V14Q0 0 14 0Z',
  pill: 'M50 0A50 50 0 0 1 100 50V50A50 50 0 0 1 50 100A50 50 0 0 1 0 50A50 50 0 0 1 50 0Z',
  archDouble: 'M0 50A50 50 0 0 1 100 50V100H0Z',
}

/** CSS mask (an image frame) from a path id; works in Chromium, Firefox and Safari. */
export function maskCss(id) {
  const d = PATHS[id]
  if (!d) return null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill-rule="evenodd" d="${d}"/></svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return {
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  }
}
