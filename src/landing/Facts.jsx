import { useEffect, useRef, useState } from 'react'
import { Lightning } from '@phosphor-icons/react'
import { TEMPLATES } from '../editor/templates.js'
import { TOOL_UI, TOOL_ORDER } from '../files/toolMeta.js'
import './facts.css'
import { t } from '../i18n/index.js'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const HEX = {
  purple: '#8b5cf6', indigo: '#6366f1', sky: '#3d9ff0', red: '#e5484d', amber: '#f5a524',
  green: '#3fb760', orange: '#f26b4b', pink: '#e8456f', emerald: '#2bb069', teal: '#12b398',
}

/** Becomes true once the element scrolls into view (and stays true). */
function useSeen(ref) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion() || !('IntersectionObserver' in window)) { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return seen
}

/** Counts from 0 to `to` with an ease-out once `run` turns true. */
function Count({ to, run, delay = 0, dur = 1500 }) {
  const [v, setV] = useState(reducedMotion() ? to : 0)
  useEffect(() => {
    if (!run || reducedMotion()) { if (run) setV(to); return }
    let raf
    let start
    const tick = (t) => {
      if (start === undefined) start = t + delay
      const p = Math.min(1, Math.max(0, (t - start) / dur))
      setV(Math.round(to * (1 - Math.pow(2, -10 * p))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setV(to)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, to, delay, dur])
  return <span className="fc-num-v">{v}</span>
}

/* ───────── visuals ───────── */

const FAN = ['#8b5cf6', '#12b398', '#f26b4b', '#3d9ff0', '#e8456f']

function TemplateFan() {
  return (
    <div className="fc-fan" aria-hidden="true">
      {FAN.map((c, i) => (
        <span key={c} className="fc-fan-card" style={{ '--c': c, '--k': i - 2 }}>
          <i /><b /><b className="s" />
        </span>
      ))}
    </div>
  )
}

function ToolGrid() {
  return (
    <div className="fc-tools" aria-hidden="true">
      {TOOL_ORDER.slice(0, 18).map((id, i) => {
        const tool = TOOL_UI[id]
        return (
          <span key={id} className="fc-tool" style={{ '--c': HEX[tool.color] ?? '#6366f1', '--k': i }}>
            <tool.icon size={14} weight="duotone" />
          </span>
        )
      })}
    </div>
  )
}

function SlideRange() {
  return (
    <div className="fc-range" aria-hidden="true">
      <div className="fc-bars">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} style={{ '--k': i, '--h': `${28 + ((i * 37) % 60)}%` }} className={i >= 3 && i <= 13 ? 'in' : ''} />
        ))}
      </div>
      <div className="fc-track">
        <span className="fc-fill" />
        <span className="fc-knob l" />
        <span className="fc-knob r" />
      </div>
    </div>
  )
}

const FILES = [['PPTX', '#f26b4b'], ['DOCX', '#3d9ff0'], ['PDF', '#e5484d']]

function FileStack() {
  return (
    <div className="fc-files" aria-hidden="true">
      {FILES.map(([f, c], i) => (
        <span key={f} className="fc-file" style={{ '--c': c, '--k': i - 1 }}>
          <i />
          <b>{f}</b>
        </span>
      ))}
    </div>
  )
}

/* ───────── section ───────── */

export default function Facts() {
  const root = useRef(null)
  const seen = useSeen(root)

  // Pointer spotlight: each tile reads --mx/--my for its glow.
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  const tiles = [
    {
      key: 'tpl', dark: true, Visual: TemplateFan,
      num: <><Count to={TEMPLATES.length} run={seen} /><span className="fc-suf">+</span></>,
      label: t('lp.facts.tpl'), sub: t('lp.facts.tplSub'),
    },
    {
      key: 'tools', Visual: ToolGrid,
      num: <Count to={Object.keys(TOOL_UI).length} run={seen} delay={120} />,
      label: t('lp.facts.tools'), sub: t('lp.facts.toolsSub'),
    },
    {
      key: 'slides', Visual: SlideRange,
      num: <><Count to={10} run={seen} delay={240} dur={900} /><span className="fc-dash">–</span><Count to={40} run={seen} delay={240} /></>,
      label: t('lp.facts.slides'), sub: <><Lightning size={12} weight="fill" /> {t('lp.facts.slidesSub')}</>,
    },
    {
      key: 'export', Visual: FileStack,
      num: <><Count to={3} run={seen} delay={360} dur={700} /><span className="fc-unit">{t('lp.facts.unit')}</span></>,
      label: t('lp.facts.export'), sub: t('lp.facts.exportSub'),
    },
  ]

  return (
    <section ref={root} className={`fc${seen ? ' seen' : ''}`} aria-label={t('lp.facts.aria')}>
      {tiles.map((tile, i) => (
        <article
          key={tile.key}
          className={`fc-tile fc-t-${tile.key}${tile.dark ? ' dark' : ''}`}
          style={{ '--i': i }}
          onPointerMove={onMove}
        >
          <tile.Visual />
          <div className="fc-copy">
            <div className="fc-num">{tile.num}</div>
            <div className="fc-label">{tile.label}</div>
            <div className="fc-sub">{tile.sub}</div>
          </div>
        </article>
      ))}
    </section>
  )
}
