import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Sparkle, Shuffle, Minus, Plus, ListNumbers, Stack, Translate, Lightbulb, X, PresentationChart,
} from '@phosphor-icons/react'
import Slide from '../editor/Slide.jsx'
import { getTemplate } from '../editor/templates.js'
import { CoinIcon } from '../components/Coins.jsx'
import { ACTION_BY_TYPE, COIN_COSTS, aiDeck, refundCoins, spendCoins } from '../coins.js'
import { ApiError } from '../api.js'
import { blueprintOf, fileDeck, planDeck, planSplit, PLAN_FIXED, PLAN_MAX } from '../blueprints.js'
import { loadDocProfile } from '../profile.js'
import { t, tr } from '../i18n/index.js'
import { DeckLangPicker, buildIn, deckLangs, defaultDeckLang, fallbackOf } from './DeckLang.jsx'
import GenerateOverlay from './GenerateOverlay.jsx'
import FileSource, { PrivateNote } from './FileSource.jsx'
import './aideck.css'

const SLIDES_MIN = 5
const SLIDES_MAX = 30
const TOPIC_MAX = 300
const TEMPLATE = 'pitch'
const PLAN_NUMS = Array.from({ length: PLAN_MAX }, (_, i) => i + 1)
// one soft colour per plan item, cycling (lime first — the brand)
const HUES = ['#c6f432', '#b9a7fb', '#fbbf8c', '#8fd3f4', '#f9a8d4', '#86efac']

const minSlides = (plans) => plans + PLAN_FIXED
// what the AI may read of a file (the server takes up to 150 000 characters)
const SOURCE_MAX = 150_000

/** A document read in the browser → plain text with "#" headings, cut at a paragraph if it is long. */
function docText(doc) {
  let out = ''
  for (const b of doc.blocks) {
    const line = b.kind === 'h' ? `${'#'.repeat(Math.min(3, b.level || 2))} ${b.text}` : b.text
    if (out.length + line.length + 2 > SOURCE_MAX) break
    out += `${line}\n\n`
  }
  return out.trim()
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

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
  const [lang, setLang] = useState(defaultDeckLang)
  const [gen, setGen] = useState(null)
  const [ideaPage, setIdeaPage] = useState(0)
  const [bumped, setBumped] = useState(0)
  const [paying, setPaying] = useState(false)
  const area = useRef(null)
  const topicBox = useRef(null)
  const stop = useRef(null) // aborts the AI stream

  // a document to build from: read in the browser, only its text kept in memory until the deck is made
  const [doc, setDoc] = useState(null)
  const fileOutline = useMemo(() => (doc ? fileDeck(doc, { slides: SLIDES_MAX }, loadDocProfile()).outline : null), [doc])
  // with a file, the plan points are the file's sections
  const planCount = fileOutline ? fileOutline.length : plans

  const action = doc ? 'prezentatsiya-fayl' : ACTION_BY_TYPE.Prezentatsiya
  const cost = COIN_COSTS[action]?.cost
  const low = minSlides(planCount)
  const text = topic.trim()
  useEffect(() => {
    if (slides < low) setSlides(low)
  }, [low, slides])
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
    if (!text && !doc) {
      topicBox.current?.animate?.(
        [{ transform: 'none' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }],
        { duration: 380, easing: 'ease-out' },
      )
      area.current?.focus()
      notify?.(t('ad.needTopic'))
      return
    }
    // the AI writes on the server (and charges there); the in-browser builder stays for when it is off
    if (await writeWithAi()) return
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
      const out = await buildIn(lang, () =>
        doc ? fileDeck(doc, { slides, topic: text }, loadDocProfile()) : planDeck(text, { plans, slides }, loadDocProfile()),
      )
      setGen({ out, paid, topic: text || out.slides[0]?.title || doc.name, lang, fromFile: Boolean(doc) })
      setDoc(null) // the document's text is no longer needed: drop it
    } catch (err) {
      if (paid.ref) refundCoins(paid.ref)
      notify?.(t('hx.createFailed'))
      throw err
    }
  }
  /**
   * Claude writes the deck; slides appear in the overlay as they arrive. Returns false only when the
   * AI is not connected (AI_OFF), so the caller falls back to the sample builder.
   */
  async function writeWithAi() {
    const usePlans = Math.min(PLAN_MAX, Math.max(1, planCount))
    const total = Math.max(slides, minSlides(usePlans))
    // a file: only its text goes to the AI (not the file), and the page forgets it afterwards
    const source = doc ? { name: (doc.name || doc.fileName || 'file').slice(0, 200), text: docText(doc), outline: (fileOutline ?? []).slice(0, PLAN_MAX).map((x) => String(x).slice(0, 120)) } : null
    const title = text || doc?.title || doc?.name || ''
    const ctl = new AbortController()
    stop.current = ctl
    setPaying(true)
    let failed = false
    const patch = (fn) => setGen((g) => (g?.live ? fn(g) : g))
    try {
      const ran = await aiDeck(
        { topic: text, plans: usePlans, slides: total, lang, source },
        {
          signal: ctl.signal,
          onEvent: (ev) => {
            if (ev.type === 'start') {
              setPaying(false)
              setGen({ live: { outline: null, written: 0, done: false }, slides: [], total, topic: title, named: Boolean(text), lang })
              setDoc(null) // the document's text is no longer needed: drop it
            } else if (ev.type === 'outline') patch((g) => ({ ...g, live: { ...g.live, outline: ev.items } }))
            else if (ev.type === 'slide')
              patch((g) => {
                const list = [...g.slides]
                list[ev.index] = { ...ev.slide, elements: [], ...(list[ev.index]?.image ? { image: list[ev.index].image, imageCredit: list[ev.index].imageCredit } : {}) }
                return { ...g, slides: list, live: { ...g.live, written: list.filter(Boolean).length } }
              })
            else if (ev.type === 'image')
              patch((g) => {
                const list = [...g.slides]
                list[ev.index] = { elements: [], ...(list[ev.index] ?? {}), image: ev.image, imageCredit: ev.credit }
                return { ...g, slides: list }
              })
            else if (ev.type === 'done') patch((g) => ({ ...g, total: g.slides.filter(Boolean).length, live: { ...g.live, done: true } }))
            else if (ev.type === 'error') {
              failed = true
              setGen(null)
              notify?.(ev.message || t('hx.createFailed'))
            }
          },
        },
      )
      if (!ran) setGen(null) // not paid: the coin shop is open
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AI_OFF') return false
      if (err.name !== 'AbortError' && !failed) {
        setGen(null)
        notify?.(err.message || t('hx.createFailed'))
      }
      return true
    } finally {
      setPaying(false)
      if (stop.current === ctl) stop.current = null
    }
  }

  const tpl = getTemplate(TEMPLATE)

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
              <p className="ad-hint">{doc ? t('fs.topicOptional') : t('ad.topicHint')}</p>
              <div className="ad-file">
                <FileSource doc={doc} onDoc={setDoc} notify={notify} variant="zone" />
                <PrivateNote />
              </div>
            </div>

            <div className="ad-field">
              <div className="ad-label">
                <span className="ad-step">02</span>
                <span id="ad-plans">{t('ad.plans')}</span>
                <span className="ad-value">{t('ad.plansN', { n: planCount })}</span>
              </div>
              <div className={`ad-plans ${doc ? 'locked' : ''}`} role="radiogroup" aria-labelledby="ad-plans" aria-disabled={Boolean(doc)}>
                {PLAN_NUMS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === planCount}
                    className={`ad-plan ${n === planCount ? 'on' : n < planCount ? 'fill' : ''}`}
                    style={{ '--i': n }}
                    disabled={Boolean(doc)}
                    onClick={() => pickPlans(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="ad-hint">{doc ? t('fs.planFromFile') : t('ad.plansHint')}</p>
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
                <DeckLangPicker langs={langs} value={lang} onChange={setLang} />
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

            <Structure plans={planCount} slides={Math.max(slides, low)} lang={curLang} />

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

      {gen?.live && (
        <GenerateOverlay
          topic={gen.topic}
          kind={t('ad.rail')}
          unit={t('bp.unit.slide')}
          outline={[]}
          live={gen.live}
          total={gen.total}
          renderThumb={(i) => (gen.slides[i] ? <Slide slide={gen.slides[i]} theme={tpl.theme} index={i} preview /> : null)}
          templateName={tpl.name}
          onDone={() =>
            // from a file without a typed topic, the deck is named by its cover title, not the file name
            onCreate({ topic: (gen.named ? gen.topic : gen.slides[0]?.title) || gen.topic, templateId: TEMPLATE, kind: 'Taqdimot', slides: gen.slides.filter(Boolean), ai: true, lang: gen.lang })
          }
          onCancel={() => {
            // the server stops writing and gives the coins back
            stop.current?.abort()
            setGen(null)
            notify?.(t('gn.cancelled'))
          }}
        />
      )}

      {gen && !gen.live && (
        <GenerateOverlay
          topic={gen.topic}
          kind={t('ad.rail')}
          unit={t('bp.unit.slide')}
          outline={gen.out.outline}
          total={gen.out.slides.length}
          renderThumb={(i) => <Slide slide={gen.out.slides[i]} theme={tpl.theme} preview />}
          templateName={tpl.name}
          note={gen.fromFile ? t('fs.contentNote') : fallbackOf(gen.lang) ? t('gn.langFallback', { lang: langs.find((l) => l.id === gen.lang)?.name }) : null}
          onDone={() => onCreate({ topic: gen.topic, templateId: TEMPLATE, kind: 'Taqdimot', slides: gen.out.slides, ai: true, lang: gen.lang })}
          onCancel={() => {
            if (gen.paid?.ref) refundCoins(gen.paid.ref)
            setGen(null)
            notify?.(t('gn.cancelled'))
          }}
        />
      )}
    </div>
  )
}
