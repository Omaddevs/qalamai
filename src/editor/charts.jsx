// Chart pages beyond the classic columns: horizontal bars, line, area, donut and pie.
// Data is the chart page's own `bars: [{ label, value }]`, so a page can switch kind without losing it.
// Texts (labels, values, legend) are HTML and stay editable; only the marks are SVG, painted with the
// theme's concrete colours (layoutKit palette) so they survive being detached as a vector image.
// Every plot keeps the aspect ratio of its viewBox, so strokes and dots are never stretched.
import { useId } from 'react'
import { Heading, T, fade, mix, palette, solidOf, valueOf } from './layoutKit.jsx'

/** Chart kinds, in menu order. 'bar' is the classic column chart drawn in layouts.jsx. */
export { CHART_KINDS } from '../../shared/slideIcons.js'

const nums = (bars) => bars.map((b) => {
  const v = valueOf(b.value)
  return Number.isFinite(v) ? v : 0
})

/** Text column shared by the side-by-side chart pages. */
function Side({ ctx }) {
  return (
    <div className="ly-chart-text">
      <Heading ctx={ctx} />
      {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-p" />}
    </div>
  )
}

/* ───────── horizontal bars: ranked rows, the leader in the accent ───────── */

function HBars({ ctx }) {
  const bars = ctx.slide.bars ?? []
  const vs = nums(bars)
  const max = Math.max(1e-9, ...vs.map(Math.abs))
  const top = vs.indexOf(Math.max(...vs))
  const { theme } = ctx
  return (
    <div className="ly ly-chart ly-chart-h">
      <Side ctx={ctx} />
      <div className="ly-hbars" style={{ '--n': bars.length }}>
        {bars.map((_, i) => (
          <div key={i} className="ly-hbar">
            <T ctx={ctx} path={`bars.${i}.label`} className="ly-hbar-l" />
            <span className="ly-hbar-track" style={{ background: fade(theme.text, 0.08) }}>
              <span
                className="ly-hbar-fill"
                style={{ width: `${Math.max(1.5, (Math.abs(vs[i]) / max) * 100)}%`, background: i === top ? theme.accent : mix(theme.accent, theme.text, 0.18), opacity: i === top ? 1 : 0.55 }}
              />
            </span>
            <T ctx={ctx} path={`bars.${i}.value`} className="ly-hbar-v" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── line and area: a trend over time ───────── */

const VW = 100
const VH = 58
const PAD = { l: 4, r: 4, t: 9, b: 4 }

/** Points of the series in viewBox units, plus a "nice" scale from 0 (or the minimum when negative). */
function plot(vs) {
  const hi = Math.max(...vs, 0)
  const lo = Math.min(...vs, 0)
  const span = hi - lo || 1
  const n = vs.length
  const x = (i) => (n === 1 ? VW / 2 : PAD.l + (i * (VW - PAD.l - PAD.r)) / (n - 1))
  const y = (v) => PAD.t + (1 - (v - lo) / span) * (VH - PAD.t - PAD.b)
  return { pts: vs.map((v, i) => [x(i), y(v)]), base: y(Math.max(lo, 0)), x, y }
}

/** A smooth path through the points (monotone cubic, so it never overshoots a value). */
function smooth(pts) {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const n = pts.length
  const d = []
  const m = []
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]))
  m.push(d[0])
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])
  let s = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = (x1 - x0) / 3
    s += ` C${(x0 + h).toFixed(2)},${(y0 + m[i] * h).toFixed(2)} ${(x1 - h).toFixed(2)},${(y1 - m[i + 1] * h).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`
  }
  return s
}

function Trend({ ctx, area }) {
  const bars = ctx.slide.bars ?? []
  const vs = nums(bars)
  const { theme } = ctx
  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  if (!bars.length) return <div className="ly ly-chart"><Side ctx={ctx} /></div>
  const { pts, base } = plot(vs)
  const line = smooth(pts)
  const last = pts.length - 1
  const grid = fade(theme.text, 0.12)
  return (
    <div className="ly ly-chart ly-chart-trend">
      <Side ctx={ctx} />
      <div className="ly-trend">
        <div className="ly-trend-plot">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="ly-trend-svg" aria-hidden="true">
            {area && (
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={theme.accent} stopOpacity="0.42" />
                  <stop offset="1" stopColor={theme.accent} stopOpacity="0.02" />
                </linearGradient>
              </defs>
            )}
            {[0, 1, 2, 3].map((k) => {
              const gy = PAD.t + (k * (VH - PAD.t - PAD.b)) / 3
              return <line key={k} x1="0" x2={VW} y1={gy} y2={gy} stroke={grid} strokeWidth="0.18" strokeDasharray={k === 3 ? undefined : '0.8 0.8'} />
            })}
            {area && <path d={`${line} L${pts[last][0].toFixed(2)},${base.toFixed(2)} L${pts[0][0].toFixed(2)},${base.toFixed(2)} Z`} fill={`url(#${gid})`} />}
            <path d={line} fill="none" stroke={theme.accent} strokeWidth={area ? 0.7 : 0.9} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === last ? 1.7 : 1.05} fill={i === last ? theme.accent : mix(theme.accent, theme.text, 0.1)} />
            ))}
            {pts.length > 0 && <circle cx={pts[last][0]} cy={pts[last][1]} r="3.4" fill={fade(theme.accent, 0.18)} />}
          </svg>
          {pts.map(([x, y], i) => (
            <T
              key={i}
              ctx={ctx}
              path={`bars.${i}.value`}
              className={`ly-trend-v ${i === last ? 'last' : ''}`}
              style={{ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%` }}
            />
          ))}
        </div>
        <div className="ly-trend-x">
          {pts.map(([x], i) => (
            <T key={i} ctx={ctx} path={`bars.${i}.label`} className="ly-trend-l" style={{ left: `${(x / VW) * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ───────── donut and pie: parts of a whole ───────── */

function Parts({ ctx, pie }) {
  const bars = ctx.slide.bars ?? []
  const vs = nums(bars).map((v) => Math.max(0, v))
  const total = vs.reduce((a, b) => a + b, 0) || 1
  const colors = palette(ctx.theme, bars.length)
  const lead = vs.indexOf(Math.max(...vs))
  // donut: a ring with hairline gaps; pie: the same trick with a ring as thick as the radius
  const r = pie ? 25 : 38
  const sw = pie ? 50 : 15
  const C = 2 * Math.PI * r
  const gap = bars.length < 2 ? 0 : 0.9
  const ringGap = solidOf(ctx.theme.bg) ?? 'transparent'
  let acc = 0
  return (
    <div className={`ly ly-chart ly-chart-parts ${pie ? 'pie' : 'donut'}`}>
      <Side ctx={ctx} />
      <div className="ly-parts">
        <div className="ly-ring">
          <svg viewBox="0 0 100 100" className="ly-ring-svg" aria-hidden="true">
            {!pie && <circle cx="50" cy="50" r={r} fill="none" stroke={fade(ctx.theme.text, 0.08)} strokeWidth={sw} />}
            {pie && vs.map((v, i) => {
              // a pie is drawn as real wedges: wide dashed rings leave seams at the centre
              const a0 = (acc / total) * 2 * Math.PI
              acc += v
              const a1 = (acc / total) * 2 * Math.PI
              return v > 0 && <path key={i} d={wedge(a0, a1)} fill={colors[i]} stroke={ringGap} strokeWidth="0.6" strokeLinejoin="round" />
            })}
            {!pie && vs.map((v, i) => {
              const len = (v / total) * C
              const dash = Math.max(0, len - gap)
              const el = (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={colors[i]}
                  strokeWidth={sw}
                  strokeDasharray={`${dash.toFixed(3)} ${(C - dash).toFixed(3)}`}
                  strokeDashoffset={(-acc).toFixed(3)}
                  transform="rotate(-90 50 50)"
                />
              )
              acc += len
              return el
            })}
          </svg>
          {!pie && bars[lead] && (
            <div className="ly-ring-c">
              <T ctx={ctx} path={`bars.${lead}.value`} className="ly-ring-v" />
              <T ctx={ctx} path={`bars.${lead}.label`} className="ly-ring-l" />
            </div>
          )}
        </div>
        <ul className="ly-legend">
          {bars.map((_, i) => (
            <li key={i} className={i === lead ? 'lead' : ''}>
              <span className="ly-sw" style={{ background: colors[i] }} />
              <T ctx={ctx} path={`bars.${i}.label`} as="span" className="ly-legend-l" />
              <T ctx={ctx} path={`bars.${i}.value`} as="span" className="ly-legend-v" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** A pie wedge from angle a0 to a1 (radians, clockwise from 12 o'clock) in the 100 × 100 box. */
function wedge(a0, a1) {
  const R = 48
  const pt = (a) => `${(50 + R * Math.sin(a)).toFixed(3)},${(50 - R * Math.cos(a)).toFixed(3)}`
  if (a1 - a0 >= 2 * Math.PI - 1e-6) return `M50,${50 - R} A${R},${R} 0 1 1 49.999,${50 - R} Z`
  return `M50,50 L${pt(a0)} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`
}

/** The chart page body for any kind but the classic columns. */
export function ChartBody({ ctx, kind }) {
  switch (kind) {
    case 'hbar':
      return <HBars ctx={ctx} />
    case 'line':
      return <Trend ctx={ctx} />
    case 'area':
      return <Trend ctx={ctx} area />
    case 'donut':
      return <Parts ctx={ctx} />
    case 'pie':
      return <Parts ctx={ctx} pie />
    default:
      return <HBars ctx={ctx} />
  }
}
