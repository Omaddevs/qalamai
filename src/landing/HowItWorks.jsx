import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, TextT, Layout, Sparkle, DownloadSimple, Check } from '@phosphor-icons/react'
import './how-it-works.css'
import { t } from '../i18n/index.js'

const STEPS = [
  {
    n: '01', icon: TextT,
    Visual: TopicVisual,
  },
  {
    n: '02', icon: Layout,
    Visual: TemplateVisual,
  },
  {
    n: '03', icon: Sparkle,
    Visual: GenerateVisual,
  },
  {
    n: '04', icon: DownloadSimple,
    Visual: ExportVisual,
  },
].map((s, i) => ({
  ...s,
  get title() { return t(`lp.how.s${i + 1}.title`) },
  get text() { return t(`lp.how.s${i + 1}.text`) },
}))

const AUTOPLAY_MS = 5200
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ───────── per-step mini visuals (decorative) ───────── */

function TopicVisual() {
  return (
    <div className="hw-vis hw-vis-topic" aria-hidden="true">
      <div className="hw-input">
        <span className="hw-typed">{t('lp.how.s1.sample')}</span>
        <span className="hw-caret" />
      </div>
      <div className="hw-chips">
        <span className="on">{t('kind.presentation')}</span>
        <span>{t('kind.essay')}</span>
        <span>{t('kind.coursework')}</span>
      </div>
    </div>
  )
}

function TemplateVisual() {
  return (
    <div className="hw-vis hw-vis-tpl" aria-hidden="true">
      {['#9a6af5', '#12b398', '#f26b4b'].map((c, i) => (
        <div key={c} className={`hw-thumb${i === 1 ? ' on' : ''}`} style={{ '--c': c }}>
          <i /><b /><b className="s" />
          {i === 1 && <span className="hw-tick"><Check size={9} weight="bold" /></span>}
        </div>
      ))}
    </div>
  )
}

function GenerateVisual() {
  return (
    <div className="hw-vis hw-vis-gen" aria-hidden="true">
      <div className="hw-gen-row"><span className="hw-dot" /><b style={{ '--w': '78%' }} /></div>
      <div className="hw-gen-row"><span className="hw-dot" /><b style={{ '--w': '62%' }} /></div>
      <div className="hw-gen-row"><span className="hw-dot" /><b style={{ '--w': '86%' }} /></div>
      <div className="hw-gen-bar"><span /></div>
    </div>
  )
}

function ExportVisual() {
  return (
    <div className="hw-vis hw-vis-exp" aria-hidden="true">
      {[['PPTX', '#f26b4b'], ['DOCX', '#3d9ff0'], ['PDF', '#e5484d']].map(([f, c]) => (
        <span key={f} className="hw-file" style={{ '--c': c }}>
          <i />{f}
        </span>
      ))}
    </div>
  )
}

/* ───────── section ───────── */

export default function HowItWorks() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const track = useRef(null)
  const section = useRef(null)
  const fromScroll = useRef(false)
  const userScroll = useRef(false)

  const go = useCallback((i) => {
    const n = (i + STEPS.length) % STEPS.length
    fromScroll.current = false
    setActive(n)
  }, [])

  // Keep the active card in view inside the horizontal track (without scrolling the page).
  useEffect(() => {
    if (fromScroll.current) return
    const el = track.current
    const card = el?.children[active]
    if (!el || !card) return
    userScroll.current = false // the scroll we start here must not be read back as a swipe
    const max = el.scrollWidth - el.clientWidth
    const base = el.firstElementChild.offsetLeft
    const last = el.lastElementChild.offsetLeft - base
    // If every card can reach the left edge, align it there; otherwise spread the small
    // overflow evenly across the steps so each step still moves the track a little.
    const left = max >= last - 4 ? card.offsetLeft - base : (active / (STEPS.length - 1)) * max
    el.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  // Swiping the track (touch / trackpad / wheel) updates the active step.
  // Only *user* scrolls count: the smooth scrollTo above also fires scroll events, and on wide
  // screens it ends at the track's max offset — reading that back used to jump 01 → 04.
  useEffect(() => {
    const el = track.current
    if (!el) return
    let timer
    const markUser = () => { userScroll.current = true }
    const onScroll = () => {
      if (!userScroll.current) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        userScroll.current = false
        const base = el.firstElementChild.offsetLeft
        const max = el.scrollWidth - el.clientWidth
        if (max <= 0) return
        const offsets = [...el.children].map((c) => c.offsetLeft - base)
        let i = 0
        if (max >= offsets[offsets.length - 1] - 4) {
          // every card can reach the left edge → pick the nearest one
          let best = Infinity
          offsets.forEach((o, k) => {
            const d = Math.abs(o - el.scrollLeft)
            if (d < best) { best = d; i = k }
          })
        } else {
          // track barely overflows → map scroll progress onto the steps
          i = Math.round((el.scrollLeft / max) * (STEPS.length - 1))
        }
        setActive((a) => {
          if (a === i) return a
          fromScroll.current = true
          return i
        })
      }, 140)
    }
    const userEvents = ['pointerdown', 'touchstart', 'wheel']
    userEvents.forEach((e) => el.addEventListener(e, markUser, { passive: true }))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      userEvents.forEach((e) => el.removeEventListener(e, markUser))
      el.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
  }, [])

  // Only autoplay while the section is on screen.
  useEffect(() => {
    const el = section.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const playing = inView && !paused && !reducedMotion()
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => go(active + 1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [playing, active, go])

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1) }
  }

  return (
    <section
      ref={section}
      className="lp-section hw"
      id="qanday"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hw-head lp-reveal">
        <h2 className="hw-title">
          {t('lp.how.title')}
          <span>{t('lp.how.sub1')} <em>{t('lp.how.subEm')}</em></span>
        </h2>
        <div className="hw-arrows">
          <button type="button" className="hw-arrow" onClick={() => go(active - 1)} aria-label={t('lp.how.prev')}>
            <ArrowLeft size={18} weight="bold" />
          </button>
          <button type="button" className="hw-arrow dark" onClick={() => go(active + 1)} aria-label={t('lp.how.next')}>
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </div>

      <ol
        ref={track}
        className="hw-track lp-reveal"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={t('lp.how.steps')}
      >
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className={`hw-card${i === active ? ' on' : ''}${i < active ? ' done' : ''}`}
            style={{ '--i': i }}
            onClick={() => go(i)}
            aria-current={i === active ? 'step' : undefined}
          >
            <div className="hw-card-body">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
            <s.Visual />
            <div className="hw-card-foot">
              <span className="hw-ic"><s.icon size={18} weight={i === active ? 'fill' : 'regular'} /></span>
              <span className="hw-n">{s.n}</span>
            </div>
            {i === active && playing && <span className="hw-timer" key={`t${active}`} style={{ '--d': `${AUTOPLAY_MS}ms` }} />}
          </li>
        ))}
      </ol>

      <div className="hw-rail lp-reveal" style={{ '--p': active / (STEPS.length - 1) }}>
        <div className="hw-rail-line"><span /></div>
        <div className="hw-pills" role="tablist" aria-label={t('lp.how.pick')}>
          {STEPS.map((s, i) => (
            <button
              key={s.n}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={t('lp.how.stepAria', { n: s.n, title: s.title })}
              className={`hw-pill${i === active ? ' on' : ''}${i < active ? ' done' : ''}`}
              onClick={() => go(i)}
            >
              {s.n}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
