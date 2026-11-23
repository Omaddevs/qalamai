import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkle, UploadSimple, Star, DownloadSimple, Trash, X, CheckCircle, Circle, MagnifyingGlass,
  SortDescending, SortAscending, ImageSquare, Images, CloudArrowUp, ArrowsOut, Checks,
} from '@phosphor-icons/react'
import { QalamNib } from '../components/ui.jsx'
import {
  ASPECTS, MAX_UPLOAD, STYLES, deleteMedia, fromFile, generateImages, listMedia, putMedia,
} from '../media.js'
// shared page header (pj-*, tv-bg, tv-spark) — see AlifboView
import './projects.css'
import './templates.css'
import './media.css'

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
const monthKey = (t) => {
  const d = new Date(t)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
const fmtDate = (t) => {
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const extOf = (type) => (type === 'image/svg+xml' ? 'svg' : type.split('/')[1] || 'png')

const SOURCES = [
  ['all', 'Hammasi'],
  ['upload', 'Yuklanganlar'],
  ['ai', 'AI yaratgan'],
  ['fav', 'Sevimlilar'],
]
const KINDS = [
  ['all', 'Barça turlar'],
  ['photo', 'Rasmlar'],
  ['graphic', 'Grafikalar'],
]

function download(item, url) {
  const a = document.createElement('a')
  a.href = url
  a.download = `${item.name.replace(/[\\/:*?"<>|]/g, '')}.${extOf(item.type)}`
  a.click()
}

/* ───────────── AI composer (inline, not a modal) ───────────── */
function Composer({ onDone, onClose, notify }) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('scene')
  const [aspect, setAspect] = useState('square')
  const [busy, setBusy] = useState(false)

  const run = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || busy) return
    setBusy(true)
    try {
      const items = await generateImages({ prompt: prompt.trim(), style, aspect, count: 4 })
      await onDone(items)
      notify('4 ta rasm kutubxonaga qöşildi (demo)')
      setPrompt('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="md-composer" onSubmit={run}>
      <div className="md-composer-top">
        <span className="md-composer-title">
          <Sparkle size={16} weight="fill" /> AI bilan rasm yaratiş
        </span>
        <button type="button" className="md-x" onClick={onClose} aria-label="Yopiş">
          <X size={16} />
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Nimani çizamiz? Masalan: tongda Samarqand, Registon maydoni, iliq ranglarda"
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) run(e)
        }}
      />
      <div className="md-composer-row">
        <div className="seg" role="group" aria-label="Uslub">
          {STYLES.map((s) => (
            <button type="button" key={s.id} className={style === s.id ? 'on' : ''} onClick={() => setStyle(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Ölçam">
          {ASPECTS.map((a) => (
            <button type="button" key={a.id} className={aspect === a.id ? 'on' : ''} onClick={() => setAspect(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        <span className="md-demo">Demo: haqiqiy AI hali ulanmagan</span>
        <button className="md-btn dark" disabled={!prompt.trim() || busy}>
          {busy ? <span className="md-spin" /> : <Sparkle size={15} weight="fill" />}
          {busy ? 'Chizilmoqda…' : '4 ta variant'}
        </button>
      </div>
      {busy && (
        <div className="md-ghosts" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ '--i': i, aspectRatio: aspect === 'land' ? '4/3' : aspect === 'port' ? '3/4' : '1' }} />
          ))}
        </div>
      )}
    </form>
  )
}

/* ───────────── Lightbox ───────────── */
function Viewer({ item, url, onClose, onFav, onDelete, onPrev, onNext }) {
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'Delete' || e.key === 'Backspace') onDelete()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, onPrev, onNext, onDelete])

  return (
    <div className="md-viewer" role="dialog" aria-label={item.name} onClick={onClose}>
      <div className="md-viewer-in" onClick={(e) => e.stopPropagation()}>
        <div className="md-viewer-img">
          <img src={url} alt={item.name} />
        </div>
        <aside className="md-viewer-side">
          <button className="md-x" onClick={onClose} aria-label="Yopiş">
            <X size={18} />
          </button>
          <span className={`md-tag ${item.source}`}>{item.source === 'ai' ? 'AI yaratgan' : 'Yuklangan'}</span>
          <h3>{item.name}</h3>
          <dl>
            <dt>Ölçam</dt>
            <dd>
              {item.w} × {item.h}
            </dd>
            <dt>Hajmi</dt>
            <dd>{fmtSize(item.size)}</dd>
            <dt>Format</dt>
            <dd>{extOf(item.type).toUpperCase()}</dd>
            <dt>Sana</dt>
            <dd>{fmtDate(item.createdAt)}</dd>
          </dl>
          {item.prompt && (
            <div className="md-prompt">
              <span>Sörov</span>
              <p>{item.prompt}</p>
            </div>
          )}
          <div className="md-viewer-actions">
            <button className="md-btn dark" onClick={() => download(item, url)}>
              <DownloadSimple size={16} /> Yuklab oliş
            </button>
            <button className={`md-btn ${item.fav ? 'fav' : ''}`} onClick={onFav}>
              <Star size={16} weight={item.fav ? 'fill' : 'regular'} /> {item.fav ? 'Sevimlida' : 'Sevimli'}
            </button>
            <button className="md-btn danger" onClick={onDelete}>
              <Trash size={16} /> Öçiriş
            </button>
          </div>
          <p className="md-keys">← → ötiş · Delete öçiriş · Esc yopiş</p>
        </aside>
      </div>
    </div>
  )
}

/* ───────────── Page ───────────── */
export default function MediaView({ notify }) {
  const [items, setItems] = useState(null) // null = loading
  const [source, setSource] = useState('all')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const [asc, setAsc] = useState(false)
  const [composer, setComposer] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [open, setOpen] = useState(null)
  const [drag, setDrag] = useState(false)
  const fileInput = useRef(null)
  const dragDepth = useRef(0)

  useEffect(() => {
    listMedia()
      .then(setItems)
      .catch(() => {
        setItems([])
        notify('Media kutubxonasini oçib bölmadi (brauzer xotirasi yopiq)')
      })
  }, [notify])

  // one object URL per item, revoked when the item disappears or the page unmounts
  const urls = useRef(new Map())
  const urlOf = useCallback((it) => {
    let u = urls.current.get(it.id)
    if (!u) {
      u = URL.createObjectURL(it.blob)
      urls.current.set(it.id, u)
    }
    return u
  }, [])
  useEffect(() => {
    const live = new Set((items ?? []).map((i) => i.id))
    for (const [id, u] of urls.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(u)
        urls.current.delete(id)
      }
    }
  }, [items])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const add = useCallback(async (list) => {
    await putMedia(list)
    setItems((xs) => [...list, ...(xs ?? [])])
  }, [])

  const upload = async (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'))
    const tooBig = imgs.filter((f) => f.size > MAX_UPLOAD)
    const ok = imgs.filter((f) => f.size <= MAX_UPLOAD)
    if (!imgs.length) return notify('Faqat rasm fayllarini yuklaş mumkin')
    if (tooBig.length) notify(`${tooBig.length} ta fayl 15 MB dan katta — ötkazib yuborildi`)
    if (!ok.length) return
    const list = await Promise.all(ok.map(fromFile))
    try {
      await add(list)
      notify(`${list.length} ta rasm yuklandi`)
    } catch {
      notify('Saqlab bölmadi — brauzer xotirasi tölgan bölişi mumkin')
    }
  }

  const patch = async (ids, change) => {
    const next = items.map((it) => (ids.includes(it.id) ? { ...it, ...change } : it))
    setItems(next)
    await putMedia(next.filter((it) => ids.includes(it.id)))
  }

  // Deleting is two-step: the files leave the grid at once, but stay in the browser's storage
  // for a few seconds so "Bekor qiliş" can bring them back. Then they are erased for good.
  const [trash, setTrash] = useState(null) // { items, timer }
  const trashRef = useRef(null)
  trashRef.current = trash

  const commitTrash = useCallback(
    async (t) => {
      if (!t) return
      clearTimeout(t.timer)
      try {
        await deleteMedia(t.items.map((i) => i.id))
      } catch {
        // could not erase: put them back so nothing silently disappears
        setItems((xs) => [...t.items, ...(xs ?? [])].sort((a, b) => b.createdAt - a.createdAt))
        notify('Öçirib bölmadi — qaytadan urinib köring')
      }
    },
    [notify],
  )

  const remove = (ids) => {
    if (!ids.length) return
    if (trashRef.current) commitTrash(trashRef.current) // an earlier deletion is now final
    const gone = (items ?? []).filter((it) => ids.includes(it.id))
    setItems((xs) => xs.filter((it) => !ids.includes(it.id)))
    setPicked(new Set())
    const t = { items: gone, timer: null }
    t.timer = setTimeout(() => {
      commitTrash(t)
      setTrash((cur) => (cur === t ? null : cur))
    }, 6000)
    setTrash(t)
  }

  const undo = () => {
    const t = trashRef.current
    if (!t) return
    clearTimeout(t.timer)
    setItems((xs) => [...t.items, ...(xs ?? [])].sort((a, b) => b.createdAt - a.createdAt))
    setTrash(null)
  }

  // closing the tab inside the undo window still deletes (the transaction starts right away)
  useEffect(() => {
    const finish = () => trashRef.current && commitTrash(trashRef.current)
    window.addEventListener('pagehide', finish)
    return () => window.removeEventListener('pagehide', finish)
  }, [commitTrash])

  // leaving the page finishes a pending deletion
  useEffect(() => () => trashRef.current && commitTrash(trashRef.current), [commitTrash])

  const counts = useMemo(() => {
    const xs = items ?? []
    return {
      all: xs.length,
      upload: xs.filter((i) => i.source === 'upload').length,
      ai: xs.filter((i) => i.source === 'ai').length,
      fav: xs.filter((i) => i.fav).length,
    }
  }, [items])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const xs = (items ?? []).filter(
      (i) =>
        (source === 'all' || (source === 'fav' ? i.fav : i.source === source)) &&
        (kind === 'all' || i.kind === kind) &&
        (!needle || `${i.name} ${i.prompt ?? ''}`.toLowerCase().includes(needle)),
    )
    return asc ? [...xs].reverse() : xs
  }, [items, source, kind, q, asc])

  const groups = useMemo(() => {
    const m = new Map()
    shown.forEach((it) => {
      const k = monthKey(it.createdAt)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(it)
    })
    return [...m]
  }, [shown])

  const togglePick = (id) =>
    setPicked((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const openIdx = open ? shown.findIndex((i) => i.id === open) : -1
  const openItem = openIdx >= 0 ? shown[openIdx] : null
  const pickedIds = [...picked]

  // drag & drop anywhere on the page
  const dnd = {
    onDragEnter: (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return
      dragDepth.current += 1
      setDrag(true)
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setDrag(false)
    },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault()
      dragDepth.current = 0
      setDrag(false)
      upload(e.dataTransfer.files)
    },
  }

  const recent = (items ?? []).slice(0, 3)

  return (
    <div className="md" {...dnd}>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />

      {/* ───── Header ───── */}
      <header className="md-head">
        <div className="tv-bg" aria-hidden="true">
          <span className="pj-wash" />
          <span className="pj-paper" />
        </div>
        <div className="md-head-text">
          <span className="pj-greet">
            <Images size={15} weight="duotone" className="tv-spark" />
            {counts.all ? `${counts.all} ta fayl · şu brauzerda saqlanadi` : 'Rasmlaringiz uçun bitta joy'}
          </span>
          <h1 className="pj-title">
            Media{' '}
            <span className="hx-word">
              <em>kutubxona</em>
              <svg className="hx-stroke" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 15C60 5 118 23 178 12S262 7 296 14" pathLength="1" />
              </svg>
              <span className="hx-pen" aria-hidden="true">
                <QalamNib height={44} />
              </span>
            </span>
          </h1>
          <p className="pj-sub">Yuklagan va AI bilan çizgan barça rasmlaringiz — qidiring, saralang, dizaynlarda qayta işlating.</p>
          <div className="md-head-actions">
            <button className="md-btn dark lg" onClick={() => setComposer(true)}>
              <Sparkle size={16} weight="fill" /> AI bilan yaratiş
            </button>
            <button className="md-btn lg" onClick={() => fileInput.current.click()}>
              <UploadSimple size={16} /> Yuklaş
            </button>
          </div>
        </div>

        {/* stacked polaroids of the latest media */}
        <div className="md-stack" aria-hidden="true">
          {[0, 1, 2].map((i) => {
            const it = recent[i]
            return (
              <span key={i} className={`md-polar p${i}`}>
                {it ? <img src={urlOf(it)} alt="" /> : <ImageSquare size={34} weight="duotone" />}
              </span>
            )
          })}
        </div>
      </header>

      {composer && <Composer onDone={add} onClose={() => setComposer(false)} notify={notify} />}

      {/* ───── Toolbar ───── */}
      <div className="md-bar">
        <div className="pj-tabs" role="tablist">
          {SOURCES.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={source === id} className={source === id ? 'on' : ''} onClick={() => setSource(id)}>
              {id === 'fav' && <Star size={14} weight={source === id ? 'fill' : 'regular'} />}
              {id === 'ai' && <Sparkle size={14} weight={source === id ? 'fill' : 'regular'} />}
              {label}
              <span className="md-count">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="md-bar-right">
          <label className="md-search">
            <MagnifyingGlass size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nomi yoki sörov böyiça" />
          </label>
          <select className="md-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Turi">
            {KINDS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button className="md-ibtn" onClick={() => setAsc((v) => !v)} title={asc ? 'Eskilari oldin' : 'Yangilari oldin'} aria-label="Saralaş">
            {asc ? <SortAscending size={18} /> : <SortDescending size={18} />}
          </button>
          <button
            className={`md-btn ${selecting ? 'on' : ''}`}
            onClick={() => {
              setSelecting((v) => !v)
              setPicked(new Set())
            }}
          >
            <Checks size={16} /> {selecting ? 'Bekor qiliş' : 'Tanlaş'}
          </button>
        </div>
      </div>

      {/* ───── Grid ───── */}
      {items === null ? (
        <div className="md-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="md-skel" style={{ height: 140 + ((i * 53) % 120) }} />
          ))}
        </div>
      ) : !items.length ? (
        <button className="md-empty" onClick={() => fileInput.current.click()}>
          <span className="md-empty-ic">
            <CloudArrowUp size={34} weight="duotone" />
          </span>
          <b>Kutubxona hozirça böş</b>
          <span>Rasmlarni şu yerga sudrab taşlang yoki bosing — PNG, JPG, SVG, WebP, 15 MB gaça</span>
        </button>
      ) : !shown.length ? (
        <p className="hm-empty">Mos fayl topilmadi.</p>
      ) : (
        groups.map(([month, list]) => (
          <section key={month} className="md-group">
            <h2>
              {month} <span>{list.length}</span>
            </h2>
            <div className="md-grid">
              {list.map((it, i) => {
                const on = picked.has(it.id)
                return (
                  <figure
                    key={it.id}
                    className={`md-item ${on ? 'picked' : ''} ${selecting ? 'selecting' : ''}`}
                    style={{ '--i': Math.min(i, 12) }}
                    onClick={() => (selecting ? togglePick(it.id) : setOpen(it.id))}
                  >
                    <img src={urlOf(it)} alt={it.name} loading="lazy" style={{ aspectRatio: `${it.w} / ${it.h}` }} />
                    {it.source === 'ai' && (
                      <span className="md-ai">
                        <Sparkle size={11} weight="fill" /> AI
                      </span>
                    )}
                    {selecting ? (
                      <span className="md-check">{on ? <CheckCircle size={24} weight="fill" /> : <Circle size={24} />}</span>
                    ) : (
                      <button
                        className={`md-star ${it.fav ? 'on' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          patch([it.id], { fav: !it.fav })
                        }}
                        aria-label={it.fav ? 'Sevimlilardan oliş' : 'Sevimlilarga qöşiş'}
                      >
                        <Star size={16} weight={it.fav ? 'fill' : 'bold'} />
                      </button>
                    )}
                    <figcaption>
                      <span>{it.name}</span>
                      {!selecting && (
                        <span className="md-acts">
                          <button onClick={(e) => { e.stopPropagation(); download(it, urlOf(it)) }} aria-label="Yuklab oliş">
                            <DownloadSimple size={15} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setOpen(it.id) }} aria-label="Kattalaştiriş">
                            <ArrowsOut size={15} />
                          </button>
                          <button className="del" onClick={(e) => { e.stopPropagation(); remove([it.id]) }} aria-label="Öçiriş" title="Öçiriş">
                            <Trash size={15} />
                          </button>
                        </span>
                      )}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </section>
        ))
      )}

      {/* ───── Bulk bar ───── */}
      {selecting && picked.size > 0 && (
        <div className="md-bulk" role="toolbar">
          <b>{picked.size} ta tanlandi</b>
          <button onClick={() => setPicked(new Set(shown.map((i) => i.id)))}>Hammasini</button>
          <span className="md-bulk-div" />
          <button onClick={() => patch(pickedIds, { fav: true })}>
            <Star size={15} /> Sevimli
          </button>
          <button onClick={() => items.filter((i) => picked.has(i.id)).forEach((i) => download(i, urlOf(i)))}>
            <DownloadSimple size={15} /> Yuklab oliş
          </button>
          <button className="danger" onClick={() => remove(pickedIds)}>
            <Trash size={15} /> Öçiriş
          </button>
        </div>
      )}

      {trash && !(selecting && picked.size > 0) && (
        <div className="md-bulk md-undo" role="status">
          <Trash size={16} />
          <b>{trash.items.length > 1 ? `${trash.items.length} ta fayl öçirildi` : 'Fayl öçirildi'}</b>
          <button onClick={undo}>Bekor qiliş</button>
          <span className="md-undo-bar" />
        </div>
      )}

      {drag && (
        <div className="md-drop" aria-hidden="true">
          <div>
            <CloudArrowUp size={44} weight="duotone" />
            <b>Rasmlarni şu yerga taşlang</b>
            <span>Ular kutubxonaga qöşiladi</span>
          </div>
        </div>
      )}

      {openItem && (
        <Viewer
          item={openItem}
          url={urlOf(openItem)}
          onClose={() => setOpen(null)}
          onFav={() => patch([openItem.id], { fav: !openItem.fav })}
          onDelete={() => {
            const next = shown[openIdx + 1] ?? shown[openIdx - 1]
            remove([openItem.id])
            setOpen(next?.id ?? null)
          }}
          onPrev={() => setOpen(shown[(openIdx - 1 + shown.length) % shown.length].id)}
          onNext={() => setOpen(shown[(openIdx + 1) % shown.length].id)}
        />
      )}
    </div>
  )
}
