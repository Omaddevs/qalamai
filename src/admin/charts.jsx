// Small, dependency-free SVG charts for the admin panel. One series per chart (never two
// y-scales), thin marks, recessive grid, hover tooltips, and a table view for the big chart.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { WEEKDAYS, fmt } from './format.js'

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    setW(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** 0, 15, 30, 45, 60 style ticks with a round step. */
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw)
  const top = Math.ceil(max / step) * step
  const out = []
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

/** Smooth-ish path through points (monotone cubic keeps it from overshooting below 0). */
function monotonePath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  const n = pts.length
  const dx = [],
    dy = [],
    m = [],
    t = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0]
    dy[i] = pts[i + 1][1] - pts[i][1]
    m[i] = dy[i] / dx[i]
  }
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

/**
 * Area chart with a crosshair tooltip.
 * @param {{ data: { label: string, sub?: string, value: number }[], name: string, height?: number }} p
 */
export function AreaChart({ data, name, height = 280, id = 'area' }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const pad = { l: 40, r: 12, t: 16, b: 30 }
  const w = Math.max(0, width - pad.l - pad.r)
  const h = height - pad.t - pad.b
  const max = Math.max(...data.map((d) => d.value), 0)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const x = (i) => pad.l + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w)
  const y = (v) => pad.t + h - (v / top) * h
  const pts = data.map((d, i) => [x(i), y(d.value)])
  const line = monotonePath(pts)
  const area = pts.length ? `${line}L${pts[pts.length - 1][0]},${pad.t + h}L${pts[0][0]},${pad.t + h}Z` : ''
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(w / 92))))

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const i = Math.round(((px - pad.l) / (w || 1)) * (data.length - 1))
    setHover(i >= 0 && i < data.length ? i : null)
  }
  const hv = hover != null ? data[hover] : null

  return (
    <div className="ad-chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={name}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ad-accent)" stopOpacity=".28" />
              <stop offset="1" stopColor="var(--ad-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={pad.l} x2={pad.l + w} y1={y(tv)} y2={y(tv)} className="ad-grid" />
              <text x={pad.l - 10} y={y(tv) + 4} className="ad-axis" textAnchor="end">
                {fmt(tv)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={d.label} x={x(i)} y={height - 8} className="ad-axis" textAnchor={i === 0 ? 'start' : 'middle'}>
                {d.label}
              </text>
            ) : null,
          )}
          <path d={area} fill={`url(#${id}-fill)`} />
          <path d={line} fill="none" stroke="var(--ad-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hv && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} className="ad-cross" />
              <circle cx={x(hover)} cy={y(hv.value)} r="5.5" fill="var(--ad-accent)" stroke="var(--ad-surface)" strokeWidth="2.5" />
            </g>
          )}
        </svg>
      )}
      {hv && (
        <div className="ad-tip" style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: Math.max(y(hv.value) - 14, 0) }}>
          <span className="ad-tip-k">{hv.sub ?? hv.label}</span>
          <b>{fmt(hv.value)}</b> <span className="ad-tip-n">{name}</span>
        </div>
      )}
    </div>
  )
}

export function Sparkline({ values, width = 96, height = 32 }) {
  if (!values?.length) return null
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * width, height - 3 - (v / max) * (height - 6)])
  const line = monotonePath(pts)
  return (
    <svg className="ad-spark" width={width} height={height} aria-hidden="true">
      <path d={`${line}L${width},${height}L0,${height}Z`} fill="var(--ad-accent)" opacity=".1" />
      <path d={line} fill="none" stroke="var(--ad-accent)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Ranked list with thin bars. items: { key, label, n, lead? (node before the label) }
 */
export function BarList({ items, limit = 8, empty = 'Hozirça maʼlumot yöq', total }) {
  const [all, setAll] = useState(false)
  const sum = total ?? items.reduce((s, i) => s + i.n, 0)
  const max = Math.max(...items.map((i) => i.n), 1)
  const shown = all ? items : items.slice(0, limit)
  if (!items.length) return <p className="ad-empty">{empty}</p>
  return (
    <div className="ad-bars">
      {shown.map((it) => (
        <div className="ad-bar" key={it.key} title={`${typeof it.label === 'string' ? it.label : it.key}: ${fmt(it.n)} (${sum ? Math.round((it.n / sum) * 100) : 0}%)`}>
          <div className="ad-bar-row">
            <span className="ad-bar-label">
              {it.lead}
              <span className="ad-bar-text">{it.label}</span>
            </span>
            <span className="ad-bar-val">
              <span className="ad-bar-pct">{sum ? `${Math.round((it.n / sum) * 100)}%` : ''}</span>
              {fmt(it.n)}
            </span>
          </div>
          <div className="ad-bar-track">
            <div className="ad-bar-fill" style={{ width: `${Math.max(1.5, (it.n / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {items.length > limit && (
        <button className="ad-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Kamroq körsatiş' : `Yana ${items.length - limit} ta`}
        </button>
      )}
    </div>
  )
}

/** Weekday × hour activity grid, one sequential hue. */
export function Heatmap({ cells }) {
  const [hover, setHover] = useState(null)
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const c of cells) g[c.dow - 1][c.hour] = c.n
    return g
  }, [cells])
  const max = Math.max(...grid.flat(), 1)
  const level = (n) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)))
  return (
    <div className="ad-heat" onMouseLeave={() => setHover(null)}>
      <div className="ad-heat-grid">
        {grid.map((row, d) => (
          <div className="ad-heat-row" key={d}>
            <span className="ad-heat-day">{WEEKDAYS[d]}</span>
            {row.map((n, hr) => (
              <span key={hr} className={`ad-heat-cell l${level(n)}`} onMouseEnter={() => setHover({ d, hr, n })} />
            ))}
          </div>
        ))}
        <div className="ad-heat-row ad-heat-hours">
          <span className="ad-heat-day" />
          {Array.from({ length: 24 }, (_, hr) => (
            <span key={hr} className="ad-heat-h">
              {hr % 3 === 0 ? hr : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="ad-heat-foot">
        <span className="ad-heat-info">
          {hover ? (
            <>
              <b>{WEEKDAYS[hover.d]}, {String(hover.hr).padStart(2, '0')}:00–{String(hover.hr).padStart(2, '0')}:59</b> — {fmt(hover.n)} ta köriş
            </>
          ) : (
            'Katakça ustiga olib boring'
          )}
        </span>
        <span className="ad-heat-legend">
          Kam
          {[1, 2, 3, 4, 5].map((l) => (
            <span key={l} className={`ad-heat-cell l${l}`} />
          ))}
          Köp
        </span>
      </div>
    </div>
  )
}

/** 24 hourly columns (sign-ups by hour of day). */
export function HourBars({ values, unit = 'ta' }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...values, 1)
  return (
    <div className="ad-hours" onMouseLeave={() => setHover(null)}>
      <div className="ad-hours-cols">
        {values.map((v, h) => (
          <div key={h} className={`ad-hours-col ${hover === h ? 'on' : ''}`} onMouseEnter={() => setHover(h)}>
            <span style={{ height: `${v ? Math.max(4, (v / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="ad-hours-axis">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h} style={{ left: `${(h / 23) * 100}%` }}>
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>
      <p className="ad-hours-info">
        {hover != null ? (
          <>
            <b>
              {String(hover).padStart(2, '0')}:00–{String(hover).padStart(2, '0')}:59
            </b>{' '}
            — {fmt(values[hover])} {unit}
          </>
        ) : (
          'Ustuniga olib boring'
        )}
      </p>
    </div>
  )
}
