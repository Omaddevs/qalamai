// The presenter's script, as it is kept in the design:
//
//   deck.narration = {
//     v: 1, lang: 'uz', tone: 'lesson', length: 'normal',
//     voice: { g: 'f'|'m', rate: 1 },
//     presenter: { id: 'madina' } | { photo: 'asset:…' },
//     side: 'right', captions: true,
//     slides: { [slideId]: { sig, say: [{ text, do?, on?, ref? }] } }
//   }
//
// `ref` is the anchor's text when the script was written (anchors.js findAnchor), `sig` the
// fingerprint of the page then: a page edited afterwards is marked so its script can be rewritten.
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Slide from '../Slide.jsx'
import { collectAnchors, sigOf } from './anchors.js'
import { presenterById } from './characters.jsx'

export const TONES = ['lesson', 'pitch', 'talk']
export const LENGTHS = ['short', 'normal', 'long']
export const DRAW_IDS = ['underline', 'circle', 'highlight', 'box', 'arrow', 'spot', 'point']
export const NARRATE_MAX_SLIDES = 40

/** The deck's narration settings, with defaults for anything not chosen yet. */
export function narrationOf(deck, lang) {
  const n = deck.narration ?? {}
  const presenter = n.presenter ?? { id: 'madina' }
  return {
    v: 1,
    lang: n.lang ?? lang,
    tone: n.tone ?? 'lesson',
    length: n.length ?? 'normal',
    voice: { g: n.voice?.g ?? (presenter.id ? presenterById(presenter.id).gender : 'f'), rate: n.voice?.rate ?? 1 },
    presenter,
    side: n.side ?? 'right',
    captions: n.captions ?? true,
    slides: n.slides ?? {},
  }
}

/** True when the deck has something to say on at least one page. */
export const hasScript = (deck) => deck.slides.some((s) => deck.narration?.slides?.[s.id]?.say?.length)

/** A model answer for one page → what the design keeps (cue anchors remembered by their text). */
export function scriptPart(say, anchors) {
  return say.map((p) => {
    const a = p.do != null && Number.isInteger(p.on) ? anchors[p.on] : null
    return a ? { text: p.text, do: p.do, on: p.on, ref: a.t } : { text: p.text }
  })
}

/** Pages whose text changed after their script was written. */
export function staleSlides(deck, anchorsById) {
  const out = new Set()
  for (const s of deck.slides) {
    const n = deck.narration?.slides?.[s.id]
    const a = anchorsById.get(s.id)
    if (n?.say?.length && a && n.sig && n.sig !== sigOf(a)) out.add(s.id)
  }
  return out
}

/**
 * Draws every page off-screen once and hands back their anchors:
 * onDone(Map<slideId, anchors without elements>). Pictures and fonts are waited for, briefly.
 */
export function AnchorProbe({ slides, theme, onDone }) {
  const box = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  const key = slides.map((s) => s.id).join('|')
  useEffect(() => {
    let alive = true
    ;(async () => {
      await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))])
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (!alive || !box.current) return
      const pages = [...box.current.querySelectorAll(':scope > .probe-page')]
      const map = new Map()
      pages.forEach((p, i) => {
        const el = p.querySelector('.slide')
        map.set(slides[i].id, collectAnchors(el).map(({ k, t }) => ({ k, t })))
      })
      done.current(map)
    })()
    return () => {
      alive = false
    }
    // the probe is made again for another set of pages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return createPortal(
    <div className="pr-probe" ref={box} aria-hidden="true">
      {slides.map((s, i) => (
        <div key={s.id} className="probe-page">
          <Slide slide={s} theme={theme} index={i} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
