// Presenting (full screen, animations play) and printing the deck to PDF.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Slide from './Slide.jsx'

/** Full-screen slideshow. → / Space / click: next · ←: back · Esc: leave. */
export function Present({ slides, theme, start = 0, onClose }) {
  const [i, setI] = useState(start)
  const box = useRef(null)
  const next = useCallback(() => setI((x) => Math.min(slides.length - 1, x + 1)), [slides.length])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

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

  return createPortal(
    <div className="present" ref={box} onClick={next}>
      <div className="present-stage">
        <Slide key={slides[i].id} slide={slides[i]} theme={theme} index={i} playing />
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
