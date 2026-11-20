import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { COLORS } from '../data.js'
import { t } from '../i18n/index.js'

/** Qalam mascot: glossy black pen nib with smiling eyes, ink hole and slit. */
export function QalamNib({ height = 24 }) {
  return (
    <svg height={height} viewBox="-8 -8 216 366" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="nib-fill" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#2c2d31" />
          <stop offset="1" stopColor="#0b0b0d" />
        </linearGradient>
      </defs>
      <path
        d="M30 12C80 2 140 0 170 6c16 4 20 16 19 34l3 110c0 50-32 130-64 190-4 8-12 8-16 0C80 280 30 220 12 160 2 120 0 70 4 40 7 22 16 15 30 12z"
        fill="url(#nib-fill)"
        stroke="#5f6168"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="M26 72C24 44 44 24 78 20" fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="11" strokeLinecap="round" />
      <path d="M40 152q20-24 40 0M114 142q20-24 40 0" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
      <circle cx="108" cy="230" r="9" fill="#6b6e75" />
      <path d="M111 250l6 76" stroke="#6b6e75" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

/** Full brand lockup: nib mascot + italic serif "qalam" + bold sans "ai". */
export function Wordmark({ size = 22 }) {
  return (
    <span className="wordmark" style={{ fontSize: size }} aria-label="qalam ai">
      <QalamNib height={Math.round(size * 1.25)} />
      <span className="wm-qalam">qalam</span>
      <span className="wm-ai">ai</span>
    </span>
  )
}

export function AppTile({ app, size = 38, iconSize, className = '' }) {
  const c = COLORS[app.color]
  const Icon = app.icon
  return (
    <span
      className={`tile ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: `linear-gradient(145deg, ${c.from} 0%, ${c.to} 100%)`,
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.5)} strokeWidth={2.2} />
    </span>
  )
}

/** Trigger + popover that closes on outside click / Escape. */
export function Dropdown({ button, children, align = 'left', placement = 'bottom', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)
  return (
    <div className="dd" ref={ref}>
      {button({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`popover ${align} ${placement} ${className}`} role="menu">
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false, header, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          {header ?? <h3>{title}</h3>}
          <button className="icon-btn" onClick={onClose} aria-label={t('ui.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
