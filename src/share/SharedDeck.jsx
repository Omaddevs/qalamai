// Public, view-only page of a shared presentation: /v/<shareId>. No account needed.
// ← / → (or the arrows, or a swipe) move between pages; «Taqdimot qiliş» goes full screen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Presentation } from 'lucide-react'
import { Wordmark } from '../components/ui.jsx'
import { getSharedDesign } from '../api.js'
import { t } from '../i18n/index.js'
import { applySeo, NOINDEX } from '../seo.js'
import Slide from '../editor/Slide.jsx'
import { Present } from '../editor/Present.jsx'
import { motionOf, transitionOf } from '../editor/motion.js'
import { getTemplate } from '../editor/templates.js'
import '../editor/editor.css'
import './shared.css'

export default function SharedDeck({ shareId }) {
  const [state, setState] = useState({ step: 'loading' }) // loading · ready {design} · error {code, msg}
  const [i, setI] = useState(0)
  const [presenting, setPresenting] = useState(false)
  const strip = useRef(null)
  const touch = useRef(null)

  const load = useCallback(() => {
    setState({ step: 'loading' })
    getSharedDesign(shareId)
      .then((design) => {
        setState({ step: 'ready', design })
        // a user's own work, shared by link: viewable, never indexed (nginx sends X-Robots-Tag too)
        applySeo({ title: `${design.name} · QalamAI`, path: null, robots: NOINDEX })
      })
      .catch((e) => setState({ step: 'error', code: e.status === 404 || e.status === 400 ? 'gone' : 'net', msg: e.message }))
  }, [shareId])
  useEffect(load, [load])
  // never indexed, whatever the load ends in (nginx sends X-Robots-Tag: noindex too)
  useEffect(() => applySeo({ title: 'QalamAI', path: null, robots: NOINDEX }), [])

  const design = state.design
  const slides = design?.deck.slides ?? []
  const theme = useMemo(() => {
    if (!design) return null
    const tpl = getTemplate(design.deck.templateId ?? design.templateId)
    return { ...tpl.theme, accent: design.deck.accent ?? tpl.theme.accent }
  }, [design])

  const n = slides.length
  const at = Math.min(i, Math.max(0, n - 1))
  const next = useCallback(() => setI((x) => Math.min(n - 1, x + 1)), [n])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

  useEffect(() => {
    if (presenting || !n) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        next()
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        prev()
      } else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presenting, n, next, prev])

  // keep the current page's thumbnail in view
  useEffect(() => {
    strip.current?.querySelector('.sv-thumb.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [at])

  const closePresent = useCallback(() => setPresenting(false), [])

  if (state.step === 'loading') return <div className="page-loading" role="status" aria-busy="true" />

  if (state.step === 'error') {
    return (
      <div className="sv sv-msg">
        <a href="/" className="sv-brand" aria-label="QalamAI">
          <Wordmark size={22} />
        </a>
        <div className="sv-msg-box" role="alert">
          <h1>{state.code === 'gone' ? t('view.notFound') : state.msg}</h1>
          {state.code === 'gone' ? (
            <p>{t('view.notFoundHint')}</p>
          ) : (
            <button className="btn primary" onClick={load}>
              {t('pe.retry')}
            </button>
          )}
          <a className="btn" href="/">
            {t('view.make')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="sv">
      <header className="sv-top">
        <a href="/" className="sv-brand" aria-label="QalamAI">
          <Wordmark size={20} />
        </a>
        <h1 className="sv-name" title={design.name}>
          {design.name}
        </h1>
        <div className="sv-top-right">
          <a className="btn sv-make" href="/">
            {t('view.make')}
          </a>
          {n > 0 && (
            <button className="btn primary" onClick={() => setPresenting(true)}>
              <Presentation size={15} /> <span>{t('view.present')}</span>
            </button>
          )}
        </div>
      </header>

      {n === 0 ? (
        <div className="sv-msg-box">
          <p>{t('view.empty')}</p>
        </div>
      ) : (
        <>
          <main
            className="sv-stage"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX)
              if (Math.abs(dx) > 50) (dx < 0 ? next : prev)()
              touch.current = null
            }}
          >
            <button className="sv-arrow left" onClick={prev} disabled={at === 0} aria-label={t('view.prev')}>
              <ChevronLeft size={22} />
            </button>
            <div className="sv-slide">
              <Slide key={`${slides[at].id}-${at}`} slide={slides[at]} theme={theme} index={at} playing />
            </div>
            <button className="sv-arrow right" onClick={next} disabled={at === n - 1} aria-label={t('view.next')}>
              <ChevronRight size={22} />
            </button>
          </main>

          <div className="sv-count" aria-live="polite">
            {at + 1} / {n}
          </div>

          <nav className="sv-strip" ref={strip} aria-label={t('view.pages')}>
            {slides.map((s, k) => (
              <button key={s.id ?? k} className={`sv-thumb ${k === at ? 'on' : ''}`} onClick={() => setI(k)} aria-label={`${k + 1}`} aria-current={k === at ? 'true' : undefined}>
                <Slide slide={s} theme={theme} index={k} />
                <span>{k + 1}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {presenting && <Present slides={slides} theme={theme} start={at} transition={transitionOf(design?.deck)} motion={motionOf(design?.deck)} onClose={closePresent} />}
    </div>
  )
}
