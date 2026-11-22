// Toolbar sections for the Elements-panel kinds: colours, outlines, line ends, icon style,
// table rows/columns and style, chart type/data/options, mockup picture and finish, image frames.
import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, ChartColumn, Database, ImagePlus, Minus, Plus, Settings2, Smartphone, Sparkles, Square, Table, Trash2, X,
} from 'lucide-react'
import { t } from '../../i18n/index.js'
import { ColorPop, Pop, Slider, toHex } from '../Toolbar.jsx'
import { ART } from './art.jsx'
import { seriesColors } from './colors.js'
import { ICON_WEIGHTS, ICONS } from './icons.js'
import { CHART_TYPES, DEVICES, FINISHES, LINE_DASHES, LINE_ENDS, LOOPS, ONE_SERIES, TABLE_STYLES, chartData } from './render.jsx'
import { maskCss } from './shapes.js'

const KINDS = new Set(['shape', 'stroke', 'icon', 'graphic', 'table', 'chart', 'mockup', 'image'])

/** Name of an element kind for the layers list (null for kinds the toolbar names itself). */
export function kindLabel(kind) {
  return ['shape', 'stroke', 'icon', 'graphic', 'table', 'chart', 'mockup'].includes(kind) ? t(`el.kind.${kind}`) : null
}

/* ───────── small parts ───────── */

function Seg({ value, options, onChange, render }) {
  return (
    <div className="et-seg">
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? 'on' : ''} onClick={() => onChange(o)} title={t(`el.opt.${o}`)}>
          {render ? render(o) : t(`el.opt.${o}`)}
        </button>
      ))}
    </div>
  )
}

function Check({ label, checked, onChange }) {
  return (
    <label className="tb-inline et-check">
      {label}
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** A text/number input that commits on blur or Enter (one undo step per edit, not per key). */
function CellInput({ value, onCommit, numeric, className = '', ...rest }) {
  const [draft, setDraft] = useState(String(value ?? ''))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? ''))
  }, [value])
  const commit = () => {
    if (numeric) {
      const v = Number(String(draft).replace(',', '.').replace(/\s/g, ''))
      const n = Number.isFinite(v) ? v : 0
      setDraft(String(n))
      if (n !== value) onCommit(n)
    } else if (draft !== value) onCommit(draft)
  }
  return (
    <input
      {...rest}
      className={`et-input ${className}`}
      value={draft}
      inputMode={numeric ? 'decimal' : undefined}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        e.stopPropagation()
      }}
    />
  )
}

function Swatch({ color, onChange, title }) {
  return (
    <label className="et-swatch" style={{ background: color }} title={title}>
      <input type="color" value={toHex(color)} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function LinePreview({ dash, start, end }) {
  const d = dash === 'dashed' ? '6 4' : dash === 'dotted' ? '0 5' : undefined
  return (
    <svg width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7H30" strokeDasharray={d} />
      {start === 'arrow' && <path d="M9 2L4 7L9 12" />}
      {end === 'arrow' && <path d="M25 2L30 7L25 12" />}
      {end === 'triangle' && <path d="M24 2L31 7L24 12Z" fill="currentColor" />}
      {end === 'circle' && <circle cx="28" cy="7" r="3" fill="currentColor" />}
      {end === 'square' && <rect x="25" y="4" width="6" height="6" fill="currentColor" />}
      {end === 'bar' && <path d="M30 2V12" />}
    </svg>
  )
}

function CapIcon({ kind, flip }) {
  return (
    <span style={{ display: 'inline-flex', transform: flip ? 'scaleX(-1)' : undefined }}>
      <LinePreview end={kind === 'arrow' ? 'arrow' : kind} />
    </span>
  )
}

function LoopPop({ first, set }) {
  return (
    <Pop title={t('el.tb.loop')} button={<span className="tb-wide"><Sparkles size={15} /> {t('el.tb.loop')}</span>} align="right">
      <div className="tb-anim-grid et-loops">
        <button type="button" className={!first.loop ? 'on' : ''} onClick={() => set({ loop: undefined })}>
          {t('el.opt.none')}
        </button>
        {LOOPS.map((l) => (
          <button key={l} type="button" className={first.loop === l ? 'on' : ''} onClick={() => set({ loop: l })}>
            <span className={`et-loop-demo el-lp el-lp-${l}`}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path pathLength="1" d="M12 3l2.6 5.6 6 .7-4.5 4 1.3 6L12 16.3 6.6 19.3l1.3-6-4.5-4 6-.7z" fill={l === 'draw' ? 'none' : '#8b5cf6'} stroke="#8b5cf6" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>
            {t(`el.loop.${l}`)}
          </button>
        ))}
      </div>
    </Pop>
  )
}

/* ───────── charts: data editor ───────── */

function ChartData({ el, theme, set }) {
  const data = chartData(el.data)
  const colors = seriesColors(el, theme)
  const one = ONE_SERIES.has(el.chart)
  const perRow = el.chart === 'pie' || el.chart === 'donut' || (el.chart === 'meter' && el.multi)
  const series = one ? data.series.slice(0, 1) : data.series
  const put = (next) => set({ data: next })
  const setColor = (i, c) => {
    const list = seriesColors(el, theme).slice(0, Math.max(i + 1, el.colors?.length ?? 0))
    list[i] = c
    set({ colors: list })
  }
  return (
    <div className="et-data">
      <div className="et-data-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('el.tb.category')}</th>
              {series.map((s, si) => (
                <th key={si}>
                  <span className="et-th">
                    {!perRow && <Swatch color={colors[si]} onChange={(c) => setColor(si, c)} title={t('el.tb.color')} />}
                    <CellInput value={s.name} onCommit={(v) => put({ ...data, series: data.series.map((x, j) => (j === si ? { ...x, name: v } : x)) })} aria-label={t('el.tb.seriesName')} />
                    {!one && data.series.length > 1 && (
                      <button type="button" className="et-x" onClick={() => put({ ...data, series: data.series.filter((_, j) => j !== si) })} aria-label={t('el.tb.remove')}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {data.labels.map((l, r) => (
              <tr key={r}>
                <td>
                  <span className="et-th">
                    {perRow && <Swatch color={colors[r % colors.length]} onChange={(c) => setColor(r, c)} title={t('el.tb.color')} />}
                    <CellInput value={l} onCommit={(v) => put({ ...data, labels: data.labels.map((x, j) => (j === r ? v : x)) })} aria-label={t('el.tb.category')} />
                  </span>
                </td>
                {series.map((s, si) => (
                  <td key={si}>
                    <CellInput
                      numeric
                      className="num"
                      value={s.values[r]}
                      onCommit={(v) => put({ ...data, series: data.series.map((x, j) => (j === si ? { ...x, values: x.values.map((y, k) => (k === r ? v : y)) } : x)) })}
                      aria-label={`${l} · ${s.name}`}
                    />
                  </td>
                ))}
                <td>
                  {data.labels.length > 1 && (
                    <button
                      type="button"
                      className="et-x"
                      onClick={() => put({ labels: data.labels.filter((_, j) => j !== r), series: data.series.map((x) => ({ ...x, values: x.values.filter((_, j) => j !== r) })) })}
                      aria-label={t('el.tb.remove')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tb-row">
        <button
          type="button"
          className="tb-btn wide"
          disabled={data.labels.length >= 24}
          onClick={() => put({ labels: [...data.labels, t('el.tb.newCat', { n: data.labels.length + 1 })], series: data.series.map((x) => ({ ...x, values: [...x.values, 0] })) })}
        >
          <Plus size={14} /> {t('el.tb.addCat')}
        </button>
        {!one && (
          <button
            type="button"
            className="tb-btn wide"
            disabled={data.series.length >= 8}
            onClick={() => put({ ...data, series: [...data.series, { name: t('el.c.series', { n: data.series.length + 1 }), values: data.labels.map(() => 0) }] })}
          >
            <Plus size={14} /> {t('el.tb.addSeries')}
          </button>
        )}
      </div>
      {one && <p className="et-note">{t(el.chart === 'progress' ? 'el.tb.progressNote' : 'el.tb.oneSeriesNote')}</p>}
    </div>
  )
}

/** The data editor; also opens when the chart is double-clicked on the page. */
function ChartDataPop({ el, theme, set }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onOpen = (e) => e.detail === el.id && setOpen(true)
    window.addEventListener('qalam:chart-data', onOpen)
    return () => window.removeEventListener('qalam:chart-data', onOpen)
  }, [el.id])
  useEffect(() => {
    if (!open) return
    const h = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open])
  return (
    <span className="tb-pop" ref={ref}>
      <button type="button" className={`tb-btn wide ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} title={t('el.tb.data')}>
        <Database size={15} /> {t('el.tb.data')}
      </button>
      {open && (
        <div className="tb-panel et-data-panel">
          <ChartData el={el} theme={theme} set={set} />
        </div>
      )}
    </span>
  )
}

/* ───────── the sections ───────── */

/**
 * @param {{ sel: object[], theme: object, act: object }} p — act.patch(patch|fn), act.replaceImage(file)
 */
export default function ElementTools({ sel, theme, act }) {
  const file = useRef(null)
  const kinds = new Set(sel.map((e) => e.kind))
  if (kinds.size !== 1) return null
  const kind = [...kinds][0]
  if (!KINDS.has(kind)) return null
  const first = sel[0]
  const one = sel.length === 1
  const set = (patch) => act.patch(patch)

  const picker = (
    <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { e.target.files[0] && act.replaceImage(e.target.files[0]); e.target.value = '' }} />
  )

  if (kind === 'image') {
    // frame shape for any picture; Unsplash photos also show their photographer
    const credit = one && first.src && first.credit
    return (
      <>
        {credit && (
          <span className="et-credit">
            {t('el.ph.credit')}{' '}
            <a href={credit.url ?? credit.link} target="_blank" rel="noopener noreferrer">
              {credit.name}
            </a>{' '}
            · {credit.by}
          </span>
        )}
        <Pop title={t('el.tb.frame')} button={<span className="tb-wide"><Square size={15} /> {t('el.tb.frame')}</span>}>
          {(close) => (
            <div className="et-frames">
              <button type="button" className={!first.mask && !first.frame ? 'on' : ''} onClick={() => { set({ mask: undefined, frame: undefined }); close() }} title={t('el.f.none')}>
                <span className="et-frame-ic" />
              </button>
              <button type="button" className={first.frame === 'polaroid' ? 'on' : ''} onClick={() => { set({ mask: undefined, frame: 'polaroid' }); close() }} title={t('el.f.polaroid')}>
                <span className="et-frame-ic polaroid" />
              </button>
              {['ellipse', 'rounded', 'squircle', 'arch', 'pill', 'blob1', 'blob2', 'blob3', 'heart', 'star5', 'hexagon', 'diamond', 'flower', 'seal', 'drop', 'leaf', 'triangle'].map((m) => (
                <button key={m} type="button" className={first.mask === m ? 'on' : ''} onClick={() => { set({ mask: m, frame: undefined }); close() }} title={t(`el.s.${m === 'ellipse' ? 'circle' : m}`)}>
                  <span className="et-frame-ic" style={maskCss(m)} />
                </button>
              ))}
            </div>
          )}
        </Pop>
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'shape') {
    return (
      <>
        <ColorPop value={first.color ?? theme.accent} onChange={(c) => set({ color: c })} title={t('el.tb.color')} theme={theme}>
          <span className="tb-fill" style={{ background: first.outline ? 'transparent' : (first.color ?? theme.accent), boxShadow: first.outline ? `inset 0 0 0 3px ${first.color ?? theme.accent}` : undefined }} />
        </ColorPop>
        <Pop title={t('el.tb.stroke')} button={<Square size={16} />}>
          <div className="tb-col">
            <Check label={t('el.tb.outline')} checked={first.outline} onChange={(v) => set({ outline: v, sw: v ? (first.sw || 0.35) : 0 })} />
            <Slider label={t('el.tb.strokeW')} value={first.sw ?? 0} min={0} max={2} step={0.05} onChange={(v) => set({ sw: v })} />
            {!first.outline && (
              <label className="tb-inline">
                {t('el.tb.strokeC')}
                <input type="color" value={toHex(first.sc ?? theme.text)} onChange={(e) => set({ sc: e.target.value, sw: first.sw || 0.2 })} />
              </label>
            )}
          </div>
        </Pop>
        <LoopPop first={first} set={set} />
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'stroke') {
    return (
      <>
        <ColorPop value={first.color ?? theme.text} onChange={(c) => set({ color: c })} title={t('el.tb.color')} theme={theme}>
          <span className="tb-fill" style={{ background: first.color ?? theme.text }} />
        </ColorPop>
        <Pop title={t('el.tb.lineStyle')} button={<LinePreview dash={first.dash} start={first.start} end={first.end} />}>
          <div className="tb-col et-line">
            <Slider label={t('el.tb.thick')} value={first.thick ?? 0.3} min={0.05} max={2} step={0.05} onChange={(v) => set({ thick: v })} />
            <span className="tb-label">{t('el.tb.lineStyle')}</span>
            <Seg value={first.dash ?? 'solid'} options={LINE_DASHES} onChange={(v) => set({ dash: v })} render={(o) => <LinePreview dash={o} />} />
            <span className="tb-label">{t('el.tb.start')}</span>
            <Seg value={first.start ?? 'none'} options={LINE_ENDS} onChange={(v) => set({ start: v })} render={(o) => (o === 'none' ? '—' : <CapIcon kind={o} flip />)} />
            <span className="tb-label">{t('el.tb.end')}</span>
            <Seg value={first.end ?? 'none'} options={LINE_ENDS} onChange={(v) => set({ end: v })} render={(o) => (o === 'none' ? '—' : <CapIcon kind={o} />)} />
          </div>
        </Pop>
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'icon') {
    const Icon = ICONS[first.icon]
    return (
      <>
        <ColorPop value={first.color ?? theme.text} onChange={(c) => set({ color: c })} title={t('el.tb.color')} theme={theme}>
          <span className="tb-fill" style={{ background: first.color ?? theme.text }} />
        </ColorPop>
        <Pop title={t('el.tb.style')} button={<span className="tb-wide">{Icon && <Icon size={17} weight={first.weight ?? 'regular'} />} {t('el.tb.style')}</span>}>
          {(close) => (
            <div className="tb-grid three et-weights">
              {ICON_WEIGHTS.map((w) => (
                <button key={w} type="button" className={(first.weight ?? 'regular') === w ? 'on' : ''} onClick={() => { set({ weight: w }); close() }}>
                  {Icon && <Icon size={20} weight={w} />}
                  <span>{t(`el.w.${w}`)}</span>
                </button>
              ))}
            </div>
          )}
        </Pop>
        <LoopPop first={first} set={set} />
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'graphic') {
    const art = ART[first.g]
    const base = art ? art.colors(theme) : []
    const cur = base.map((c, i) => first.colors?.[i] ?? c)
    const setColor = (i, c) => act.patch((e) => {
      const b = ART[e.g]?.colors(theme) ?? []
      const list = b.map((x, j) => e.colors?.[j] ?? x)
      list[i] = c
      return { colors: list }
    })
    return (
      <>
        {cur.map((c, i) => (
          <ColorPop key={i} value={c} onChange={(v) => setColor(i, v)} title={t('el.tb.color')} theme={theme}>
            <span className="tb-fill" style={{ background: c }} />
          </ColorPop>
        ))}
        {first.colors && (
          <button type="button" className="tb-btn" onClick={() => set({ colors: undefined })} title={t('el.tb.resetColors')}>
            <X size={14} />
          </button>
        )}
        <LoopPop first={first} set={set} />
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'table') {
    const rows = first.rows ?? [['']]
    const cols = Math.max(1, ...rows.map((r) => r.length))
    const resize = (dr, dc) =>
      act.patch((e) => {
        const r0 = e.rows ?? [['']]
        const c0 = Math.max(1, ...r0.map((r) => r.length))
        const nc = Math.max(1, Math.min(12, c0 + dc))
        let next = r0.map((r) => Array.from({ length: nc }, (_, i) => r[i] ?? ''))
        if (dr > 0 && next.length < 30) next = [...next, Array.from({ length: nc }, () => '')]
        if (dr < 0 && next.length > 1) next = next.slice(0, -1)
        const h = e.h ?? 30
        return { rows: next, h: dr ? Math.max(4, h + (h / r0.length) * (next.length - r0.length)) : h }
      })
    return (
      <>
        <ColorPop value={first.color ?? theme.accent} onChange={(c) => set({ color: c })} title={t('el.tb.accent')} theme={theme}>
          <span className="tb-fill" style={{ background: first.color ?? theme.accent }} />
        </ColorPop>
        <ColorPop value={first.textColor ?? theme.text} onChange={(c) => set({ textColor: c })} title={t('el.tb.textColor')} theme={theme}>
          <span className="tb-a" style={{ '--c': first.textColor ?? theme.text }}>A</span>
        </ColorPop>
        <span className="tb-size">
          <button type="button" onClick={() => act.patch((e) => ({ size: Math.max(0.5, Math.round(((e.size ?? 1.3) - 0.1) * 10) / 10) }))} aria-label={t('el.tb.smaller')}>
            <Minus size={14} />
          </button>
          <input value={Math.round((first.size ?? 1.3) * 10)} onChange={(e) => { const v = Number(e.target.value); if (v > 0) set({ size: v / 10 }) }} title={t('el.tb.textSize')} />
          <button type="button" onClick={() => act.patch((e) => ({ size: Math.round(((e.size ?? 1.3) + 0.1) * 10) / 10 }))} aria-label={t('el.tb.bigger')}>
            <Plus size={14} />
          </button>
        </span>
        <Pop title={t('el.tb.table')} button={<span className="tb-wide"><Table size={15} /> {t('el.tb.table')}</span>}>
          <div className="tb-col et-table">
            <div className="et-rc">
              <span>{t('el.tb.rows')} <b>{rows.length}</b></span>
              <span className="et-pm">
                <button type="button" onClick={() => resize(-1, 0)} disabled={rows.length <= 1} aria-label={t('el.tb.removeRow')}><Minus size={14} /></button>
                <button type="button" onClick={() => resize(1, 0)} disabled={rows.length >= 30} aria-label={t('el.tb.addRow')}><Plus size={14} /></button>
              </span>
            </div>
            <div className="et-rc">
              <span>{t('el.tb.cols')} <b>{cols}</b></span>
              <span className="et-pm">
                <button type="button" onClick={() => resize(0, -1)} disabled={cols <= 1} aria-label={t('el.tb.removeCol')}><Minus size={14} /></button>
                <button type="button" onClick={() => resize(0, 1)} disabled={cols >= 12} aria-label={t('el.tb.addCol')}><Plus size={14} /></button>
              </span>
            </div>
            <span className="tb-label">{t('el.tb.tableStyle')}</span>
            <Seg value={first.tstyle ?? 'grid'} options={TABLE_STYLES} onChange={(v) => set({ tstyle: v })} />
            <Check label={t('el.tb.header')} checked={first.head !== false} onChange={(v) => set({ head: v })} />
            <Check label={t('el.tb.firstCol')} checked={first.firstCol} onChange={(v) => set({ firstCol: v })} />
            <Seg
              value={first.align ?? 'left'}
              options={['left', 'center', 'right']}
              onChange={(v) => set({ align: v })}
              render={(o) => (o === 'left' ? <AlignLeft size={15} /> : o === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />)}
            />
            <p className="et-note">{t('el.tablesHint')}</p>
          </div>
        </Pop>
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'chart') {
    const type = first.chart ?? 'column'
    return (
      <>
        <Pop title={t('el.tb.chartType')} button={<span className="tb-wide"><ChartColumn size={15} /> {t(`el.c.${type}`)}</span>}>
          {(close) => (
            <div className="tb-grid three et-types">
              {CHART_TYPES.map((c) => (
                <button key={c} type="button" className={type === c ? 'on' : ''} onClick={() => { set({ chart: c }); close() }}>
                  {t(`el.c.${c}`)}
                </button>
              ))}
            </div>
          )}
        </Pop>
        {one && <ChartDataPop el={first} theme={theme} set={set} />}
        <Pop title={t('el.tb.options')} button={<Settings2 size={16} />}>
          <div className="tb-col et-opts">
            {!['progress', 'meter'].includes(type) && <Check label={t('el.tb.values')} checked={type === 'pie' || type === 'donut' ? first.values !== false : first.values} onChange={(v) => set({ values: v })} />}
            {!['progress', 'meter'].includes(type) && <Check label={t('el.tb.legend')} checked={first.legend !== false} onChange={(v) => set({ legend: v })} />}
            {['column', 'bar', 'stacked', 'line', 'area'].includes(type) && <Check label={t('el.tb.grid')} checked={first.grid !== false} onChange={(v) => set({ grid: v })} />}
            {['column', 'bar', 'stacked'].includes(type) && <Check label={t('el.tb.round')} checked={first.round !== false} onChange={(v) => set({ round: v })} />}
            {['line', 'area'].includes(type) && <Check label={t('el.tb.smooth')} checked={first.smooth} onChange={(v) => set({ smooth: v })} />}
            {type === 'meter' && <Check label={t('el.tb.multi')} checked={first.multi} onChange={(v) => set({ multi: v })} />}
            {['progress', 'meter'].includes(type) && (
              <label className="tb-inline">
                {t('el.tb.max')}
                <CellInput numeric className="num short" value={first.max > 0 ? first.max : 100} onCommit={(v) => set({ max: v > 0 ? v : 100 })} />
              </label>
            )}
            <label className="tb-inline">
              {t('el.tb.unit')}
              <CellInput className="short" value={first.unit ?? ''} onCommit={(v) => set({ unit: v.slice(0, 8) })} placeholder="%" />
            </label>
            <Slider label={t('el.tb.textSize')} value={Math.round((first.fs ?? 1) * 100)} min={50} max={250} step={5} onChange={(v) => set({ fs: v / 100 })} unit="%" />
            <label className="tb-inline">
              {t('el.tb.textColor')}
              <input type="color" value={toHex(first.textColor ?? theme.text)} onChange={(e) => set({ textColor: e.target.value })} />
            </label>
          </div>
        </Pop>
        <span className="tb-sep" />
      </>
    )
  }

  if (kind === 'mockup') {
    const fin = first.finish ?? (first.device === 'browser' ? 'silver' : 'dark')
    return (
      <>
        {one && (
          <button type="button" className="tb-btn wide" onClick={() => file.current?.click()}>
            <ImagePlus size={16} /> {first.src ? t('el.tb.replace') : t('el.addImage')}
          </button>
        )}
        {one && first.src && (
          <button type="button" className="tb-btn" onClick={() => set({ src: null })} title={t('el.tb.removeImage')}>
            <Trash2 size={15} />
          </button>
        )}
        <Pop title={t('el.tb.device')} button={<span className="tb-wide"><Smartphone size={15} /> {t(`el.m.${first.device ?? 'phone'}`)}</span>}>
          {(close) => (
            <div className="tb-col">
              <div className="tb-grid">
                {Object.keys(DEVICES).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={first.device === d ? 'on' : ''}
                    onClick={() => {
                      act.patch((e) => {
                        const [vw, vh] = DEVICES[d].vb
                        return { device: d, h: Math.round(((e.w * 16) / 9 / (vw / vh)) * 100) / 100 }
                      })
                      close()
                    }}
                  >
                    {t(`el.m.${d}`)}
                  </button>
                ))}
              </div>
              <span className="tb-label">{t('el.tb.finish')}</span>
              <div className="et-finishes">
                {Object.entries(FINISHES).map(([id, f]) => (
                  <button key={id} type="button" className={fin === id ? 'on' : ''} style={{ background: f.body }} onClick={() => set({ finish: id })} title={t(`el.fin.${id}`)} aria-label={t(`el.fin.${id}`)} />
                ))}
              </div>
            </div>
          )}
        </Pop>
        {picker}
        <span className="tb-sep" />
      </>
    )
  }
  return null
}

