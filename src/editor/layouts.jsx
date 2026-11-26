// Page layouts for the structured templates: cover, agenda, cards, stats, process, team, quiz …
// One renderer per layout; the template only supplies theme tokens (colours, fonts, card and
// image-frame styles) through CSS variables, so every layout works with every template.
// All sizes are in cqw — the same page scales from a 150 px thumbnail to the full canvas.
import { Check, Quotes } from '@phosphor-icons/react'
import { t } from '../i18n/index.js'
import { Bullets, Heading, ImageSlot, T, patchAt, valueOf } from './layoutKit.jsx'
import { ChartBody, CHART_KINDS } from './charts.jsx'
import { PRO_LAYOUTS, PRO_RENDER, proSample } from './layoutsPro.jsx'
import './layouts.css'
import './layouts-pro.css'

export { downscale, patchAt } from './layoutKit.jsx'

/** Layouts a page can have. 'title' and 'content' are the classic two; the rest are structured. */
export const LAYOUTS = ['title', 'content', 'agenda', 'section', 'media', 'cards', 'stats', 'process', 'team', 'quote', 'chart', 'quiz', 'compare', 'end', ...PRO_LAYOUTS]

/** Entries of the "add page" menu: every layout, plus the other chart kinds ('chart:line' …). */
export const PICKS = [...LAYOUTS.slice(0, 11), ...CHART_KINDS.filter((k) => k !== 'bar').map((k) => `chart:${k}`), ...LAYOUTS.slice(11)]

/* ───────── layouts ───────── */

function Cover({ ctx }) {
  const mode = ctx.theme.cover ?? 'center' // center · left · split · bg
  return (
    <div className={`ly ly-cover c-${mode}`}>
      {(mode === 'split' || mode === 'bg') && <ImageSlot ctx={ctx} path="image" className="ly-cover-img" />}
      <div className="ly-cover-text">
        {ctx.slide.kicker != null && <T ctx={ctx} path="kicker" className="ly-kicker" />}
        <T ctx={ctx} path="title" className="ly-cover-title" />
        <span className="ly-rule" />
        <T ctx={ctx} path="subtitle" className="ly-sub" />
      </div>
    </div>
  )
}

function Content({ ctx }) {
  return (
    <div className="ly ly-content">
      <Heading ctx={ctx} />
      <Bullets ctx={ctx} />
    </div>
  )
}

function Agenda({ ctx }) {
  const items = ctx.slide.items ?? []
  return (
    <div className="ly ly-agenda">
      <Heading ctx={ctx} />
      <ol className="ly-agenda-list">
        {items.map((_, i) => (
          <li key={i}>
            <span className="ly-num">{String(i + 1).padStart(2, '0')}</span>
            <T ctx={ctx} path={`items.${i}`} as="span" />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Section({ ctx }) {
  return (
    <div className="ly ly-section">
      <span className="ly-big-num">{String(ctx.slide.num ?? (ctx.index ?? 0) + 1).padStart(2, '0')}</span>
      <T ctx={ctx} path="title" className="ly-cover-title" />
      <span className="ly-rule" />
      <T ctx={ctx} path="subtitle" className="ly-sub" />
    </div>
  )
}

function Media({ ctx }) {
  const flip = ctx.slide.side === 'left'
  return (
    <div className={`ly ly-media ${flip ? 'flip' : ''}`}>
      <div className="ly-media-text">
        <Heading ctx={ctx} />
        <T ctx={ctx} path="text" className="ly-p" />
        {ctx.slide.bullets?.length > 0 && <Bullets ctx={ctx} />}
      </div>
      <ImageSlot ctx={ctx} path="image" className="ly-media-img" />
    </div>
  )
}

function Cards({ ctx }) {
  const cards = ctx.slide.cards ?? []
  return (
    <div className="ly ly-cards">
      <Heading ctx={ctx} />
      <div className="ly-card-row" style={{ '--n': cards.length }}>
        {cards.map((_, i) => (
          <div key={i} className="ly-card">
            <span className="ly-card-num">{String(i + 1).padStart(2, '0')}</span>
            <T ctx={ctx} path={`cards.${i}.title`} className="ly-card-title" />
            <T ctx={ctx} path={`cards.${i}.text`} className="ly-p sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stats({ ctx }) {
  const stats = ctx.slide.stats ?? []
  return (
    <div className="ly ly-stats">
      <Heading ctx={ctx} />
      <div className="ly-stat-row" style={{ '--n': stats.length }}>
        {stats.map((_, i) => (
          <div key={i} className="ly-stat">
            <T ctx={ctx} path={`stats.${i}.value`} className="ly-stat-v" />
            <T ctx={ctx} path={`stats.${i}.label`} className="ly-p sm" />
          </div>
        ))}
      </div>
      {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-p ly-foot" />}
    </div>
  )
}

function Process({ ctx }) {
  const steps = ctx.slide.steps ?? []
  return (
    <div className="ly ly-process">
      <Heading ctx={ctx} />
      <div className="ly-steps" style={{ '--n': steps.length }}>
        <span className="ly-steps-line" />
        {steps.map((_, i) => (
          <div key={i} className="ly-step">
            <span className="ly-step-dot">{i + 1}</span>
            <T ctx={ctx} path={`steps.${i}.title`} className="ly-card-title" />
            <T ctx={ctx} path={`steps.${i}.text`} className="ly-p sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Team({ ctx }) {
  const people = ctx.slide.people ?? []
  return (
    <div className="ly ly-team">
      <Heading ctx={ctx} />
      <div className="ly-people" style={{ '--n': people.length }}>
        {people.map((_, i) => (
          <div key={i} className="ly-person">
            <ImageSlot ctx={ctx} path={`people.${i}.image`} className="ly-face" />
            <T ctx={ctx} path={`people.${i}.name`} className="ly-card-title" />
            <T ctx={ctx} path={`people.${i}.role`} className="ly-p sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Quote({ ctx }) {
  return (
    <div className="ly ly-quote">
      <Quotes weight="fill" className="ly-quote-mark" />
      <T ctx={ctx} path="quote" className="ly-quote-text" />
      <span className="ly-rule" />
      <T ctx={ctx} path="author" className="ly-sub" />
    </div>
  )
}

function Chart({ ctx }) {
  const kind = ctx.slide.kind ?? 'bar'
  if (kind !== 'bar') return <ChartBody ctx={ctx} kind={kind} />
  const bars = ctx.slide.bars ?? []
  const max = Math.max(1, ...bars.map((b) => valueOf(b.value) || 0))
  return (
    <div className="ly ly-chart">
      <div className="ly-chart-text">
        <Heading ctx={ctx} />
        <T ctx={ctx} path="text" className="ly-p" />
      </div>
      <div className="ly-bars" style={{ '--n': bars.length }}>
        {bars.map((b, i) => (
          <div key={i} className="ly-bar">
            <T ctx={ctx} path={`bars.${i}.value`} className="ly-bar-v" />
            <span className="ly-bar-fill" style={{ height: `${(Math.max(0, valueOf(b.value) || 0) / max) * 100}%` }} />
            <T ctx={ctx} path={`bars.${i}.label`} className="ly-bar-l" />
          </div>
        ))}
      </div>
    </div>
  )
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function Quiz({ ctx }) {
  const { slide } = ctx
  const options = slide.options ?? []
  const reveal = slide.answer != null
  return (
    <div className={`ly ly-quiz ${reveal ? 'reveal' : ''}`}>
      <span className="ly-quiz-badge">{slide.num ?? 1}</span>
      <div className="ly-quiz-label">{reveal ? t('ly.quiz.answer') : t('ly.quiz.label', { n: slide.num ?? 1 })}</div>
      <T ctx={ctx} path="question" className="ly-quiz-q" />
      <div className="ly-options">
        {options.map((_, i) => {
          const right = reveal && slide.answer === i
          return (
            <div key={i} className={`ly-opt ${right ? 'right' : ''} ${reveal && !right ? 'dim' : ''}`}>
              {/* in the editor, clicking the letter marks/unmarks the correct answer */}
              <span
                className={`ly-opt-l ${ctx.editable ? 'pick' : ''}`}
                onClick={ctx.editable ? () => ctx.change({ answer: slide.answer === i ? null : i }) : undefined}
              >
                {right ? <Check weight="bold" /> : LETTERS[i]}
              </span>
              <T ctx={ctx} path={`options.${i}`} as="span" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Compare({ ctx }) {
  return (
    <div className="ly ly-compare">
      <Heading ctx={ctx} />
      <div className="ly-cols">
        {['left', 'right'].map((side) => (
          <div key={side} className={`ly-col ${side}`}>
            <T ctx={ctx} path={`${side}.title`} className="ly-card-title" />
            <Bullets ctx={ctx} path={`${side}.items`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function End({ ctx }) {
  return (
    <div className="ly ly-end">
      <T ctx={ctx} path="title" className="ly-end-title" />
      <span className="ly-rule" />
      <T ctx={ctx} path="subtitle" className="ly-sub" />
      {ctx.slide.contact != null && <T ctx={ctx} path="contact" className="ly-contact" />}
    </div>
  )
}

const RENDER = {
  title: Cover,
  content: Content,
  agenda: Agenda,
  section: Section,
  media: Media,
  cards: Cards,
  stats: Stats,
  process: Process,
  team: Team,
  quote: Quote,
  chart: Chart,
  quiz: Quiz,
  compare: Compare,
  end: End,
  ...PRO_RENDER,
}

/**
 * The page body for structured templates (and for any non-classic layout).
 * @param {{ slide: object, theme: object, index?: number, editable?: boolean, onChange?: (patch: object) => void }} props
 */
export function LayoutBody({ slide, theme, index, editable, onChange }) {
  const Render = RENDER[slide.type] ?? Content
  const ctx = {
    slide,
    theme,
    index,
    editable,
    change: (patch) => onChange?.(patch),
    set: (path, value) => onChange?.(patchAt(slide, path, value)),
  }
  const a = theme.area ?? { l: 7, t: 10, w: 86, h: 80 }
  return (
    // --al … --ah: the area in % of the page, so full-bleed pictures can reach the page edges
    <div
      className="ly-area"
      data-layout={slide.type}
      style={{
        left: `${a.l}%`, top: `${a.t}%`, width: `${a.w}%`, height: `${a.h}%`, '--al': a.l, '--at': a.t, '--aw': a.w, '--ah': a.h,
        // quality.js may set `fit` (< 1) on a page whose text runs over: every type size scales down together
        ...(slide.fit > 0 && slide.fit < 1 ? { '--ts': (theme.titleScale ?? 1) * slide.fit, '--bs': (theme.bodyScale ?? 1) * slide.fit, '--fit': slide.fit } : {}),
      }}
    >
      <Render ctx={ctx} />
    </div>
  )
}

/** CSS variables carrying a template's tokens to the layouts. */
export function themeVars(th) {
  return {
    '--tx': th.text,
    '--mu': th.muted,
    '--acc': th.accent,
    '--acc2': th.accent2 ?? th.accent,
    '--card': th.card ?? 'rgba(127,127,127,.12)',
    '--card-tx': th.cardText ?? th.text,
    '--card-bd': th.cardBorder ?? 'transparent',
    '--rad': `${th.radius ?? 1.2}cqw`,
    '--tf': th.titleFont,
    '--bf': th.bodyFont,
    '--tw': th.titleWeight ?? 700,
    '--tcase': th.upper ? 'uppercase' : 'none',
    '--ts': th.titleScale ?? 1,
    '--bs': th.bodyScale ?? 1,
    '--btn-tx': th.onAccent ?? '#fff',
    '--ph': th.placeholder ?? 'linear-gradient(135deg, rgba(127,127,127,.25), rgba(127,127,127,.08))',
    '--talign': th.center ? 'center' : 'left',
  }
}

/* ───────── sample pages (template previews and "use all pages") ───────── */

const parts = (key, vars) => t(key, vars).split('|')
const pairs = (key, a, b) => {
  const xs = parts(key)
  const out = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push({ [a]: xs[i], [b]: xs[i + 1] })
  return out
}

/** A filled page of the given layout, in the interface language. `v` picks a variant. */
export function samplePage(entry, v = 0) {
  const [type, variant] = String(entry).split(':')
  if (variant != null) return type === 'chart' ? chartSample(variant) : samplePage(type, Number(variant) || 0)
  const pro = proSample(type, v)
  if (pro) return pro
  switch (type) {
    // an empty white page (Canva's new page): filled by hand with text, photos, elements
    case 'blank':
      return { type: 'content', blank: true, free: true, decorFree: true, bg: '#ffffff', title: '', bullets: [] }
    case 'agenda':
      return { type, title: t('ly.agenda.title'), items: parts('ly.agenda.items') }
    case 'section': {
      const [title, subtitle] = parts('ly.section')
      return { type, title, subtitle, num: v + 1 }
    }
    case 'media': {
      const [title, text] = parts(`ly.media.${v % 2}`)
      return { type, title, text, image: null, side: v % 2 ? 'left' : 'right', ...(v % 2 ? { bullets: parts('ly.media.bullets') } : {}) }
    }
    case 'cards':
      return { type, title: t('ly.cards.title'), cards: pairs('ly.cards.items', 'title', 'text').slice(0, v ? 4 : 3) }
    case 'stats':
      return { type, title: t('ly.stats.title'), stats: pairs('ly.stats.items', 'value', 'label'), text: t('ly.stats.text') }
    case 'process':
      return { type, title: t('ly.process.title'), steps: pairs('ly.process.items', 'title', 'text') }
    case 'team':
      return { type, title: t('ly.team.title'), people: pairs('ly.team.items', 'name', 'role').map((p) => ({ ...p, image: null })) }
    case 'quote': {
      const [quote, author] = parts('ly.quote')
      return { type, quote, author }
    }
    case 'chart': {
      if (v) return chartSample(CHART_KINDS[v % CHART_KINDS.length])
      const xs = parts('ly.chart.items')
      const bars = []
      for (let i = 0; i + 1 < xs.length; i += 2) bars.push({ label: xs[i], value: xs[i + 1] })
      return { type, title: t('ly.chart.title'), text: t('ly.chart.text'), bars }
    }
    case 'quiz': {
      const [question, ...rest] = parts(`ly.quiz.${Math.floor(v / 2) % 3}`)
      const answer = Number(rest.pop())
      return { type, num: Math.floor(v / 2) + 1, question, options: rest, answer: v % 2 ? answer : null }
    }
    case 'compare': {
      const [lt, ...li] = parts('ly.compare.left')
      const [rt, ...ri] = parts('ly.compare.right')
      return { type, title: t('ly.compare.title'), left: { title: lt, items: li }, right: { title: rt, items: ri } }
    }
    case 'end': {
      const [title, subtitle] = parts('ly.end')
      return { type, title, subtitle, contact: 'info@qalam.ai · +998 90 000 00 00' }
    }
    case 'content': {
      const [title, ...bullets] = parts(`ly.content.${v % 2}`)
      return { type, title, bullets }
    }
    default:
      return { type: 'title', kicker: t('ly.kicker'), title: '', subtitle: '', image: null }
  }
}

/** A sample chart page of the given kind: a series over time for bars and lines, shares for the rest. */
function chartSample(kind) {
  const share = kind === 'donut' || kind === 'pie' || kind === 'hbar'
  const xs = parts(share ? 'ly.chart.share' : 'ly.chart.items')
  const bars = []
  for (let i = 0; i + 1 < xs.length; i += 2) bars.push({ label: xs[i], value: xs[i + 1] })
  return {
    type: 'chart',
    kind,
    title: t(share ? 'ly.chart.shareTitle' : 'ly.chart.title'),
    text: t(share ? 'ly.chart.shareText' : 'ly.chart.text'),
    bars,
    ...(share ? { unit: '%' } : {}),
  }
}
