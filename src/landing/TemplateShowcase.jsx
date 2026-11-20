import { useEffect, useMemo, useRef, useState } from 'react'
import ProBadge from '../components/ProBadge.jsx'
import { ArrowRight, Student, ChalkboardTeacher, Briefcase, ArrowUpRight } from '@phosphor-icons/react'
import Slide from '../editor/Slide.jsx'
import { TEMPLATES, CATEGORIES } from '../editor/templates.js'
import './template-showcase.css'
import { t } from '../i18n/index.js'

const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? ''
const CATS = CATEGORIES.filter((c) => c.id !== 'all' && TEMPLATES.some((tpl) => tpl.cat === c.id))

const slideOf = (tpl) => ({ id: `lp-tpl-${tpl.id}`, type: 'title', title: tpl.sample.title, subtitle: tpl.sample.subtitle, elements: [] })

/** One template tile. Copies used for the seamless loop are hidden from AT and tab order. */
function Tile({ tpl, copy, onStart }) {
  return (
    <button
      type="button"
      className="tm-card"
      onClick={onStart}
      tabIndex={copy ? -1 : 0}
      aria-hidden={copy || undefined}
      aria-label={t('tm.startWith', { name: tpl.name })}
    >
      <span className="tm-frame">
        <span className="tm-slide"><Slide slide={slideOf(tpl)} theme={tpl.theme} preview /></span>
        {tpl.pro && <ProBadge size="sm" className="tm-pro" />}
        <span className="tm-cap">
          <span>
            <b>{tpl.name}</b>
            <small>{catLabel(tpl.cat)}</small>
          </span>
          <i><ArrowUpRight size={14} weight="bold" /></i>
        </span>
      </span>
    </button>
  )
}

function Row({ items, reverse, speed, onStart }) {
  return (
    <div className={`tm-row${reverse ? ' rev' : ''}`} style={{ '--speed': `${speed}s` }}>
      <div className="tm-track">
        {items.map((tpl) => <Tile key={tpl.id} tpl={tpl} onStart={onStart} />)}
        {items.map((tpl) => <Tile key={`c-${tpl.id}`} tpl={tpl} copy onStart={onStart} />)}
      </div>
    </div>
  )
}

/** Templates wall: two counter-scrolling rows on a slightly tilted plane. */
export function TemplateShowcase({ onStart }) {
  const root = useRef(null)
  const [live, setLive] = useState(false)

  // Only animate (and pay for 48 live slides moving) while the wall is on screen.
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) { setLive(true); return }
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Split the list between the rows so no template shows twice on screen.
  const [a, b] = useMemo(() => [TEMPLATES.filter((_, i) => i % 2 === 0), TEMPLATES.filter((_, i) => i % 2 === 1)], [])

  return (
    // `live` sits on the root as a data attribute: the landing's reveal observer adds `.in`
    // to `.lp-reveal` by hand, and a React-driven className there would wipe it on re-render.
    <div className="tm" ref={root} data-live={live || undefined}>
      <div className="tm-wall lp-reveal">
        <span className="tm-glow g1" aria-hidden="true" />
        <span className="tm-glow g2" aria-hidden="true" />
        <div className="tm-plane">
          <Row items={a} speed={70} onStart={onStart} />
          <Row items={b} speed={84} reverse onStart={onStart} />
        </div>
      </div>

      <div className="tm-foot lp-reveal">
        <div className="tm-cats" aria-label={t('tm.cats')}>
          {CATS.map((c) => (
            <span key={c.id}>{c.label}<sup>{TEMPLATES.filter((tpl) => tpl.cat === c.id).length}</sup></span>
          ))}
        </div>
        <button type="button" className="tm-cta" onClick={onStart}>
          {t('tm.all')}
          <span className="tm-count">{TEMPLATES.length}</span>
          <ArrowRight size={15} weight="bold" />
        </button>
      </div>
    </div>
  )
}

/* ───────── audiences ───────── */

const AUDIENCE_ICONS = [Student, ChalkboardTeacher, Briefcase]
const audience = () =>
  AUDIENCE_ICONS.map((icon, i) => {
    const [title, text, ...tags] = t(`tm.aud.${i}`).split('|')
    return { icon, title, text, tags }
  })

export function AudienceCards({ onStart }) {
  // Ink circle grows from where the pointer entered and is sized to just cover the far corner.
  const enter = (e) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const d = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) + 4
    el.style.setProperty('--ox', `${x}px`)
    el.style.setProperty('--oy', `${y}px`)
    el.style.setProperty('--d', `${Math.ceil(d)}px`)
    el.style.setProperty('--sx', `${x}px`)
    el.style.setProperty('--sy', `${y}px`)
  }
  // Spotlight follows the pointer, batched to one write per frame.
  const raf = useRef(0)
  const move = (e) => {
    const el = e.currentTarget
    const { clientX, clientY } = e
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--sx', `${clientX - r.left}px`)
      el.style.setProperty('--sy', `${clientY - r.top}px`)
    })
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return (
    <section className="lp-section ts-aud" aria-label={t('tm.audience')}>
      {audience().map((a, i) => (
        <button key={a.title} type="button" className="ts-aud-card lp-reveal" style={{ '--i': i }} onPointerEnter={enter} onPointerMove={move} onClick={onStart}>
          <span className="ts-aud-top">
            <span className="ts-aud-ic"><a.icon size={22} weight="duotone" /></span>
            <span className="ts-aud-go" aria-hidden="true"><ArrowUpRight size={15} weight="bold" /></span>
          </span>
          <h3>{a.title}</h3>
          <p>{a.text}</p>
          <span className="ts-aud-tags">{a.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
        </button>
      ))}
    </section>
  )
}
