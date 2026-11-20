import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkle, Monitor, DeviceTablet, DeviceMobile, ArrowCounterClockwise, ArrowClockwise, Play, MagnifyingGlass,
  Plus, Minus, Layout, TextT, Image, Shapes, Table, ChartBar, Quotes, ListBullets, TextHOne, CaretDown, Check,
  ShareNetwork, DownloadSimple, TextAlignLeft, TextAlignCenter, TextAlignRight, TextB, TextItalic, CircleNotch,
  ArrowUp,
} from '@phosphor-icons/react'
import { QalamNib } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { getTemplate, generateSlides } from '../editor/templates.js'
import './mock.css'
import { getLang, t } from '../i18n/index.js'

/*
 * A scripted, looping "live session" of the editor. Collaborator cursors aim at real DOM
 * elements (measured each step), so the choreography stays correct at any width.
 *
 *  1. Jasur types a topic into the AI composer and presses «Yaratish»
 *  2. slides stream into the filmstrip one by one
 *  3. Jasur selects the title → the inspector shows text properties
 *  4. Dilnoza opens slide 4 and drags «Roʻyxat» from the panel onto it → a new bullet appears
 *  5. Jasur recolours it from the inspector, then the loop restarts
 */

const COUNT = 6
/** Topic, generated slides and element names in the interface language (built once per language). */
let mockCache = null
function mock() {
  if (mockCache?.lang === getLang()) return mockCache
  const topic = t('pm.topic')
  const base = generateSlides(topic, COUNT)
  base[0].subtitle = t('pm.subtitle')
  const elements = ELEMENT_ICONS.map(([id, icon]) => ({ id, icon, label: t(`pm.el.${id}`) }))
  mockCache = { lang: getLang(), topic, base, bullet: t('pm.bullet'), elements }
  return mockCache
}
const TARGET = 3 // «Tahlil»
const TPL = getTemplate('pitch')
const SWATCHES = ['#5eead4', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa']

const ELEMENT_ICONS = [
  ['h', TextHOne], ['t', TextT], ['list', ListBullets], ['q', Quotes],
  ['tb', Table], ['ch', ChartBar], ['im', Image], ['sh', Shapes],
]

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const INITIAL = {
  typed: 0,
  phase: 'prompt', // prompt → gen → done
  gen: 0,
  active: 0,
  added: false,
  accent: SWATCHES[0],
  go: false, // «Yaratish» pressed
  hot: false, // «Roʻyxat» tile picked up
  sel: null, // { x, y, w, h, kind }
  j: { x: null, y: null, press: false, show: false },
  d: { x: null, y: null, press: false, show: false, drag: false },
}

const finalState = () => ({
  ...INITIAL,
  typed: mock().topic.length,
  phase: 'done',
  gen: COUNT,
  active: TARGET,
  added: true,
})

export function Cursor({ who, name, c }) {
  if (!c.show || c.x == null) return null
  return (
    <span className={`mk-cursor ${who} ${c.press ? 'press' : ''}`} style={{ transform: `translate(${c.x}px, ${c.y}px)` }} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M2 1.5l12.5 6.2-5.4 1.6-2.2 5.3z" />
      </svg>
      <span className="mk-cursor-name">{name}</span>
      {c.drag && (
        <span className="mk-ghost">
          <ListBullets size={12} weight="bold" /> {t('pm.el.list')}
        </span>
      )}
    </span>
  )
}

export default function ProductMock() {
  const root = useRef(null)
  const [s, setS] = useState(INITIAL)
  const { topic: TOPIC, base: BASE, bullet: NEW_BULLET, elements: ELEMENTS } = mock()
  const patch = (p) => setS((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) }))

  const slides = useMemo(
    () => BASE.map((sl, i) => (i === TARGET && s.added ? { ...sl, bullets: [...sl.bullets, NEW_BULLET] } : sl)),
    [s.added],
  )
  const theme = useMemo(() => ({ ...TPL.theme, accent: s.accent }), [s.accent])

  useEffect(() => {
    const el = root.current
    if (!el) return
    if (reduced()) {
      setS(finalState())
      return
    }

    /* geometry: element point / rect relative to the mock, undoing any ancestor scale */
    // `text: true` measures the rendered glyphs rather than the element box (titles can overflow their box)
    const box = (sel, text = false) => {
      const node = el.querySelector(sel)
      if (!node) return null
      let b = node.getBoundingClientRect()
      if (text) {
        const range = document.createRange()
        range.selectNodeContents(node)
        const t = range.getBoundingClientRect()
        if (t.width) b = { left: Math.min(b.left, t.left), top: t.top, width: Math.max(b.right, t.right) - Math.min(b.left, t.left), height: t.height }
      }
      if (!b.width || !b.height) return null
      const r = el.getBoundingClientRect()
      const k = r.width / el.offsetWidth || 1
      return { x: (b.left - r.left) / k, y: (b.top - r.top) / k, w: b.width / k, h: b.height / k }
    }
    const point = (sel, ax = 0.5, ay = 0.5) => {
      const b = box(sel)
      return b ? { x: b.x + b.w * ax, y: b.y + b.h * ay, show: true } : {} // target hidden at this width → stay put
    }
    const moveJ = (sel, ax, ay) => patch((p) => ({ j: { ...p.j, press: false, ...point(sel, ax, ay) } }))
    const moveD = (sel, ax, ay, extra = {}) => patch((p) => ({ d: { ...p.d, press: false, ...point(sel, ax, ay), ...extra } }))
    const press = (who, on) => patch((p) => ({ [who]: { ...p[who], press: on } }))
    const select = (sel, kind) => {
      const b = box(sel, true)
      patch({ sel: b ? { ...b, kind } : null })
    }

    let timers = []
    let alive = true
    const at = (ms, fn) => timers.push(setTimeout(() => alive && fn(), ms))

    const loop = () => {
      timers = []
      setS(INITIAL)
      // start positions: Jasur near the composer, Dilnoza resting over the panel
      at(60, () => {
        moveJ('.mk-stage', 0.86, 0.78)
        moveD('.mk-panel', 0.78, 0.7)
      })

      // 1 · typing the topic
      for (let i = 1; i <= TOPIC.length; i++) at(500 + i * 55, () => patch({ typed: i }))
      at(1700, () => moveJ('.mk-go', 0.45, 0.6))
      at(2500, () => {
        press('j', true)
        patch({ go: true })
      })
      at(2700, () => {
        press('j', false)
        patch({ go: false, phase: 'gen' })
      })

      // 2 · slides stream in
      for (let i = 1; i <= COUNT; i++) at(2800 + i * 330, () => patch({ gen: i }))
      at(2800 + COUNT * 330 + 250, () => patch({ phase: 'done' }))

      // 3 · Jasur selects the title
      at(5300, () => moveJ('.mk-slide .s-title', 0.62, 0.55))
      at(6100, () => {
        press('j', true)
        select('.mk-slide .s-title', 'title')
      })
      at(6300, () => press('j', false))
      at(6900, () => moveJ('.mk-insp', 0.55, 0.42))

      // 4 · Dilnoza opens slide 4 and drags a list onto it
      at(7600, () => moveD(`.mk-thumb:nth-child(${TARGET + 1})`, 0.55, 0.5))
      at(8400, () => {
        press('d', true)
        patch({ active: TARGET, sel: null })
      })
      at(8600, () => press('d', false))
      at(9000, () => moveD('.mk-el-list', 0.5, 0.5))
      at(9800, () => {
        press('d', true)
        patch((p) => ({ hot: true, d: { ...p.d, drag: true } }))
      })
      at(10000, () => moveD('.mk-slide .s-list', 0.35, 1.25, { press: true, drag: true }))
      at(11100, () => patch((p) => ({ hot: false, added: true, d: { ...p.d, press: false, drag: false } })))
      at(11250, () => select('.mk-slide .s-list li:last-child', 'list'))

      // 5 · Jasur recolours it
      at(11600, () => moveJ('.mk-swatch:nth-child(2)', 0.5, 0.5))
      at(12400, () => {
        press('j', true)
        patch({ accent: SWATCHES[1] })
      })
      at(12600, () => press('j', false))
      at(13000, () => moveD('.mk-stage', 0.15, 0.85))
      at(13300, () => select('.mk-slide .s-list li:last-child', 'list'))

      at(15800, loop)
    }

    // only run while the mock is on screen
    let running = false
    let first = true
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true
        alive = true
        // first run: let the hero reveal transition finish before the scripted re-renders start
        if (first) {
          first = false
          at(950, loop)
        } else loop()
      } else if (!e.isIntersecting && running) {
        running = false
        alive = false
        timers.forEach(clearTimeout)
      }
    }, { threshold: 0.25 })
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [])

  const generating = s.phase === 'gen'
  const shown = s.gen > 0 ? slides[Math.min(s.active, s.gen - 1)] : null
  const selKind = s.sel?.kind

  return (
    <div className="mk-wrap">
      <div
        className="mk"
        ref={root}
        role="img"
        aria-label={t('pm.aria')}
      >
        {/* ── top bar ── */}
        <div className="mk-top">
          <div className="mk-doc">
            <span className="mk-nib"><QalamNib height={17} /></span>
            <span className="mk-doc-t">
              <b>{s.typed ? TOPIC.slice(0, s.typed) : t('tpl.untitled')}</b>
              <small>
                {generating ? (
                  <><CircleNotch size={9} className="spin" /> {t('pm.creating')}</>
                ) : (
                  <><Check size={9} weight="bold" /> {t('pm.saved')}</>
                )}
              </small>
            </span>
          </div>
          <div className="mk-seg">
            <span className="on"><Monitor size={13} weight="bold" /></span>
            <span><DeviceTablet size={13} weight="bold" /></span>
            <span><DeviceMobile size={13} weight="bold" /></span>
          </div>
          <div className="mk-actions">
            <span className="mk-ic"><ArrowCounterClockwise size={14} /></span>
            <span className="mk-ic"><ArrowClockwise size={14} /></span>
            <span className="mk-ic"><Play size={13} weight="fill" /></span>
            <span className="mk-avatars">
              <i className="a1">D</i>
              <i className="a2">J</i>
            </span>
            <span className="mk-ghost-btn"><ShareNetwork size={12} weight="bold" /> {t('pm.share')}</span>
            <span className="mk-cta"><DownloadSimple size={12} weight="bold" /> PPTX</span>
          </div>
        </div>

        <div className="mk-body">
          {/* ── rail ── */}
          <div className="mk-rail">
            <span className="add"><Plus size={14} weight="bold" /></span>
            <span className="on"><Layout size={15} /></span>
            <span><TextT size={15} /></span>
            <span><Image size={15} /></span>
            <span><Sparkle size={15} /></span>
          </div>

          {/* ── elements panel ── */}
          <div className="mk-panel">
            <div className="mk-ph">{t('pm.addElements')}</div>
            <div className="mk-field"><span>{t('pm.search')}</span><MagnifyingGlass size={12} /></div>
            <div className="mk-field dark">Tartib <CaretDown size={10} /></div>
            <div className="mk-label">{t('pm.typography')}</div>
            <div className="mk-grid">
              {ELEMENTS.map((e) => (
                <span key={e.id} className={`mk-el mk-el-${e.id} ${e.id === 'list' && s.hot ? 'hot' : ''}`}>
                  <span className="ic"><e.icon size={14} /></span>
                  {e.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── canvas ── */}
          <div className="mk-canvas">
            <div className="mk-stage">
              {shown ? (
                <div className={`mk-slide ${s.d.drag ? 'droppable' : ''}`} key={shown.id}>
                  <Slide slide={shown} theme={theme} preview />
                </div>
              ) : (
                <div className="mk-empty">
                  <div className={`mk-composer ${s.phase !== 'prompt' ? 'leaving' : ''}`}>
                    <span className="mk-composer-h"><Sparkle size={12} weight="fill" /> Nima haqida taqdimot tayyorlaymiz?</span>
                    <div className="mk-composer-in">
                      <span className="txt">
                        {TOPIC.slice(0, s.typed)}
                        <i className="caret" />
                        {!s.typed && <span className="ph">{t('pm.examplePh', { topic: TOPIC })}</span>}
                      </span>
                    </div>
                    <div className="mk-composer-row">
                      <span className="chip">Prezentatsiya <CaretDown size={9} /></span>
                      <span className="chip">{COUNT} slayd</span>
                      <span className="chip"><i style={{ background: '#5eead4' }} /> {TPL.name}</span>
                      <span className={`mk-go ${s.go ? 'down' : ''}`}>{t('ui.create')} <ArrowUp size={11} weight="bold" /></span>
                    </div>
                  </div>
                </div>
              )}

              <div className={`mk-chip ${s.phase === 'prompt' ? 'hide' : ''}`}>
                <span className="spark">
                  {generating ? <CircleNotch size={11} weight="bold" className="spin" /> : <Sparkle size={11} weight="fill" />}
                </span>
                {generating ? t('pm.genProgress', { i: s.gen, n: COUNT }) : t('pm.genDone', { n: COUNT })}
                {!generating && <Check size={11} weight="bold" />}
              </div>
            </div>

            <div className="mk-strip">
              {slides.map((sl, i) => (
                <span key={sl.id} className={`mk-thumb ${i < s.gen ? 'ready' : ''} ${i === s.active && i < s.gen ? 'on' : ''}`}>
                  <span className="mk-thumb-in">
                    {i < s.gen ? <Slide slide={sl} theme={theme} preview /> : <span className="mk-skel" />}
                  </span>
                  <small>{i + 1}</small>
                </span>
              ))}
            </div>

            <div className="mk-zoom">
              <Minus size={10} weight="bold" /> 100% <Plus size={10} weight="bold" />
            </div>
          </div>

          {/* ── inspector ── */}
          <div className="mk-insp">
            {selKind ? (
              <>
                <div className="mk-ph">{selKind === 'title' ? t('pm.el.h') : t('pm.el.list')}</div>
                <div className="mk-label">{t('pm.font')}</div>
                <div className="mk-field dark">{selKind === 'title' ? 'Unbounded' : 'Inter'} <CaretDown size={10} /></div>
                <div className="mk-row2">
                  <div className="mk-field dark">{selKind === 'title' ? 48 : 18}</div>
                  <div className="mk-field dark">{selKind === 'title' ? 'SemiBold' : 'Regular'}</div>
                </div>
                <div className="mk-tools">
                  <span className="on"><TextAlignLeft size={12} /></span>
                  <span><TextAlignCenter size={12} /></span>
                  <span><TextAlignRight size={12} /></span>
                  <span className="sep" />
                  <span className={selKind === 'title' ? 'on' : ''}><TextB size={12} weight="bold" /></span>
                  <span><TextItalic size={12} /></span>
                </div>
                <div className="mk-label">{t('pm.accent')}</div>
                <div className="mk-swatches">
                  {SWATCHES.map((c) => (
                    <span key={c} className={`mk-swatch ${c === s.accent ? 'on' : ''}`} style={{ background: c }} />
                  ))}
                </div>
                <div className="mk-label">{t('pm.animation')}</div>
                <div className="mk-field dark">{t('pm.appear')} <CaretDown size={10} /></div>
              </>
            ) : (
              <>
                <div className="mk-ph">{t('pm.slide')}</div>
                <div className="mk-label">{t('pm.template')}</div>
                <div className="mk-tpl">
                  <span className="mk-tpl-th"><Slide slide={{ ...BASE[0], id: 'mk-tpl' }} theme={theme} preview /></span>
                  <span>{TPL.name}</span>
                </div>
                <div className="mk-label">{t('pm.accent')}</div>
                <div className="mk-swatches">
                  {SWATCHES.map((c) => (
                    <span key={c} className={`mk-swatch ${c === s.accent ? 'on' : ''}`} style={{ background: c }} />
                  ))}
                </div>
                <div className="mk-label">{t('pm.transition')}</div>
                <div className="mk-field dark">Silliq <CaretDown size={10} /></div>
                <div className="mk-label">{t('pm.size')}</div>
                <div className="mk-meta">
                  <span>{t('pm.slides')}</span><b>{s.gen}/{COUNT}</b>
                </div>
              </>
            )}
          </div>
        </div>

        {/* selection overlay */}
        {s.sel && (
          <span className="mk-sel" style={{ left: s.sel.x - 4, top: s.sel.y - 3, width: s.sel.w + 8, height: s.sel.h + 6 }} aria-hidden="true">
            <i /><i /><i /><i />
            <em>{s.sel.kind === 'title' ? 'Jasur' : 'Dilnoza'}</em>
          </span>
        )}

        <Cursor who="d" name="Dilnoza" c={s.d} />
        <Cursor who="j" name="Jasur" c={s.j} />
      </div>
      <div className="mk-fade" />
    </div>
  )
}
