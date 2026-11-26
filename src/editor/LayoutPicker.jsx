import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n/index.js'
import Slide from './Slide.jsx'
import { PICKS, samplePage } from './layouts.jsx'
import './layout-picker.css'

/**
 * "Add page" menu: every layout, previewed in the deck's own theme. Rendered in a portal above
 * the button, because the page strip scrolls and would clip it.
 */
export default function LayoutPicker({ anchor, theme, onPick, onClose }) {
  const panel = useRef(null)
  const [pos, setPos] = useState(null)
  const pages = useMemo(() => ['blank', ...PICKS].map((type) => ({ type, slide: { ...samplePage(type), id: `pick-${type}`, elements: [] } })), [])

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const w = Math.min(560, window.innerWidth - 24)
    setPos({ left: Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12)), bottom: window.innerHeight - r.top + 10, width: w })
  }, [anchor])

  useEffect(() => {
    const away = (e) => {
      if (!panel.current?.contains(e.target) && !anchor.contains(e.target)) onClose()
    }
    const key = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [anchor, onClose])

  if (!pos) return null
  return createPortal(
    <div ref={panel} className="lp-pick" style={pos} role="menu" aria-label={t('ly.pick')}>
      <div className="lp-pick-head">{t('ly.pick')}</div>
      <div className="lp-pick-grid">
        {pages.map(({ type, slide }) => (
          <button key={type} role="menuitem" className="lp-pick-item" onClick={() => onPick(type)}>
            <span className="lp-pick-thumb">
              <Slide slide={slide} theme={theme} index={2} preview />
            </span>
            <span className="lp-pick-name">{t(`ly.name.${type}`)}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}
