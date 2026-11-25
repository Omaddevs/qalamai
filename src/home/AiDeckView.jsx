import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Sparkle, Shuffle, Minus, Plus, CaretDown, Check, MagnifyingGlass, ListNumbers, Stack, Translate,
  Lightbulb, X, PresentationChart,
} from '@phosphor-icons/react'
import { Dropdown } from '../components/ui.jsx'
import { CoinIcon } from '../components/Coins.jsx'
import { ACTION_BY_TYPE, COIN_COSTS, refundCoins, spendCoins } from '../coins.js'
import { blueprintOf, planDeck, planSplit, PLAN_FIXED, PLAN_MAX } from '../blueprints.js'
import { loadDocProfile } from '../profile.js'
import { LANGS, getLang, t, tr } from '../i18n/index.js'
import './aideck.css'

const SLIDES_MIN = 5
const SLIDES_MAX = 30
const TOPIC_MAX = 300
const PLAN_NUMS = Array.from({ length: PLAN_MAX }, (_, i) => i + 1)
// one soft colour per plan item, cycling (lime first — the brand)
const HUES = ['#c6f432', '#b9a7fb', '#fbbf8c', '#8fd3f4', '#f9a8d4', '#86efac']

/* Presentation languages: the 7 site languages, then the most spoken world languages.
 * The order matches 'ad.names' (src/i18n/msg/aideck.js); native names are not translated. */
const WORLD = [
  ['zh', '中文'],
  ['hi', 'हिन्दी'],
  ['es', 'Español'],
  ['fr', 'Français'], // i18n-ignore
  ['ar', 'العربية', true],
  ['bn', 'বাংলা'],
  ['pt', 'Português'],
  ['ur', 'اردو', true],
  ['id', 'Bahasa Indonesia'],
  ['de', 'Deutsch'],
  ['ja', '日本語'],
  ['tr', 'Türkçe'], // i18n-ignore
  ['ko', '한국어'],
  ['vi', 'Tiếng Việt'],
  ['it', 'Italiano'],
  ['fa', 'فارسی', true],
  ['pl', 'Polski'],
  ['uk', 'Українська'],
]
const deckLangs = () => {
  const names = t('ad.names').split('|')
  const site = LANGS.map((l) => ({ id: l.id, code: l.code, native: l.note ? `${l.name} · ${l.note}` : l.name, site: true }))
  const world = WORLD.map(([id, native, rtl]) => ({ id, code: id.toUpperCase(), native, rtl }))
  return [...site, ...world].map((l, i) => ({ ...l, name: names[i] ?? l.native }))
}

const minSlides = (plans) => plans + PLAN_FIXED
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

function LangPicker({ langs, value, onChange }) {
  const [q, setQ] = useState('')
  const cur = langs.find((l) => l.id === value) ?? langs[0]
  const query = q.trim().toLowerCase()
  const found = query ? langs.filter((l) => `${l.name} ${l.native} ${l.code}`.toLowerCase().includes(query)) : langs
  const groups = [
    [t('ad.langSite'), found.filter((l) => l.site)],
    [t('ad.langWorld'), found.filter((l) => !l.site)],
  ].filter(([, list]) => list.length)

  return (
    <Dropdown
      className="ad-lang-pop"
      button={({ toggle, open }) => (
        <button type="button" className={`ad-lang-btn ${open ? 'open' : ''}`} onClick={() => { setQ(''); toggle() }} aria-haspopup="listbox" aria-expanded={open}>
          <span className="ad-code">{cur.code}</span>
          <span className="ad-lang-text">
            <b dir={cur.rtl ? 'rtl' : undefined}>{cur.native}</b>
            {cur.name !== cur.native && <small>{cur.name}</small>}
          </span>
          <CaretDown size={14} weight="bold" className="ad-caret" />
        </button>
      )}
    >
      {(close) => (
        <>
          <label className="ad-lang-search">
            <MagnifyingGlass size={15} weight="bold" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ad.langSearch')} aria-label={t('ad.langSearch')} />
          </label>
          <div className="ad-lang-list" role="listbox">
            {groups.map(([label, list]) => (
              <div key={label} className="ad-lang-group">
                <div className="pop-label">
                  {label} <span>{list.length}</span>
                </div>
                {list.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="option"
                    aria-selected={l.id === value}
                    className={`ad-lang-item ${l.id === value ? 'on' : ''}`}
                    onClick={() => {
                      onChange(l.id)
                      close()
                    }}
                  >
                    <span className="ad-code sm">{l.code}</span>
                    <span className="ad-lang-text">
                      <b dir={l.rtl ? 'rtl' : undefined}>{l.native}</b>
                      {l.name !== l.native && <small>{l.name}</small>}
                    </span>
                    {l.id === value && <Check size={15} weight="bold" className="ad-check" />}
                  </button>
                ))}
              </div>
            ))}
            {!groups.length && <p className="ad-lang-none">{t('ad.langNone')}</p>}
          </div>
        </>
      )}
    </Dropdown>
  )
}

/** Live outline: one mini slide per slide, coloured by section, plus the plan legend. */
function Structure({ plans, slides, lang }) {
  const split = planSplit(plans, slides)
  const strip = [
    { k: 'cover' },
    { k: 'agenda' },
    ...split.flatMap((n, i) => Array.from({ length: n }, (_, j) => ({ k: 'plan', i, first: j === 0 }))),
    { k: 'summary' },
    { k: 'thanks' },
  ]
  return (
    <>
      <div className="ad-strip" key={`${plans}-${slides}`}>
        {strip.map((s, n) => (
          <div
            key={n}
            className={`ad-mini ${s.k} ${s.first ? 'first' : ''}`}
            style={{ '--i': n, '--hue': s.k === 'plan' ? HUES[s.i % HUES.length] : undefined }}
            title={s.k === 'plan' ? t('ad.planItem', { n: s.i + 1 }) : t(`ad.${s.k}`)}
          >
            <span className="ad-mini-n">{n + 1}</span>
            {s.k === 'cover' || s.k === 'thanks' ? (
              <span className="ad-mini-cover">
                <i />
                <i />
              </span>
            ) : (
              <span className="ad-mini-lines">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        ))}
      </div>

      <ol className="ad-legend">
        <li className="fixed">
          <span className="ad-dot dark" /> {t('ad.cover')} · {t('ad.agenda')}
          <b>2</b>
        </li>
        {split.map((n, i) => (
          <li key={i} style={{ '--i': i }}>
            <span className="ad-dot" style={{ background: HUES[i % HUES.length] }} />
            {t('ad.planItem', { n: i + 1 })}
            <span className="ad-bar">
              <span style={{ width: `${(n / Math.max(...split)) * 100}%`, background: HUES[i % HUES.length] }} />
            </span>
            <b>{n}</b>
          </li>
        ))}
        <li className="fixed">
          <span className="ad-dot dark" /> {t('ad.summary')} · {t('ad.thanks')}
          <b>2</b>
        </li>
      </ol>

      <div className="ad-sum">
        <span>
          <Stack size={14} weight="bold" /> {t('ad.slidesN', { n: slides })}
        </span>
        <span>
          <ListNumbers size={14} weight="bold" /> {t('ad.plansN', { n: plans })}
        </span>
        <span>
          <Translate size={14} weight="bold" /> {lang.name}
        </span>
      </div>
    </>
  )
}

export default function AiDeckView({ initialTopic = '', onCreate, notify }) {
  const langs = useMemo(deckLangs, [])
  const bp = blueprintOf('Prezentatsiya')
  const ideas = useMemo(() => bp.examples, [bp])
  const [topic, setTopic] = useState(initialTopic)
  const [plans, setPlans] = useState(4)
  const [slides, setSlides] = useState(10)
  const [lang, setLang] = useState(() => (langs.some((l) => l.id === getLang()) ? getLang() : 'uz'))
  const [ideaPage, setIdeaPage] = useState(0)
  const [bumped, setBumped] = useState(0)
  const [paying, setPaying] = useState(false)
  const area = useRef(null)
  const topicBox = useRef(null)

  const action = ACTION_BY_TYPE.Prezentatsiya
  const cost = COIN_COSTS[action]?.cost
  const low = minSlides(plans)
  const text = topic.trim()
  const curLang = langs.find((l) => l.id === lang) ?? langs[0]
  const shownIdeas = [0, 1, 2].map((k) => ideas[(ideaPage * 3 + k) % ideas.length])

  // the field grows with the text
  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [topic])

  useEffect(() => {
    if (initialTopic) area.current?.focus()
  }, [initialTopic])

  const pickPlans = (n) => {
    setPlans(n)
    if (slides < minSlides(n)) {
      setSlides(minSlides(n))
      setBumped((b) => b + 1)
    }
  }
  const pickSlides = (n) => setSlides(clamp(n, low, SLIDES_MAX))

  const submit = async (e) => {
    e?.preventDefault()
    if (paying) return
    if (!text) {
      topicBox.current?.animate?.(
        [{ transform: 'none' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }],
        { duration: 380, easing: 'ease-out' },
      )
      area.current?.focus()
      notify?.(t('ad.needTopic'))
      return
    }
    // pay first; when coins are short the coin shop opens and nothing is created
    setPaying(true)
    let paid = null
    try {
      paid = action ? await spendCoins(action, { topic: text }) : {}
      if (!paid) return
    } catch (err) {
      notify?.(err.message)
      return
    } finally {
      setPaying(false)
    }
    try {
      const out = planDeck(text, { plans, slides }, loadDocProfile())
      onCreate({ topic: text, templateId: 'pitch', kind: 'Taqdimot', slides: out.slides, ai: true, lang })
    } catch (err) {
      if (paid.ref) refundCoins(paid.ref)
      notify?.(t('hx.createFailed'))
      throw err
    }
  }

  const lowPct = ((low - SLIDES_MIN) / (SLIDES_MAX - SLIDES_MIN)) * 100
  const valPct = ((slides - SLIDES_MIN) / (SLIDES_MAX - SLIDES_MIN)) * 100

  return (
    <div className="ad">
      <section className="ad-scene">
        <div className="ad-bg" aria-hidden="true">
          <span className="ad-aurora a1" />
          <span className="ad-aurora a2" />
          <span className="ad-aurora a3" />
          <span className="ad-grid" />
        </div>

        <header className="ad-head">
          <span className="ad-eyebrow">
            <span className="ad-eyebrow-ic">
              <Sparkle size={12} weight="fill" />
            </span>
            {t('ad.eyebrow')}
          </span>
          <h1 className="ad-title">{tr('ad.title')}</h1>
          <p className="ad-sub">{t('ad.sub')}</p>
        </header>

        <form className="ad-studio" onSubmit={submit}>
          {/* ───── Settings ───── */}
          <div className="ad-form">
            <div className={`ad-field ad-topic ${text ? 'filled' : ''}`} ref={topicBox}>
              <div className="ad-label">
                <span className="ad-step">01</span>
                <label htmlFor="ad-topic">{t('ad.topic')}</label>
                <span className="ad-count">
                  {topic.length}/{TOPIC_MAX}
                </span>
              </div>
              <div className="ad-input">
                <Sparkle size={20} weight="fill" className="ad-input-ic" />
                <textarea
                  id="ad-topic"
                  ref={area}
                  rows={2}
                  value={topic}
                  maxLength={TOPIC_MAX}
                  placeholder={t('ad.topicPh')}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
                  }}
                  spellCheck={false}
                />
                {topic && (
                  <button type="button" className="ad-clear" onClick={() => { setTopic(''); area.current?.focus() }} aria-label={t('hx.clear')}>
                    <X size={13} weight="bold" />
                  </button>
                )}
              </div>
              <div className="ad-ideas">
                <span className="ad-ideas-label">
                  <Lightbulb size={14} weight="duotone" /> {t('ad.ideas')}
                </span>
                <div className="ad-ideas-row" key={ideaPage}>
                  {shownIdeas.map((idea, i) => (
                    <button key={idea} type="button" className="ad-idea" style={{ '--i': i }} onClick={() => { setTopic(idea); area.current?.focus() }}>
                      {idea}
                    </button>
                  ))}
                </div>
                <button type="button" className="ad-shuffle" onClick={() => setIdeaPage((p) => p + 1)} aria-label={t('hx.otherIdeas')} title={t('hx.otherIdeas')}>
                  <Shuffle size={15} weight="bold" />
                </button>
              </div>
              <p className="ad-hint">{t('ad.topicHint')}</p>
            </div>

            <div className="ad-field">
              <div className="ad-label">
                <span className="ad-step">02</span>
                <span id="ad-plans">{t('ad.plans')}</span>
                <span className="ad-value">{t('ad.plansN', { n: plans })}</span>
              </div>
              <div className="ad-plans" role="radiogroup" aria-labelledby="ad-plans">
                {PLAN_NUMS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === plans}
                    className={`ad-plan ${n === plans ? 'on' : n < plans ? 'fill' : ''}`}
                    style={{ '--i': n }}
                    onClick={() => pickPlans(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="ad-hint">{t('ad.plansHint')}</p>
            </div>

            <div className="ad-row">
              <div className="ad-field">
                <div className="ad-label">
                  <span className="ad-step">03</span>
                  <span id="ad-slides">{t('ad.slides')}</span>
                </div>
                <div className="ad-slides">
                  <button type="button" className="ad-stepbtn" onClick={() => pickSlides(slides - 1)} disabled={slides <= low} aria-label={t('ad.less')}>
                    <Minus size={16} weight="bold" />
                  </button>
                  <span className="ad-big" key={`${slides}-${bumped}`} data-bumped={bumped ? '' : undefined}>
                    {slides}
                  </span>
                  <button type="button" className="ad-stepbtn" onClick={() => pickSlides(slides + 1)} disabled={slides >= SLIDES_MAX} aria-label={t('ad.more')}>
                    <Plus size={16} weight="bold" />
                  </button>
                </div>
                <input
                  type="range"
                  className="ad-range"
                  min={SLIDES_MIN}
                  max={SLIDES_MAX}
                  value={slides}
                  onChange={(e) => pickSlides(Number(e.target.value))}
                  aria-labelledby="ad-slides"
                  style={{ '--low': `${lowPct}%`, '--val': `${valPct}%` }}
                />
                <p className="ad-hint">{t('ad.slidesMin', { n: low })}</p>
              </div>

              <div className="ad-field">
                <div className="ad-label">
                  <span className="ad-step">04</span>
                  <span>{t('ad.lang')}</span>
                  <span className="ad-value">{langs.length}</span>
                </div>
                <LangPicker langs={langs} value={lang} onChange={setLang} />
              </div>
            </div>
          </div>

          {/* ───── Live structure + create ───── */}
          <aside className="ad-side">
            <div className="ad-side-head">
              <span className="ad-side-ic">
                <PresentationChart size={18} weight="duotone" />
              </span>
              <div>
                <b>{t('ad.structure')}</b>
                <small>{t('ad.liveNote')}</small>
              </div>
              <span className="ad-live" aria-hidden="true" />
            </div>

            <Structure plans={plans} slides={slides} lang={curLang} />

            <button className="ad-go" disabled={paying}>
              <span className="ad-go-label">{paying ? t('ui.wait') : t('ad.go')}</span>
              {cost != null && (
                <span className="ad-go-cost" title={t('hx.coins', { n: cost })}>
                  <CoinIcon size={16} />
                  {cost}
                </span>
              )}
              <span className="ad-go-arrow">
                <ArrowRight size={17} weight="bold" />
              </span>
            </button>
            <p className="ad-after">
              <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd>
              <kbd>Enter</kbd> · {t('ad.after')}
            </p>
          </aside>
        </form>
      </section>
    </div>
  )
}
