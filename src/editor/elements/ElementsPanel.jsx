// The Elements panel — Canva-style: a search box, category tiles, preview rows per category and a
// full view per category. Click adds an element to the middle of the page; drag drops it where
// you let go (a photo dropped on a frame or mockup fills it).
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Search, X } from 'lucide-react'
import { t } from '../../i18n/index.js'
import { ElementContent } from '../FreeLayer.jsx'
import { CATEGORIES, GROUPS, ITEMS, ITEM_BY_ID, gridRects, searchItems } from './catalog.js'
import { DND_ITEM, DND_PHOTO, imageSpec, loadRecent, onRecent, photoErrorText, remember } from './dnd.js'
import { ICON_WEIGHTS } from './icons.js'
import { photoData, searchPhotos } from './photos.js'
import { Loop } from './render.jsx'
import CatArt from './CatArt.jsx'
import './elements.css'

// A landscape drawn in SVG: what frames, mockups and collages show in the panel previews.
const SAMPLE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#8ec5ff"/><stop offset="1" stop-color="#dbeeff"/></linearGradient></defs><rect width="160" height="120" fill="url(#s)"/><circle cx="118" cy="34" r="13" fill="#ffd166"/><path d="M0 84L34 58L60 76L96 46L160 90V120H0Z" fill="#5fa86a"/><path d="M0 98C40 86 80 90 160 100V120H0Z" fill="#3f8a52"/></svg>`,
  )

const TOPICS = ['nature', 'city', 'people', 'business', 'education', 'technology', 'space', 'food', 'flowers', 'mountains', 'sea', 'animals', 'travel', 'sport', 'abstract', 'architecture']

const COLS = { shapes: 4, lines: 2, graphics: 3, icons: 5, frames: 3, grids: 3, tables: 2, charts: 2, mockups: 3, animations: 3, stickers: 4 }
const ROW = { shapes: 4, lines: 2, graphics: 3, icons: 5, frames: 3, grids: 3, tables: 2, charts: 2, mockups: 3, animations: 3, stickers: 4 }
const TILE_RATIO = { lines: 2.6, tables: 1.45, charts: 1.45, grids: 16 / 9 }
const HOME_ORDER = ['shapes', 'graphics', 'photos', 'icons', 'charts', 'tables', 'frames', 'grids', 'stickers', 'mockups', 'animations', 'lines']

/* ───────── previews ───────── */

function Preview({ item, theme, weight, tileRatio = 1, animate }) {
  const els = useMemo(() => item.make(theme, { weight }), [item, theme, weight])
  if (item.grid) {
    return (
      <span className="ep-grid">
        {gridRects(item.grid, item.grid === 'full' || item.grid === 'framed' ? 0 : 1.6).map((r, i) => (
          <span key={i} style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, backgroundImage: `url("${SAMPLE}")` }} />
        ))}
      </span>
    )
  }
  const el = { ...els[0], ...(els[0].kind === 'image' || els[0].kind === 'mockup' ? { src: SAMPLE } : {}) }
  const ratio = (el.w * 16) / (el.h * 9)
  const wide = ratio >= tileRatio
  return (
    <span className="ep-box">
      <span className="ep-fit" style={{ aspectRatio: ratio, width: wide ? '100%' : 'auto', height: wide ? 'auto' : '100%' }}>
        <span className="ep-page" style={{ width: `${10000 / el.w}%` }}>
          <span className="ep-el" style={{ width: `${el.w}%`, height: `${el.h}%` }}>
            <Loop type={animate ? el.loop : undefined}>
              <ElementContent el={el} theme={theme} />
            </Loop>
          </span>
        </span>
      </span>
    </span>
  )
}

function Tile({ item, theme, weight, onAdd, ratio = 1, animate }) {
  const drag = (e) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData(DND_ITEM, JSON.stringify({ id: item.id, els: item.make(theme, { weight }) }))
  }
  return (
    <button type="button" className="ep-tile" style={{ aspectRatio: ratio }} title={item.name()} draggable onDragStart={drag} onClick={() => onAdd(item)}>
      <Preview item={item} theme={theme} weight={weight} tileRatio={ratio} animate={animate} />
    </button>
  )
}

function TileGrid({ items, cat, theme, weight, onAdd, animate }) {
  return (
    <div className="ep-grid-list" style={{ '--cols': COLS[cat] ?? 3 }}>
      {items.map((it) => (
        <Tile key={it.id} item={it} theme={theme} weight={weight} onAdd={onAdd} ratio={TILE_RATIO[cat] ?? 1} animate={animate ?? cat === 'animations'} />
      ))}
    </div>
  )
}

function Head({ title, onAll }) {
  return (
    <div className="pn-head">
      <h3>{title}</h3>
      {onAll && (
        <button type="button" className="pn-link" onClick={onAll}>
          {t('el.all')}
        </button>
      )}
    </div>
  )
}

/* ───────── photos ───────── */

function PhotoGrid({ photos, busyId, onPick }) {
  const cols = [[], []]
  const hgt = [0, 0]
  for (const p of photos) {
    const k = hgt[0] <= hgt[1] ? 0 : 1
    cols[k].push(p)
    hgt[k] += p.h / p.w
  }
  return (
    <div className="ep-photos">
      {cols.map((col, i) => (
        <div key={i} className="ep-photo-col">
          {col.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ep-photo ${busyId === p.id ? 'busy' : ''}`}
              style={{ aspectRatio: `${p.w} / ${p.h}` }}
              title={p.title}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData(DND_PHOTO, JSON.stringify(p))
              }}
              onClick={() => onPick(p)}
            >
              <img src={p.thumb} alt={p.title} loading="lazy" draggable={false} onError={(e) => e.currentTarget.closest('.ep-photo')?.classList.add('broken')} />
              {busyId === p.id && (
                <span className="ep-photo-spin">
                  <Loader2 size={20} />
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function usePhotos(query, enabled = true) {
  const [state, setState] = useState({ items: [], page: 0, more: false, loading: false, error: null })
  useEffect(() => {
    if (!enabled || !query) return
    const ac = new AbortController()
    setState({ items: [], page: 0, more: false, loading: true, error: null })
    searchPhotos(query, 1, ac.signal)
      .then((r) => setState({ items: r.items, page: 1, more: r.more, loading: false, error: null }))
      .catch((e) => e.name !== 'AbortError' && setState((s) => ({ ...s, loading: false, error: e })))
    return () => ac.abort()
  }, [query, enabled])
  const loadMore = () => {
    if (state.loading || !state.more) return
    setState((s) => ({ ...s, loading: true }))
    searchPhotos(query, state.page + 1)
      .then((r) => setState((s) => ({ items: [...s.items, ...r.items.filter((x) => !s.items.some((y) => y.id === x.id))], page: s.page + 1, more: r.more, loading: false, error: null })))
      .catch((e) => setState((s) => ({ ...s, loading: false, error: e })))
  }
  return { ...state, loadMore }
}

function PhotosView({ query, setQuery, pick, busyId }) {
  const topics = t('el.ph.topics').split('|')
  const q = query.trim() || TOPICS[0]
  const res = usePhotos(q)
  return (
    <>
      <div className="pn-chips wrap ep-topics">
        {TOPICS.map((id, i) => (
          <button key={id} type="button" className={`pn-chip ${q === id ? 'on' : ''}`} onClick={() => setQuery(id)}>
            {topics[i] ?? id}
          </button>
        ))}
      </div>
      {res.error && <p className="ep-error">{photoErrorText(res.error)}</p>}
      <PhotoGrid photos={res.items} busyId={busyId} onPick={pick} />
      {!res.loading && !res.error && !res.items.length && <p className="pn-empty">{t('el.empty')}</p>}
      {res.loading && (
        <div className="ep-loading">
          <Loader2 size={18} /> {t('el.ph.loading')}
        </div>
      )}
      {res.more && !res.loading && (
        <button type="button" className="btn block ep-more" onClick={res.loadMore}>
          {t('el.ph.more')}
        </button>
      )}
      <p className="pn-note">{t('el.ph.note')}</p>
    </>
  )
}

/** A row of photos on the home view; loads once it scrolls into sight. */
function PhotoStrip({ pick, busyId, onAll }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const n = ref.current
    if (!n || seen) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: '120px' })
    io.observe(n)
    return () => io.disconnect()
  }, [seen])
  const res = usePhotos(TOPICS[0], seen)
  return (
    <div ref={ref}>
      <Head title={t('el.cat.photos')} onAll={onAll} />
      <div className="ep-photo-row">
        {(res.items.length ? res.items.slice(0, 3) : [0, 1, 2]).map((p, i) =>
          typeof p === 'number' ? (
            <span key={i} className="ep-photo ph" />
          ) : (
            <button
              key={p.id}
              type="button"
              className={`ep-photo ${busyId === p.id ? 'busy' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DND_PHOTO, JSON.stringify(p))}
              onClick={() => pick(p)}
              title={p.title}
            >
              <img src={p.thumb} alt={p.title} loading="lazy" draggable={false} />
              {busyId === p.id && (
                <span className="ep-photo-spin">
                  <Loader2 size={18} />
                </span>
              )}
            </button>
          ),
        )}
      </div>
      {res.error && <p className="ep-error">{photoErrorText(res.error)}</p>}
    </div>
  )
}

/* ───────── the panel ───────── */

/**
 * @param {{ theme: object, selected?: object|null, onAdd: (specs: object[]) => void, onFill: (id: string, src: string) => boolean }} p
 */
export default function ElementsPanel({ theme, selected, onAdd, onFill }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)
  const [photoQ, setPhotoQ] = useState('')
  const [weight, setWeight] = useState('regular')
  const [recent, setRecent] = useState(loadRecent)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const scroller = useRef(null)
  const input = useRef(null)

  useEffect(() => onRecent(() => setRecent(loadRecent())), [])
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [cat])

  const add = (item) => {
    onAdd(item.make(theme, { weight }))
    remember(item.id)
  }

  const pickPhoto = async (p) => {
    if (busyId) return
    setBusyId(p.id)
    setError(null)
    try {
      const src = await photoData(p)
      // an empty frame or mockup that is selected takes the photo; otherwise it is added
      const target = selected && (selected.kind === 'image' || selected.kind === 'mockup') && !selected.src ? selected.id : null
      if (!(target && onFill(target, src))) onAdd([await imageSpec(src)])
    } catch (e) {
      setError(photoErrorText(e))
    } finally {
      setBusyId(null)
    }
  }

  const inPhotos = cat === 'photos'
  const searching = !inPhotos && q.trim().length > 0
  const results = useMemo(() => (searching ? searchItems(q) : []), [searching, q])

  const openCat = (id) => {
    setCat(id)
    setQ('')
    setError(null)
  }

  const itemsOf = (c) => ITEMS.filter((it) => it.cat === c)

  /* ───── views ───── */

  const home = (
    <>
      <div className="ep-cats">
        {CATEGORIES.map((id) => (
          <button key={id} type="button" className="ep-cat" onClick={() => openCat(id)}>
            <CatArt id={id} />
            <span>{t(`el.cat.${id}`)}</span>
          </button>
        ))}
      </div>
      {recent.some((id) => ITEM_BY_ID.has(id)) && (
        <>
          <Head title={t('el.recent')} />
          <div className="ep-grid-list" style={{ '--cols': 4 }}>
            {recent
              .map((id) => ITEM_BY_ID.get(id))
              .filter(Boolean)
              .slice(0, 8)
              .map((it) => (
                <Tile key={it.id} item={it} theme={theme} weight={weight} onAdd={add} animate={it.cat === 'animations'} />
              ))}
          </div>
        </>
      )}
      {HOME_ORDER.map((c) =>
        c === 'photos' ? (
          <PhotoStrip key={c} pick={pickPhoto} busyId={busyId} onAll={() => openCat('photos')} />
        ) : (
          <div key={c}>
            <Head title={t(`el.cat.${c}`)} onAll={() => openCat(c)} />
            <TileGrid items={itemsOf(c).slice(0, ROW[c] ?? 3)} cat={c} theme={theme} weight={weight} onAdd={add} />
          </div>
        ),
      )}
    </>
  )

  const groupedView = (c) => {
    const items = itemsOf(c)
    const groups = GROUPS[c]
    if (!groups) return <TileGrid items={items} cat={c} theme={theme} weight={weight} onAdd={add} />
    return groups.map((g) => (
      <div key={g}>
        <Head title={t(`el.grp.${g}`)} />
        <TileGrid items={items.filter((it) => it.group === g)} cat={c} theme={theme} weight={weight} onAdd={add} />
      </div>
    ))
  }

  const catView = cat && (
    <>
      <div className="ep-cat-head">
        <button type="button" className="pn-icon" onClick={() => openCat(null)} aria-label={t('el.back')}>
          <ArrowLeft size={17} />
        </button>
        <h3>{t(`el.cat.${cat}`)}</h3>
      </div>
      {cat === 'icons' && (
        <div className="seg full ep-weights" role="group" aria-label={t('el.tb.style')}>
          {ICON_WEIGHTS.slice(0, 4).map((w) => (
            <button key={w} type="button" className={weight === w ? 'on' : ''} onClick={() => setWeight(w)}>
              {t(`el.w.${w}`)}
            </button>
          ))}
        </div>
      )}
      {cat === 'grids' && <p className="pn-text">{t('el.gridsHint')}</p>}
      {cat === 'frames' && <p className="pn-text">{t('el.framesHint')}</p>}
      {cat === 'tables' && <p className="pn-text">{t('el.tablesHint')}</p>}
      {cat === 'charts' && <p className="pn-text">{t('el.chartsHint')}</p>}
      {inPhotos ? (
        <PhotosView
          query={photoQ}
          setQuery={(v) => {
            setPhotoQ(v)
            setQ('')
          }}
          pick={pickPhoto}
          busyId={busyId}
        />
      ) : (
        groupedView(cat)
      )}
    </>
  )

  const byCat = CATEGORIES.map((c) => [c, results.filter((it) => it.cat === c)]).filter(([, l]) => l.length)
  const searchView = (
    <>
      <Head title={t('el.results', { n: results.length })} />
      {byCat.map(([c, l]) => {
        const limit = expanded[c] ? l.length : (COLS[c] ?? 3) * 2
        return (
          <div key={c}>
            <div className="pn-label">{t(`el.cat.${c}`)}</div>
            <TileGrid items={l.slice(0, limit)} cat={c} theme={theme} weight={weight} onAdd={add} />
            {l.length > limit && (
              <button type="button" className="pn-link ep-expand" onClick={() => setExpanded((x) => ({ ...x, [c]: true }))}>
                {t('el.showAll', { n: l.length })}
              </button>
            )}
          </div>
        )
      })}
      {!results.length && <p className="pn-empty">{t('el.empty')}</p>}
      <button
        type="button"
        className="ep-photo-search"
        onClick={() => {
          setPhotoQ(q.trim())
          setCat('photos')
          setQ('')
        }}
      >
        <Search size={15} /> {t('el.photosFor', { q: q.trim() })}
      </button>
    </>
  )

  const submitPhoto = (v) => setPhotoQ(v.trim())

  return (
    <>
      <div className="pn-search ep-search">
        <Search size={17} />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inPhotos) submitPhoto(q)
            if (e.key === 'Escape') setQ('')
          }}
          placeholder={inPhotos ? t('el.ph.search') : t('el.search')}
          aria-label={inPhotos ? t('el.ph.search') : t('el.search')}
        />
        {q && (
          <button
            type="button"
            className="pn-icon"
            onClick={() => {
              setQ('')
              if (inPhotos) setPhotoQ('')
              input.current?.focus()
            }}
            aria-label={t('el.clear')}
          >
            <X size={15} />
          </button>
        )}
      </div>
      {inPhotos && q.trim() && q.trim() !== photoQ && (
        <button type="button" className="ep-photo-search slim" onClick={() => submitPhoto(q)}>
          <Search size={14} /> {t('el.photosFor', { q: q.trim() })}
        </button>
      )}
      <div className="pn-scroll ep-scroll" ref={scroller}>
        {error && (
          <p className="ep-error" role="alert">
            {error}
          </p>
        )}
        {searching ? searchView : cat ? catView : home}
        {!searching && !cat && <p className="pn-note">{t('el.dragHint')}</p>}
      </div>
    </>
  )
}
