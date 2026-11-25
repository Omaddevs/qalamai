import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp, ArrowRight, MagnifyingGlass, Sparkle, X, CaretDown, Minus, Plus, Shuffle, ArrowsClockwise,
  Check, SealCheck, TextAa, DownloadSimple, Exam, ListBullets,
} from '@phosphor-icons/react'
import { Dropdown, QalamNib } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { getTemplate, DEFAULT_TEMPLATE } from '../editor/templates.js'
import { COLORS } from '../data.js'
import { loadDocProfile } from '../profile.js'
import { blueprintOf, docHtml } from '../blueprints.js'
import { CREATE, CatTile } from './create.jsx'
import { CoinIcon } from '../components/Coins.jsx'
import { ACTION_BY_TYPE, COIN_COSTS, refundCoins, spendCoins } from '../coins.js'
import { DeckLangPicker, buildIn, deckLangs, defaultDeckLang, fallbackOf } from './DeckLang.jsx'
import GenerateOverlay, { headingsOf } from './GenerateOverlay.jsx'
import TitulSheet, { TitulPill } from './TitulSheet.jsx'
import './hero.css'
import { t, tr } from '../i18n/index.js'

// Ideas carry their type (and options) — picking one also sets up the composer.
// `label` is what the chip says, `t` what gets typed into the field.
const IDEA_TYPES = [
  { k: 'Prezentatsiya' },
  { k: 'Referat' },
  { k: 'Prezentatsiya' },
  { k: 'Biznes reja' },
  { k: 'Kurs işi' },
  { k: 'Dars işlanma', o: { grade: '5' } },
  { k: 'Hisobot', o: { period: 'Çoraklik' } },
  { k: 'Referat' },
  { k: 'Taklifnoma', o: { event: 'Nikoh töyi' } },
  { k: 'Kurs işi' },
  { k: 'Prezentatsiya' },
  { k: 'Portfolio' },
]
/** Ideas in the interface language: "chip|typed" (src/i18n/msg/home.js). */
const ideasList = () =>
  IDEA_TYPES.map((x, i) => {
    const [label, typed] = t(`hx.idea.${i}`).split('|')
    return { ...x, label, t: typed }
  })
const PER_PAGE = 4
const typeOf = (id) => CREATE.find((c) => c.id === id) ?? CREATE[0]

// Real template previews in the side gutters, kept clear of the headline and composer rows.
// side/x = distance from that edge, depth = parallax strength (px), low = hidden first on narrow heroes.
const FLOATERS = [
  { tpl: 'chronicle', side: 'left', x: '2.6%', y: '6%', r: -8, d: 0.35, depth: 18, sticker: { icon: SealCheck, key: 'hx.st.titul', r: -3 } },
  { tpl: 'gallery', side: 'right', x: '2.6%', y: '5%', r: 7, d: 0.5, depth: 26, sticker: { icon: TextAa, key: 'hx.st.script', r: 4 } },
  { tpl: 'quiz', side: 'left', x: '3.4%', y: '71%', r: 6, d: 0.7, depth: 34, low: true, sticker: { icon: Sparkle, key: 'hx.st.slides', r: 3, up: true } },
  { tpl: 'pitch', side: 'right', x: '3.2%', y: '69%', r: -6, d: 0.85, depth: 14, low: true, sticker: { icon: DownloadSimple, text: 'PPTX · PDF', r: -4, up: true } },
]

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Types and erases each word in turn — used as a living placeholder. */
function useTypewriter(words, active) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!active) return
    if (reducedMotion()) {
      setText(words[0])
      return
    }
    let w = 0
    let i = 0
    let erasing = false
    let timer
    const tick = () => {
      const word = words[w]
      if (!erasing) {
        i++
        setText(word.slice(0, i))
        if (i === word.length) {
          erasing = true
          timer = setTimeout(tick, 1700)
          return
        }
      } else {
        i--
        setText(word.slice(0, i))
        if (i === 0) {
          erasing = false
          w = (w + 1) % words.length
        }
      }
      timer = setTimeout(tick, erasing ? 24 : 55)
    }
    setText('')
    timer = setTimeout(tick, 900)
    return () => clearTimeout(timer)
  }, [words, active])
  return text
}

function Floater({ f, onPick }) {
  const tpl = getTemplate(f.tpl)
  const slide = useMemo(() => ({ id: tpl.id, type: 'title', ...tpl.sample, elements: [] }), [tpl])
  const S = f.sticker
  return (
    <div
      className={`hx-card ${f.low ? 'low' : ''}`}
      style={{ [f.side]: f.x, top: f.y, '--r': `${f.r}deg`, '--d': `${f.d}s`, '--depth': f.depth }}
    >
      <div className="hx-card-btn" onClick={() => onPick(tpl.id)}>
        <div className="hx-card-in">
          <Slide slide={slide} theme={tpl.theme} preview />
          <span className="hx-sheen" />
        </div>
        <span className="hx-card-cta">
          {t('hx.startWith', { name: tpl.name })} <ArrowRight size={11} weight="bold" />
        </span>
      </div>
      {S && (
        <span className={`hx-sticker ${S.up ? 'up' : ''}`} style={{ '--sr': `${S.r}deg` }}>
          <span className="hx-sticker-ic">
            <S.icon size={12} weight="bold" />
          </span>
          {S.key ? t(S.key) : S.text}
        </span>
      )}
    </div>
  )
}

/** −  10 slayd  + — walks through the blueprint's allowed values. */
function Stepper({ c, value, onChange, opts }) {
  const i = c.options.indexOf(value)
  const go = (d) => onChange(c.options[Math.min(c.options.length - 1, Math.max(0, i + d))])
  const low = c.min?.(opts) ?? -Infinity
  return (
    <div className="hx-stepper" role="group" aria-label={c.unit}>
      <button type="button" onClick={() => go(-1)} disabled={i <= 0 || c.options[i - 1] < low} aria-label={t('hx.less')}>
        <Minus size={12} weight="bold" />
      </button>
      <span>
        <b key={value}>{value}</b> {c.unit}
      </span>
      <button type="button" onClick={() => go(1)} disabled={i >= c.options.length - 1} aria-label={t('hx.moreBtn')}>
        <Plus size={12} weight="bold" />
      </button>
    </div>
  )
}

/** Page count: ready numbers (5…30) or any number the user types (c.low…c.high). */
function PagesPicker({ c, value, onChange }) {
  const [custom, setCustom] = useState('')
  const n = Number(custom)
  const ok = custom !== '' && n >= c.low && n <= c.high
  return (
    <Dropdown
      className="pg-pop"
      button={({ toggle, open }) => (
        <button
          type="button"
          className={`hx-pill hx-choice ${open ? 'open' : ''}`}
          onClick={() => {
            setCustom(c.options.includes(value) ? '' : String(value))
            toggle()
          }}
          aria-label={t('pg.title')}
        >
          <b>{value}</b> {c.unit}
          <CaretDown size={11} weight="bold" className="hx-pill-caret" />
        </button>
      )}
    >
      {(close) => {
        const pick = (v) => {
          onChange(v)
          close()
        }
        return (
          <>
            <div className="pg-title">{t('pg.title')}</div>
            <div className="pg-grid">
              {c.options.map((o) => (
                <button key={o} type="button" className={`pg-opt ${o === value ? 'on' : ''}`} onClick={() => pick(o)}>
                  <b>{o}</b>
                  <small>{c.unit}</small>
                </button>
              ))}
            </div>
            <div className="pg-custom">
              <div className="pg-custom-label">
                {t('pg.custom')} <small>{t('pg.range', { min: c.low, max: c.high })}</small>
              </div>
              <div className="pg-custom-row">
                <input
                  inputMode="numeric"
                  value={custom}
                  placeholder="18"
                  className={custom && !ok ? 'bad' : ''}
                  aria-label={t('pg.custom')}
                  onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, String(c.high).length))}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault() // not the composer's submit
                    if (ok) pick(n)
                  }}
                />
                <button type="button" disabled={!ok} onClick={() => pick(n)}>
                  {t('pg.apply')}
                </button>
              </div>
            </div>
          </>
        )
      }}
    </Dropdown>
  )
}

/** Compact pill with a menu: sinf, daqiqa, bob, davr, tadbir… */
function Choice({ c, value, onChange }) {
  const grid = c.options.length > 6
  return (
    <Dropdown
      className={`hx-choice-pop ${grid ? 'grid' : ''}`}
      button={({ toggle, open }) => (
        <button type="button" className={`hx-pill hx-choice ${open ? 'open' : ''}`} onClick={toggle}>
          {c.format(value)}
          <CaretDown size={11} weight="bold" className="hx-pill-caret" />
        </button>
      )}
    >
      {(close) =>
        c.options.map((o) => (
          <button
            key={o}
            type="button"
            className={`menu-item ${o === value ? 'on' : ''}`}
            onClick={() => {
              onChange(o)
              close()
            }}
          >
            {c.format(o)}
            {o === value && !grid && <Check size={14} weight="bold" className="hx-check" />}
          </button>
        ))
      }
    </Dropdown>
  )
}

/** One A4 page of a generated document, drawn at true proportions (cqw-based type). */
function DocPage({ html, i }) {
  return (
    <div className={`hx-dpage ${i === 0 ? 'cover' : ''}`} style={{ '--i': i }}>
      <div className="mp" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export default function Hero({ mode, onMode, q, onQ, inputRef, typeLabel, onType, onCreate, onCreateDoc, onTab, notify }) {
  const root = useRef(null)
  const typing = useRef(null)
  const lastInk = useRef(Date.now())
  const [focused, setFocused] = useState(false)
  const [useAlt, setUseAlt] = useState(false)
  const [optsByType, setOptsByType] = useState({})
  const [page, setPage] = useState(0)
  const [ink, setInk] = useState(0)
  const [paying, setPaying] = useState(false)

  const type = typeOf(typeLabel)
  const bp = blueprintOf(type.id)
  const opts = useMemo(() => ({ ...bp.defaults, ...optsByType[type.id] }), [bp, optsByType, type.id])
  // a control may need another one to move along (slides ≥ plan points + 4)
  const setOpt = (key, value) =>
    setOptsByType((o) => {
      const next = { ...bp.defaults, ...o[type.id], [key]: value }
      for (const c of bp.controls) {
        const low = c.min?.(next)
        if (low != null && next[c.key] < low) next[c.key] = c.options.find((v) => v >= low) ?? c.options.at(-1)
      }
      return { ...o, [type.id]: next }
    })
  const langs = useMemo(deckLangs, [])
  const [deckLang, setDeckLang] = useState(defaultDeckLang)
  const [gen, setGen] = useState(null)
  // titul details (profile): the composer pill shows how complete they are
  const [docProfile, setDocProfile] = useState(loadDocProfile)
  const [titulOpen, setTitulOpen] = useState(false)
  // bp.examples is a getter that builds a new array each time — keep one per type for the typewriter
  const examples = useMemo(() => bp.examples, [bp])
  const typed = useTypewriter(examples, mode === 'ai' && !q && !focused)

  const topic = q.trim()
  const templateId = (useAlt && type.alt) || type.templateId || DEFAULT_TEMPLATE
  const tpl = getTemplate(templateId)

  useEffect(() => setUseAlt(false), [typeLabel])

  // Live preview = exactly what "Yaratish" will produce (same blueprint, same profile).
  const built = useMemo(() => (topic && mode === 'ai' ? bp.build(topic, opts, docProfile) : null), [topic, mode, bp, opts, docProfile])

  const ideas = useMemo(() => {
    const all = ideasList()
    const start = (page * PER_PAGE) % all.length
    return [...all, ...all].slice(start, start + PER_PAGE)
  }, [page])

  // "/" anywhere on the page jumps into the prompt
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inputRef])

  useEffect(() => () => clearInterval(typing.current), [])

  const onMove = (e) => {
    const el = root.current
    if (!el || reducedMotion()) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  const onLeave = () => {
    root.current?.style.setProperty('--mx', 0)
    root.current?.style.setProperty('--my', 0)
  }

  // Hovering the headline word makes the pen write it again.
  const replayInk = () => {
    const now = Date.now()
    if (reducedMotion() || now - lastInk.current < 2600) return
    lastInk.current = now
    setInk((n) => n + 1)
  }

  // Picking an idea selects its type and options, then types the topic in letter by letter.
  const fill = (idea) => {
    const text = idea.t ?? idea.label
    onMode('ai')
    onType(idea.k)
    if (idea.o) setOptsByType((o) => ({ ...o, [idea.k]: { ...o[idea.k], ...idea.o } }))
    clearInterval(typing.current)
    if (reducedMotion()) {
      onQ(text)
      inputRef.current?.focus()
      return
    }
    let i = 0
    typing.current = setInterval(() => {
      i = Math.min(text.length, i + 2)
      onQ(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(typing.current)
        inputRef.current?.focus()
      }
    }, 18)
  }

  const action = ACTION_BY_TYPE[type.id]
  const cost = COIN_COSTS[action]?.cost

  const submit = async (e) => {
    e.preventDefault()
    if (mode !== 'ai' || !topic || paying) return
    // pay first; when coins are short the coin shop opens and nothing is created
    setPaying(true)
    let paid = null
    try {
      paid = action ? await spendCoins(action, { topic }) : {}
      if (!paid) return
    } catch (err) {
      notify?.(err.message)
      return
    } finally {
      setPaying(false)
    }
    try {
      const build = () => bp.build(topic, opts, loadDocProfile())
      const out = await (bp.lang ? buildIn(deckLang, build) : build())
      setGen({ out, paid, topic, type, bp, templateId, lang: bp.lang ? deckLang : null })
    } catch (err) {
      if (paid.ref) refundCoins(paid.ref)
      notify?.(t('hx.createFailed'))
      throw err
    }
  }

  const inkDelay = ink ? { animationDelay: '0s' } : undefined
  const isDoc = bp.format === 'doc'
  const shown = built ? (isDoc ? built.pages.slice(0, 3) : built.slides.slice(0, bp.format === 'card' ? 2 : 3)) : []
  const more = built ? (isDoc ? built.estPages : built.slides.length) - shown.length : 0

  return (
    <section className={`hx ${focused ? 'is-focus' : ''}`} ref={root} onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* ───── Living background ───── */}
      <div className="hx-bg" aria-hidden="true">
        <span className="hx-aurora a1" />
        <span className="hx-aurora a2" />
        <span className="hx-aurora a3" />
        <span className="hx-grid" />
        <span className="hx-grid lit" />
        <span className="hx-spot" />
        <svg className="hx-rings" viewBox="-600 -600 1200 1200" preserveAspectRatio="xMidYMid meet">
          {[150, 230, 310, 390, 470, 550].map((r) => (
            <circle key={r} r={r} />
          ))}
          <circle className="hx-orbit" r={310} />
          <circle className="hx-orbit slow" r={470} />
          <g className="hx-planet p1">
            <circle className="halo" cx="310" cy="0" r="11" />
            <circle cx="310" cy="0" r="4.5" />
          </g>
          <g className="hx-planet p2">
            <circle className="halo" cx="-470" cy="0" r="12" />
            <circle cx="-470" cy="0" r="5" />
          </g>
        </svg>
        <span className="hx-grain" />
      </div>

      <div className="hx-floaters" aria-hidden="true">
        {FLOATERS.map((f) => (
          <Floater key={f.tpl} f={f} onPick={(id) => onCreate({ templateId: id })} />
        ))}
      </div>

      <div className="hx-content">
        <button type="button" className="hx-badge" onClick={() => onTab('files')}>
          <span className="hx-badge-new">
            <Sparkle size={11} weight="fill" /> {t('hx.new')}
          </span>
          <span className="hx-badge-text">{t('hx.badge')}</span>
          <ArrowRight size={13} weight="bold" className="hx-badge-arrow" />
        </button>

        <h1 className="hx-title">
          <span className="hx-w" style={{ '--w': 0 }}>
            {t('hx.title1')}
          </span>{' '}
          <span className="hx-w" style={{ '--w': 1 }}>
            {t('hx.title2')}
          </span>
          <br />
          <span className="hx-word hx-w" style={{ '--w': 2 }} onPointerEnter={replayInk}>
            <em>{t('hx.title3')}</em>
            <svg key={`s${ink}`} className="hx-stroke" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
              <path d="M4 15C60 5 118 23 178 12S262 7 296 14" pathLength="1" style={inkDelay} />
            </svg>
            <span key={`p${ink}`} className="hx-pen" aria-hidden="true" style={inkDelay}>
              <QalamNib height={62} />
            </span>
          </span>
          <span className="hx-q">?</span>
        </h1>

        <p className="hx-sub">{tr('hx.sub')}</p>

        {/* ───── Composer ───── */}
        <form className={`hx-composer ${mode} ${focused ? 'focus' : ''} ${topic ? 'filled' : ''}`} onSubmit={submit}>
          <span className="hx-glow" aria-hidden="true" />
          <div className="hx-composer-in">
            <div className="hx-field">
              <span className="hx-field-ic" aria-hidden="true">
                {mode === 'ai' ? <Sparkle size={19} weight="fill" /> : <MagnifyingGlass size={19} weight="bold" />}
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  clearInterval(typing.current)
                  onQ(e.target.value)
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={mode === 'search' ? t('hx.searchPh') : focused ? bp.placeholder : ''}
                aria-label={mode === 'ai' ? bp.label : t('hx.search')}
                autoComplete="off"
                spellCheck={false}
              />
              {mode === 'ai' && !q && !focused && (
                <span className="hx-ph" aria-hidden="true">
                  <span className="hx-ph-label">{bp.label}:</span> {typed}
                  <i className="hx-caret" />
                </span>
              )}
              {q ? (
                <button
                  type="button"
                  className="hx-clear"
                  onClick={() => {
                    clearInterval(typing.current)
                    onQ('')
                    inputRef.current?.focus()
                  }}
                  aria-label={t('hx.clear')}
                >
                  <X size={13} weight="bold" />
                </button>
              ) : (
                !focused && (
                  <kbd className="hx-kbd" title={t('hx.slashHint')}>
                    /
                  </kbd>
                )
              )}
            </div>

            <div className="hx-tools">
              <div className="hm-mode">
                <button type="button" className={mode === 'ai' ? 'on' : ''} onClick={() => onMode('ai')}>
                  <QalamNib height={16} />
                  <span className="hm-mode-brand">
                    Qalam<b>AI</b>
                  </span>
                </button>
                <button type="button" className={mode === 'search' ? 'on' : ''} onClick={() => onMode('search')}>
                  <MagnifyingGlass size={14} weight="bold" /> {t('hx.search')}
                </button>
              </div>

              {mode === 'ai' ? (
                <>
                  <span className="hx-tools-div" />
                  <Dropdown
                    className="hx-type-pop"
                    button={({ toggle, open }) => (
                      <button type="button" className={`hx-pill ${open ? 'open' : ''}`} onClick={toggle} aria-label={t('hx.type')}>
                        <span className="hx-pill-ic" style={{ background: COLORS[type.color].to }}>
                          <type.icon size={14} weight="fill" color="#fff" />
                        </span>
                        <span className="hx-pill-label">{type.label}</span>
                        <CaretDown size={11} weight="bold" className="hx-pill-caret" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <div className="pop-label">{t('hx.whatCreate')}</div>
                        {/* a wide grid, four in a row, instead of a long list */}
                        <div className="hx-type-grid">
                          {CREATE.map((c, i) => (
                            <button
                              key={c.id}
                              type="button"
                              className={`hx-type-card ${c.id === type.id ? 'on' : ''}`}
                              style={{ '--i': i }}
                              onClick={() => {
                                onType(c.id)
                                close()
                              }}
                            >
                              <CatTile icon={c.icon} color={c.color} />
                              <span className="hx-type-text">
                                {c.label}
                                <small>{blueprintOf(c.id).format === 'doc' ? t('hx.a4') : t('hx.slides')}</small>
                              </span>
                              {c.id === type.id && (
                                <span className="hx-type-on">
                                  <Check size={11} weight="bold" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </Dropdown>

                  {bp.controls.map((c) =>
                    c.kind === 'pages' ? (
                      <PagesPicker key={`${type.id}-${c.key}`} c={c} value={opts[c.key]} onChange={(v) => setOpt(c.key, v)} />
                    ) : c.kind === 'stepper' ? (
                      <Stepper key={`${type.id}-${c.key}`} c={c} value={opts[c.key]} opts={opts} onChange={(v) => setOpt(c.key, v)} />
                    ) : (
                      <Choice key={`${type.id}-${c.key}`} c={c} value={opts[c.key]} onChange={(v) => setOpt(c.key, v)} />
                    ),
                  )}

                  {bp.lang && <DeckLangPicker langs={langs} value={deckLang} onChange={setDeckLang} variant="pill" />}
                  {bp.titul && <TitulPill profile={docProfile} onClick={() => setTitulOpen(true)} />}

                  <button className="hx-go" disabled={!topic || paying}>
                    <span className="hx-go-label">{paying ? t('ui.wait') : t('ui.create')}</span>
                    {cost != null && (
                      <span className="hx-go-cost" title={t('hx.coins', { n: cost })}>
                        <CoinIcon size={16} />
                        {cost}
                      </span>
                    )}
                    <ArrowUp size={16} weight="bold" />
                  </button>
                </>
              ) : (
                <span className="hx-tools-hint">{t('hx.resultsBelow')}</span>
              )}
            </div>
          </div>
        </form>

        {/* ───── Ideas ↔ live preview (same footprint, so nothing below jumps) ───── */}
        <div className={`hx-below ${built ? 'is-preview' : ''}`}>
          <div className="hx-ideas">
            <div className={`hx-chips ${page ? 'again' : ''}`} key={page}>
              {ideas.map((idea, i) => (
                <button key={idea.label} type="button" className="hx-chip" style={{ '--i': i }} onClick={() => fill(idea)}>
                  <span className="hx-chip-dot" style={{ background: COLORS[typeOf(idea.k).color].to }} />
                  {idea.label}
                </button>
              ))}
              <button
                type="button"
                className="hx-chip shuffle"
                style={{ '--i': PER_PAGE }}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t('hx.otherIdeas')}
                title={t('hx.otherIdeas')}
              >
                <Shuffle size={15} weight="bold" />
              </button>
            </div>

            <ul className="hx-trust">
              <li>
                <Exam size={15} weight="duotone" /> {t('hx.trust1')}
              </li>
              <li>
                <TextAa size={15} weight="duotone" /> {t('hx.trust2')}
              </li>
              <li>
                <DownloadSimple size={15} weight="duotone" /> {t('hx.trust3')}
              </li>
            </ul>
          </div>

          {built && (
            <div className="hx-preview">
              <div className="hx-preview-head">
                <span className="hx-live-label">
                  <span className="hx-live" /> {t('hx.live')}
                </span>
                <span className="hx-outline" title={bp.outline(opts)}>
                  <ListBullets size={13} weight="bold" /> {bp.outline(opts)}
                </span>
                {!isDoc && type.alt && (
                  <button type="button" className="hx-swap" onClick={() => setUseAlt((v) => !v)}>
                    <ArrowsClockwise size={13} weight="bold" /> {t('hx.otherTpl')}
                  </button>
                )}
              </div>
              <div className={`hx-preview-slides ${bp.format}`} key={`${type.id}-${templateId}`}>
                {isDoc
                  ? shown.map((html, i) => <DocPage key={i} html={html} i={i} />)
                  : shown.map((s, i) => (
                      <div key={i} className={`hx-thumb ${i === 0 && bp.format !== 'card' ? 'cover' : ''}`} style={{ '--i': i }}>
                        <Slide slide={s} theme={tpl.theme} preview />
                      </div>
                    ))}
                {more > 0 && (
                  <div className="hx-thumb more" style={{ '--i': shown.length }}>
                    <b>+{more}</b>
                    <span>{isDoc ? t('hx.morePages') : t('hx.moreSlides')}</span>
                    <small>{isDoc ? bp.meta(opts).split(' · ')[0] : tpl.name}</small>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {titulOpen && (
        <TitulSheet
          kindId={type.id}
          topic={topic}
          lang={deckLang}
          langName={langs.find((l) => l.id === deckLang)?.name}
          onClose={() => setTitulOpen(false)}
          onSaved={(p) => {
            setDocProfile(p)
            notify?.(t('ts.saved'))
          }}
        />
      )}

      {gen && <HeroGenerate gen={gen} langs={langs} onCreate={onCreate} onCreateDoc={onCreateDoc} onClose={() => setGen(null)} notify={notify} />}
    </section>
  )
}

/** The generation screen for whatever the composer built (slides, card or A4 pages). */
function HeroGenerate({ gen, langs, onCreate, onCreateDoc, onClose, notify }) {
  const { out, type, bp, topic, templateId, lang } = gen
  const isDoc = bp.format === 'doc'
  const tpl = getTemplate(templateId)
  const outline = out.outline ?? (isDoc ? headingsOf(out.pages) : out.slides.map((s) => s.title).filter(Boolean))
  return (
    <GenerateOverlay
      topic={topic}
      kind={type.label}
      unit={t(isDoc ? 'bp.unit.page' : 'bp.unit.slide')}
      format={bp.format}
      outline={outline}
      total={isDoc ? out.pages.length : out.slides.length}
      renderThumb={(i) =>
        isDoc ? (
          <div className="gn-doc">
            <div className="mp" dangerouslySetInnerHTML={{ __html: out.pages[i] }} />
          </div>
        ) : (
          <Slide slide={out.slides[i]} theme={tpl.theme} preview />
        )
      }
      templateName={isDoc ? 'A4' : tpl.name}
      note={lang && fallbackOf(lang) ? t('gn.langFallback', { lang: langs.find((l) => l.id === lang)?.name }) : null}
      onDone={() => {
        if (isDoc) onCreateDoc({ name: out.name, html: docHtml(out.pages), kind: type.label })
        else onCreate({ topic, templateId, kind: type.kind, slides: out.slides, ai: true, lang })
        onClose()
      }}
      onCancel={() => {
        if (gen.paid?.ref) refundCoins(gen.paid.ref)
        onClose()
        notify?.(t('gn.cancelled'))
      }}
    />
  )
}
