import { useEffect, useState } from 'react'
import { Cursor } from './ProductMock.jsx'

/*
 * Three collaborators wander over the hero headline, the same way they do inside the editor mock:
 * they hover the capsules, select a word and point at the main CTA. Targets are measured from the
 * DOM on every step, so the paths stay right at any width. Purely decorative (aria-hidden).
 */

const HIDDEN = { x: null, y: null, press: false, show: false }

export default function HeroCursors({ hero }) {
  const [m, setM] = useState(HIDDEN)
  const [s, setS] = useState(HIDDEN)
  const [g, setG] = useState(HIDDEN)

  useEffect(() => {
    const root = hero.current
    if (!root) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const q = (sel) => root.querySelector(sel)
    const point = (sel, ax, ay) => {
      const node = q(sel)
      if (!node) return {}
      const b = node.getBoundingClientRect()
      if (!b.width) return {}
      const r = root.getBoundingClientRect()
      return { x: b.left - r.left + b.width * ax, y: b.top - r.top + b.height * ay, show: true }
    }
    const setters = { m: setM, s: setS, g: setG }
    // remember each cursor's target so it can follow it when the layout shifts (the rotating word changes width)
    const target = {}
    const move = (who, sel, ax = 0.5, ay = 0.5) => {
      target[who] = [sel, ax, ay]
      setters[who]((c) => ({ ...c, press: false, ...point(sel, ax, ay) }))
    }
    const follow = () => {
      for (const who of ['m', 's', 'g']) {
        if (!target[who]) continue
        const p = point(...target[who])
        if (p.show) setters[who]((c) => (Math.abs(c.x - p.x) < 1 && Math.abs(c.y - p.y) < 1 ? c : { ...c, ...p }))
      }
    }
    let followTimer = null
    const press = (who, on) => setters[who]((c) => ({ ...c, press: on }))
    const COLOR = { m: '#f97316', s: '#3b82f6', g: '#10b981' }
    const flag = (sel, cls, on, who) => {
      const node = q(sel)
      if (!node) return
      if (who) node.style.setProperty('--hc', COLOR[who])
      node.classList.toggle(cls, on)
    }
    const clearFlags = () => root.querySelectorAll('.is-hover, .is-sel').forEach((n) => n.classList.remove('is-hover', 'is-sel'))

    let timers = []
    let alive = false
    // PACE stretches the whole script; keep it in step with the cursor transition in landing.css
    const PACE = 1.8
    const at = (ms, fn) => timers.push(setTimeout(() => alive && fn(), ms * PACE))

    const SLIDES = '.lp-cap.kinds'
    const NIB = '.lp-cap.nib'
    const FILES = '.lp-cap.files'
    const WORD = '.lp-h1 .lp-line:nth-child(3) .lp-it'
    const CTA = '.lp-hero-cta .lp-btn-primary'

    const loop = () => {
      timers = []
      clearFlags()
      // enter from the edges of the headline
      move('m', '.lp-h1', 1.04, 0.15)
      move('s', '.lp-h1', -0.03, 0.85)
      move('g', '.lp-h1', 0.5, 1.12)

      // third collaborator: files capsule → main CTA → slides capsule, between the other two
      at(800, () => move('g', FILES, 0.4, 0.8))
      at(1650, () => flag(FILES, 'is-hover', true, 'g'))
      at(3000, () => {
        flag(FILES, 'is-hover', false)
        move('g', CTA, 0.3, 0.75)
      })
      at(3800, () => flag(CTA, 'is-hover', true))
      at(5800, () => {
        flag(CTA, 'is-hover', false)
        move('g', SLIDES, 0.75, 0.8)
      })
      at(6650, () => flag(SLIDES, 'is-hover', true, 'g'))
      at(7200, () => {
        flag(SLIDES, 'is-hover', false)
        move('g', '.lp-h1', 0.5, 1.12)
      })

      at(500, () => move('m', SLIDES, 0.62, 0.7))
      at(1350, () => flag(SLIDES, 'is-hover', true, 'm'))
      at(1300, () => move('s', NIB, 0.55, 0.75))
      at(2150, () => flag(NIB, 'is-hover', true, 's'))

      at(3400, () => {
        flag(SLIDES, 'is-hover', false)
        move('m', FILES, 0.55, 0.65)
      })
      at(4250, () => flag(FILES, 'is-hover', true, 'm'))

      at(4000, () => {
        flag(NIB, 'is-hover', false)
        move('s', WORD, 0.08, 0.62)
      })
      at(4850, () => press('s', true))
      at(4950, () => flag(WORD, 'is-sel', true))
      at(5150, () => press('s', false))
      at(5300, () => move('s', WORD, 0.92, 0.62))

      at(6300, () => {
        flag(FILES, 'is-hover', false)
        move('m', CTA, 0.78, 0.7)
      })
      at(7100, () => flag(CTA, 'is-hover', true))

      at(7400, () => {
        flag(WORD, 'is-sel', false)
        move('s', SLIDES, 0.3, 0.85)
      })
      at(8250, () => flag(SLIDES, 'is-hover', true, 's'))

      at(9600, () => {
        flag(CTA, 'is-hover', false)
        flag(SLIDES, 'is-hover', false)
        move('m', '.lp-h1', 1.04, 0.15)
        move('s', '.lp-h1', -0.03, 0.85)
        move('g', '.lp-h1', 0.5, 1.12)
      })
      at(11000, loop)
    }

    const stop = () => {
      alive = false
      clearInterval(followTimer)
      timers.forEach(clearTimeout)
      clearFlags()
    }
    // run only while the hero is visible
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !alive) {
        alive = true
        followTimer = setInterval(follow, 250)
        loop()
      } else if (!e.isIntersecting && alive) stop()
    }, { threshold: 0.2 })
    io.observe(root)
    return () => {
      io.disconnect()
      stop()
    }
  }, [hero])

  return (
    <div className="lp-hero-cursors" aria-hidden="true">
      <Cursor who="m" name="Ziyodbek" c={m} />
      <Cursor who="s" name="Omadbek" c={s} />
      <Cursor who="g" name="Akobir" c={g} />
    </div>
  )
}
