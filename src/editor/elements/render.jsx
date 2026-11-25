// How the Elements-panel kinds look on a page: shapes, lines, icons, graphics, tables, charts,
// device mockups and framed images. Pure renderers — the editor, thumbnails, presenting and
// export all draw pages with these, so a design looks the same everywhere.
//
// Sizes: the page is 16:9 and units scale with it (cqw), so an element's own box is
// (w·16) × (h·9) "page units" (the page is 1600 × 900). Charts and lines draw in those units,
// so nothing is stretched when the element is resized.
import AssetImg from '../../components/AssetImg.jsx'
import { useEffect, useId, useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { formatNumber, t } from '../../i18n/index.js'
import { ART } from './art.jsx'
import { alpha, inkOn, seriesColors } from './colors.js'
import { ICONS } from './icons.js'
import { PATHS, maskCss } from './shapes.js'
import './render.css'

const UNITS_W = 16
const UNITS_H = 9
const boxOf = (el) => ({ W: Math.max(8, (el.w ?? 20) * UNITS_W), H: Math.max(4, (el.h ?? 20) * UNITS_H) })
const n2 = (v) => Math.round(v * 100) / 100
const svgId = (id) => `q${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

/* ───────── shapes ───────── */

function ShapeView({ el, theme }) {
  const d = PATHS[el.shape]
  if (!d) return null
  const color = el.color ?? theme.accent
  const outline = Boolean(el.outline)
  const sw = outline ? (el.sw ?? 0.4) : (el.sw ?? 0)
  return (
    <svg className="el-svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
      <path
        d={d}
        fillRule="evenodd"
        fill={outline ? 'none' : color}
        stroke={outline ? color : sw ? (el.sc ?? theme.text) : 'none'}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: `${sw}cqw` }}
      />
    </svg>
  )
}

/* ───────── lines ───────── */

export const LINE_ENDS = ['none', 'arrow', 'triangle', 'circle', 'square', 'bar']
export const LINE_DASHES = ['solid', 'dashed', 'dotted']

function lineCap(kind, x, y, dir, t, color) {
  // dir: +1 = the line's end (pointing right), -1 = its start
  const s = t * 2.6
  const p = (dx, dy) => `${n2(x + dx * dir)} ${n2(y + dy)}`
  switch (kind) {
    case 'arrow':
      return <path d={`M${p(-s, -s)}L${p(0, 0)}L${p(-s, s)}`} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />
    case 'triangle':
      return <path d={`M${p(-s * 1.15, -s * 0.85)}L${p(0, 0)}L${p(-s * 1.15, s * 0.85)}Z`} fill={color} stroke={color} strokeWidth={t * 0.4} strokeLinejoin="round" />
    case 'circle':
      return <circle cx={x - dir * s * 0.55} cy={y} r={s * 0.55} fill={color} />
    case 'square':
      return <rect x={dir > 0 ? x - s : x} y={y - s / 2} width={s} height={s} fill={color} />
    case 'bar':
      return <path d={`M${p(0, -s)}L${p(0, s)}`} stroke={color} strokeWidth={t} strokeLinecap="round" />
    default:
      return null
  }
}

/** How far a cap reaches back along the line (the line stops there, so its end never shows). */
const capInset = (kind, t) => ({ arrow: t * 0.3, triangle: t * 2.6, circle: t * 1.4, square: t * 1.3, bar: 0 })[kind] ?? 0

function StrokeView({ el, theme }) {
  const { W, H } = boxOf(el)
  const color = el.color ?? theme.text
  const tw = Math.max(0.5, (el.thick ?? 0.3) * UNITS_W)
  const y = H / 2
  const pad = el.start === 'none' && el.end === 'none' ? tw / 2 : tw
  const x0 = pad + capInset(el.start, tw)
  const x1 = W - pad - capInset(el.end, tw)
  const dash = el.dash === 'dashed' ? `${tw * 3} ${tw * 2.2}` : el.dash === 'dotted' ? `0 ${tw * 2}` : undefined
  return (
    <svg className="el-svg" viewBox={`0 0 ${n2(W)} ${n2(H)}`} width="100%" height="100%">
      {x1 > x0 && (
        <path d={`M${n2(x0)} ${n2(y)}H${n2(x1)}`} stroke={color} strokeWidth={tw} strokeDasharray={dash} strokeLinecap={el.dash === 'dotted' || !el.dash || el.dash === 'solid' ? 'round' : 'butt'} />
      )}
      {lineCap(el.start, pad, y, -1, tw, color)}
      {lineCap(el.end, W - pad, y, 1, tw, color)}
    </svg>
  )
}

/* ───────── icons and graphics ───────── */

function IconView({ el, theme }) {
  const Icon = ICONS[el.icon]
  if (!Icon) return null
  return <Icon className="el-svg" weight={el.weight ?? 'regular'} color={el.color ?? theme.text} size="100%" />
}

function GraphicView({ el, theme }) {
  const art = ART[el.g]
  if (!art) return null
  const base = art.colors(theme)
  const c = base.map((x, i) => el.colors?.[i] ?? x)
  return (
    <svg className="el-svg" viewBox={art.vb ?? '0 0 100 100'} preserveAspectRatio={art.stretch ? 'none' : 'xMidYMid meet'} width="100%" height="100%">
      {art.draw(c)}
    </svg>
  )
}

/* ───────── tables ───────── */

export const TABLE_STYLES = ['grid', 'header', 'zebra', 'lines', 'minimal']
const lastCell = new Map() // element id → index of the cell last pressed (focused when editing starts)

function placeCaret(node) {
  const r = document.createRange()
  r.selectNodeContents(node)
  r.collapse(false)
  const s = window.getSelection()
  s.removeAllRanges()
  s.addRange(r)
}

function TableView({ el, theme, editing, onPatch }) {
  const ref = useRef(null)
  const rows = el.rows?.length ? el.rows : [['']]
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const st = el.tstyle ?? 'grid'
  const accent = el.color ?? theme.accent
  const text = el.textColor ?? theme.text
  const line = alpha(text, 0.2)
  const hair = 'max(1px, 0.07cqw)'
  const head = el.head !== false
  const solidHead = st === 'header' || st === 'zebra'
  // the latest rows and callback, for handlers that fire after a re-render (blur, effect cleanup)
  const live = useRef(null)
  live.current = { rows, cols, onPatch }

  const grid = (src) => src.map((row) => Array.from({ length: live.current.cols }, (_, i) => row[i] ?? ''))
  const clean = (node) => node.innerText.replace(/\n$/, '')

  useEffect(() => {
    if (!editing) return
    const table = ref.current
    const cells = table?.querySelectorAll('[data-cell]')
    if (cells?.length) {
      const node = cells[Math.min(lastCell.get(el.id) ?? 0, cells.length - 1)]
      node.focus()
      placeCaret(node)
    }
    // Leaving edit mode by pressing another element doesn't always blur the cell (the press is
    // cancelled before focus moves), so whatever is typed is read back from the cells here.
    return () => {
      const { rows: cur, cols: n, onPatch: patch } = live.current
      const next = grid(cur)
      let changed = false
      table?.querySelectorAll('[data-cell]').forEach((node) => {
        const i = Number(node.dataset.cell)
        const r = Math.floor(i / n)
        const c = i % n
        if (next[r] && next[r][c] !== clean(node)) {
          next[r][c] = clean(node)
          changed = true
        }
      })
      if (changed) patch?.({ rows: next })
    }
  }, [editing, rows.length, cols, el.id])

  const commit = (r, c, v) => {
    const cur = live.current.rows
    if ((cur[r]?.[c] ?? '') === v) return
    const next = grid(cur)
    if (!next[r]) return
    next[r][c] = v
    live.current.onPatch?.({ rows: next })
  }

  const onKey = (e, r, c) => {
    if (e.key === 'Escape') return e.currentTarget.blur()
    if (e.key !== 'Tab') return
    e.preventDefault()
    const cells = [...ref.current.querySelectorAll('[data-cell]')]
    const i = cells.indexOf(e.currentTarget)
    const j = i + (e.shiftKey ? -1 : 1)
    if (j >= 0 && j < cells.length) {
      lastCell.set(el.id, j)
      cells[j].focus()
      placeCaret(cells[j])
      return
    }
    if (!e.shiftKey) {
      // Tab in the last cell adds a row, like spreadsheets do
      const next = grid(live.current.rows)
      next[r][c] = clean(e.currentTarget)
      next.push(Array.from({ length: cols }, () => ''))
      lastCell.set(el.id, cells.length)
      onPatch?.({ rows: next, h: (el.h ?? 30) + (el.h ?? 30) / rows.length })
    }
  }

  const cellStyle = (r, c) => {
    const isHead = head && r === 0
    const s = { padding: '0.42em 0.7em', verticalAlign: 'middle', textAlign: el.align ?? 'left', overflow: 'hidden' }
    if (isHead) {
      s.fontWeight = 700
      if (solidHead) {
        s.background = accent
        s.color = inkOn(accent)
      } else if (st === 'grid') s.background = alpha(accent, 0.16)
      if (st === 'minimal') {
        s.color = alpha(text, 0.6)
        s.fontSize = '0.82em'
        s.letterSpacing = '0.06em'
        s.textTransform = 'uppercase'
      }
    } else if (el.firstCol && c === 0) s.fontWeight = 700
    if (st === 'zebra' && !isHead && (r - (head ? 1 : 0)) % 2 === 1) s.background = alpha(accent, 0.09)
    if (st === 'grid' || st === 'header') s.border = `${hair} solid ${line}`
    if (st === 'lines' || st === 'minimal') s.borderBottom = `${hair} solid ${line}`
    if (st === 'lines' && isHead) s.borderBottom = `max(2px, 0.16cqw) solid ${accent}`
    return s
  }

  return (
    <div className="el-table" style={{ borderRadius: st === 'header' || st === 'zebra' ? `${el.radius ?? 0.6}cqw` : 0 }}>
      <table
        ref={ref}
        style={{
          fontFamily: el.font ?? theme.bodyFont,
          fontSize: `${el.size ?? 1.3}cqw`,
          color: text,
          lineHeight: 1.3,
        }}
      >
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => {
                const v = row[c] ?? ''
                const idx = r * cols + c
                return (
                  <td key={c} style={cellStyle(r, c)}>
                    <div
                      key={v}
                      data-cell={idx}
                      className="el-cell"
                      contentEditable={editing || undefined}
                      suppressContentEditableWarning
                      spellCheck={false}
                      onPointerDown={() => lastCell.set(el.id, idx)}
                      onFocus={() => lastCell.set(el.id, idx)}
                      onBlur={editing ? (e) => commit(r, c, clean(e.currentTarget)) : undefined}
                      onKeyDown={editing ? (e) => onKey(e, r, c) : undefined}
                    >
                      {v}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───────── charts ───────── */

export const CHART_TYPES = ['column', 'bar', 'stacked', 'line', 'area', 'pie', 'donut', 'progress', 'meter']
export const ONE_SERIES = new Set(['pie', 'donut', 'progress', 'meter'])

/** Clean data: labels are strings, every series has one finite number per label. */
export function chartData(data) {
  const labels = (data?.labels ?? []).map((l) => String(l ?? ''))
  const series = (data?.series?.length ? data.series : [{ name: '', values: [] }]).map((s) => ({
    name: String(s.name ?? ''),
    values: labels.map((_, i) => {
      const v = Number(s.values?.[i])
      return Number.isFinite(v) ? v : 0
    }),
  }))
  return { labels, series }
}

function niceTicks(min, max, count = 4) {
  if (!(max > min)) max = min + 1
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const k = raw / mag
  const step = (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * mag
  const lo = Math.floor(min / step + 1e-9) * step
  const hi = Math.ceil(max / step - 1e-9) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2 && ticks.length < 14; v += step) ticks.push(Math.round(v / step) * step)
  return ticks
}

const fmt = (v, unit = '') => `${formatNumber(v, { maximumFractionDigits: 2 })}${unit}`
const textW = (s, size) => String(s).length * size * 0.58

/** Bar with rounded far end. vertical: the far end is the top when `up`; horizontal: right when `up`. */
function barPath(x, y, w, h, r, vertical, up) {
  if (w <= 0 || h <= 0) return ''
  r = Math.max(0, Math.min(r, (vertical ? w : h) / 2, vertical ? h : w))
  if (!r) return `M${n2(x)} ${n2(y)}h${n2(w)}v${n2(h)}h${n2(-w)}Z`
  if (vertical && up) return `M${n2(x)} ${n2(y + h)}V${n2(y + r)}Q${n2(x)} ${n2(y)} ${n2(x + r)} ${n2(y)}H${n2(x + w - r)}Q${n2(x + w)} ${n2(y)} ${n2(x + w)} ${n2(y + r)}V${n2(y + h)}Z`
  if (vertical) return `M${n2(x)} ${n2(y)}V${n2(y + h - r)}Q${n2(x)} ${n2(y + h)} ${n2(x + r)} ${n2(y + h)}H${n2(x + w - r)}Q${n2(x + w)} ${n2(y + h)} ${n2(x + w)} ${n2(y + h - r)}V${n2(y)}Z`
  if (up) return `M${n2(x)} ${n2(y)}H${n2(x + w - r)}Q${n2(x + w)} ${n2(y)} ${n2(x + w)} ${n2(y + r)}V${n2(y + h - r)}Q${n2(x + w)} ${n2(y + h)} ${n2(x + w - r)} ${n2(y + h)}H${n2(x)}Z`
  return `M${n2(x + w)} ${n2(y)}H${n2(x + r)}Q${n2(x)} ${n2(y)} ${n2(x)} ${n2(y + r)}V${n2(y + h - r)}Q${n2(x)} ${n2(y + h)} ${n2(x + r)} ${n2(y + h)}H${n2(x + w)}Z`
}

function smoothPath(pts) {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join('')
  let d = `M${n2(pts[0][0])} ${n2(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${n2(c1[0])} ${n2(c1[1])} ${n2(c2[0])} ${n2(c2[1])} ${n2(p2[0])} ${n2(p2[1])}`
  }
  return d
}

/** Legend laid out in rows across `width`; → { node, h } */
function legend(items, x, y, width, fs, color) {
  const gap = fs * 1.1
  const sw = fs * 0.62
  const rows = [[]]
  let cx = 0
  for (const it of items) {
    const w = sw + fs * 0.4 + textW(it.name, fs * 0.82)
    if (cx > 0 && cx + w > width) {
      rows.push([])
      cx = 0
    }
    rows.at(-1).push({ ...it, x: cx, w })
    cx += w + gap
  }
  const lh = fs * 1.35
  return {
    h: rows.length * lh,
    node: (
      <g fontSize={n2(fs * 0.82)} fill={color}>
        {rows.flatMap((row, ri) =>
          row.map((it, i) => (
            <g key={`${ri}-${i}`} transform={`translate(${n2(x + it.x)} ${n2(y + ri * lh + lh / 2)})`}>
              <rect x="0" y={n2(-sw / 2)} width={n2(sw)} height={n2(sw)} rx={n2(sw * 0.3)} fill={it.color} />
              <text x={n2(sw + fs * 0.4)} y="0" dominantBaseline="central">
                {it.name}
              </text>
            </g>
          )),
        )}
      </g>
    ),
  }
}

function axisChart({ el, data, W, H, fs, colors, text, muted, grid }) {
  const type = el.chart
  const horizontal = type === 'bar'
  const stacked = type === 'stacked'
  const lineLike = type === 'line' || type === 'area'
  const { labels, series } = data
  const n = Math.max(1, labels.length)
  const unit = el.unit ?? ''
  const showValues = Boolean(el.values)
  const showGrid = el.grid !== false
  const rounded = el.round !== false

  let top = 0
  let legendNode = null
  if (series.length > 1 && el.legend !== false) {
    const lg = legend(series.map((s, i) => ({ name: s.name, color: colors[i] })), 0, 0, W, fs, text)
    legendNode = lg.node
    top = lg.h + fs * 0.6
  }

  const all = stacked
    ? labels.flatMap((_, i) => {
        const pos = series.reduce((s, se) => s + Math.max(0, se.values[i]), 0)
        const neg = series.reduce((s, se) => s + Math.min(0, se.values[i]), 0)
        return [pos, neg]
      })
    : series.flatMap((s) => s.values)
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all))
  const lo = ticks[0]
  const hi = ticks.at(-1)
  const tickFs = fs * 0.78
  const tickW = showGrid ? Math.max(...ticks.map((v) => textW(fmt(v, unit), tickFs))) + fs * 0.5 : 0
  const valFs = fs * 0.72

  if (horizontal) {
    const labelW = Math.min(W * 0.38, Math.max(0, ...labels.map((l) => textW(l, fs * 0.8))) + fs * 0.6)
    const left = labelW
    const bottom = showGrid ? fs * 1.6 : fs * 0.3
    const right = showValues ? Math.max(0, ...all.map((v) => textW(fmt(v, unit), valFs))) + fs * 0.5 : fs * 0.4
    const pw = Math.max(1, W - left - right)
    const ph = Math.max(1, H - top - bottom)
    const X = (v) => left + ((v - lo) / (hi - lo)) * pw
    const band = ph / n
    const inner = band * 0.7
    const bh = inner / series.length
    return (
      <>
        {legendNode}
        {showGrid &&
          ticks.map((v) => (
            <g key={v}>
              <line x1={n2(X(v))} x2={n2(X(v))} y1={n2(top)} y2={n2(top + ph)} stroke={grid} strokeWidth={n2(fs * 0.06)} />
              <text x={n2(X(v))} y={n2(H - fs * 0.45)} textAnchor="middle" fontSize={n2(tickFs)} fill={muted}>
                {fmt(v, unit)}
              </text>
            </g>
          ))}
        {labels.map((l, i) => (
          <text key={i} x={n2(left - fs * 0.5)} y={n2(top + band * (i + 0.5))} textAnchor="end" dominantBaseline="central" fontSize={n2(fs * 0.8)} fill={muted}>
            {l}
          </text>
        ))}
        {series.map((s, si) =>
          s.values.map((v, i) => {
            const y = top + band * i + (band - inner) / 2 + si * bh
            const x0 = X(Math.min(0, v))
            const w = Math.abs(X(v) - X(0))
            return (
              <g key={`${si}-${i}`}>
                <path d={barPath(x0, y + bh * 0.06, w, bh * 0.88, rounded ? bh * 0.3 : 0, false, v >= 0)} fill={colors[si]} />
                {showValues && (
                  <text x={n2(v >= 0 ? X(v) + fs * 0.3 : X(v) - fs * 0.3)} y={n2(y + bh / 2)} textAnchor={v >= 0 ? 'start' : 'end'} dominantBaseline="central" fontSize={n2(valFs)} fill={text}>
                    {fmt(v, unit)}
                  </text>
                )}
              </g>
            )
          }),
        )}
        <line x1={n2(X(0))} x2={n2(X(0))} y1={n2(top)} y2={n2(top + ph)} stroke={alpha(text, 0.35)} strokeWidth={n2(fs * 0.07)} />
      </>
    )
  }

  const left = tickW
  const valRoom = showValues ? valFs * 1.4 : fs * 0.4
  const bottom = fs * 1.7
  const pw = Math.max(1, W - left - fs * 0.3)
  const ph = Math.max(1, H - top - valRoom - bottom)
  const y0 = top + valRoom
  const Y = (v) => y0 + ph - ((v - lo) / (hi - lo)) * ph
  const band = pw / n
  const labelFs = band < fs * 3 ? fs * 0.66 : fs * 0.8

  let marks
  if (lineLike) {
    const pts = (s) => s.values.map((v, i) => [left + band * (i + 0.5), Y(v)])
    marks = series.map((s, si) => {
      const p = pts(s)
      const d = el.smooth ? smoothPath(p) : p.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join('')
      const base = Y(Math.max(lo, Math.min(0, hi)))
      return (
        <g key={si}>
          {type === 'area' && p.length > 0 && <path d={`${d}L${n2(p.at(-1)[0])} ${n2(base)}L${n2(p[0][0])} ${n2(base)}Z`} fill={colors[si]} opacity={series.length > 1 ? 0.22 : 0.28} />}
          <path d={d} fill="none" stroke={colors[si]} strokeWidth={n2(fs * 0.16)} strokeLinecap="round" strokeLinejoin="round" />
          {p.map(([x, y], i) => (
            <circle key={i} cx={n2(x)} cy={n2(y)} r={n2(fs * 0.24)} fill={colors[si]} stroke="#fff" strokeWidth={n2(fs * 0.08)} />
          ))}
          {showValues &&
            p.map(([x, y], i) => (
              <text key={`v${i}`} x={n2(x)} y={n2(y - fs * 0.55)} textAnchor="middle" fontSize={n2(valFs)} fill={text}>
                {fmt(s.values[i], unit)}
              </text>
            ))}
        </g>
      )
    })
  } else {
    const inner = band * (stacked ? 0.56 : 0.72)
    const bw = stacked ? inner : inner / series.length
    marks = labels.map((_, i) => {
      let pos = 0
      let neg = 0
      return (
        <g key={i}>
          {series.map((s, si) => {
            const v = s.values[i]
            let from
            let to
            if (stacked) {
              if (v >= 0) {
                from = pos
                pos += v
                to = pos
              } else {
                from = neg
                neg += v
                to = neg
              }
            } else {
              from = 0
              to = v
            }
            const x = left + band * i + (band - inner) / 2 + (stacked ? 0 : si * bw)
            const yTop = Y(Math.max(from, to))
            const h = Math.abs(Y(from) - Y(to))
            const lastPos = stacked ? si === series.length - 1 || series.slice(si + 1).every((x2) => x2.values[i] <= 0) : true
            const r = rounded && (!stacked || lastPos) ? Math.min(bw * 0.22, fs * 0.45) : 0
            return (
              <g key={si}>
                <path d={barPath(x + bw * 0.05, yTop, bw * 0.9, h, r, true, v >= 0)} fill={colors[si]} />
                {showValues && !stacked && (
                  <text x={n2(x + bw / 2)} y={n2(v >= 0 ? yTop - fs * 0.3 : yTop + h + valFs)} textAnchor="middle" fontSize={n2(valFs)} fill={text}>
                    {fmt(v, unit)}
                  </text>
                )}
              </g>
            )
          })}
          {showValues && stacked && (
            <text x={n2(left + band * (i + 0.5))} y={n2(Y(pos) - fs * 0.3)} textAnchor="middle" fontSize={n2(valFs)} fill={text}>
              {fmt(pos, unit)}
            </text>
          )}
        </g>
      )
    })
  }

  return (
    <>
      {legendNode}
      {showGrid &&
        ticks.map((v) => (
          <g key={v}>
            <line x1={n2(left)} x2={n2(W)} y1={n2(Y(v))} y2={n2(Y(v))} stroke={grid} strokeWidth={n2(fs * 0.06)} />
            <text x={n2(left - fs * 0.45)} y={n2(Y(v))} textAnchor="end" dominantBaseline="central" fontSize={n2(tickFs)} fill={muted}>
              {fmt(v, unit)}
            </text>
          </g>
        ))}
      {labels.map((l, i) => (
        <text key={i} x={n2(left + band * (i + 0.5))} y={n2(H - fs * 0.5)} textAnchor="middle" fontSize={n2(labelFs)} fill={muted}>
          {l}
        </text>
      ))}
      {marks}
      <line x1={n2(left)} x2={n2(W)} y1={n2(Y(Math.max(lo, Math.min(0, hi))))} y2={n2(Y(Math.max(lo, Math.min(0, hi))))} stroke={alpha(text, 0.35)} strokeWidth={n2(fs * 0.07)} />
    </>
  )
}

function arc(cx, cy, ro, ri, a0, a1) {
  const full = a1 - a0 >= Math.PI * 2 - 1e-6
  if (full) {
    const o = `M${n2(cx - ro)} ${n2(cy)}A${n2(ro)} ${n2(ro)} 0 1 1 ${n2(cx + ro)} ${n2(cy)}A${n2(ro)} ${n2(ro)} 0 1 1 ${n2(cx - ro)} ${n2(cy)}Z`
    return ri > 0 ? `${o}M${n2(cx - ri)} ${n2(cy)}A${n2(ri)} ${n2(ri)} 0 1 0 ${n2(cx + ri)} ${n2(cy)}A${n2(ri)} ${n2(ri)} 0 1 0 ${n2(cx - ri)} ${n2(cy)}Z` : o
  }
  const P = (a, r) => `${n2(cx + r * Math.cos(a))} ${n2(cy + r * Math.sin(a))}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  if (ri > 0) return `M${P(a0, ro)}A${n2(ro)} ${n2(ro)} 0 ${large} 1 ${P(a1, ro)}L${P(a1, ri)}A${n2(ri)} ${n2(ri)} 0 ${large} 0 ${P(a0, ri)}Z`
  return `M${n2(cx)} ${n2(cy)}L${P(a0, ro)}A${n2(ro)} ${n2(ro)} 0 ${large} 1 ${P(a1, ro)}Z`
}

function pieChart({ el, data, W, H, fs, colors, text, muted }) {
  const vals = data.series[0].values.map((v) => Math.max(0, v))
  const total = vals.reduce((a, b) => a + b, 0)
  const items = data.labels.map((l, i) => ({ name: l, color: colors[i % colors.length], v: vals[i] }))
  const side = W >= H * 1.25
  const legendW = side ? Math.min(W * 0.48, Math.max(0, ...items.map((it) => textW(`${it.name}  100%`, fs * 0.82))) + fs * 1.6) : W
  const lg = el.legend === false ? null : side ? null : legend(items, 0, 0, W, fs, text)
  const areaW = side && el.legend !== false ? W - legendW : W
  const areaH = lg ? H - lg.h - fs * 0.6 : H
  const r = Math.max(1, Math.min(areaW, areaH) / 2 - fs * 0.2)
  const cx = areaW / 2
  const cy = (lg ? lg.h + fs * 0.6 : 0) + areaH / 2
  const ri = el.chart === 'donut' ? r * 0.6 : 0
  let a = -Math.PI / 2
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0)
  return (
    <>
      {lg?.node}
      {total === 0 && <circle cx={n2(cx)} cy={n2(cy)} r={n2(r)} fill={alpha(text, 0.08)} />}
      {items.map((it, i) => {
        if (!total || !it.v) return null
        const a0 = a
        const a1 = a + (it.v / total) * Math.PI * 2
        a = a1
        const mid = (a0 + a1) / 2
        const rr = ri ? (r + ri) / 2 : r * 0.62
        const show = el.values !== false && a1 - a0 > 0.38
        return (
          <g key={i}>
            <path d={arc(cx, cy, r, ri, a0, a1)} fill={it.color} />
            {show && (
              <text x={n2(cx + rr * Math.cos(mid))} y={n2(cy + rr * Math.sin(mid))} textAnchor="middle" dominantBaseline="central" fontSize={n2(fs * 0.8)} fontWeight="700" fill={inkOn(it.color)}>
                {pct(it.v)}%
              </text>
            )}
          </g>
        )
      })}
      {side && el.legend !== false && (
        <g fontSize={n2(fs * 0.82)}>
          {items.map((it, i) => {
            const lh = fs * 1.55
            const y = H / 2 - (items.length * lh) / 2 + lh * (i + 0.5)
            const x = areaW + fs * 0.4
            return (
              <g key={i} transform={`translate(${n2(x)} ${n2(y)})`}>
                <rect x="0" y={n2(-fs * 0.31)} width={n2(fs * 0.62)} height={n2(fs * 0.62)} rx={n2(fs * 0.18)} fill={it.color} />
                <text x={n2(fs * 1)} y="0" dominantBaseline="central" fill={text}>
                  {it.name}
                </text>
                <text x={n2(legendW - fs * 0.6)} y="0" dominantBaseline="central" textAnchor="end" fill={muted}>
                  {pct(it.v)}%
                </text>
              </g>
            )
          })}
        </g>
      )}
    </>
  )
}

function progressChart({ el, data, W, H, fs, colors, text, muted }) {
  const max = el.max > 0 ? el.max : 100
  const v = data.series[0].values[0] ?? 0
  const p = Math.max(0, Math.min(1, v / max))
  const label = data.labels[0] ?? ''
  const r = Math.max(1, Math.min(W, H) / 2)
  const sw = r * 0.16
  const ro = r - sw / 2 - 1
  const cx = W / 2
  const cy = H / 2
  const a0 = -Math.PI / 2
  const a1 = a0 + p * Math.PI * 2
  const big = r * 0.42
  return (
    <>
      <circle cx={n2(cx)} cy={n2(cy)} r={n2(ro)} fill="none" stroke={alpha(colors[0], 0.18)} strokeWidth={n2(sw)} />
      {p >= 0.999 ? (
        <circle cx={n2(cx)} cy={n2(cy)} r={n2(ro)} fill="none" stroke={colors[0]} strokeWidth={n2(sw)} />
      ) : p > 0 ? (
        <path
          d={`M${n2(cx + ro * Math.cos(a0))} ${n2(cy + ro * Math.sin(a0))}A${n2(ro)} ${n2(ro)} 0 ${p > 0.5 ? 1 : 0} 1 ${n2(cx + ro * Math.cos(a1))} ${n2(cy + ro * Math.sin(a1))}`}
          fill="none"
          stroke={colors[0]}
          strokeWidth={n2(sw)}
          strokeLinecap="round"
        />
      ) : null}
      <text x={n2(cx)} y={n2(label ? cy - big * 0.18 : cy)} textAnchor="middle" dominantBaseline="central" fontSize={n2(big)} fontWeight="700" fill={text}>
        {el.unit ? fmt(v, el.unit) : `${Math.round(p * 100)}%`}
      </text>
      {label && (
        <text x={n2(cx)} y={n2(cy + big * 0.62)} textAnchor="middle" dominantBaseline="central" fontSize={n2(Math.min(fs * 0.9, big * 0.4))} fill={muted}>
          {label}
        </text>
      )}
    </>
  )
}

function meterChart({ el, data, W, H, fs, colors, text, muted }) {
  const max = el.max > 0 ? el.max : 100
  const rows = data.labels.map((l, i) => ({ l, v: data.series[0].values[i] ?? 0 }))
  const n = Math.max(1, rows.length)
  const rowH = H / n
  const track = Math.min(rowH * 0.28, fs * 0.7)
  return rows.map((row, i) => {
    const p = Math.max(0, Math.min(1, row.v / max))
    const y = rowH * i + rowH / 2
    const ty = y + track * 0.2
    const color = colors[el.multi ? i % colors.length : 0]
    return (
      <g key={i}>
        <text x="0" y={n2(ty - track - fs * 0.25)} fontSize={n2(fs * 0.82)} fill={text}>
          {row.l}
        </text>
        <text x={n2(W)} y={n2(ty - track - fs * 0.25)} textAnchor="end" fontSize={n2(fs * 0.82)} fontWeight="700" fill={muted}>
          {el.unit ? fmt(row.v, el.unit) : `${Math.round(p * 100)}%`}
        </text>
        <rect x="0" y={n2(ty - track / 2)} width={n2(W)} height={n2(track)} rx={n2(track / 2)} fill={alpha(color, 0.16)} />
        {p > 0 && <rect x="0" y={n2(ty - track / 2)} width={n2(Math.max(track, W * p))} height={n2(track)} rx={n2(track / 2)} fill={color} />}
      </g>
    )
  })
}

function ChartView({ el, theme }) {
  const { W, H } = boxOf(el)
  const fs = 20 * (el.fs ?? 1)
  const text = el.textColor ?? theme.text
  const props = {
    el: { ...el, chart: el.chart ?? 'column' },
    data: chartData(el.data),
    W,
    H,
    fs,
    colors: seriesColors(el, theme),
    text,
    muted: alpha(text, 0.62),
    grid: alpha(text, 0.13),
  }
  const type = props.el.chart
  const body =
    type === 'pie' || type === 'donut' ? pieChart(props) : type === 'progress' ? progressChart(props) : type === 'meter' ? meterChart(props) : axisChart(props)
  return (
    <svg className="el-svg" viewBox={`0 0 ${n2(W)} ${n2(H)}`} width="100%" height="100%" style={{ fontFamily: el.font ?? theme.bodyFont, overflow: 'visible' }}>
      {body}
    </svg>
  )
}

/* ───────── device mockups ───────── */

export const FINISHES = {
  dark: { body: '#1f2937', base: '#9ca3af', bar: '#2b2f36', pill: '#3b4048' },
  silver: { body: '#d1d5db', base: '#e5e7eb', bar: '#e9ecef', pill: '#ffffff' },
  light: { body: '#f8fafc', base: '#e5e7eb', bar: '#f1f3f5', pill: '#ffffff' },
  gold: { body: '#e9cfa6', base: '#f1dfc2', bar: '#f3e6cf', pill: '#fffaf0' },
}

const rr = (x, y, w, h, [tl, tr, br, bl]) =>
  `M${x + tl} ${y}H${x + w - tr}Q${x + w} ${y} ${x + w} ${y + tr}V${y + h - br}Q${x + w} ${y + h} ${x + w - br} ${y + h}H${x + bl}Q${x} ${y + h} ${x} ${y + h - bl}V${y + tl}Q${x} ${y} ${x + tl} ${y}Z`

export const DEVICES = {
  phone: {
    vb: [200, 408],
    screen: [10, 10, 180, 388, [26, 26, 26, 26]],
    body: (f) => <rect width="200" height="408" rx="34" fill={f.body} />,
    over: () => <rect x="74" y="20" width="52" height="14" rx="7" fill="#0b0b0d" />,
  },
  tablet: {
    vb: [300, 410],
    screen: [14, 14, 272, 382, [12, 12, 12, 12]],
    body: (f) => <rect width="300" height="410" rx="26" fill={f.body} />,
    over: () => <circle cx="150" cy="7.5" r="2.5" fill="#0b0b0d" opacity=".6" />,
  },
  laptop: {
    vb: [480, 290],
    screen: [56, 12, 368, 238, [4, 4, 0, 0]],
    body: (f) => (
      <>
        <rect x="44" y="0" width="392" height="262" rx="14" fill={f.body} />
        <path d="M0 262H480V270C480 279 471 286 460 286H20C9 286 0 279 0 270Z" fill={f.base} />
        <rect x="196" y="262" width="88" height="6" rx="3" fill="#000" opacity=".16" />
      </>
    ),
  },
  browser: {
    vb: [400, 264],
    screen: [0, 28, 400, 236, [0, 0, 12, 12]],
    body: (f) => (
      <>
        <rect width="400" height="264" rx="12" fill={f.bar} />
        <circle cx="18" cy="14" r="4.5" fill="#ff5f57" />
        <circle cx="33" cy="14" r="4.5" fill="#febc2e" />
        <circle cx="48" cy="14" r="4.5" fill="#28c840" />
        <rect x="76" y="6.5" width="248" height="15" rx="7.5" fill={f.pill} />
      </>
    ),
  },
  monitor: {
    vb: [400, 326],
    screen: [10, 10, 380, 222, [4, 4, 4, 4]],
    body: (f) => (
      <>
        <path d="M168 250H232L240 306H160Z" fill={f.base} />
        <rect x="118" y="304" width="164" height="12" rx="6" fill={f.base} />
        <rect width="400" height="252" rx="12" fill={f.body} />
      </>
    ),
  },
}

function MockupView({ el }) {
  const uid = svgId(useId())
  const dev = DEVICES[el.device] ?? DEVICES.phone
  const fin = FINISHES[el.finish] ?? FINISHES[el.device === 'browser' ? 'silver' : 'dark']
  const [vw, vh] = dev.vb
  const [x, y, w, h, radii] = dev.screen
  const path = rr(x, y, w, h, radii)
  return (
    <svg className="el-svg el-mockup" viewBox={`0 0 ${vw} ${vh}`} width="100%" height="100%">
      <defs>
        <clipPath id={uid}>
          <path d={path} />
        </clipPath>
      </defs>
      {dev.body(fin)}
      <g clipPath={`url(#${uid})`}>
        {el.src ? (
          <image href={el.src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect x={x} y={y} width={w} height={h} fill="#e8ecf3" />
            <g transform={`translate(${x + w / 2 - 18} ${y + h / 2 - 15})`} fill="none" stroke="#9aa5b8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="34" height="28" rx="4" />
              <circle cx="11" cy="10" r="3.2" />
              <path d="M2 26L13 16L21 23L26 18L34 25" />
            </g>
          </>
        )}
      </g>
      {dev.over?.(fin)}
    </svg>
  )
}

/* ───────── framed images (masks, polaroid) ───────── */

export function FramedImage({ el, editable }) {
  const mask = el.mask ? maskCss(el.mask) : null
  const inner = (
    <div className="fx-img" style={{ ...(mask ?? {}), borderRadius: mask ? 0 : (el.radius ?? 0), ...(el.src ? {} : { background: '#e3e7ee' }) }}>
      {el.src ? (
        <AssetImg src={el.src} draggable={false} style={{ objectFit: el.fit ?? 'cover', ...(el.filter ? { filter: el.filter } : {}) }} />
      ) : (
        <span className="fx-img-ph">
          <ImagePlus />
          {editable && !mask && <small>{t('el.addImage')}</small>}
        </span>
      )}
    </div>
  )
  return el.frame === 'polaroid' ? <div className="el-polaroid">{inner}</div> : inner
}

/* ───────── looping animations ───────── */

export const LOOPS = ['float', 'pulse', 'spin', 'wiggle', 'bounce', 'swing', 'twinkle', 'draw']

export function Loop({ type, children }) {
  if (!type) return children
  return <div className={`el-lp el-lp-${type}`}>{children}</div>
}

/** Kinds this module draws. */
export const NEW_KINDS = new Set(['shape', 'stroke', 'icon', 'graphic', 'table', 'chart', 'mockup'])

/** The look of an Elements-panel element, or null for kinds drawn elsewhere. */
export function renderElement(el, theme, { editing, onPatch } = {}) {
  switch (el.kind) {
    case 'shape':
      return <ShapeView el={el} theme={theme} />
    case 'stroke':
      return <StrokeView el={el} theme={theme} />
    case 'icon':
      return <IconView el={el} theme={theme} />
    case 'graphic':
      return <GraphicView el={el} theme={theme} />
    case 'table':
      return <TableView el={el} theme={theme} editing={editing} onPatch={onPatch} />
    case 'chart':
      return <ChartView el={el} theme={theme} />
    case 'mockup':
      return <MockupView el={el} />
    default:
      return null
  }
}
