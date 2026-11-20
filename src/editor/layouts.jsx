// Page layouts for the structured templates: cover, agenda, cards, stats, process, team, quiz …
// One renderer per layout; the template only supplies theme tokens (colours, fonts, card and
// image-frame styles) through CSS variables, so every layout works with every template.
// All sizes are in cqw — the same page scales from a 150 px thumbnail to the full canvas.
import { useRef } from 'react'
import { Check, ImageSquare, Quotes } from '@phosphor-icons/react'
import { t } from '../i18n/index.js'
import { Text } from './Text.jsx'
import './layouts.css'

/** Layouts a page can have. 'title' and 'content' are the classic two; the rest are structured. */
export const LAYOUTS = ['title', 'content', 'agenda', 'section', 'media', 'cards', 'stats', 'process', 'team', 'quote', 'chart', 'quiz', 'compare', 'end']

/* ───────── nested field paths: "cards.1.title" ───────── */

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

function setDeep(node, keys, value) {
  const [k, ...rest] = keys
  const copy = Array.isArray(node) ? [...node] : { ...(node ?? {}) }
  copy[k] = rest.length ? setDeep(copy[k], rest, value) : value
  return copy
}

/** Patch for the slide's top-level field that contains `path`. */
export function patchAt(slide, path, value) {
  const [head, ...rest] = path.split('.')
  return { [head]: rest.length ? setDeep(slide[head], rest, value) : value }
}

/* ───────── images: picked once, stored with the deck (scaled down, so it syncs) ───────── */

export async function downscale(file, max = 1280) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return c.toDataURL('image/jpeg', 0.82)
}

function ImageSlot({ ctx, path, className = '' }) {
  const input = useRef(null)
  const src = get(ctx.slide, path)
  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f?.type.startsWith('image/')) ctx.set(path, await downscale(f))
  }
  return (
    <div
      className={`ly-img f-${ctx.theme.frame ?? 'round'} ${src ? '' : 'empty'} ${className}`}
      data-path={path}
      onClick={ctx.editable ? () => input.current?.click() : undefined}
      role={ctx.editable ? 'button' : undefined}
      title={ctx.editable ? t('ly.addImage') : undefined}
    >
      <div className="ly-img-in">
        {src ? (
          <img src={src} alt="" draggable={false} />
        ) : (
          <span className="ly-img-ph">
            <ImageSquare weight="duotone" />
            {ctx.editable && <small>{t('ly.addImage')}</small>}
          </span>
        )}
      </div>
      {ctx.editable && <input ref={input} type="file" accept="image/*" hidden onChange={pick} />}
    </div>
  )
}

/* ───────── editable text bound to a path ───────── */

function T({ ctx, path, as = 'div', className }) {
  return <Text as={as} className={className} path={path} value={get(ctx.slide, path) ?? ''} editable={ctx.editable} onCommit={(v) => ctx.set(path, v)} />
}

const Heading = ({ ctx, path = 'title' }) => <T ctx={ctx} path={path} className="ly-h" />

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

function Bullets({ ctx, path = 'bullets' }) {
  const list = get(ctx.slide, path) ?? []
  return (
    <ul className="ly-bullets">
      {list.map((_, i) => (
        <li key={i}>
          <span className="ly-dot" />
          <T ctx={ctx} path={`${path}.${i}`} as="span" />
        </li>
      ))}
    </ul>
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
  const bars = ctx.slide.bars ?? []
  const max = Math.max(1, ...bars.map((b) => parseFloat(b.value) || 0))
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
            <span className="ly-bar-fill" style={{ height: `${((parseFloat(b.value) || 0) / max) * 100}%` }} />
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
    <div className="ly-area" style={{ left: `${a.l}%`, top: `${a.t}%`, width: `${a.w}%`, height: `${a.h}%` }}>
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
export function samplePage(type, v = 0) {
  switch (type) {
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
