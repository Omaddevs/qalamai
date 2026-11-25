// "QalamAI is working" — the screen between pressing Yaratiş and the editor opening.
// Four steps (topic → outline → slides/pages → design) with the real result appearing piece by
// piece: the outline items, then every slide or page, then the template's colours.
// The result is built before this opens; once the AI backend streams, the same steps follow its
// events instead of the clock below.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, ArrowRight, Info } from '@phosphor-icons/react'
import { QalamNib } from '../components/ui.jsx'
import { t } from '../i18n/index.js'
import './generate.css'

const STEPS = ['analyze', 'outline', 'write', 'design']
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** How long each step takes (ms) for this many outline items and slides. */
function timeline(outlineN, total) {
  const k = reducedMotion() ? 0.35 : 1
  const d = [900, 380 + outlineN * 150, Math.min(3000, 300 + total * 190), 750].map((x) => x * k)
  const ends = d.reduce((acc, x) => [...acc, (acc.at(-1) ?? 0) + x], [])
  return { d, ends, total: ends.at(-1) }
}

/** Headings of a generated document page (for the outline of referat, kurs işi …). */
export const headingsOf = (pages) =>
  pages
    .flatMap((html) => [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()))
    .filter(Boolean)

export default function GenerateOverlay({ topic, kind, unit, outline, total, renderThumb, format = 'slides', templateName, note, onDone, onCancel }) {
  const items = outline.slice(0, 12)
  const [plan] = useState(() => timeline(items.length, total))
  const [now, setNow] = useState(0)
  const finished = useRef(false)
  const grid = useRef(null)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    onDone()
  }

  // one clock drives every step
  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (ts) => {
      const e = ts - start
      setNow(e)
      if (e < plan.total + 650) raf = requestAnimationFrame(tick)
      else finish()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !finished.current && onCancel()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel])

  const step = plan.ends.findIndex((end) => now < end) // -1 = all done
  const done = step === -1
  const at = (i) => Math.min(1, Math.max(0, (now - (plan.ends[i - 1] ?? 0)) / plan.d[i]))
  const shownItems = Math.ceil(at(1) * items.length)
  const written = Math.min(total, Math.floor(at(2) * total + (step > 2 || done ? 1 : 0)))
  const designed = step > 3 || done || (step === 3 && at(3) > 0.25)
  const pct = Math.min(100, Math.round((now / plan.total) * 100))

  // keep the slide being written in view
  useEffect(() => {
    const box = grid.current
    const el = box?.children[Math.min(written, total - 1)]
    if (!box || !el) return
    const top = el.offsetTop - box.offsetTop
    if (top + el.offsetHeight > box.scrollTop + box.clientHeight || top < box.scrollTop) box.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' })
  }, [written, total])

  const detail = (i) =>
    i === 0
      ? t('gn.d.analyze')
      : i === 1
        ? t('gn.d.outline', { n: items.length })
        : i === 2
          ? `${Math.min(written, total)} / ${total} ${unit}`
          : t('gn.d.design', { name: templateName })

  const cols = format === 'doc' ? (total > 8 ? 5 : 4) : total > 12 ? 5 : total > 6 ? 4 : 3

  return createPortal(
    <div className={`gn ${done ? 'is-done' : ''}`} role="dialog" aria-modal="true" aria-label={t('gn.title')}>
      <div className="gn-bg" aria-hidden="true">
        <span className="gn-aurora a1" />
        <span className="gn-aurora a2" />
        <span className="gn-grid" />
      </div>

      <div className="gn-card">
        <header className="gn-head">
          <span className={`gn-orb ${done ? 'ok' : ''}`} aria-hidden="true">
            <span className="gn-orb-ring" />
            {done ? <Check size={26} weight="bold" /> : <QalamNib height={30} />}
          </span>
          <div className="gn-head-text">
            <small>
              {kind} · {done ? t('gn.s.done') : t('gn.title')}
            </small>
            <h2>{topic}</h2>
          </div>
          <span className="gn-pct" aria-live="polite">
            {pct}
            <i>%</i>
          </span>
        </header>

        <div className="gn-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>

        <div className="gn-body">
          <div className="gn-left">
            <ol className="gn-steps">
              {STEPS.map((s, i) => {
                const state = done || i < step ? 'ok' : i === step ? 'on' : 'wait'
                return (
                  <li key={s} className={state}>
                    <span className="gn-step-ic">{state === 'ok' ? <Check size={12} weight="bold" /> : <i />}</span>
                    <div>
                      <b>{t(s === 'write' && format === 'doc' ? 'gn.s.writeDoc' : `gn.s.${s}`)}</b>
                      {state !== 'wait' && <small>{detail(i)}</small>}
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className={`gn-outline ${step >= 1 || done ? 'show' : ''}`}>
              <div className="gn-outline-head">{t('ad.agenda')}</div>
              <ol>
                {items.slice(0, done || step > 1 ? items.length : shownItems).map((x, i) => (
                  <li key={i} style={{ '--i': i }}>
                    <span>{i + 1}</span>
                    {x}
                  </li>
                ))}
                {step === 1 && shownItems < items.length && <li className="gn-typing" aria-hidden="true"><i /><i /><i /></li>}
              </ol>
            </div>
          </div>

          <div className="gn-stage">
            {step === 0 && (
              <div className="gn-scan" aria-hidden="true">
                <span>{topic}</span>
              </div>
            )}
            <div ref={grid} className={`gn-grid-thumbs ${format} ${designed ? 'designed' : ''} ${step === 0 ? 'dim' : ''}`} style={{ '--cols': cols }}>
              {Array.from({ length: total }, (_, i) => {
                const state = i < written ? 'ok' : i === written && step === 2 ? 'on' : 'wait'
                return (
                  <div key={i} className={`gn-thumb ${state}`} style={{ '--i': i }}>
                    {state === 'ok' ? renderThumb(i) : <span className="gn-skel"><i /><i /><i /></span>}
                    <span className="gn-thumb-n">{i + 1}</span>
                    {state === 'on' && (
                      <span className="gn-pen" aria-hidden="true">
                        <QalamNib height={18} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <footer className="gn-foot">
          {note ? (
            <span className="gn-note">
              <Info size={14} weight="bold" /> {note}
            </span>
          ) : (
            <span className="gn-note muted">{t(format === 'doc' ? 'gn.tipDoc' : 'gn.tip')}</span>
          )}
          {done ? (
            <span className="gn-opening">{t('gn.d.done')}</span>
          ) : (
            <>
              <button type="button" className="gn-cancel" onClick={onCancel}>
                <X size={13} weight="bold" /> {t('gn.cancel')}
              </button>
              {step >= 2 && (
                <button type="button" className="gn-skip" onClick={finish}>
                  {t('gn.open')} <ArrowRight size={14} weight="bold" />
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
