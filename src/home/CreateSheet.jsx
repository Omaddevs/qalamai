// "+ Yaratiş": QalamAI's own way to start something new. A sheet slides out of the rail:
// a dark prompt head where the user writes a topic, kinds as cards below, and a live preview
// on the right that already carries the typed topic. Typing a kind's name filters the cards;
// any other text is taken as the topic.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Sparkle, FileDashed, ArrowUpRight, KeyReturn, ArrowRight,
  PenNib, LinkSimple, IdentificationCard, TextAa, FilePdf, Translate, FileMagnifyingGlass,
} from '@phosphor-icons/react'
import { COLORS } from '../data.js'
import { KIT_TYPES } from '../creators/kitTypes.js'
import { blueprintOf } from '../blueprints.js'
import { QalamNib } from '../components/ui.jsx'
import { CREATE } from './create.jsx'
import { t } from '../i18n/index.js'
import './create-sheet.css'

const byId = (id) => CREATE.find((c) => c.id === id)

const KITS = [
  { type: 'logo', icon: PenNib, color: 'amber' },
  { type: 'bio', icon: LinkSimple, color: 'green' },
  { type: 'cv', icon: IdentificationCard, color: 'blue' },
]

const TOOLS = [
  { app: 'alifbo', icon: TextAa, color: 'teal' },
  { app: 'pdf', icon: FilePdf, color: 'red' },
  { app: 'tarjima', icon: Translate, color: 'green' },
  { app: 'plagiat', icon: FileMagnifyingGlass, color: 'amber' },
]

/** Every entry of the sheet, grouped. Built per render so labels follow the interface language. */
function buildGroups({ onAi, onBlank, onKit, onTool }) {
  const type = (id) => {
    const c = byId(id)
    return {
      key: id, label: c.label, desc: t(`cs.d.${id}`), icon: c.icon, color: c.color,
      art: blueprintOf(id).format === 'doc' ? 'doc' : 'slide',
      actions: [
        { id: 'ai', label: t('cs.withAi'), icon: Sparkle, run: (topic) => onAi(id, topic) },
        { id: 'blank', label: t('cs.blank'), icon: FileDashed, run: () => onBlank(c) },
      ],
      // Enter: a written topic goes to AI, otherwise a blank design opens
      primary: (topic) => (topic ? 'ai' : 'blank'),
    }
  }
  const kit = ({ type: k, icon, color }) => ({
    key: k, label: KIT_TYPES[k].label, desc: t(`cs.d.${k}`), icon, color, art: 'icon',
    actions: [{ id: 'open', label: t('cs.open'), icon: ArrowUpRight, run: () => onKit(k) }],
    primary: () => 'open',
  })
  const tool = ({ app, icon, color }) => ({
    key: app, label: t(`hm.tools.${app}`), desc: t(`cs.d.${app}`), icon, color, soft: true, art: 'icon',
    actions: [{ id: 'open', label: t('cs.open'), icon: ArrowUpRight, run: () => onTool(app) }],
    primary: () => 'open',
  })
  return [
    { id: 'study', items: ['Referat', 'Kurs işi', 'Dars işlanma'].map(type) },
    { id: 'work', items: ['Prezentatsiya', 'Biznes reja', 'Hisobot'].map(type) },
    { id: 'create', items: [...['Taklifnoma', 'Portfolio'].map(type), ...KITS.map(kit)] },
    { id: 'tools', items: TOOLS.map(tool) },
  ]
}

function Tile({ icon: Icon, color, soft, size = 20 }) {
  const c = COLORS[color]
  return (
    <span
      className={`ys-tile ${soft ? 'soft' : ''}`}
      style={soft ? { background: c.band, color: c.to } : { background: `linear-gradient(140deg, ${c.from}, ${c.to})` }}
    >
      <Icon size={size} weight="duotone" />
    </span>
  )
}

/** The picture on the right: a page, a slide or the tool's icon — with the typed topic on it. */
function Art({ item, topic }) {
  const c = COLORS[item.color]
  const Icon = item.icon
  const title = topic || item.label
  return (
    <div className={`ys-art k-${item.art}`} style={{ '--c1': c.from, '--c2': c.to, '--cb': c.band }}>
      <span className="ys-art-glow" />
      {item.art === 'doc' && (
        <div className="ys-mock">
          <div className="ys-a4 back" />
          <div className="ys-a4">
            <i className="cap" />
            <b>{title}</b>
            <i className="ln w9" /><i className="ln" /><i className="ln w7" />
            <i className="ln w9" /><i className="ln w6" /><i className="ln" /><i className="ln w8" />
          </div>
        </div>
      )}
      {item.art === 'slide' && (
        <div className="ys-mock">
          <div className="ys-16 back2" />
          <div className="ys-16 back" />
          <div className="ys-16">
            <span className="tag"><Icon size={10} weight="fill" /> {item.label}</span>
            <b>{title}</b>
            <span className="row"><i /><i /><i /></span>
          </div>
        </div>
      )}
      {item.art === 'icon' && (
        <div className="ys-mock">
          <span className="ys-orbit o1" />
          <span className="ys-orbit o2" />
          <span className="ys-glass"><Icon size={54} weight="duotone" /></span>
        </div>
      )}
    </div>
  )
}

export default function CreateSheet({ onClose, onAi, onBlank, onKit, onTool }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const body = useRef(null)

  const groups = buildGroups({ onAi, onBlank, onKit, onTool })

  // the text either names kinds (filter) or is a topic (show everything, AI takes the text)
  const needle = q.trim().toLowerCase()
  const matched = needle
    ? groups.map((g) => ({ ...g, items: g.items.filter((it) => `${it.label} ${it.key}`.toLowerCase().includes(needle)) })).filter((g) => g.items.length)
    : groups
  const isTopic = Boolean(needle) && matched.length === 0
  const shown = isTopic ? groups : matched
  const topic = isTopic ? q.trim() : ''
  const flat = useMemo(() => shown.flatMap((g) => g.items), [shown])
  const at = Math.min(active, flat.length - 1)
  const current = flat[at]
  const examples = t('cs.ex').split('|')

  useEffect(() => {
    input.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => setActive(0), [needle])

  // keep the highlighted card in view while moving with the keyboard
  useEffect(() => {
    body.current?.querySelector('.ys-row.on')?.scrollIntoView({ block: 'nearest' })
  }, [at])

  const run = (item, actionId) => {
    const action = item.actions.find((a) => a.id === (actionId ?? item.primary(topic)))
    onClose()
    action.run(topic)
  }

  const onKey = (e) => {
    if (e.key === 'Escape') onClose()
    else if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
      // left/right only move between cards while the caret is not needed in the text
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target === input.current && q) return
      e.preventDefault()
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
      setActive((at + step + flat.length) % flat.length)
    } else if (e.key === 'Enter' && current) {
      e.preventDefault()
      run(current)
    }
  }

  const pickExample = (ex) => {
    setQ(ex)
    input.current?.focus()
  }

  const keys = t('cs.keys').split(' · ').map((k) => {
    const sp = k.indexOf(' ')
    return [k.slice(0, sp), k.slice(sp + 1)]
  })

  let index = -1
  return (
    <div className="ys-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={onKey}>
      <section className="cs" role="dialog" aria-modal="true" aria-label={t('cs.title')}>
        {/* ── dark prompt head ── */}
        <header className="ys-head">
          <span className="ys-head-grid" aria-hidden="true" />
          <div className="ys-head-top">
            <span className="ys-nib"><QalamNib height={20} /></span>
            <h2>{t('cs.title')}</h2>
            <button className="ys-close" onClick={onClose} aria-label={t('cs.close')} title={t('cs.close')}>
              <kbd>Esc</kbd>
              <X size={16} weight="bold" />
            </button>
          </div>

          <label className={`ys-prompt ${isTopic ? 'topic' : ''}`}>
            <span className="ys-spark"><Sparkle size={18} weight="fill" /></span>
            <input
              ref={input}
              className="ys-write"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('cs.placeholder')}
              aria-label={t('cs.placeholder')}
              spellCheck={false}
            />
            {q && (
              <button type="button" className="ys-clear" onClick={() => pickExample('')} aria-label={t('cs.close')}>
                <X size={13} weight="bold" />
              </button>
            )}
          </label>

          <div className="ys-sub">
            {isTopic ? (
              <p className="ys-hint topic" key="topic">
                <Sparkle size={13} weight="fill" /> {t('cs.topic', { topic })}
              </p>
            ) : needle ? (
              <p className="ys-hint">{t('cs.hint')}</p>
            ) : (
              <div className="ys-ex" key="ex">
                <span>{t('cs.try')}:</span>
                {examples.map((ex) => (
                  <button type="button" key={ex} onClick={() => pickExample(ex)}>
                    {ex} <ArrowRight size={11} weight="bold" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="ys-main">
          {/* ── kinds ── */}
          <div className="ys-body" ref={body} role="listbox" aria-label={t('cs.title')}>
            {shown.map((g, gi) => (
              <section key={g.id} className={`ys-group g-${g.id}`}>
                <h3>
                  <span className="ys-num">{String(gi + 1).padStart(2, '0')}</span>
                  {t(`cs.g.${g.id}`)}
                  <span className="ys-rule" />
                </h3>
                <div className="ys-cards">
                  {g.items.map((it) => {
                    index += 1
                    const i = index
                    const on = i === at
                    const primary = it.primary(topic)
                    return (
                      <div
                        key={it.key}
                        className={`ys-row ${on ? 'on' : ''}`}
                        style={{ '--c2': COLORS[it.color].to, '--i': i }}
                        role="option"
                        aria-selected={on}
                        onPointerEnter={() => setActive(i)}
                        onClick={() => run(it)}
                      >
                        <Tile icon={it.icon} color={it.color} soft={it.soft} />
                        <span className="ys-text">
                          <b>{it.label}</b>
                          <small>{it.desc}</small>
                        </span>
                        {/* touch screens have no preview pane: actions sit on the card */}
                        <span className="ys-acts">
                          {it.actions.map(({ id, label, icon: Icon }) => (
                            <button
                              key={id}
                              className={`ys-act a-${id} ${id === primary ? 'main' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                run(it, id)
                              }}
                            >
                              <Icon size={13} weight={id === 'ai' ? 'fill' : 'bold'} />
                              {label}
                            </button>
                          ))}
                        </span>
                        <ArrowRight size={14} weight="bold" className="ys-go" />
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* ── live preview of the highlighted kind ── */}
          {current && (
            <aside className="ys-side" aria-live="polite">
              <div className="ys-side-in" key={current.key}>
                <Art item={current} topic={topic} />
                <div className="ys-side-text">
                  <h4>{current.label}</h4>
                  <p>{current.desc}</p>
                </div>
                <div className="ys-side-acts">
                  {current.actions.map(({ id, label, icon: Icon }) => {
                    const main = id === current.primary(topic)
                    return (
                      <button key={id} className={`ys-big a-${id} ${main ? 'main' : ''}`} onClick={() => run(current, id)}>
                        <Icon size={16} weight={id === 'ai' ? 'fill' : 'bold'} />
                        {label}
                        {main && <span className="ys-enter"><KeyReturn size={13} weight="bold" /></span>}
                      </button>
                    )
                  })}
                </div>
                {current.actions.some((a) => a.id === 'ai') && !topic && <p className="ys-side-hint">{t('cs.hint')}</p>}
              </div>
            </aside>
          )}
        </div>

        <footer className="ys-foot">
          {keys.map(([k, label]) => (
            <span key={k}><kbd>{k}</kbd> {label}</span>
          ))}
          <span className="ys-foot-brand">qalam<b>ai</b></span>
        </footer>
      </section>
    </div>
  )
}
