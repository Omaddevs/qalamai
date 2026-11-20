// Building blocks shared by the admin pages.
import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import { apiUrl } from './api.js'
import { Sparkline } from './charts.jsx'
import { fmt, pct } from './format.js'

export const RANGES = [
  { days: 7, label: '7 kun' },
  { days: 30, label: '30 kun' },
  { days: 90, label: '90 kun' },
  { days: 365, label: '1 yil' },
]

export function PageHead({ title, sub, children }) {
  return (
    <header className="ad-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="ad-head-tools">{children}</div>}
    </header>
  )
}

export function Segmented({ value, onChange, options }) {
  const ref = useRef(null)
  const [pill, setPill] = useState(null)
  useEffect(() => {
    const el = ref.current?.querySelector('.on')
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, options.length])
  return (
    <div className="ad-seg" ref={ref} role="tablist">
      {pill && <span className="ad-seg-pill" style={{ transform: `translateX(${pill.left - 4}px)`, width: pill.width }} />}
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function RangePicker({ days, onChange }) {
  return <Segmented value={days} onChange={onChange} options={RANGES.map((r) => ({ value: r.days, label: r.label }))} />
}

export function RefreshButton({ onClick, busy }) {
  return (
    <button className={`ad-icon ad-icon-line ${busy ? 'spinning' : ''}`} onClick={onClick} aria-label="Yangilaş" title="Yangilaş">
      <RefreshCw size={16} />
    </button>
  )
}

export function Card({ title, sub, right, children, className = '' }) {
  return (
    <section className={`ad-card ${className}`}>
      {(title || right) && (
        <div className="ad-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** Change against the previous period of the same length. */
export function Delta({ now, prev, invert = false }) {
  if (!prev && !now) return <span className="ad-delta flat"><Minus size={12} /> 0%</span>
  if (!prev) return <span className="ad-delta up"><ArrowUpRight size={13} /> yangi</span>
  const d = (now - prev) / prev
  const good = invert ? d < 0 : d > 0
  if (Math.abs(d) < 0.005) return <span className="ad-delta flat"><Minus size={12} /> 0%</span>
  return (
    <span className={`ad-delta ${good ? 'up' : 'down'}`} title={`Oldingi davr: ${fmt(prev)}`}>
      {d > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {pct(Math.abs(d), 0)}
    </span>
  )
}

export function Kpi({ label, value, icon: Icon, delta, foot, spark, accent }) {
  return (
    <div className={`ad-card ad-kpi ${accent ? 'accent' : ''}`}>
      <div className="ad-kpi-top">
        <span className="ad-kpi-label">
          {Icon && (
            <span className="ad-kpi-ic">
              <Icon size={15} strokeWidth={2} />
            </span>
          )}
          {label}
        </span>
        {delta}
      </div>
      <div className="ad-kpi-row">
        <b className="ad-kpi-value">{value}</b>
        {spark && <Sparkline values={spark} />}
      </div>
      {foot && <p className="ad-kpi-foot">{foot}</p>}
    </div>
  )
}

export function Flag({ cc }) {
  const ok = cc && /^[A-Z]{2}$/.test(cc)
  return <span className="ad-flag">{ok ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐'}</span>
}

export function Code({ children }) {
  return <span className="ad-code">{children}</span>
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="ad-card ad-errbox">
      <p>{error?.message ?? 'Maʼlumotni yuklab bölmadi'}</p>
      {onRetry && (
        <button className="ad-btn" onClick={onRetry}>
          Qayta uriniş
        </button>
      )}
    </div>
  )
}

/** Load-on-change with stale data kept on screen while the next one loads. */
export function useLoad(fn, deps) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setBusy(true)
    fn().then(
      (d) => live && (setData(d), setError(null), setBusy(false)),
      (e) => live && (setError(e), setBusy(false)),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, busy, reload: () => setTick((t) => t + 1) }
}

export const MethodDot = ({ m }) => <span className={`ad-method-dot m-${m}`} />

export function Avatar({ u, size = 36 }) {
  const [ok, setOk] = useState(Boolean(u.avatarUrl))
  const initials = (u.name || u.email || u.phone || '?').replace(/^\+?\d{3}/, '').trim().slice(0, 1).toUpperCase() || '?'
  const hue = [...u.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return ok ? (
    <img className="ad-avatar" src={apiUrl(u.avatarUrl)} alt="" style={{ width: size, height: size }} onError={() => setOk(false)} />
  ) : (
    <span className="ad-avatar ad-avatar-x" style={{ width: size, height: size, '--h': hue }}>
      {initials}
    </span>
  )
}

