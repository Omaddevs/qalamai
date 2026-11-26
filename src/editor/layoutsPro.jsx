// The professional page layouts: timeline, roadmap, SWOT, 2×2 matrix, pyramid, funnel, hero number,
// statement, table, gallery, full-bleed photo, problem → solution, pricing, KPI board, executive summary,
// feature showcase and chapter opener. Like layouts.jsx, each one only reads theme tokens (CSS variables)
// so it works in every template; skins restyle them in layouts-pro.css / premium.css.
// Rules that keep pages detachable onto the canvas (detach.js): every visible mark is a real element
// (no ::before/::after), every text sits alone in its element, drawings are <svg> with real colours.
import {
  ArrowRight, BookOpen, Brain, Buildings, ChartLineUp, Check, CheckCircle, Clock, Cloud, Code, Cpu, Crown,
  CurrencyCircleDollar, DeviceMobile, Flask, Gear, Globe, GraduationCap, Handshake, Heart, Leaf, Lightbulb,
  Lightning, Lock, MagnifyingGlass, Megaphone, Palette, PuzzlePiece, Rocket, ShieldCheck, Sparkle, Star,
  Stethoscope, Target, TrendDown, TrendUp, Trophy, Truck, Users, Warning, Atom,
} from '@phosphor-icons/react'
import { t } from '../i18n/index.js'
import { SLIDE_ICONS } from '../../shared/slideIcons.js'
import { Bullets, Heading, ImageSlot, T, density, luminance, num2 } from './layoutKit.jsx'

/** The layouts this file draws, in "add page" menu order. */
export const PRO_LAYOUTS = [
  'statement', 'bignum', 'summary', 'kpi', 'timeline', 'roadmap', 'swot', 'matrix', 'pyramid', 'funnel',
  'table', 'problem', 'features', 'pricing', 'gallery', 'photo', 'chapter',
]

/* ───────── icons a feature can carry (the AI picks one of these names) ───────── */

export const ICONS = {
  lightning: Lightning, shield: ShieldCheck, growth: ChartLineUp, users: Users, globe: Globe, rocket: Rocket,
  gear: Gear, idea: Lightbulb, target: Target, leaf: Leaf, heart: Heart, brain: Brain, chip: Cpu, cloud: Cloud,
  lock: Lock, clock: Clock, star: Star, book: BookOpen, education: GraduationCap, science: Flask,
  partnership: Handshake, money: CurrencyCircleDollar, mobile: DeviceMobile, search: MagnifyingGlass,
  trophy: Trophy, building: Buildings, delivery: Truck, sparkle: Sparkle, code: Code, crown: Crown,
  puzzle: PuzzlePiece, atom: Atom, health: Stethoscope, design: Palette, marketing: Megaphone,
}
export const ICON_NAMES = SLIDE_ICONS.filter((n) => ICONS[n])
const FALLBACK_ICONS = ['idea', 'target', 'rocket', 'shield', 'growth', 'users']

function Icon({ ctx, path, name, i }) {
  const key = ICONS[name] ? name : FALLBACK_ICONS[i % FALLBACK_ICONS.length]
  const Glyph = ICONS[key]
  // in the editor a click steps to the next icon
  const next = () => ctx.set(path, ICON_NAMES[(ICON_NAMES.indexOf(key) + 1) % ICON_NAMES.length])
  return (
    <span className={`ly-ico ${ctx.editable ? 'pick' : ''}`} onClick={ctx.editable ? next : undefined} title={ctx.editable ? t('ly.iconNext') : undefined}>
      <Glyph weight="duotone" />
    </span>
  )
}

/* ───────── statement: one sentence, set big ───────── */

function Statement({ ctx }) {
  const d = density([ctx.slide.text], 120, 200)
  return (
    <div className={`ly ly-statement ${d}`}>
      {ctx.slide.kicker != null && <T ctx={ctx} path="kicker" className="ly-kicker" />}
      <div className="ly-statement-body">
        <span className="ly-statement-bar" />
        <T ctx={ctx} path="text" className="ly-statement-text" />
      </div>
      {ctx.slide.note != null && <T ctx={ctx} path="note" className="ly-sub ly-statement-note" />}
    </div>
  )
}

/* ───────── hero number: one figure carries the page ───────── */

function BigNum({ ctx }) {
  const value = String(ctx.slide.value ?? '')
  // the figure fills its half of the page on one line: wide display faces (theme.titleWidth) get less
  const w = (ctx.theme.titleWidth ?? 1) * (ctx.theme.titleScale ?? 1)
  const bn = Math.min(17, Math.max(6, 40 / (Math.max(2, value.length) * 0.64 * w)))
  return (
    <div className="ly ly-bignum" style={{ '--bn': `${bn.toFixed(2)}cqw` }}>
      <div className="ly-bignum-fig">
        <T ctx={ctx} path="value" className="ly-bignum-v" />
        <span className="ly-rule" />
      </div>
      <div className="ly-bignum-text">
        {ctx.slide.kicker != null && <T ctx={ctx} path="kicker" className="ly-kicker" />}
        <T ctx={ctx} path="label" className="ly-h" />
        <T ctx={ctx} path="text" className="ly-p" />
      </div>
    </div>
  )
}

/* ───────── executive summary: the key message, then numbered findings ───────── */

function Summary({ ctx }) {
  const points = ctx.slide.points ?? []
  const d = density([ctx.slide.text, ...points.map((p) => p.text)], 420, 620)
  return (
    <div className={`ly ly-summary ${d}`}>
      <div className="ly-summary-lead">
        <Heading ctx={ctx} />
        <T ctx={ctx} path="text" className="ly-summary-msg" />
      </div>
      <ol className="ly-summary-list" style={{ '--n': points.length }}>
        {points.map((_, i) => (
          <li key={i}>
            <span className="ly-num">{num2(i)}</span>
            <div className="ly-summary-item">
              <T ctx={ctx} path={`points.${i}.title`} className="ly-card-title" />
              <T ctx={ctx} path={`points.${i}.text`} className="ly-p sm" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ───────── KPI board: value, label and change ───────── */

function trendOf(delta) {
  const s = String(delta ?? '').trim()
  if (/^[-−–]|↓|▼/.test(s)) return 'down'
  if (/^\+|↑|▲/.test(s)) return 'up'
  return 'flat'
}

function Kpi({ ctx }) {
  const kpis = ctx.slide.kpis ?? []
  const dark = luminance(ctx.theme.text) > 0.5
  const cols = kpis.length > 4 ? 3 : Math.max(1, kpis.length)
  // the values share one size, as large as the longest one allows on one line of its tile
  const longest = Math.max(3, ...kpis.map((k) => String(k.value ?? '').length))
  const kv = Math.min(4.6, Math.max(2.2, (84 / cols - 6) / (longest * 0.72)))
  return (
    <div className={`ly ly-kpi ${dark ? 'on-dark' : ''}`}>
      <Heading ctx={ctx} />
      <div className="ly-kpi-grid" style={{ '--n': kpis.length, '--cols': cols, '--kv': `${kv.toFixed(2)}cqw` }}>
        {kpis.map((k, i) => {
          const tr = trendOf(k.delta)
          const Arrow = tr === 'down' ? TrendDown : TrendUp
          return (
            <div key={i} className="ly-kpi-tile">
              <T ctx={ctx} path={`kpis.${i}.label`} className="ly-kpi-l" />
              <T ctx={ctx} path={`kpis.${i}.value`} className="ly-kpi-v" />
              {k.delta != null && k.delta !== '' && (
                <span className={`ly-delta ${tr}`}>
                  {tr !== 'flat' && <Arrow weight="bold" />}
                  <T ctx={ctx} path={`kpis.${i}.delta`} as="span" />
                </span>
              )}
            </div>
          )
        })}
      </div>
      {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-p ly-foot" />}
    </div>
  )
}

/* ───────── timeline: dated milestones on one line ───────── */

function Timeline({ ctx }) {
  const items = ctx.slide.items ?? []
  const d = density(items.map((x) => x.text), 360, 520)
  return (
    <div className={`ly ly-tl ${d}`}>
      <Heading ctx={ctx} />
      <div className="ly-tl-track" style={{ '--n': items.length }}>
        <span className="ly-tl-line" />
        {items.map((_, i) => (
          <div key={i} className="ly-tl-item">
            <T ctx={ctx} path={`items.${i}.date`} className="ly-tl-date" />
            <span className="ly-tl-dot" />
            <T ctx={ctx} path={`items.${i}.title`} className="ly-card-title" />
            <T ctx={ctx} path={`items.${i}.text`} className="ly-p sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── roadmap: phases as chevrons, their work below ───────── */

function Roadmap({ ctx }) {
  const phases = ctx.slide.phases ?? []
  return (
    <div className="ly ly-road">
      <Heading ctx={ctx} />
      <div className="ly-road-row" style={{ '--n': phases.length }}>
        {phases.map((p, i) => (
          <div key={i} className="ly-road-col" style={{ '--k': phases.length > 1 ? i / (phases.length - 1) : 0 }}>
            <div className={`ly-road-head ${i === 0 ? 'first' : ''}`}>
              <T ctx={ctx} path={`phases.${i}.period`} className="ly-road-period" />
              <T ctx={ctx} path={`phases.${i}.title`} className="ly-road-title" />
            </div>
            {p.items?.length > 0 && <Bullets ctx={ctx} path={`phases.${i}.items`} className="sm" />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── SWOT ───────── */

const SWOT = ['S', 'W', 'O', 'T']

function Swot({ ctx }) {
  const quads = ctx.slide.quads ?? []
  return (
    <div className="ly ly-swot">
      <Heading ctx={ctx} />
      <div className="ly-swot-grid">
        {SWOT.map((letter, i) => (
          <div key={letter} className={`ly-swot-q q${i}`}>
            <span className="ly-swot-letter">{letter}</span>
            <div className="ly-swot-body">
              <T ctx={ctx} path={`quads.${i}.title`} className="ly-card-title" />
              {quads[i]?.items?.length > 0 && <Bullets ctx={ctx} path={`quads.${i}.items`} className="sm" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── 2×2 matrix with axes; the top-right cell is the one that matters ───────── */

function Matrix({ ctx }) {
  return (
    <div className="ly ly-matrix">
      <div className="ly-matrix-text">
        <Heading ctx={ctx} />
        {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-p" />}
      </div>
      <div className="ly-matrix-plot">
        <div className="ly-matrix-y">
          <span className="ly-axis-arrow up" />
          {/* turned with a rotation (not writing-mode), so it keeps its look when detached */}
          <span className="ly-axis-turn">
            <T ctx={ctx} path="y" className="ly-axis-l ly-axis-vert" />
          </span>
        </div>
        <div className="ly-matrix-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`ly-matrix-q q${i}`}>
              <T ctx={ctx} path={`quads.${i}.title`} className="ly-card-title" />
              <T ctx={ctx} path={`quads.${i}.text`} className="ly-p sm" />
            </div>
          ))}
        </div>
        <span />
        <div className="ly-matrix-x">
          <T ctx={ctx} path="x" className="ly-axis-l" />
          <span className="ly-axis-arrow right" />
        </div>
      </div>
    </div>
  )
}

/* ───────── pyramid: levels from the narrow top to the broad base ───────── */

function Pyramid({ ctx }) {
  const levels = ctx.slide.levels ?? []
  const n = Math.max(1, levels.length)
  return (
    <div className="ly ly-pyr">
      <Heading ctx={ctx} />
      <div className="ly-pyr-rows" style={{ '--n': levels.length }}>
        {levels.map((_, i) => {
          // each band is a slice of one triangle: its top edge is the band above's bottom edge
          const top = 50 - (50 * i) / n
          const bot = 50 - (50 * (i + 1)) / n
          return (
            <div key={i} className="ly-pyr-row">
              <span
                className="ly-pyr-band"
                style={{ clipPath: `polygon(${top}% 0, ${100 - top}% 0, ${100 - bot}% 100%, ${bot}% 100%)`, '--k': n > 1 ? i / (n - 1) : 0 }}
              >
                <span className="ly-pyr-n">{i + 1}</span>
              </span>
              <div className="ly-pyr-text">
                <T ctx={ctx} path={`levels.${i}.title`} className="ly-card-title" />
                <T ctx={ctx} path={`levels.${i}.text`} className="ly-p sm" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────── funnel: stages narrowing to the result ───────── */

function Funnel({ ctx }) {
  const stages = ctx.slide.stages ?? []
  const n = stages.length
  return (
    <div className="ly ly-funnel">
      <div className="ly-chart-text">
        <Heading ctx={ctx} />
        {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-p" />}
      </div>
      <div className="ly-funnel-stack" style={{ '--n': n }}>
        {stages.map((_, i) => {
          // widths step down by rank (not by value), so a tiny last stage still has room for its number
          // each band's bottom edge is as wide as the next band's top edge, so the stack reads as one funnel
          const width = (k) => (n > 1 ? 100 - (k * 52) / (n - 1) : 100)
          const w = width(i)
          const next = i < n - 1 ? width(i + 1) : w * 0.86
          const inset = Math.round((((w - next) / 2) / w) * 1000) / 10
          return (
            <div key={i} className="ly-funnel-row">
              <div className="ly-funnel-cell">
                <span
                  className="ly-funnel-bar"
                  style={{ width: `${w}%`, clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`, '--k': n > 1 ? i / (n - 1) : 0 }}
                >
                  <T ctx={ctx} path={`stages.${i}.value`} className="ly-funnel-v" />
                </span>
              </div>
              <T ctx={ctx} path={`stages.${i}.label`} className="ly-funnel-l" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────── table ───────── */

function Table({ ctx }) {
  const head = ctx.slide.head ?? []
  const rows = ctx.slide.rows ?? []
  const hi = ctx.slide.hi
  const cols = Math.max(head.length, ...rows.map((r) => r.length))
  const size = rows.length > 6 || cols > 5 ? 'dense' : rows.length > 4 ? 'mid' : ''
  return (
    <div className={`ly ly-table ${size}`}>
      <Heading ctx={ctx} />
      <table className="ly-tbl">
        <thead>
          <tr>
            {head.map((_, c) => (
              <th key={c} className={c === hi ? 'hi' : ''}>
                <T ctx={ctx} path={`head.${c}`} as="span" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((_, c) => (
                <td key={c} className={c === hi ? 'hi' : ''}>
                  <T ctx={ctx} path={`rows.${i}.${c}`} as="span" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {ctx.slide.note != null && <T ctx={ctx} path="note" className="ly-p sm ly-foot" />}
    </div>
  )
}

/* ───────── problem → solution ───────── */

function Problem({ ctx }) {
  const { problem = {}, solution = {} } = ctx.slide
  return (
    <div className="ly ly-prob">
      <Heading ctx={ctx} />
      <div className="ly-prob-row">
        <div className="ly-prob-card bad">
          <span className="ly-prob-ico"><Warning weight="duotone" /></span>
          <T ctx={ctx} path="problem.title" className="ly-card-title" />
          {problem.text != null && <T ctx={ctx} path="problem.text" className="ly-p sm" />}
          {problem.items?.length > 0 && <Bullets ctx={ctx} path="problem.items" className="sm" />}
        </div>
        <span className="ly-prob-arrow"><ArrowRight weight="bold" /></span>
        <div className="ly-prob-card good">
          <span className="ly-prob-ico"><CheckCircle weight="duotone" /></span>
          <T ctx={ctx} path="solution.title" className="ly-card-title" />
          {solution.text != null && <T ctx={ctx} path="solution.text" className="ly-p sm" />}
          {solution.items?.length > 0 && <Bullets ctx={ctx} path="solution.items" className="sm" />}
        </div>
      </div>
    </div>
  )
}

/* ───────── feature showcase: a picture and what it does ───────── */

function Features({ ctx }) {
  const features = ctx.slide.features ?? []
  return (
    <div className="ly ly-feat">
      <ImageSlot ctx={ctx} path="image" className="ly-feat-img" />
      <div className="ly-feat-side">
        <Heading ctx={ctx} />
        <div className="ly-feat-grid" style={{ '--n': features.length }}>
          {features.map((f, i) => (
            <div key={i} className="ly-feat-item">
              <Icon ctx={ctx} path={`features.${i}.icon`} name={f.icon} i={i} />
              <T ctx={ctx} path={`features.${i}.title`} className="ly-card-title" />
              <T ctx={ctx} path={`features.${i}.text`} className="ly-p sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ───────── pricing / offers ───────── */

function Pricing({ ctx }) {
  const plans = ctx.slide.plans ?? []
  return (
    <div className="ly ly-price">
      <Heading ctx={ctx} />
      <div className="ly-price-row" style={{ '--n': plans.length }}>
        {plans.map((p, i) => (
          <div key={i} className={`ly-plan ${p.hi ? 'hi' : ''}`}>
            <T ctx={ctx} path={`plans.${i}.name`} className="ly-plan-name" />
            <div className="ly-plan-price">
              <T ctx={ctx} path={`plans.${i}.price`} as="span" className="ly-plan-v" />
              {p.period != null && <T ctx={ctx} path={`plans.${i}.period`} as="span" className="ly-plan-per" />}
            </div>
            <span className="ly-plan-rule" />
            <ul className="ly-plan-list">
              {(p.features ?? []).map((_, k) => (
                <li key={k}>
                  <span className="ly-plan-check"><Check weight="bold" /></span>
                  <T ctx={ctx} path={`plans.${i}.features.${k}`} as="span" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── gallery: a lead picture and its companions ───────── */

function Gallery({ ctx }) {
  const images = ctx.slide.images ?? []
  return (
    <div className="ly ly-gal">
      <Heading ctx={ctx} />
      <div className={`ly-gal-grid n${images.length}`}>
        {images.map((_, i) => (
          <figure key={i} className={`ly-gal-fig g${i}`}>
            <ImageSlot ctx={ctx} path={`images.${i}.image`} className="ly-gal-img" />
            {images[i]?.caption != null && <T ctx={ctx} path={`images.${i}.caption`} as="figcaption" className="ly-gal-cap" />}
          </figure>
        ))}
      </div>
    </div>
  )
}

/* ───────── full-bleed photo with the message over it ───────── */

function Photo({ ctx }) {
  return (
    <div className="ly ly-photo">
      <div className="ly-bleed">
        <ImageSlot ctx={ctx} path="image" className="ly-photo-img" frame="flat" />
        <span className="ly-photo-scrim" />
      </div>
      <div className="ly-photo-text">
        {ctx.slide.kicker != null && <T ctx={ctx} path="kicker" className="ly-kicker" />}
        <T ctx={ctx} path="title" className="ly-photo-title" />
        {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-photo-p" />}
      </div>
    </div>
  )
}

/* ───────── chapter opener: half-page picture, number and title ───────── */

function Chapter({ ctx }) {
  return (
    <div className={`ly ly-chap ${ctx.slide.side === 'right' ? 'flip' : ''}`}>
      <div className="ly-chap-pic">
        <ImageSlot ctx={ctx} path="image" className="ly-chap-img" frame="flat" />
      </div>
      <div className="ly-chap-text">
        <span className="ly-big-num">{String(ctx.slide.num ?? (ctx.index ?? 0) + 1).padStart(2, '0')}</span>
        <T ctx={ctx} path="title" className="ly-cover-title" />
        <span className="ly-rule" />
        {ctx.slide.text != null && <T ctx={ctx} path="text" className="ly-p" />}
      </div>
    </div>
  )
}

export const PRO_RENDER = {
  statement: Statement,
  bignum: BigNum,
  summary: Summary,
  kpi: Kpi,
  timeline: Timeline,
  roadmap: Roadmap,
  swot: Swot,
  matrix: Matrix,
  pyramid: Pyramid,
  funnel: Funnel,
  table: Table,
  problem: Problem,
  features: Features,
  pricing: Pricing,
  gallery: Gallery,
  photo: Photo,
  chapter: Chapter,
}

/* ───────── sample pages, in the interface language ───────── */

const parts = (key) => t(key).split('|')
const groups = (key, names) => {
  const xs = parts(key)
  const out = []
  for (let i = 0; i + names.length - 1 < xs.length; i += names.length) out.push(Object.fromEntries(names.map((n, k) => [n, xs[i + k]])))
  return out
}

/** A filled sample page of one of these layouts, or null for a layout this file does not draw. */
export function proSample(type, v = 0) {
  switch (type) {
    case 'statement': {
      const [kicker, text, note] = parts('ly.statement')
      return { type, kicker, text, note }
    }
    case 'bignum': {
      const [value, label, text, kicker] = parts('ly.bignum')
      return { type, kicker, value, label, text }
    }
    case 'summary':
      return { type, title: t('ly.summary.title'), text: t('ly.summary.text'), points: groups('ly.summary.items', ['title', 'text']) }
    case 'kpi':
      return { type, title: t('ly.kpi.title'), kpis: groups('ly.kpi.items', ['label', 'value', 'delta']).slice(0, v ? 6 : 4) }
    case 'timeline':
      return { type, title: t('ly.timeline.title'), items: groups('ly.timeline.items', ['date', 'title', 'text']) }
    case 'roadmap': {
      const tasks = parts('ly.roadmap.tasks')
      return {
        type,
        title: t('ly.roadmap.title'),
        phases: groups('ly.roadmap.phases', ['title', 'period']).map((p, i) => ({ ...p, items: tasks.slice(i * 2, i * 2 + 2) })),
      }
    }
    case 'swot': {
      const heads = parts('ly.swot.heads')
      const items = parts('ly.swot.items')
      return { type, title: t('ly.swot.title'), quads: heads.map((title, i) => ({ title, items: items.slice(i * 2, i * 2 + 2) })) }
    }
    case 'matrix': {
      const [x, y] = parts('ly.matrix.axes')
      return { type, title: t('ly.matrix.title'), text: t('ly.matrix.text'), x, y, quads: groups('ly.matrix.items', ['title', 'text']) }
    }
    case 'pyramid':
      return { type, title: t('ly.pyramid.title'), levels: groups('ly.pyramid.items', ['title', 'text']) }
    case 'funnel':
      return { type, title: t('ly.funnel.title'), text: t('ly.funnel.text'), stages: groups('ly.funnel.items', ['label', 'value']) }
    case 'table': {
      const head = parts('ly.table.head')
      const cells = parts('ly.table.rows')
      const rows = []
      for (let i = 0; i + head.length - 1 < cells.length; i += head.length) rows.push(cells.slice(i, i + head.length))
      return { type, title: t('ly.table.title'), head, rows, hi: head.length - 1 }
    }
    case 'problem': {
      const [pt, ptext] = parts('ly.problem.p')
      const [st, stext] = parts('ly.problem.s')
      return { type, title: t('ly.problem.title'), problem: { title: pt, text: ptext }, solution: { title: st, text: stext } }
    }
    case 'features':
      return {
        type,
        title: t('ly.features.title'),
        image: null,
        features: groups('ly.features.items', ['title', 'text']).map((f, i) => ({ ...f, icon: ['lightning', 'shield', 'growth', 'users'][i] })),
      }
    case 'pricing': {
      const feats = parts('ly.pricing.features')
      return {
        type,
        title: t('ly.pricing.title'),
        plans: groups('ly.pricing.plans', ['name', 'price', 'period']).map((p, i) => ({ ...p, features: feats.slice(i * 3, i * 3 + 3), hi: i === 1 })),
      }
    }
    case 'gallery':
      return { type, title: t('ly.gallery.title'), images: parts('ly.gallery.items').slice(0, v ? 4 : 3).map((caption) => ({ image: null, caption })) }
    case 'photo': {
      const [title, text, kicker] = parts('ly.photo')
      return { type, kicker, title, text, image: null }
    }
    case 'chapter': {
      const [title, text] = parts('ly.chapter')
      return { type, title, text, image: null, num: v + 1 }
    }
    default:
      return null
  }
}
