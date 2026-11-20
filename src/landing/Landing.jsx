import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Sparkle, ArrowRight, Play, Plus, List, X, PresentationChart, FileText, GraduationCap, Files, TextAa, Briefcase, TelegramLogo, InstagramLogo, YoutubeLogo, BookOpen, Books, ListNumbers, ChartLineUp, CurrencyCircleDollar, Heart, EnvelopeSimple, ChartBar, Quotes, Confetti,
} from '@phosphor-icons/react'
import { QalamNib, Wordmark } from '../components/ui.jsx'
import { SIGNUP_BONUS } from '../../shared/coins.js'
import { COLORS } from '../data.js'
import { t } from '../i18n/index.js'
import '../editor/editor.css'
import ProductMock from './ProductMock.jsx'
import HeroCursors from './HeroCursors.jsx'
import LangSwitch from './LangSwitch.jsx'
import FeatureShowcase from './FeatureShowcase.jsx'
import HowItWorks from './HowItWorks.jsx'
import Facts from './Facts.jsx'
import Pricing from './Pricing.jsx'
import { TemplateShowcase, AudienceCards } from './TemplateShowcase.jsx'
import './landing.css'

/* ───────────────────────── helpers ───────────────────────── */

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const NAV = [
  { id: 'imkoniyatlar', key: 'features' },
  { id: 'qanday', key: 'how' },
  { id: 'shablonlar', key: 'templates' },
  { id: 'narxlar', key: 'pricing' },
  { id: 'savollar', key: 'faq' },
].map((n) => ({ ...n, get label() { return t(`lp.nav.${n.key}`) } }))

// Hash routing belongs to the app — in-page links scroll instead of touching location.hash.
const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })

/** Adds `.in` to every `.lp-reveal` once it scrolls into view. */
function useReveal(root) {
  useEffect(() => {
    const els = root.current?.querySelectorAll('.lp-reveal') ?? []
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    // Hero content is above the fold: reveal it all together on the next frame instead of
    // waiting for per-element intersection (the tall product mock used to lag behind / stay hidden).
    const hero = [...els].filter((el) => el.closest('.lp-hero'))
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => hero.forEach((el) => el.classList.add('in'))))
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    els.forEach((el) => { if (!el.closest('.lp-hero')) io.observe(el) })
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [root])
}

// Each document type gets its own capsule: brand colour from COLORS + three themed icon tiles (main one centred).
const HEADLINE_WORDS = [
  { id: 'presentation', color: 'purple', icons: [ChartBar, PresentationChart, Play] },
  { id: 'essay', color: 'sky', icons: [BookOpen, FileText, Quotes] },
  { id: 'coursework', color: 'indigo', icons: [Books, GraduationCap, ListNumbers] },
  { id: 'business', color: 'teal', icons: [ChartLineUp, Briefcase, CurrencyCircleDollar] },
  { id: 'invite', color: 'pink', icons: [Heart, Confetti, EnvelopeSimple] },
].map((h) => ({ ...h, get w() { return t(`lp.h1.w.${h.id}`) } }))

/** Width-animated italic word; `i` is driven by the headline so the slide capsule stays in sync. */
function RotatingWord({ word }) {
  const [w, setW] = useState(null)
  const sizer = useRef(null)
  // Re-measure when the word changes and whenever the sizer resizes (web font swap, viewport change).
  useLayoutEffect(() => {
    const el = sizer.current
    if (!el) return
    const measure = () => setW(el.getBoundingClientRect().width)
    measure()
    let alive = true
    document.fonts?.ready.then(() => alive && measure())
    document.fonts?.addEventListener?.('loadingdone', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(el, { box: 'border-box' })
    const late = [setTimeout(measure, 400), setTimeout(measure, 1500)] // belt and braces for slow font swaps
    return () => {
      alive = false
      ro.disconnect()
      late.forEach(clearTimeout)
      document.fonts?.removeEventListener?.('loadingdone', measure)
    }
  }, [word])
  return (
    <span className="lp-it lp-rot" style={w ? { width: w } : undefined}>
      <span className="lp-rot-sizer" ref={sizer} aria-hidden="true">{word}</span>
      <span className="lp-rot-word" key={word}>{word}</span>
    </span>
  )
}

function Headline() {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reducedMotion()) return
    const timer = setInterval(() => setI((x) => (x + 1) % HEADLINE_WORDS.length), 2600)
    return () => clearInterval(timer)
  }, [])
  return (
    <h1 className="lp-h1 lp-reveal" aria-label={t('lp.h1.aria')}>
      <span className="lp-line" aria-hidden="true">
        {t('lp.h1.l1')}
        <span className="lp-cap nib">
          <span className="ink" />
          <span className="nib"><QalamNib height="100%" /></span>
        </span>
        ,
      </span>
      <span className="lp-line" aria-hidden="true">
        {t('lp.h1.l2')} <RotatingWord word={HEADLINE_WORDS[i].w} />
        <span className="lp-cap kinds">
          {HEADLINE_WORDS.map((h, k) => {
            const c = COLORS[h.color]
            return (
              <span
                key={h.id}
                className={`k ${k === i ? 'on' : ''}`}
                style={{ '--band': c.band, '--from': c.from, '--to': c.to }}
              >
                {h.icons.map((Icon, n) => (
                  <span key={n} className={`t t${n + 1}`}>
                    <Icon weight={n === 1 ? 'fill' : 'bold'} />
                  </span>
                ))}
              </span>
            )
          })}
        </span>
      </span>
      <span className="lp-line" aria-hidden="true">
        {t('lp.h1.l3a')} <span className="lp-it">{t('lp.h1.l3b')}</span>
        <span className="lp-cap files">
          <span className="f f1"><b>PPTX</b></span>
          <span className="f f2"><b>DOCX</b></span>
          <span className="f f3"><b>PDF</b></span>
        </span>
      </span>
    </h1>
  )
}

/* ───────────────────────── header ───────────────────────── */

function Header({ onStart, onLogin }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  // scroll-spy: highlight the section currently in the middle band of the viewport
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean)
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    const top = () => window.scrollY < 300 && setActive(null)
    window.addEventListener('scroll', top, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', top)
    }
  }, [])

  // close the mobile menu on Escape
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  const go = (id) => {
    setOpen(false)
    scrollToId(id)
  }
  return (
    <header className={`lp-nav ${scrolled ? 'scrolled' : ''} ${open ? 'open' : ''}`}>
      <div className="lp-bar">
        <div className="lp-bar-row">
          <button className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t('lp.nav.home')}>
            <Wordmark size={19} />
          </button>
          <nav className="lp-links" aria-label={t('lp.nav.main')}>
            {NAV.map((n) => (
              <button key={n.id} className={active === n.id ? 'on' : ''} aria-current={active === n.id ? 'true' : undefined} onClick={() => go(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="lp-nav-right">
            <LangSwitch />
            <button className="lp-btn lp-btn-primary lp-nav-cta" onClick={onStart}>
              {t('lp.startFree')}
            </button>
            <button className="lp-burger" onClick={() => setOpen((o) => !o)} aria-label={t('lp.nav.menu')} aria-expanded={open}>
              {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lp-mobile-menu">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => go(n.id)}>{n.label}</button>
            ))}
            <div className="lp-mobile-cta">
              <button className="lp-btn lp-btn-soft" onClick={onLogin}>{t('lp.login')}</button>
              <button className="lp-btn lp-btn-primary" onClick={onStart}>{t('lp.startFree')} <ArrowRight size={15} weight="bold" /></button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

/* ───────────────────────── hero + product mockup ───────────────────────── */

function Hero({ onStart }) {
  const ref = useRef(null)
  return (
    <section className="lp-hero" ref={ref}>
      <HeroCursors hero={ref} />
      <div className="lp-hero-glow" aria-hidden="true" />
      <Headline />
      <p className="lp-sub lp-reveal">
        {t('lp.sub')}
      </p>
      <div className="lp-hero-cta lp-reveal">
        <button className="lp-btn lp-btn-primary lg" onClick={onStart}>
          {t('lp.ctaStart')} <ArrowRight size={16} weight="bold" />
        </button>
        <button className="lp-btn lp-btn-soft lg" onClick={() => scrollToId('qanday')}>
          <Play size={14} weight="fill" /> {t('lp.nav.how')}
        </button>
      </div>
      <div className="lp-reveal lp-reveal-up">
        <ProductMock />
      </div>
    </section>
  )
}

/* ───────────────────────── features ───────────────────────── */

function Features({ onStart }) {
  return (
    <section className="lp-section" id="imkoniyatlar">
      <FeatureShowcase onStart={onStart} />
    </section>
  )
}

/* ───────────────────────── templates ───────────────────────── */

function Templates({ onStart }) {
  return (
    <section className="lp-section lp-tpl" id="shablonlar">
      <div className="lp-head lp-reveal">
        <span className="lp-eyebrow">{t('lp.tpl.eyebrow')}</span>
        <h2 className="lp-h2">{t('lp.tpl.title1')} <em>{t('lp.tpl.titleEm')}</em> {t('lp.tpl.title2')}</h2>
        <p>{t('lp.tpl.lead')}</p>
      </div>
      <TemplateShowcase onStart={onStart} />
    </section>
  )
}

/* ───────────────────────── FAQ ───────────────────────── */

const faqList = () =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [t(`lp.faq.q${n}`), t(`lp.faq.a${n}`, { bonus: SIGNUP_BONUS })])

function FaqItem({ q, a, id, open, onToggle }) {
  return (
    <div className={`lp-qa${open ? ' open' : ''}`}>
      <h3>
        <button aria-expanded={open} aria-controls={`${id}-a`} id={`${id}-q`} onClick={onToggle}>
          <span>{q}</span>
          <span className="pm" aria-hidden="true"><Plus size={16} weight="bold" /></span>
        </button>
      </h3>
      <div className="lp-qa-body" id={`${id}-a`} role="region" aria-labelledby={`${id}-q`} inert={open ? undefined : ''}>
        <div><p>{a}</p></div>
      </div>
    </div>
  )
}

function Faq({ onContact }) {
  const [open, setOpen] = useState(0)
  const FAQ = faqList()
  const half = Math.ceil(FAQ.length / 2)
  const cols = [FAQ.slice(0, half).map((f, i) => [f, i]), FAQ.slice(half).map((f, i) => [f, i + half])]
  const item = ([[q, a], i]) => (
    <FaqItem key={q} q={q} a={a} id={`faq-${i}`} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
  )
  return (
    <section className="lp-faq-panel" id="savollar">
      <div className="lp-head lp-reveal">
        <span className="lp-eyebrow">{t('lp.faq.eyebrow')}</span>
        <h2 className="lp-h2">{t('lp.faq.title1')} <em>{t('lp.faq.titleEm')}</em></h2>
      </div>
      <div className="lp-faq-grid lp-reveal">
        <div className="lp-faq-col">{cols[0].map(item)}</div>
        <div className="lp-faq-col">
          {cols[1].map(item)}
          <div className="lp-qa lp-qa-ask">
            <span>{t('lp.faq.notFound')}</span>
            <button className="lp-pill" onClick={onContact}>
              {t('lp.faq.contact')} <span className="ic"><ArrowRight size={11} weight="bold" /></span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── CTA + footer ───────────────────────── */

const CTA_TILES = [
  { Icon: PresentationChart, cls: 't1' },
  { Icon: FileText, cls: 't2' },
  { Icon: Files, cls: 't3' },
  { Icon: TextAa, cls: 't4' },
]

const CTA_STARS = [
  [12, 30, 0], [22, 78, 1.2], [31, 12, 2.4], [44, 88, 0.6], [57, 20, 1.8], [68, 84, 3], [79, 34, 0.9], [88, 70, 2.1], [93, 22, 1.5], [6, 58, 2.7],
]

function FinalCta({ onStart }) {
  const ref = useRef(null)
  // Spotlight follows the pointer via CSS vars — no re-render.
  const move = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <section className="lp-cta lp-reveal" ref={ref} onPointerMove={move}>
      <span className="lp-cta-spot" aria-hidden="true" />
      <span className="lp-cta-grid" aria-hidden="true" />
      <span className="lp-cta-beam" aria-hidden="true" />
      <div className="lp-cta-rings" aria-hidden="true"><span /><span /><span /></div>
      {CTA_STARS.map(([x, y, d], i) => (
        <i key={i} className="lp-cta-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} aria-hidden="true" />
      ))}
      {CTA_TILES.map(({ Icon, cls }) => (
        <span key={cls} className={`lp-cta-tile ${cls}`} aria-hidden="true"><Icon size={26} weight="duotone" /></span>
      ))}
      <div className="lp-cta-inner">
        <span className="lp-cta-badge"><Sparkle size={12} weight="fill" /> {t('lp.cta.badge')}</span>
        <h2>
          <span className="lp-cta-metal">{t('lp.cta.l1')}</span><br />
          <span className="lp-cta-line">
            {t('lp.cta.l2a') && <><span className="lp-cta-metal">{t('lp.cta.l2a')}</span> </>}
            <em>Qalam</em> <span className="lp-cta-nib" aria-hidden="true"><QalamNib height={34} /></span>
            {t('lp.cta.l2b') && <> <span className="lp-cta-metal">{t('lp.cta.l2b')}</span></>}
          </span>
        </h2>
        <svg className="lp-cta-ink" viewBox="0 0 320 24" aria-hidden="true">
          <path d="M4 16 C 60 4, 120 22, 170 12 S 270 6, 316 14" />
        </svg>
        <p>{t('lp.cta.text')}</p>
        <button className="lp-cta-btn" onClick={onStart}>
          <span className="lp-cta-av"><QalamNib height={24} /></span>
          {t('lp.startFree')}
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </section>
  )
}

function Footer({ onStart }) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <Wordmark size={22} />
        <div className="lp-social">
          <span className="lbl">{t('lp.ft.social')}</span>
          <span className="ic" title="Telegram"><TelegramLogo size={17} /></span>
          <span className="ic" title="Instagram"><InstagramLogo size={17} /></span>
          <span className="ic" title="YouTube"><YoutubeLogo size={17} /></span>
        </div>
      </div>

      <div className="lp-footer-mid">
        <div className="lp-footer-reach" id="aloqa">
          <b>{t('lp.ft.reach')}</b>
          <div className="lp-tg">
            <span className="lp-tg-ic"><TelegramLogo size={19} weight="fill" /></span>
            <span className="lp-tg-txt">
              <strong>{t('lp.ft.tg')} <em><i />{t('lp.ft.online')}</em></strong>
              <small>{t('lp.ft.reply')}</small>
            </span>
            <span className="lp-tg-go" aria-hidden="true"><ArrowRight size={14} weight="bold" /></span>
          </div>
        </div>
        <nav className="lp-footer-cols" aria-label="Footer">
          <div>
            <b>{t('lp.ft.product')}</b>
            <button onClick={onStart}>{t('lp.ft.aiPres')}</button>
            <button onClick={onStart}>{t('lp.ft.essays')}</button>
            <button onClick={onStart}>{t('lp.ft.files')}</button>
          </div>
          <div>
            <b>{t('lp.ft.pages')}</b>
            {NAV.slice(0, 4).map((n) => <button key={n.id} onClick={() => scrollToId(n.id)}>{n.label}</button>)}
          </div>
          <div>
            <b>{t('lp.ft.help')}</b>
            <button onClick={() => scrollToId('savollar')}>{t('lp.nav.faq')}</button>
            <button onClick={onStart}>{t('lp.ft.alifbo')}</button>
            <button onClick={onStart}>{t('lp.ft.edu')}</button>
          </div>
        </nav>
      </div>

      <div className="lp-footer-giant" aria-hidden="true"><span className="q">qalam</span><span className="a">ai</span></div>

      <div className="lp-footer-bottom">
        <span>{t('lp.ft.rights', { year: new Date().getFullYear() })}</span>
        <span className="links">
          <span>{t('lp.ft.terms')}</span>
          <span>{t('lp.ft.privacy')}</span>
          <span>{t('lp.ft.love')}</span>
        </span>
      </div>
    </footer>
  )
}

/* ───────────────────────── page ───────────────────────── */

export default function Landing({ onStart, onLogin }) {
  const root = useRef(null)
  useReveal(root)
  useEffect(() => {
    const prev = document.title
    document.title = t('lp.title')
    const desc = document.querySelector('meta[name="description"]')
    const prevDesc = desc?.getAttribute('content')
    desc?.setAttribute('content', t('lp.sub'))
    return () => {
      document.title = prev
      if (desc && prevDesc != null) desc.setAttribute('content', prevDesc)
    }
  }, [])
  return (
    <div className="lp" ref={root}>
      <Header onStart={onStart} onLogin={onLogin} />
      <div className="lp-canvas">
        <Hero onStart={onStart} />
      </div>
      <main className="lp-main">
        <Facts />
        <Features onStart={onStart} />
        <HowItWorks />
        <Templates onStart={onStart} />
        <AudienceCards onStart={onStart} />
        <Pricing onStart={onStart} />
      </main>
      <div className="lp-end">
        <Faq onContact={() => scrollToId('aloqa')} />
        <FinalCta onStart={onStart} />
        <Footer onStart={onStart} />
      </div>
    </div>
  )
}
