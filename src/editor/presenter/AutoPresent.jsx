// «AI taqdimotçi» — the presentation runs by itself: the presenter speaks every page in the
// deck's language, a pen draws on the page as the words reach it, captions follow the voice, and
// the next page comes when the talk on this one is over. Space pauses, ← → change the page.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowCounterClockwise, CaretLeft, CaretRight, ClosedCaptioning, CornersIn, CornersOut, Pause, Play, UserCircle, X,
} from '@phosphor-icons/react'
import Slide from '../Slide.jsx'
import { TRANSITION_DUR, reducedMotion } from '../motion.js'
import { t } from '../../i18n/index.js'
import { collectAnchors, findAnchor } from './anchors.js'
import { lineBoxes, marks } from './ink.js'
import { PresenterFace, PresenterThumb, presenterById } from './characters.jsx'
import { createVoice } from './voice.js'
import './presenter.css'

const SPEEDS = [1, 1.25, 1.5, 0.75]
const PEN_MS = { underline: 520, highlight: 560, circle: 820, box: 300, arrow: 480 }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Pauses that respect the pause button: only time while playing counts. */
function useRunner() {
  const run = useRef(0)
  const paused = useRef(false)
  const sleep = useCallback(async (ms, token) => {
    let left = ms
    while (left > 0) {
      if (run.current !== token) return false
      const step = Math.min(left, 60)
      await wait(step)
      if (!paused.current) left -= step
    }
    return run.current === token
  }, [])
  return { run, paused, sleep }
}

/** One pen mark: its strokes draw in order, the pen tip riding along each one. */
function InkMark({ mark, pen }) {
  const refs = useRef([])
  useEffect(() => {
    let raf = 0
    let alive = true
    const els = refs.current.filter(Boolean)
    els.forEach((el) => {
      const len = el.getTotalLength?.() ?? 0
      el.style.strokeDasharray = `${len} ${len}`
      el.style.strokeDashoffset = `${len}`
    })
    const each = PEN_MS[mark.draw] ?? 500
    const draw = (i) => {
      const el = els[i]
      if (!el || !alive) {
        if (pen.current) pen.current.dataset.on = 'rest'
        return
      }
      const len = el.getTotalLength()
      const dur = mark.reduced ? 0 : mark.draw === 'arrow' && i === 1 ? 180 : each
      const t0 = performance.now()
      const step = (now) => {
        if (!alive) return
        const k = dur ? Math.min(1, (now - t0) / dur) : 1
        const e = 1 - Math.pow(1 - k, 2.2) // the pen slows down at the end of a stroke
        el.style.strokeDashoffset = `${len * (1 - e)}`
        const pt = el.getPointAtLength(len * e)
        if (pen.current) {
          pen.current.dataset.on = 'draw'
          pen.current.style.transform = `translate(${pt.x}px, ${pt.y}px)`
        }
        if (k < 1) raf = requestAnimationFrame(step)
        else draw(i + 1)
      }
      raf = requestAnimationFrame(step)
    }
    draw(0)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [mark, pen])
  return (
    <g className={`ink-mark ${mark.old ? 'old' : ''}`}>
      {mark.paths.map((p, i) => (
        <path
          key={i}
          ref={(el) => (refs.current[i] = el)}
          d={p.d}
          className={`ink-${p.kind}`}
          style={p.width ? { strokeWidth: p.width } : undefined}
        />
      ))}
    </g>
  )
}

/** Captions: the words already said are brighter than the ones still coming. */
function Captions({ text, handle }) {
  const [said, setSaid] = useState(0)
  const words = useMemo(() => (text ? text.split(/\s+/).filter(Boolean) : []), [text])
  useEffect(() => {
    setSaid(0)
    if (!handle) return
    const id = setInterval(() => setSaid(Math.round((handle.progress?.() ?? 0) * words.length)), 90)
    return () => clearInterval(id)
  }, [handle, words.length])
  if (!words.length) return null
  return (
    <div className="ap-cc" aria-live="polite">
      <p>
        {words.map((w, i) => (
          <span key={i} className={i < said ? 'said' : ''}>
            {w}{' '}
          </span>
        ))}
      </p>
    </div>
  )
}

/**
 * @param {{ slides: object[], theme: object, narration: object, transition?: string, motion?: object,
 *           title?: string, start?: number, onClose: () => void }} props
 */
export default function AutoPresent({ slides, theme, narration, transition = 'fade', motion = null, title = '', start = 0, onClose }) {
  const box = useRef(null)
  const stage = useRef(null)
  const pageEl = useRef(null)
  const pen = useRef(null)
  const handleRef = useRef(null)
  const { run, paused, sleep } = useRunner()

  const [view, setView] = useState({ i: start, from: null, dir: 1, n: 0 })
  const [phase, setPhase] = useState('intro') // intro · play · end
  const [playing, setPlaying] = useState(false)
  const [part, setPart] = useState(null) // { text, handle }
  const [ink, setInk] = useState({ marks: [], spot: null })
  const [pointing, setPointing] = useState(false)
  const [laser, setLaser] = useState(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cc, setCc] = useState(narration.captions !== false)
  const [showFace, setShowFace] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [notice, setNotice] = useState(null)
  const [idle, setIdle] = useState(false)
  const [full, setFull] = useState(false)

  const tr = reducedMotion() ? 'none' : transition
  const dur = TRANSITION_DUR[tr] ?? 0
  const who = narration.presenter ?? {}
  const persona = who.photo ? null : presenterById(who.id)
  const side = narration.side === 'left' ? 'left' : 'right'
  const host = Boolean(persona?.real) // a real-looking host stands beside the slide instead of a round bubble

  const voice = useMemo(
    () =>
      createVoice({
        lang: narration.lang,
        gender: narration.voice?.g ?? persona?.gender ?? 'f',
        rate: narration.voice?.rate ?? 1,
        onFallback: (code) => setNotice(code === 'VOICE_LIMIT' ? t('pr.voiceLimit') : t('pr.voiceFallback')),
      }),
    // a new voice only when the player opens again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => () => voice.dispose(), [voice])
  const [mode, setMode] = useState(null)
  useEffect(() => {
    voice.ready().then(setMode)
  }, [voice])

  const scriptOf = useCallback((i) => narration.slides?.[slides[i]?.id]?.say ?? [], [narration, slides])

  /* ───── the stage size (pen marks are drawn in stage pixels) ───── */
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
      setInk({ marks: [], spot: null }) // the page was laid out again: old marks no longer fit
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // the old page leaves once the transition is over
  useEffect(() => {
    if (view.from == null) return
    const tm = setTimeout(() => setView((v) => (v.n === view.n ? { ...v, from: null } : v)), dur * 1000 + 60)
    return () => clearTimeout(tm)
  }, [view.n, view.from, dur])

  /* ───── drawing one cue ───── */
  const cue = useCallback((p, anchors, seed) => {
    const a = findAnchor(anchors, p)
    if (!a || !stage.current) return
    const origin = stage.current.getBoundingClientRect()
    const r = a.el.getBoundingClientRect()
    const rect = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }
    const lines = a.k === 'text' ? lineBoxes(a.el, origin) : []
    const m = marks(p.do, { box: rect, lines, stage: { w: origin.width, h: origin.height }, seed })
    setPointing(true)
    setTimeout(() => setPointing(false), 1400)
    if (p.do === 'point') {
      setLaser({ x: m.tip[0], y: m.tip[1], n: seed })
      return
    }
    setLaser(null)
    setInk((s) => ({
      // earlier marks stay, fainter; at most three on the page
      marks: [...s.marks.slice(-2).map((x) => ({ ...x, old: true })), ...(m.paths.length ? [{ id: seed, draw: p.do, paths: m.paths, reduced: reducedMotion() }] : [])],
      spot: m.spot ?? null,
    }))
  }, [])

  /* ───── the director: one page after the other ───── */
  const playFrom = useCallback(
    async (i, from = 0) => {
      const token = ++run.current
      handleRef.current?.stop()
      setInk({ marks: [], spot: null })
      setLaser(null)
      setPart(null)
      setView((v) => (v.i === i ? v : { i, from: dur ? v.i : null, dir: i > v.i ? 1 : -1, n: v.n + 1 }))
      // the page comes in (transition + its own entrance animations) before the talk starts
      if (!(await sleep(Math.max(700, dur * 1000 + 450), token))) return
      const anchors = collectAnchors(pageEl.current?.querySelector('.slide'))
      const say = scriptOf(i)
      for (let k = from; k < say.length; k++) {
        const p = say[k]
        voice.prefetch(say[k + 1]?.text ?? scriptOf(i + 1)[0]?.text)
        if (p.do) cue(p, anchors, i * 100 + k + 1)
        else if (i === 0 && k === 0) {
          // the greeting: the presenter waves
          setPointing(true)
          setTimeout(() => setPointing(false), 1400)
        }
        const h = voice.speak(p.text)
        handleRef.current = h
        if (paused.current) h.pause()
        setPart({ text: p.text, handle: h, k })
        await h.done
        if (run.current !== token) return
        if (!(await sleep(220, token))) return
      }
      if (!say.length && !(await sleep(4000, token))) return
      if (!(await sleep(650, token))) return
      setPart(null)
      if (i < slides.length - 1) playFrom(i + 1, 0)
      else {
        setPhase('end')
        setPlaying(false)
      }
    },
    [cue, dur, paused, run, scriptOf, sleep, slides.length, voice],
  )

  const begin = (i = view.i) => {
    voice.unlock() // inside the click: browsers allow sound from here on
    box.current?.requestFullscreen?.().catch(() => {})
    paused.current = false
    setPlaying(true)
    setPhase('play')
    playFrom(i, 0)
  }
  const toggle = useCallback(() => {
    if (phase !== 'play') return
    const now = !paused.current
    paused.current = now
    setPlaying(!now)
    if (now) handleRef.current?.pause()
    else handleRef.current?.resume()
  }, [phase])
  const goTo = useCallback(
    (i) => {
      if (phase === 'intro') return
      const j = Math.min(slides.length - 1, Math.max(0, i))
      paused.current = false
      setPlaying(true)
      setPhase('play')
      playFrom(j, 0)
    },
    [phase, playFrom, slides.length],
  )
  const close = useCallback(() => {
    run.current++
    handleRef.current?.stop()
    voice.dispose()
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    onClose()
  }, [onClose, run, voice])
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    voice.setSpeed(next)
  }
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else box.current?.requestFullscreen?.().catch(() => {})
  }

  /* ───── keyboard, fullscreen, idle controls ───── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (phase === 'intro') begin()
        else toggle()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(view.i + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(view.i - 1)
      else if (e.key.toLowerCase() === 'c') setCc((v) => !v)
      else if (e.key === 'Escape' && !document.fullscreenElement) close()
    }
    const onFs = () => setFull(Boolean(document.fullscreenElement))
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  })
  useEffect(() => {
    let tm = null
    const wake = () => {
      setIdle(false)
      clearTimeout(tm)
      tm = setTimeout(() => setIdle(true), 2600)
    }
    wake()
    // a tap wakes the controls too (touch screens have no pointer moves)
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    return () => {
      clearTimeout(tm)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
    }
  }, [])
  useEffect(() => () => run.current++, [run])
  useEffect(() => {
    if (!notice) return
    const tm = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(tm)
  }, [notice])

  const level = useCallback(() => handleRef.current?.level?.() ?? 0, [])
  const { i, from } = view
  const moving = from != null && slides[from]
  const name = persona ? t(`pr.name.${persona.id}`) : t('pr.you')

  return createPortal(
    <div className={`ap ${idle && phase === 'play' && playing ? 'idle' : ''}`} ref={box} data-side={side} data-host={host ? '' : undefined}>
      <div className="present-stage ap-stage" ref={stage} data-tr={tr} style={{ '--pt-dur': `${dur}s`, '--pt-dir': view.dir }}>
        {moving && (
          <div key={`out-${view.n}`} className="pt-page out">
            <Slide slide={slides[from]} theme={theme} index={from} />
          </div>
        )}
        <div key={`in-${view.n}`} className={`pt-page ${moving ? 'in' : ''}`} ref={pageEl}>
          <Slide key={slides[i].id} slide={slides[i]} theme={theme} index={i} playing={phase !== 'intro'} motion={motion} />
        </div>

        {/* the pen */}
        <svg className="ap-ink" width={size.w} height={size.h} viewBox={`0 0 ${size.w || 1} ${size.h || 1}`} aria-hidden="true">
          {ink.spot && <path key={ink.spot} className="ink-spot" d={ink.spot} fillRule="evenodd" />}
          {ink.marks.map((m) => (
            <InkMark key={m.id} mark={m} pen={pen} />
          ))}
        </svg>
        <div className="ap-pen" ref={pen} data-on="rest" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <path d="M3 29 L6 21 L22 5 L27 10 L11 26 Z" fill="#1A1A1A" />
            <path d="M22 5 L25 2 L30 7 L27 10 Z" fill="#E5484D" />
            <path d="M3 29 L6 21 L11 26 Z" fill="#F5D0B5" />
            <path d="M3 29 L4.4 25.4 L6.6 27.6 Z" fill="#E5484D" />
          </svg>
        </div>
        {laser && <span key={laser.n} className="ap-laser" style={{ transform: `translate(${laser.x}px, ${laser.y}px)` }} />}

        {showFace && phase !== 'intro' && (
          <div className={`ap-face ${host ? 'host' : ''} ${part ? 'talking' : ''}`}>
            <PresenterFace narration={narration} level={level} pointing={pointing} side={side} />
            <span className="ap-face-name">{name}</span>
          </div>
        )}
        {cc && phase === 'play' && part && <Captions key={`${i}-${part.k}`} text={part.text} handle={part.handle} />}

        {phase === 'intro' && (
          <div className="ap-intro">
            <div className="ap-intro-card">
              <div className="ap-intro-face">
                <PresenterThumb narration={narration} />
              </div>
              <small>{t('pr.introKicker')}</small>
              <h2>{title || t('pr.untitled')}</h2>
              <p>{t('pr.introBy', { name })}</p>
              <button type="button" className="ap-start" onClick={() => begin()} autoFocus>
                <Play weight="fill" size={20} /> {t('pr.start')}
              </button>
              <em className="ap-mode">{mode === 'server' ? t('pr.modeServer') : voice.weak ? t('pr.edgeTip') : mode === 'browser' ? t('pr.modeBrowser') : ' '}</em>
            </div>
          </div>
        )}
        {phase === 'end' && (
          <div className="ap-intro">
            <div className="ap-intro-card">
              <small>{t('pr.endKicker')}</small>
              <h2>{t('pr.endTitle')}</h2>
              <div className="ap-end-row">
                <button type="button" className="ap-start" onClick={() => begin(0)}>
                  <ArrowCounterClockwise size={18} /> {t('pr.replay')}
                </button>
                <button type="button" className="ap-ghost" onClick={close}>
                  {t('pr.close')}
                </button>
              </div>
            </div>
          </div>
        )}
        {notice && <div className="ap-notice">{notice}</div>}
      </div>

      <div className="ap-bar" onClick={(e) => e.stopPropagation()}>
        <div className="ap-track" role="group" aria-label={t('pr.pages')}>
          {slides.map((s, j) => (
            <button key={s.id} type="button" className={j < i ? 'done' : j === i ? 'now' : ''} onClick={() => goTo(j)} aria-label={t('pr.pageN', { n: j + 1 })} disabled={phase === 'intro'}>
              <i />
            </button>
          ))}
        </div>
        <div className="ap-controls">
          <button type="button" onClick={() => goTo(i - 1)} disabled={phase === 'intro' || i === 0} aria-label={t('pr.prev')} title={t('pr.prev')}>
            <CaretLeft size={18} weight="bold" />
          </button>
          <button type="button" className="ap-play" onClick={() => (phase === 'play' ? toggle() : begin(phase === 'end' ? 0 : i))} aria-label={playing ? t('pr.pause') : t('pr.play')} title={playing ? t('pr.pause') : t('pr.play')}>
            {playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
          </button>
          <button type="button" onClick={() => goTo(i + 1)} disabled={phase === 'intro' || i === slides.length - 1} aria-label={t('pr.next')} title={t('pr.next')}>
            <CaretRight size={18} weight="bold" />
          </button>
          <span className="ap-count">
            {i + 1} / {slides.length}
          </span>
          <span className="ap-gap" />
          <button type="button" className={cc ? 'on' : ''} onClick={() => setCc((v) => !v)} aria-pressed={cc} title={t('pr.captions')} aria-label={t('pr.captions')}>
            <ClosedCaptioning size={19} />
          </button>
          <button type="button" className="ap-speed" onClick={cycleSpeed} title={t('pr.speed')} aria-label={t('pr.speed')}>
            {speed}×
          </button>
          <button type="button" className={showFace ? 'on' : ''} onClick={() => setShowFace((v) => !v)} aria-pressed={showFace} title={t('pr.showPresenter')} aria-label={t('pr.showPresenter')}>
            <UserCircle size={19} />
          </button>
          <button type="button" onClick={toggleFull} title={t('pr.fullscreen')} aria-label={t('pr.fullscreen')}>
            {full ? <CornersIn size={18} /> : <CornersOut size={18} />}
          </button>
          <button type="button" onClick={close} title={t('pr.close')} aria-label={t('pr.close')}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
