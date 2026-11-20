import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MagnifyingGlass, SquaresFour, ListBullets, CaretDown, Check, Plus, Stack, Files, ChartBar, Star, X,
  HouseSimple, Layout, FolderSimple, Fire, ArrowRight, PencilSimpleLine,
} from '@phosphor-icons/react'
import { Dropdown, QalamNib } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { deckTheme, getTemplate } from '../editor/templates.js'
import { timeAgo } from '../store.js'
import DesignCard, { DesignMenu, DesignThumb, NameField, useHoverPreview } from './DesignCard.jsx'
import { KIT_TYPES, isKit, kitTemplate } from '../creators/kits.js'
import { CREATE, CreateMenu, KIND_COLOR } from './create.jsx'
import './projects.css'
import { formatDate, getLang, localeOf, t, weekday } from '../i18n/index.js'
import { kindLabel } from '../i18n/kinds.js'

const DAY = 86_400_000
const SORTS = ['recent', 'oldest', 'name', 'slides'].map((id) => ({ id, get label() { return t(`pj.sort.${id}`) } }))
const TABS = [
  ['home', HouseSimple],
  ['templates', Layout],
  ['projects', FolderSimple],
]

function groupOf(ts) {
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  if (ts >= startOfToday) return t('pj.g.today')
  if (ts >= startOfToday - 6 * DAY) return t('pj.g.week')
  if (ts >= startOfToday - 29 * DAY) return t('pj.g.month')
  return t('pj.g.earlier')
}

/** Animated number for the stat cards. */
function useCountUp(value, ms = 700) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setN(value)
    let raf
    const t0 = performance.now()
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return n
}

function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return t('greet.night')
  if (h < 11) return t('greet.morning')
  if (h < 17) return t('greet.day')
  if (h < 22) return t('greet.evening')
  return t('greet.night')
}

const dateLabel = (d = new Date()) => `${formatDate(d, { day: 'numeric', month: 'long' })}, ${weekday(d)}`

function StatTile({ icon: Icon, label, value, note, children }) {
  const n = useCountUp(typeof value === 'number' ? value : 0)
  return (
    <div className="pj-tile">
      <span className="pj-tile-label">
        <Icon size={15} />
        {label}
      </span>
      <div className="pj-tile-row">
        {children ?? <span className="pj-tile-value">{n}</span>}
      </div>
      {note && <span className="pj-tile-note">{note}</span>}
    </div>
  )
}

/** 7-day activity: past days in the de-emphasis hue, today in the accent. */
function Spark({ days }) {
  const max = Math.max(1, ...days.map((d) => d.n))
  return (
    <div className="pj-spark" role="img" aria-label={t('pj.spark', { list: days.map((d) => `${d.label} ${d.n}`).join(', ') })}>
      {days.map((d) => (
        <span key={d.key} className={`pj-spark-col ${d.today ? 'today' : ''}`} tabIndex={0}>
          <span className="pj-spark-track">
            <span className="pj-spark-bar" style={{ height: d.n ? `${Math.max(12, (d.n / max) * 100)}%` : 0 }} />
          </span>
          <span className="pj-spark-day">{d.label}</span>
          <span className="pj-spark-tip">
            {t('pj.sparkTip', { day: d.today ? t('pj.g.today') : d.label, n: d.n })}
          </span>
        </span>
      ))}
    </div>
  )
}

function DesignRow({ d, onOpen, onDuplicate, onDelete, onRename }) {
  const theme = useMemo(() => deckTheme(d), [d])
  const { idx, start, stop } = useHoverPreview(d.slides.length)
  const [renaming, setRenaming] = useState(false)
  return (
    <div className="pj-row" onClick={() => !renaming && onOpen(d.id)} onPointerEnter={start} onPointerLeave={stop} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !renaming && onOpen(d.id)}>
      <span className="pj-row-thumb">
        <DesignThumb d={d} idx={idx} theme={theme} />
      </span>
      <span className="pj-row-name">
        {renaming ? (
          <NameField value={d.name} onDone={(name) => { setRenaming(false); if (name !== d.name) onRename(d.id, name) }} />
        ) : (
          <b title={d.name}>{d.name}</b>
        )}
      </span>
      <span className="pj-row-kind">
        <span className="pj-kind" style={{ '--k': KIND_COLOR[d.kind] ?? '#8b919a' }}>{kindLabel(d.kind)}</span>
      </span>
      <span className="pj-row-num">{isKit(d) ? '—' : d.slides.length}</span>
      <span className="pj-row-tpl">{isKit(d) ? kitTemplate(d.templateId)?.name ?? KIT_TYPES[d.type].label : getTemplate(d.templateId).name}</span>
      <span className="pj-row-time">{timeAgo(d.updatedAt)}</span>
      <span className="pj-row-actions" onClick={(e) => e.stopPropagation()}>
        <DesignMenu d={d} onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} onRename={() => setRenaming(true)} className="pj-row-menu" />
      </span>
    </div>
  )
}

/* ───── Header showcase: "continue where you left off" ─────
 * One clean spotlight card that plays the latest designs (story-style progress bars),
 * a quiet deck of cards behind it for depth, and a queue of the next designs on the side.
 * Nothing floats over the preview; hovering pauses the rotation. */
function Showcase({ designs, onOpen }) {
  const list = useMemo(() => designs.slice(0, 4), [designs])
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced || paused || list.length < 2) return
    const t = setTimeout(() => setAt((a) => (a + 1) % list.length), 4500)
    return () => clearTimeout(t)
  }, [at, paused, list.length, reduced])

  const idx = at % list.length
  const cur = list[idx]
  const color = KIND_COLOR[cur.kind] ?? '#14b8a6'

  return (
    <div
      className={`pj-show ${paused ? 'paused' : ''}`}
      style={{ '--glow': color }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <span className="pj-show-glow" aria-hidden="true" />

      <div className="pj-spot">
        <span className="pj-spot-back b2" aria-hidden="true" />
        <span className="pj-spot-back b1" aria-hidden="true" />
        <button type="button" className="pj-spot-card" onClick={() => onOpen(cur.id)}>
          <span className="pj-spot-view">
            {list.map((d, k) => (
              <span key={d.id} className={`pj-spot-slide ${k === idx ? 'on' : ''}`}>
                <DesignThumb d={d} />
              </span>
            ))}
            {list.length > 1 && (
              <span className="pj-spot-bars" key={idx}>
                {list.map((d, k) => (
                  <i key={d.id} className={k < idx ? 'done' : k === idx ? 'on' : ''} />
                ))}
              </span>
            )}
          </span>
          <span className="pj-spot-foot">
            <span className="pj-spot-info">
              <span className="pj-spot-meta">
                <span className="pj-spot-kind">{kindLabel(cur.kind)}</span>
                <small>{t('pj.edited', { ago: timeAgo(cur.updatedAt) })}</small>
              </span>
              <b title={cur.name}>{cur.name}</b>
            </span>
            <span className="pj-spot-go">
              {t('pj.continue')} <ArrowRight size={13} weight="bold" />
            </span>
          </span>
        </button>
      </div>

      {list.length > 1 && (
        <div className="pj-queue">
          {list.map((d, k) => (
            <button key={d.id} type="button" className={k === idx ? 'on' : ''} onClick={() => setAt(k)} title={d.name} aria-label={d.name}>
              <DesignThumb d={d} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProjectsView({ designs, onTab, onCreate, onOpen, onDuplicate, onDelete, onRename }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('qalamai.projects.view') || 'grid'
    } catch {
      return 'grid'
    }
  })
  const search = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem('qalamai.projects.view', view)
    } catch {
      /* ignore */
    }
  }, [view])

  // "/" focuses search
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target
      if (e.key === '/' && !(el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ───── stats ───── */
  const stats = useMemo(() => {
    const slides = designs.reduce((sum, d) => sum + d.slides.length, 0)
    const week = designs.filter((d) => d.updatedAt >= Date.now() - 7 * DAY).length
    const byTpl = {}
    designs.filter((d) => !isKit(d)).forEach((d) => (byTpl[d.templateId] = (byTpl[d.templateId] || 0) + 1))
    const [favId, favN] = Object.entries(byTpl).sort((a, b) => b[1] - a[1])[0] ?? []
    const today = new Date().setHours(0, 0, 0, 0)
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = today - (6 - i) * DAY
      return {
        key: start,
        label: weekday(start, true),
        today: i === 6,
        n: designs.filter((d) => d.updatedAt >= start && d.updatedAt < start + DAY).length,
      }
    })
    const kinds = new Set(designs.map((d) => d.kind)).size
    // days in a row with work; today not done yet doesn't break a run that reached yesterday
    const workedOn = (start) => designs.some((d) => d.updatedAt >= start && d.updatedAt < start + DAY)
    let streak = 0
    for (let k = workedOn(today) ? 0 : 1; k < 365; k++) {
      const start = today - k * DAY
      if (!designs.some((d) => d.updatedAt >= start && d.updatedAt < start + DAY)) break
      streak++
    }
    return { slides, week, days, kinds, streak, fav: favId && getTemplate(favId), favN }
  }, [designs])

  const kinds = useMemo(() => {
    const m = {}
    designs.forEach((d) => (m[d.kind] = (m[d.kind] || 0) + 1))
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [designs])

  /* ───── filter + sort + group ───── */
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = designs.filter(
      (d) => (kind === 'all' || d.kind === kind) && (!needle || `${d.name} ${d.kind} ${kindLabel(d.kind)}`.toLowerCase().includes(needle)),
    )
    const cmp = {
      recent: (a, b) => b.updatedAt - a.updatedAt,
      oldest: (a, b) => a.updatedAt - b.updatedAt,
      name: (a, b) => a.name.localeCompare(b.name, localeOf(getLang())),
      slides: (a, b) => b.slides.length - a.slides.length,
    }[sort]
    return [...out].sort(cmp)
  }, [designs, q, kind, sort])

  const groups = useMemo(() => {
    if (sort !== 'recent' && sort !== 'oldest') return [[null, list]]
    const g = new Map()
    list.forEach((d) => {
      const k = groupOf(d.updatedAt)
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(d)
    })
    return [...g.entries()]
  }, [list, sort])

  const filtering = q.trim() || kind !== 'all'
  const last = designs[0]
  const handlers = { onOpen, onDuplicate, onDelete, onRename }

  /* mouse-driven 3D tilt for the fanned designs */
  const head = useRef(null)
  const tilt = useRef(0)
  const onMove = (e) => {
    const el = head.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // one style write per frame, not per mouse event
    cancelAnimationFrame(tilt.current)
    const { clientX, clientY } = e
    tilt.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', ((clientX - r.left) / r.width - 0.5).toFixed(3))
      el.style.setProperty('--my', ((clientY - r.top) / r.height - 0.5).toFixed(3))
    })
  }
  const onLeave = () => {
    cancelAnimationFrame(tilt.current)
    head.current?.style.setProperty('--mx', 0)
    head.current?.style.setProperty('--my', 0)
  }


  return (
    <div className="pj">
      {/* ───── Header ───── */}
      <header className="pj-head" ref={head} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="pj-bg" aria-hidden="true">
          <span className="pj-wash" />
          <span className="pj-paper" />
          <svg className="pj-rings" viewBox="-500 -500 1000 1000">
            {[110, 180, 250, 320, 390, 460].map((r) => (
              <circle key={r} r={r} />
            ))}
            <circle className="hx-orbit" r={250} />
            <circle className="hx-orbit slow" r={390} />
          </svg>
        </div>

        <div className="pj-head-main">
          <div className="pj-head-text">
            <span className="pj-greet">
              <span className="hx-pulse" />
              {greeting()} · {dateLabel()}
            </span>
            <h1 className="pj-title">
              {t('pj.title1')}{' '}
              <span className="hx-word">
                <em>{t('pj.title2')}</em>
                <svg className="hx-stroke" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4 15C60 5 118 23 178 12S262 7 296 14" pathLength="1" />
                </svg>
                <span className="hx-pen" aria-hidden="true">
                  <QalamNib height={44} />
                </span>
              </span>
            </h1>
            <p className="pj-sub">
              {t('pj.count', { n: designs.length })}{last && <> · {t('pj.lastEdit', { ago: timeAgo(last.updatedAt) })}</>}
            </p>
            <div className="pj-head-actions">
              <Dropdown
                className="hm-create-pop"
                button={({ toggle }) => (
                  <button className="pj-new-btn" onClick={toggle}>
                    <Plus size={16} weight="bold" /> {t('design.newDesign')}
                  </button>
                )}
              >
                {(close) => <CreateMenu onCreate={onCreate} close={close} />}
              </Dropdown>
              <div className="pj-tabs" role="tablist">
                {TABS.map(([id, Icon]) => (
                  <button key={id} role="tab" aria-selected={id === 'projects'} className={id === 'projects' ? 'on' : ''} onClick={() => onTab(id)}>
                    <Icon size={15} weight={id === 'projects' ? 'duotone' : 'regular'} /> {t(`hm.rail.${id}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {designs.length > 0 && (
            <Showcase designs={designs} onOpen={onOpen} />
          )}
        </div>

        <div className="pj-stats">
          <StatTile icon={Stack} label={t('pj.total')} value={designs.length} note={t('pj.kinds', { n: stats.kinds })}>
            <span className="pj-tile-value">{designs.length}</span>
            <span className="pj-thumbs" aria-hidden="true">
              {designs.slice(0, 3).map((d) => (
                <span key={d.id} className="pj-thumbs-item">
                  <DesignThumb d={d} />
                </span>
              ))}
              {designs.length > 3 && <span className="pj-thumbs-more">+{designs.length - 3}</span>}
            </span>
          </StatTile>
          <StatTile
            icon={Files}
            label={t('pj.totalSlides')}
            value={stats.slides}
            note={designs.length ? t('pj.avg', { n: Math.round(stats.slides / designs.length) }) : null}
          />
          <StatTile
            icon={ChartBar}
            label={t('pj.activity')}
            note={
              stats.streak > 1 ? (
                <span className="pj-streak">
                  <Fire size={14} weight="fill" /> {t('pj.streak', { n: stats.streak })}
                </span>
              ) : (
                t('pj.weekEdited', { n: stats.week })
              )
            }
          >
            <span className="pj-tile-value">{stats.week}</span>
            <Spark days={stats.days} />
          </StatTile>
          <StatTile
            icon={Star}
            label={t('pj.fav')}
            note={
              stats.fav ? (
                <button className="pj-tile-link" onClick={() => onCreate({ templateId: stats.fav.id })}>
                  {t('pj.favCreate')} <ArrowRight size={13} weight="bold" />
                </button>
              ) : null
            }
          >
            {stats.fav ? (
              <span className="pj-fav">
                <span className="pj-fav-thumb">
                  <Slide slide={{ id: 'fav', type: 'title', ...stats.fav.sample, elements: [] }} theme={stats.fav.theme} preview />
                </span>
                <span className="pj-fav-text">
                  {stats.fav.name}
                  <small>{t('pj.favIn', { n: stats.favN })}</small>
                </span>
              </span>
            ) : (
              <span className="pj-tile-value">—</span>
            )}
          </StatTile>
        </div>
      </header>

      {/* ───── Toolbar ───── */}
      <div className="pj-toolbar">
        <label className="pj-search">
          <MagnifyingGlass size={17} />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('pj.searchPh')} />
          {q ? (
            <button className="pj-clear" onClick={() => setQ('')} aria-label={t('hx.clear')}>
              <X size={14} weight="bold" />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>

        <div className="pj-kinds">
          <button className={`pj-chip ${kind === 'all' ? 'on' : ''}`} onClick={() => setKind('all')}>
            {t('tpl.cat.all')} <span>{designs.length}</span>
          </button>
          {kinds.map(([k, n]) => (
            <button key={k} className={`pj-chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)} style={{ '--k': KIND_COLOR[k] ?? '#8b919a' }}>
              <i className="pj-chip-dot" />
              {kindLabel(k)} <span>{n}</span>
            </button>
          ))}
        </div>

        <div className="pj-tools">
          <Dropdown
            align="right"
            button={({ toggle }) => (
              <button className="pj-sort" onClick={toggle}>
                <span className="pj-sort-label">{t('pj.sortBy')}</span> {SORTS.find((s) => s.id === sort).label}
                <CaretDown size={13} weight="bold" />
              </button>
            )}
          >
            {(close) =>
              SORTS.map((s) => (
                <button key={s.id} className="menu-item" onClick={() => { setSort(s.id); close() }}>
                  {s.label} {sort === s.id && <Check size={15} weight="bold" />}
                </button>
              ))
            }
          </Dropdown>
          <div className="pj-view" role="group" aria-label={t('pj.view')}>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label={t('pj.grid')}>
              <SquaresFour size={17} weight={view === 'grid' ? 'fill' : 'regular'} />
            </button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label={t('pj.list')}>
              <ListBullets size={17} weight={view === 'list' ? 'bold' : 'regular'} />
            </button>
          </div>
        </div>
      </div>

      {/* ───── Content ───── */}
      {list.length === 0 ? (
        <div className="pj-empty">
          <span className="pj-empty-pen">
            <QalamNib height={70} />
          </span>
          <h3>{filtering ? t('pj.nothing') : t('pj.first')}</h3>
          <p>{filtering ? t('pj.nothingHint') : t('pj.firstHint')}</p>
          {filtering ? (
            <button className="btn" onClick={() => { setQ(''); setKind('all') }}>
              {t('pj.clearFilter')}
            </button>
          ) : (
            <button className="btn primary" onClick={() => onCreate(CREATE[0])}>
              <Plus size={15} weight="bold" /> {t('pj.newPres')}
            </button>
          )}
        </div>
      ) : (
        groups.map(([label, items], gi) => (
          <section key={label ?? 'all'} className="pj-group">
            {label && (
              <h2 className="pj-group-head">
                {label} <span>{items.length}</span>
              </h2>
            )}
            {view === 'grid' ? (
              <div className="dz-grid pj-grid">
                {gi === 0 && !filtering && (
                  <button className="pj-new-card" onClick={() => onCreate(CREATE[0])}>
                    <span className="pj-new-plus">
                      <Plus size={22} weight="bold" />
                    </span>
                    <b>{t('design.newDesign')}</b>
                    <span>{t('pj.fromBlank')}</span>
                  </button>
                )}
                {items.map((d, i) => (
                  <div key={d.id} className="pj-in" style={{ '--i': Math.min(i, 12) }}>
                    <DesignCard d={d} {...handlers} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="pj-table">
                {gi === 0 && (
                  <div className="pj-row pj-row-head" aria-hidden="true">
                    <span />
                    <span>{t('pj.col.name')}</span>
                    <span>{t('pj.col.kind')}</span>
                    <span>{t('pj.col.slides')}</span>
                    <span>{t('pj.col.tpl')}</span>
                    <span>{t('pj.col.edited')}</span>
                    <span />
                  </div>
                )}
                {items.map((d) => (
                  <DesignRow key={d.id} d={d} {...handlers} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  )
}
