import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PresentationChart, FileText, GraduationCap, TextAa, Files, ShieldCheck, Lightning, Translate, Check, PenNib,
  Sparkle, ArrowRight, CaretRight,
} from '@phosphor-icons/react'
import { Wordmark } from '../components/ui.jsx'
import { TOOL_UI } from '../files/toolMeta.js'
import './feature-showcase.css'
import { t } from '../i18n/index.js'

const TOOL_COUNT = Object.keys(TOOL_UI).length

// Needs ≥ 7 items: offsets −2…2 are on stage, −3 and ≥ 3 are hidden (above the fade / inside the box).
const FEATURE_LOOK = [
  { icon: PresentationChart, color: 'purple' },
  { icon: FileText, color: 'sky' },
  { icon: GraduationCap, color: 'indigo' },
  { icon: TextAa, color: 'teal' },
  { icon: Files, color: 'red' },
  { icon: ShieldCheck, color: 'emerald' },
  { icon: Lightning, color: 'amber' },
  { icon: Translate, color: 'sky' },
  { icon: Check, color: 'teal' },
  { icon: PenNib, color: 'pink' },
]
/** "title|tag|text" per feature, in the interface language (src/i18n/msg/templates.js). */
const features = () =>
  FEATURE_LOOK.map((look, i) => {
    const [title, tag, text] = t(`fx.${i}`, { n: TOOL_COUNT }).split('|')
    return { ...look, title, tag, text }
  })

const N = FEATURE_LOOK.length
const TICK = 2800

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Offset of card `i` from the active one, wrapped into −3 … N−4 so cards leave at the top and re-enter from the box. */
const offsetOf = (i, active) => ((((i - active) % N) + N + 3) % N) - 3

export default function FeatureShowcase({ onStart }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const root = useRef(null)
  const timer = useRef(null)

  // Only cycle while the section is on screen.
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const run = !paused && visible && !reducedMotion()
  const schedule = useCallback(() => {
    clearInterval(timer.current)
    if (run) timer.current = setInterval(() => !document.hidden && setActive((a) => (a + 1) % N), TICK)
  }, [run])
  useEffect(() => {
    schedule()
    return () => clearInterval(timer.current)
  }, [schedule])

  const go = (i) => { setActive(((i % N) + N) % N); schedule() }
  const FEATURES = features()
  const f = FEATURES[active]
  const Icon = f.icon

  return (
    <div className="fx" ref={root}>
      <div
        className="fx-stage lp-reveal"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span className="fx-dot d1" /><span className="fx-dot d2" /><span className="fx-dot d3" />
        <span className="fx-dot d4" /><span className="fx-dot d5" />

        {/* middle row guides + ghost cards on either side of the active card */}
        <span className="fx-guide top" /><span className="fx-guide bottom" />
        <span className="fx-ghost left"><i /><i /></span>
        <span className="fx-ghost right"><i /><i /></span>

        {/* box: back wall + flaps sit behind the cards, the front flap + body in front */}
        <span className="fx-box-back" aria-hidden="true">
          <span className="fx-flap l" /><span className="fx-flap r" />
        </span>

        <ul className="fx-tube" aria-label={t('fx.list')}>
          {FEATURES.map((it, i) => {
            const k = offsetOf(i, active)
            const C = it.icon
            return (
              <li
                key={i}
                className={`fx-card${k === 0 ? ' on' : ''}`}
                style={{ '--k': k }}
                data-k={k}
                aria-current={k === 0 || undefined}
              >
                <button type="button" onClick={() => go(i)} tabIndex={Math.abs(k) <= 1 ? 0 : -1}>
                  <span className={`fx-ic fx-t-${it.color}`}><C size={19} weight="duotone" /></span>
                  <span className="fx-card-txt">
                    <b>{it.title}</b>
                    <small>{it.tag}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <span className="fx-box-front" aria-hidden="true">
          <span className="fx-lid" />
          <span className="fx-body" />
          {/* brand label stuck onto the box with two strips of tape */}
          <span className="fx-label">
            <i className="fx-tape l" /><i className="fx-tape r" />
            <Wordmark size={19} />
          </span>
        </span>
      </div>

      <div className="fx-copy">
        <span className="fx-pill lp-reveal"><Sparkle size={14} weight="fill" /> {t('fx.pill')} <ArrowRight size={13} weight="bold" /></span>
        <h2 className="fx-h2 lp-reveal">
          {t('fx.h2a')} <span>{t('fx.h2b')}</span>
        </h2>

        <div className="fx-detail lp-reveal" aria-live="polite">
          <p key={active}>{f.text}</p>
          <button className="lp-link" onClick={onStart}>{t('fx.try')} <ArrowRight size={13} weight="bold" /></button>
        </div>

        <div className="fx-now lp-reveal">
          <span className="fx-now-ic" key={active}><Icon size={22} weight="duotone" /></span>
          <span className="fx-now-txt">
            <b key={`t${active}`}>{f.title}</b>
            <small>{FEATURES.slice(active + 1).concat(FEATURES.slice(0, active)).slice(0, 3).map((x) => x.title).join(', ')}</small>
          </span>
          <span className="fx-now-count">{String(active + 1).padStart(2, '0')}<em>/{N}</em></span>
          <button className="fx-next" onClick={() => go(active + 1)} aria-label={t('fx.next')}>
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
