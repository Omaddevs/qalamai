// Presenting (full screen, animations play) and printing the deck to PDF.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Slide from './Slide.jsx'
import { TRANSITION_DUR, reducedMotion } from './motion.js'

/**
 * Full-screen slideshow. → / Space / click: next · ←: back · Esc: leave.
 * `transition` (motion.js TRANSITIONS) runs between pages; `motion` (a MOTIONS preset) brings in the
 * content of pages that have no animations of their own.
 */
export function Present({ slides, theme, start = 0, transition = 'fade', motion = null, onClose }) {
  const [view, setView] = useState({ i: start, from: null, dir: 1, n: 0 })
  const box = useRef(null)
  const tr = reducedMotion() ? 'none' : transition
  const dur = TRANSITION_DUR[tr] ?? 0
  const go = useCallback(
    (step) =>
      setView((v) => {
        const i = Math.min(slides.length - 1, Math.max(0, v.i + step))
        return i === v.i ? v : { i, from: dur ? v.i : null, dir: step > 0 ? 1 : -1, n: v.n + 1 }
      }),
    [slides.length, dur],
  )
  const next = useCallback(() => go(1), [go])
  const prev = useCallback(() => go(-1), [go])
  // the old page is dropped once the transition is over
  useEffect(() => {
    if (view.from == null) return
    const tm = setTimeout(() => setView((v) => (v.n === view.n ? { ...v, from: null } : v)), dur * 1000 + 60)
    return () => clearTimeout(tm)
  }, [view.n, view.from, dur])

  useEffect(() => {
    box.current?.requestFullscreen?.().catch(() => {})
    const onKey = (e) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault()
        next()
      }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) prev()
      if (e.key === 'Escape') onClose()
    }
    const onFs = () => !document.fullscreenElement && onClose()
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [next, prev, onClose])

  const { i, from } = view
  const moving = from != null && slides[from]
  return createPortal(
    <div className="present" ref={box} onClick={next}>
      <div className="present-stage" data-tr={tr} style={{ '--pt-dur': `${dur}s`, '--pt-dir': view.dir }}>
        {moving && (
          <div key={`out-${view.n}`} className="pt-page out">
            <Slide slide={slides[from]} theme={theme} index={from} />
          </div>
        )}
        <div key={`in-${view.n}`} className={`pt-page ${moving ? 'in' : ''}`}>
          <Slide key={slides[i].id} slide={slides[i]} theme={theme} index={i} playing motion={motion} />
        </div>
      </div>
      <div className="present-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={prev} disabled={i === 0} aria-label="Oldingi">
          <ChevronLeft size={18} />
        </button>
        <span>
          {i + 1} / {slides.length}
        </span>
        <button type="button" onClick={next} disabled={i === slides.length - 1} aria-label="Keyingi">
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={onClose} aria-label="Çiqiş">
          <X size={18} />
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Every page, one per sheet, for the browser's "Save as PDF". Calls onDone after printing. */
export function PrintDeck({ slides, theme, watermark, onDone }) {
  useEffect(() => {
    let alive = true
    const done = () => onDone()
    window.addEventListener('afterprint', done, { once: true })
    ;(async () => {
      await document.fonts?.ready
      await Promise.all([...document.querySelectorAll('.print-root img')].map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r }))))
      await new Promise((r) => setTimeout(r, 120))
      if (alive) window.print()
    })()
    return () => {
      alive = false
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])

  return createPortal(
    <div className="print-root">
      {slides.map((s, i) => (
        <div key={s.id} className="print-page">
          <Slide slide={s} theme={theme} index={i} />
          {watermark && <span className="print-wm">qalam ai</span>}
        </div>
      ))}
    </div>,
    document.body,
  )
}
