import { useEffect, useMemo, useRef, useState } from 'react'
import ProBadge, { ProCrown } from '../components/ProBadge.jsx'
import {
  MagnifyingGlass, X, Play, ArrowRight, ArrowLeft, CaretLeft, CaretRight, Eye, CheckCircle,
  HouseSimple, Layout, FolderSimple, Sparkle, ClockCounterClockwise, PenNib, LinkSimple, IdentificationCard,
} from '@phosphor-icons/react'
import { QalamNib } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { CATEGORIES, TEMPLATES, catLabel, getTemplate, sampleDeck, templatesFor } from '../editor/templates.js'
import { useHoverPreview } from './DesignCard.jsx'
import { CREATE, CatTile } from './create.jsx'
import KitThumb, { Scaled } from '../creators/KitThumb.jsx'
import { BioPage } from '../creators/BioPhone.jsx'
import CvPage from '../creators/CvPage.jsx'
import { KIT_TEMPLATES, KIT_TYPES, templateData } from '../creators/kits.js'
// shared page header, chips and empty state (pj-*) — see AlifboView
import './projects.css'
import './templates.css'
import { t } from '../i18n/index.js'

const TABS = [
  ['home', HouseSimple],
  ['templates', Layout],
  ['projects', FolderSimple],
]
const RECENT_KEY = 'qalamai.templates.recent'

const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || []
  } catch {
    return []
  }
}

/* ───────────── Header wall: three columns of templates drifting in opposite directions ───────────── */
function Wall() {
  const cols = useMemo(() => {
    const a = TEMPLATES
    return [a, [...a].reverse(), [...a.slice(6), ...a.slice(0, 6)]]
  }, [])
  return (
    <div className="tv-wall" aria-hidden="true">
      <div className="tv-wall-tilt">
        {cols.map((col, ci) => (
          <div key={ci} className={`tv-col c${ci}`}>
            <div className="tv-col-track">
              {[...col, ...col].map((tpl, i) => (
                <div key={`${tpl.id}-${i}`} className="tv-col-item">
                  <Slide slide={sampleDeck(tpl)[0]} theme={tpl.theme} preview />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────── Category tile ───────────── */
function CategoryCard({ c, i, onCreate }) {
  const own = useMemo(() => templatesFor(c.id), [c.id])
  // the two newest-looking picks: the type's main and alternative template first
  const tpls = useMemo(() => [c.templateId, c.alt].filter(Boolean).map(getTemplate).concat(own).filter((x, k, a) => a.indexOf(x) === k).slice(0, 2), [c.templateId, c.alt, own])
  const soon = own.length === 0
  return (
    <button className={`tv-cat ${soon ? 'soon' : ''}`} style={{ '--i': i }} onClick={soon ? undefined : () => onCreate({ templateId: c.templateId, kind: c.kind, blank: true })} disabled={soon}>
      <span className="tv-cat-text">
        <CatTile icon={c.icon} color={c.color} />
        <b>{c.label}</b>
        <span className="tv-cat-count">
          {soon ? (
            t('tv.tplSoon')
          ) : (
            <>
              {t('tv.count', { n: own.length })} <ArrowRight size={12} weight="bold" />
            </>
          )}
        </span>
      </span>
      <span className="tv-cat-art">
        {tpls.map((tpl, k) => (
          <span key={tpl.id} className={`tv-cat-thumb k${k}`}>
            <Slide slide={sampleDeck(tpl)[0]} theme={tpl.theme} preview />
          </span>
        ))}
      </span>
    </button>
  )
}

/* ───────────── Gallery card ───────────── */
function TemplateTile({ tpl, i, onPreview, onUse }) {
  const deck = sampleDeck(tpl)
  const { idx, start, stop } = useHoverPreview(deck.length)
  return (
    <div className="tg-card" style={{ '--i': Math.min(i, 12) }} onPointerEnter={start} onPointerLeave={stop}>
      <button className="tg-thumb" onClick={() => onPreview(tpl.id)} aria-label={t('tv.see', { name: tpl.name })}>
        <div className="dz-frame" key={idx}>
          <Slide slide={deck[idx]} theme={tpl.theme} index={idx} preview />
        </div>
        <span className="tg-badges">
          {tpl.pro && (
            <ProBadge size="sm" className="tg-pro" />
          )}
          {tpl.video && (
            <span className="tg-badge">
              <Play size={10} weight="fill" /> {t('tv.anim')}
            </span>
          )}
        </span>
        <span className="tg-hover">
          <span className="tg-hover-btn">
            <Eye size={15} weight="bold" /> {t('tv.preview')}
          </span>
        </span>
        <span className="dz-progress" aria-hidden="true">
          {deck.map((s, k) => (
            <i key={s.id} className={k === idx ? 'on' : ''} />
          ))}
        </span>
      </button>
      <div className="tg-meta">
        <div>
          <b>{tpl.name}</b>
          <span>
            {catLabel(tpl.cat)} · {deck.length} slayd
          </span>
        </div>
        <button className="tg-use" onClick={() => onUse(tpl.id)}>
          {t('tv.use')} <ArrowRight size={13} weight="bold" />
        </button>
      </div>
    </div>
  )
}

/* ───────────── Preview window ───────────── */
function Preview({ tpl, onClose, onUse, onNav }) {
  const deck = sampleDeck(tpl)
  const [i, setI] = useState(0)

  useEffect(() => setI(0), [tpl.id])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(deck.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [deck.length, onClose])

  return (
    <div className="tp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tp" role="dialog" aria-modal="true" aria-label={tpl.name}>
        <button className="tp-close" onClick={onClose} aria-label={t('ui.close')}>
          <X size={18} weight="bold" />
        </button>

        <div className="tp-stage">
          <div className="tp-slide" key={`${tpl.id}-${i}`}>
            <Slide slide={deck[i]} theme={tpl.theme} index={i} />
          </div>
          <button className="tp-arrow l" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label={t('tv.prevSlide')}>
            <CaretLeft size={18} weight="bold" />
          </button>
          <button className="tp-arrow r" onClick={() => setI((x) => Math.min(deck.length - 1, x + 1))} disabled={i === deck.length - 1} aria-label={t('tv.nextSlide')}>
            <CaretRight size={18} weight="bold" />
          </button>
          <div className="tp-strip">
            {deck.map((s, k) => (
              <button key={s.id} className={`tp-strip-item ${k === i ? 'on' : ''}`} onClick={() => setI(k)} aria-label={t('tv.slideN', { n: k + 1 })}>
                <Slide slide={s} theme={tpl.theme} index={k} preview />
              </button>
            ))}
          </div>
        </div>

        <aside className="tp-side">
          <span className="tp-cat">{catLabel(tpl.cat)}</span>
          <h2>
            {tpl.name}
            {tpl.pro && (
              <ProBadge size="md" className="tp-pro-badge" />
            )}
          </h2>
          <p className="tp-desc">
            «{tpl.sample.title}» namunasida. Matn, rang va şriftlarni muharrirda bemalol özgartirasiz.
          </p>
          <ul className="tp-feats">
            <li><CheckCircle size={16} weight="fill" /> {t('tv.f1', { n: deck.length })}</li>
            <li><CheckCircle size={16} weight="fill" /> {t('tv.f2')}</li>
            <li><CheckCircle size={16} weight="fill" /> {t('tv.f3')}</li>
            {tpl.video && <li><CheckCircle size={16} weight="fill" /> {t('tv.f4')}</li>}
          </ul>
          <div className="tp-swatches">
            <span style={{ background: tpl.theme.bg }} />
            <span style={{ background: tpl.theme.accent }} />
            <span style={{ background: tpl.theme.text }} />
            <small>{t('tv.palette')}</small>
          </div>
          <button className="tp-use" onClick={() => onUse(tpl.id)}>
            {t('tv.useThis')} <ArrowRight size={16} weight="bold" />
          </button>
          <div className="tp-nav">
            <button onClick={() => onNav(-1)}>
              <ArrowLeft size={14} weight="bold" /> {t('tv.prev')}
            </button>
            <button onClick={() => onNav(1)}>
              {t('tv.next')} <ArrowRight size={14} weight="bold" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ───────────── Kits: logo · link in bio · resume ───────────── */
const KIT_ICON = { logo: PenNib, bio: LinkSimple, cv: IdentificationCard }
const KIT_CAT = { logo: 'logo', bio: 'bio', cv: 'cv' }

const KIT_TILES = {
  logo: { color: 'amber', picks: [1, 2] },
  bio: { color: 'green', picks: [1, 2] },
  cv: { color: 'blue', picks: [0, 3] },
}

/** Preview of one kit template, shaped like what it makes: card, phone or A4 page. */
function KitArt({ tpl }) {
  if (tpl.type === 'logo') return <KitThumb type="logo" data={templateData(tpl)} />
  if (tpl.type === 'bio')
    return (
      <Scaled width={300} height={600}>
        <BioPage data={templateData(tpl)} compact />
      </Scaled>
    )
  return (
    <Scaled width={794} height={1123}>
      <CvPage cv={templateData(tpl)} />
    </Scaled>
  )
}

/** "Nima yaratamiz?" tile for logo / link in bio / resume — same look as the slide categories. */
function KitCategoryCard({ type, i, onOpen }) {
  const meta = KIT_TILES[type]
  const tpls = KIT_TEMPLATES.filter((x) => x.type === type)
  return (
    <button className={`tv-cat kit kit-${type}`} style={{ '--i': i }} onClick={() => onOpen(type)}>
      <span className="tv-cat-text">
        <CatTile icon={KIT_ICON[type]} color={meta.color} />
        <b>{KIT_TYPES[type].label}</b>
        <span className="tv-cat-count">
          {t('tv.count', { n: tpls.length })} <ArrowRight size={12} weight="bold" />
        </span>
      </span>
      <span className="tv-cat-art">
        {meta.picks.map((n, k) => (
          <span key={tpls[n].id} className={`tv-cat-thumb k${k}`}>
            <KitArt tpl={tpls[n]} />
          </span>
        ))}
      </span>
      <span className="tv-cat-new">{t('tv.new')}</span>
    </button>
  )
}

function KitTile({ tpl, i, onUse }) {
  return (
    <div className="tg-card" style={{ '--i': Math.min(i, 12) }}>
      <button className={`tg-thumb kit k-${tpl.type}`} onClick={() => onUse(tpl.type, tpl.id)} aria-label={t('tv.create', { name: tpl.name })}>
        <KitThumb type={tpl.type} data={templateData(tpl)} />
        <span className="tg-badges">
          <span className="tg-badge new">{t('tv.new')}</span>
        </span>
        <span className="tg-hover">
          <span className="tg-hover-btn">
            <Sparkle size={14} weight="fill" /> {t('tv.startWith')}
          </span>
        </span>
      </button>
      <div className="tg-meta">
        <div>
          <b>{tpl.name}</b>
          <span>{KIT_TYPES[tpl.type].label}</span>
        </div>
        <button className="tg-use" onClick={() => onUse(tpl.type, tpl.id)}>
          {t('tv.use')} <ArrowRight size={13} weight="bold" />
        </button>
      </div>
    </div>
  )
}

/* ───────────── Page ───────────── */
export default function TemplatesView({ onTab, onCreate, onCreateKit }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [pro, setPro] = useState(false)
  const [anim, setAnim] = useState(false)
  const [previewId, setPreviewId] = useState(null)
  const [recent, setRecent] = useState(readRecent)
  const gallery = useRef(null)
  const recentRow = useRef(null)

  const kitCat = KIT_CAT[cat]
  const kitList = useMemo(() => {
    if (pro || anim) return []
    const needle = q.trim().toLowerCase()
    return KIT_TEMPLATES.filter(
      (x) => (cat === 'all' || x.type === kitCat) && (!needle || `${x.name} ${KIT_TYPES[x.type].label} ${KIT_TYPES[x.type].kind}`.toLowerCase().includes(needle)),
    )
  }, [q, cat, kitCat, pro, anim])

  const list = useMemo(() => {
    if (kitCat) return []
    const needle = q.trim().toLowerCase()
    return TEMPLATES.filter(
      (x) =>
        (cat === 'all' || x.cat === cat) &&
        (!pro || x.pro) &&
        (!anim || x.video) &&
        (!needle || `${x.name} ${x.sample.title} ${x.sample.subtitle} ${catLabel(x.cat)}`.toLowerCase().includes(needle)),
    )
  }, [q, cat, pro, anim, kitCat])

  const open = (id) => {
    setPreviewId(id)
    setRecent((r) => {
      const next = [id, ...r.filter((x) => x !== id)].slice(0, 8)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }
  const use = (id) => {
    setPreviewId(null)
    onCreate({ templateId: id })
  }
  const nav = (dir) => {
    const ids = (list.length ? list : TEMPLATES).map((x) => x.id)
    const at = ids.indexOf(previewId)
    open(ids[(at + dir + ids.length) % ids.length])
  }
  const scrollRecent = (dir) => recentRow.current?.scrollBy({ left: dir * 520, behavior: 'smooth' })
  const pickCat = (id) => {
    setCat(id)
    gallery.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const recentTpls = recent.map((id) => TEMPLATES.find((x) => x.id === id)).filter(Boolean)
  const counts = useMemo(
    () => ({
      ...Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id === 'all' ? TEMPLATES.length + KIT_TEMPLATES.length : TEMPLATES.filter((x) => x.cat === c.id).length])),
      ...Object.fromEntries(Object.keys(KIT_TYPES).map((k) => [k, KIT_TEMPLATES.filter((x) => x.type === k).length])),
    }),
    [],
  )

  return (
    <div className="tv">
      {/* ───── Header ───── */}
      <header className="tv-head">
        <div className="tv-bg" aria-hidden="true">
          <span className="pj-wash" />
          <span className="pj-paper" />
        </div>
        <div className="tv-head-text">
          <span className="pj-greet">
            <Sparkle size={14} weight="fill" className="tv-spark" />
            {t('tv.eyebrow', { n: TEMPLATES.length })}
          </span>
          <h1 className="pj-title tv-title">
            {t('tv.title1')}{' '}
            <span className="hx-word">
              <em>{t('tv.title2')}</em>
              <svg className="hx-stroke" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 15C60 5 118 23 178 12S262 7 296 14" pathLength="1" />
              </svg>
              <span className="hx-pen" aria-hidden="true">
                <QalamNib height={44} />
              </span>
            </span>
          </h1>
          <p className="pj-sub tv-sub">{t('tv.sub')}</p>

          <label className="tv-search">
            <MagnifyingGlass size={19} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tv.searchPh')} />
            {q && (
              <button className="pj-clear" onClick={() => setQ('')} aria-label={t('hx.clear')}>
                <X size={14} weight="bold" />
              </button>
            )}
          </label>

          <div className="tv-head-row">
            <div className="pj-tabs" role="tablist">
              {TABS.map(([id, Icon]) => (
                <button key={id} role="tab" aria-selected={id === 'templates'} className={id === 'templates' ? 'on' : ''} onClick={() => onTab(id)}>
                  <Icon size={15} weight={id === 'templates' ? 'duotone' : 'regular'} /> {t(`hm.rail.${id}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Wall />
      </header>

      {/* ───── Categories ───── */}
      {!q && (
        <section className="tv-section">
          <div className="tv-section-head">
            <h2>{t('tv.what')}</h2>
            <span className="tv-hint">{t('tv.whatHint')}</span>
          </div>
          <div className="tv-cats">
            {CREATE.map((c, i) => (
              <CategoryCard key={c.id} c={c} i={i} onCreate={onCreate} />
            ))}
            {Object.keys(KIT_TILES).map((type, i) => (
              <KitCategoryCard key={type} type={type} i={CREATE.length + i} onOpen={pickCat} />
            ))}
          </div>
        </section>
      )}

      {/* ───── Recently viewed ───── */}
      {!q && recentTpls.length > 0 && (
        <section className="tv-section">
          <div className="tv-section-head">
            <h2>
              <ClockCounterClockwise size={18} /> {t('tv.recent')}
            </h2>
            <div className="tv-arrows">
              <button onClick={() => scrollRecent(-1)} aria-label={t('tv.left')}>
                <CaretLeft size={16} weight="bold" />
              </button>
              <button onClick={() => scrollRecent(1)} aria-label={t('tv.right')}>
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
          </div>
          <div className="tv-recent" ref={recentRow}>
            {recentTpls.map((tpl) => (
              <button key={tpl.id} className="tv-recent-item" onClick={() => open(tpl.id)}>
                <Slide slide={sampleDeck(tpl)[0]} theme={tpl.theme} preview />
                <span>{tpl.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ───── Gallery ───── */}
      <section className="tv-section" ref={gallery}>
        <div className="tv-section-head">
          <h2>{q ? t('tv.results', { q, n: list.length + kitList.length }) : kitCat ? t('tv.kitTemplates', { name: KIT_TYPES[kitCat].label }) : t('tv.all')}</h2>
        </div>
        <div className="tv-filters">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`pj-chip ${cat === c.id ? 'on' : ''}`} onClick={() => pickCat(c.id)}>
              {c.label} <span>{counts[c.id]}</span>
            </button>
          ))}
          <span className="tv-filters-div" />
          {Object.entries(KIT_TYPES).map(([id, k]) => {
            const Icon = KIT_ICON[id]
            return (
              <button key={id} className={`pj-chip tv-kit-chip ${cat === id ? 'on' : ''}`} onClick={() => pickCat(id)}>
                <Icon size={13} weight="duotone" /> {KIT_TYPES[id].label} <span>{counts[id]}</span>
              </button>
            )
          })}
          <span className="tv-filters-div" />
          <button className={`pj-chip tv-toggle ${pro ? 'on' : ''}`} onClick={() => setPro((v) => !v)}>
            <ProCrown size={15} /> Pro
          </button>
          <button className={`pj-chip tv-toggle ${anim ? 'on' : ''}`} onClick={() => setAnim((v) => !v)}>
            <Play size={12} weight="fill" /> {t('tv.animated')}
          </button>
        </div>

        {list.length || kitList.length ? (
          <div className="tg-grid">
            {list.map((tpl, i) => (
              <TemplateTile key={tpl.id} tpl={tpl} i={i} onPreview={open} onUse={use} />
            ))}
            {kitList.map((tpl, i) => (
              <KitTile key={tpl.id} tpl={tpl} i={list.length + i} onUse={onCreateKit} />
            ))}
          </div>
        ) : (
          <div className="pj-empty">
            <span className="pj-empty-pen">
              <QalamNib height={70} />
            </span>
            <h3>{t('tv.none')}</h3>
            <p>{t('tv.noneHint')}</p>
            <button className="btn" onClick={() => { setQ(''); setCat('all'); setPro(false); setAnim(false) }}>
              {t('tv.clearFilters')}
            </button>
          </div>
        )}
      </section>

      {previewId && <Preview tpl={getTemplate(previewId)} onClose={() => setPreviewId(null)} onUse={use} onNav={nav} />}
    </div>
  )
}
