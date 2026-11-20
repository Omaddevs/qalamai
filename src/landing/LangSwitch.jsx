import { useEffect, useRef, useState } from 'react'
import { Globe, CaretDown, Check } from '@phosphor-icons/react'
import { LANGS, setLang, t, useLang } from '../i18n/index.js'
import './lang-switch.css'

// Interface language picker. Languages and the store live in src/i18n.
export { LANGS }

export default function LangSwitch({ className = '', up = false }) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const items = useRef([])
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  useEffect(() => {
    if (!open) return
    // focus the selected item when the menu opens
    items.current[LANGS.findIndex((l) => l.id === lang)]?.focus()
    const away = (e) => !root.current?.contains(e.target) && setOpen(false)
    const key = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        root.current?.querySelector('.lp-lang-btn')?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const i = items.current.indexOf(document.activeElement)
        const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + LANGS.length) % LANGS.length
        items.current[n]?.focus()
      }
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open, lang])

  const choose = (id) => {
    setOpen(false)
    setLang(id)
  }

  return (
    <div className={`lp-lang ${open ? 'open' : ''} ${up ? 'up' : ''} ${className}`} ref={root}>
      <button
        className="lp-lang-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('lang.current', { name: current.name })}
      >
        <Globe size={17} />
        <span className="code">{current.code}</span>
        <CaretDown size={11} weight="bold" className="caret" />
      </button>
      {open && (
        <div className="lp-lang-menu" role="menu" aria-label={t('lang.menu')}>
          <div className="lp-lang-head">{t('lang.menu')}</div>
          {LANGS.map((l, i) => (
            <button
              key={l.id}
              ref={(el) => (items.current[i] = el)}
              role="menuitemradio"
              aria-checked={l.id === lang}
              className={l.id === lang ? 'on' : ''}
              onClick={() => choose(l.id)}
            >
              <span className="badge">{l.code}</span>
              <span className="name">
                {l.name}
                {l.note && <small>{l.note}</small>}
              </span>
              {l.id === lang && <Check size={14} weight="bold" className="tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
