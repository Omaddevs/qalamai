import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FilePlus, FolderOpen, FileText, Trash, MagnifyingGlass, DownloadSimple, CaretDown, CheckCircle,
  TextB, TextItalic, TextUnderline, TextStrikethrough, ListBullets, ListNumbers, TextAlignLeft,
  TextAlignCenter, TextAlignRight, TextAlignJustify, ArrowCounterClockwise, ArrowClockwise, Eraser,
  Table, Quotes, TextAa, FilePdf, FileDoc, FileHtml, FileTxt, CloudArrowUp, Printer,
} from '@phosphor-icons/react'
import { Dropdown } from '../components/ui.jsx'
import { SCRIPTS, convert, detectScript } from '../lib/alifbo.js'
import { onSynced } from '../changes.js'
import { IMPORT_ACCEPT, blankDoc, exportDoc, importFile, loadDocs, sanitize, saveDocs } from '../docs.js'
import './fileeditor.css'

const BLOCKS = [
  ['p', 'Oddiy matn'],
  ['h1', 'Sarlavha 1'],
  ['h2', 'Sarlavha 2'],
  ['h3', 'Sarlavha 3'],
]

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
const when = (t) => {
  const d = new Date(t)
  const today = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toDateString() === today.toDateString() ? `Bugun, ${hm}` : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm}`
}

const A4_RATIO = 297 / 210
const A4_PAGE_PX = 1123 // A4 height at 96 dpi; the sheet is 794 px wide
const exec = (cmd, val = null) => document.execCommand(cmd, false, val)

function Tool({ icon: Icon, label, on, onClick }) {
  return (
    <button
      type="button"
      className={`fe-tool ${on ? 'on' : ''}`}
      // keep the text selection: act on mousedown, never take focus
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={label}
      aria-label={label}
      aria-pressed={on ?? undefined}
    >
      <Icon size={17} weight={on ? 'bold' : 'regular'} />
    </button>
  )
}

export default function FileEditorView({ notify }) {
  const [docs, setDocs] = useState(loadDocs)
  const [activeId, setActiveId] = useState(() => docs[0]?.id ?? null)
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState(true)
  const [fmt, setFmt] = useState({})
  const [stats, setStats] = useState({ words: 0, chars: 0, pages: 1 })
  const [drag, setDrag] = useState(false)
  const editor = useRef(null)
  const fileInput = useRef(null)
  const dragDepth = useRef(0)
  const saveTimer = useRef(null)

  const active = docs.find((d) => d.id === activeId) ?? null
  const activeRef = useRef(activeId)
  activeRef.current = activeId

  // persist (debounced)
  const persist = useCallback(
    (next) => {
      setSaved(false)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (saveDocs(next)) setSaved(true)
        else notify('Saqlab bölmadi — brauzer xotirasi tölgan')
      }, 500)
    },
    [notify],
  )
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  // documents changed on another device: take the stored list, but keep whatever is newer here
  // (an edit still inside the save debounce, or the open document if it vanished meanwhile)
  useEffect(
    () =>
      onSynced((got) => {
        if (!got.docs) return
        setDocs((prev) => {
          const stored = loadDocs()
          const byId = new Map(stored.map((d) => [d.id, d]))
          for (const p of prev) {
            const s = byId.get(p.id)
            if (s ? p.updatedAt > s.updatedAt : p.id === activeRef.current) byId.set(p.id, p)
          }
          return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
        })
      }),
    [],
  )

  const update = useCallback(
    (id, change) =>
      setDocs((xs) => {
        const next = xs.map((d) => (d.id === id ? { ...d, ...change, updatedAt: Date.now() } : d))
        persist(next)
        return next
      }),
    [persist],
  )

  const add = (doc) => {
    setDocs((xs) => {
      const next = [doc, ...xs]
      persist(next)
      return next
    })
    setActiveId(doc.id)
  }

  const remove = (id) => {
    const d = docs.find((x) => x.id === id)
    if (!window.confirm(`«${d.name}» öçirilsinmi?`)) return
    const next = docs.filter((x) => x.id !== id)
    setDocs(next)
    persist(next)
    if (id === activeId) setActiveId(next[0]?.id ?? null)
    notify('Hujjat öçirildi')
  }

  const open = async (files) => {
    for (const f of [...files]) {
      try {
        const { name, html } = await importFile(f)
        add(blankDoc(name, html))
        notify(`«${f.name}» oçildi`)
      } catch {
        notify(`«${f.name}» oçilmadi — DOCX, TXT, MD yoki HTML fayl tanlang`)
      }
    }
  }

  // fill the editor only when switching documents (it is uncontrolled while typing)
  useEffect(() => {
    if (editor.current && active) {
      editor.current.innerHTML = active.html
      measure()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Generated documents mark page ends with <hr class="pb">. On a true-A4-width sheet, pad each
  // break so the next page starts exactly at the next sheet's top margin (where print puts it).
  const alignBreaks = (el) => {
    const breaks = el.querySelectorAll('hr.pb')
    breaks.forEach((hr) => hr.style.removeProperty('margin-bottom'))
    if (el.offsetWidth < 790) return
    const top = parseFloat(getComputedStyle(el).paddingTop) || 0
    breaks.forEach((hr) => {
      const bottom = hr.offsetTop + hr.offsetHeight
      const next = Math.ceil(bottom / A4_PAGE_PX) * A4_PAGE_PX + top
      hr.style.marginBottom = `${Math.max(24, next - bottom)}px`
    })
  }

  const measure = () => {
    const el = editor.current
    if (!el) return
    alignBreaks(el)
    const text = el.innerText.trim()
    const pageH = el.offsetWidth * A4_RATIO
    setStats({
      words: text ? text.split(/\s+/).length : 0,
      chars: text.length,
      pages: Math.max(1, Math.ceil(el.scrollHeight / pageH)),
    })
  }

  const onInput = () => {
    if (!active) return
    update(active.id, { html: editor.current.innerHTML })
    measure()
  }

  useEffect(() => {
    const again = () => measure()
    window.addEventListener('resize', again)
    document.fonts?.ready.then(again)
    return () => window.removeEventListener('resize', again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // toolbar state follows the caret
  useEffect(() => {
    const read = () => {
      const sel = document.getSelection()
      if (!editor.current || !sel?.anchorNode || !editor.current.contains(sel.anchorNode)) return
      setFmt({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        left: document.queryCommandState('justifyLeft'),
        center: document.queryCommandState('justifyCenter'),
        right: document.queryCommandState('justifyRight'),
        full: document.queryCommandState('justifyFull'),
        block: (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, ''),
      })
    }
    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [])

  const run = (cmd, val) => {
    editor.current?.focus()
    exec(cmd, val)
    onInput()
  }

  const setBlock = (tag) => run('formatBlock', `<${tag}>`)

  const insertTable = () => {
    const cells = (tag) => Array.from({ length: 3 }, () => `<${tag}><br></${tag}>`).join('')
    run('insertHTML', `<table><thead><tr>${cells('th')}</tr></thead><tbody><tr>${cells('td')}</tr><tr>${cells('td')}</tr></tbody></table><p><br></p>`)
  }

  // Whole-document script conversion through execCommand so Ctrl+Z can undo it.
  const toScript = (to) => {
    const el = editor.current
    if (!el) return
    const from = detectScript(el.innerText)
    if (from === to) return notify('Hujjat allaqaçon şu alifboda')
    const clone = el.cloneNode(true)
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = convert(n.nodeValue, from, to)
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = document.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    exec('insertHTML', clone.innerHTML)
    onInput()
    notify(`${SCRIPTS.find((s) => s.id === to).label} alifbosiga ötkazildi · Ctrl+Z — bekor qiliş`)
  }

  // paste: keep structure, drop foreign styles and anything unsafe
  const onPaste = (e) => {
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    e.preventDefault()
    if (html) exec('insertHTML', sanitize(html))
    else exec('insertText', text)
    onInput()
  }

  const doExport = (format) => {
    if (!active) return
    const ok = exportDoc({ ...active, html: editor.current.innerHTML }, format)
    if (ok === false) notify('Brauzer yangi oynani blokladi — ruxsat bering')
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? docs.filter((d) => d.name.toLowerCase().includes(needle)) : docs
  }, [docs, q])

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
    onDragOver: (e) => {
      if ([...e.dataTransfer.types].includes('Files')) e.preventDefault()
    },
    onDrop: (e) => {
      if (!e.dataTransfer.files.length) return
      e.preventDefault()
      dragDepth.current = 0
      setDrag(false)
      open(e.dataTransfer.files)
    },
  }

  return (
    <div className="fe" {...dnd}>
      <input ref={fileInput} type="file" accept={IMPORT_ACCEPT} multiple hidden onChange={(e) => { open(e.target.files); e.target.value = '' }} />

      {/* ───── Documents list ───── */}
      <aside className="fe-side">
        <div className="fe-side-head">
          <h2>
            <FileText size={18} weight="duotone" /> Hujjatlar
          </h2>
          <span>{docs.length}</span>
        </div>
        <div className="fe-side-actions">
          <button className="fe-btn dark" onClick={() => add(blankDoc())}>
            <FilePlus size={16} weight="duotone" /> Yangi
          </button>
          <button className="fe-btn" onClick={() => fileInput.current.click()}>
            <FolderOpen size={16} weight="duotone" /> Oçiş
          </button>
        </div>
        {docs.length > 4 && (
          <label className="fe-search">
            <MagnifyingGlass size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidiriş" />
          </label>
        )}
        <div className="fe-list">
          {shown.map((d) => (
            <div key={d.id} className={`fe-doc ${d.id === activeId ? 'on' : ''}`}>
              <button className="fe-doc-main" onClick={() => setActiveId(d.id)}>
                <span className="fe-doc-ic">
                  <FileText size={18} weight={d.id === activeId ? 'duotone' : 'regular'} />
                </span>
                <span className="fe-doc-text">
                  <b>{d.name}</b>
                  <small>{when(d.updatedAt)}</small>
                </span>
              </button>
              <button className="fe-doc-del" onClick={() => remove(d.id)} aria-label="Öçiriş">
                <Trash size={15} />
              </button>
            </div>
          ))}
          {!docs.length && <p className="fe-list-empty">Hali hujjat yöq</p>}
        </div>
        <p className="fe-formats">DOCX · TXT · MD · HTML oçiladi</p>
      </aside>

      {/* ───── Editor ───── */}
      <section className="fe-main">
        {!active ? (
          <button className="fe-empty" onClick={() => fileInput.current.click()}>
            <span className="fe-empty-ic">
              <CloudArrowUp size={36} weight="duotone" />
            </span>
            <b>Faylni oçing yoki şu yerga taşlang</b>
            <span>Word (DOCX), matn (TXT), Markdown va HTML fayllarni tahrirlang — keyin PDF yoki Word qilib yuklab oling.</span>
            <span className="fe-empty-or">
              yoki{' '}
              <u
                onClick={(e) => {
                  e.stopPropagation()
                  add(blankDoc())
                }}
              >
                böş hujjat yarating
              </u>
            </span>
          </button>
        ) : (
          <>
            <div className="fe-top">
              <input
                className="fe-name"
                value={active.name}
                onChange={(e) => update(active.id, { name: e.target.value })}
                onBlur={(e) => !e.target.value.trim() && update(active.id, { name: 'Nomsiz hujjat' })}
                aria-label="Hujjat nomi"
              />
              <span className={`fe-saved ${saved ? 'ok' : ''}`}>
                <CheckCircle size={14} weight="fill" /> {saved ? 'Saqlandi' : 'Saqlanmoqda…'}
              </span>
              <div className="fe-top-right">
                <Dropdown
                  align="right"
                  button={({ toggle }) => (
                    <button className="fe-btn" onClick={toggle}>
                      <TextAa size={16} /> Alifbo <CaretDown size={12} />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <div className="pop-label">Butun hujjatni ötkaziş</div>
                      {SCRIPTS.map((s) => (
                        <button key={s.id} className="menu-item" onClick={() => { close(); toScript(s.id) }}>
                          {s.label}
                        </button>
                      ))}
                    </>
                  )}
                </Dropdown>
                <Dropdown
                  align="right"
                  button={({ toggle }) => (
                    <button className="fe-btn dark" onClick={toggle}>
                      <DownloadSimple size={16} /> Yuklab oliş <CaretDown size={12} />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <div className="pop-label">Format</div>
                      {[
                        ['pdf', 'PDF / çop etiş', FilePdf],
                        ['word', 'Word (.doc)', FileDoc],
                        ['html', 'Veb sahifa (.html)', FileHtml],
                        ['txt', 'Oddiy matn (.txt)', FileTxt],
                      ].map(([id, label, Icon]) => (
                        <button key={id} className="menu-item fe-menu" onClick={() => { close(); doExport(id) }}>
                          <span>
                            <Icon size={17} weight="duotone" /> {label}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* toolbar */}
            <div className="fe-toolbar" role="toolbar" aria-label="Formatlaş">
              <Tool icon={ArrowCounterClockwise} label="Bekor qiliş (Ctrl+Z)" onClick={() => run('undo')} />
              <Tool icon={ArrowClockwise} label="Qaytariş (Ctrl+Y)" onClick={() => run('redo')} />
              <span className="fe-sep" />
              <select
                className="fe-block"
                value={BLOCKS.some(([t]) => t === fmt.block) ? fmt.block : 'p'}
                onChange={(e) => setBlock(e.target.value)}
                aria-label="Matn turi"
              >
                {BLOCKS.map(([t, l]) => (
                  <option key={t} value={t}>
                    {l}
                  </option>
                ))}
              </select>
              <span className="fe-sep" />
              <Tool icon={TextB} label="Qalin (Ctrl+B)" on={fmt.bold} onClick={() => run('bold')} />
              <Tool icon={TextItalic} label="Kursiv (Ctrl+I)" on={fmt.italic} onClick={() => run('italic')} />
              <Tool icon={TextUnderline} label="Tagiga çiziş (Ctrl+U)" on={fmt.underline} onClick={() => run('underline')} />
              <Tool icon={TextStrikethrough} label="Ustidan çiziş" on={fmt.strike} onClick={() => run('strikeThrough')} />
              <span className="fe-sep" />
              <Tool icon={TextAlignLeft} label="Çapga" on={fmt.left} onClick={() => run('justifyLeft')} />
              <Tool icon={TextAlignCenter} label="Markazga" on={fmt.center} onClick={() => run('justifyCenter')} />
              <Tool icon={TextAlignRight} label="Öngga" on={fmt.right} onClick={() => run('justifyRight')} />
              <Tool icon={TextAlignJustify} label="Ikki tomonga" on={fmt.full} onClick={() => run('justifyFull')} />
              <span className="fe-sep" />
              <Tool icon={ListBullets} label="Belgili röyxat" on={fmt.ul} onClick={() => run('insertUnorderedList')} />
              <Tool icon={ListNumbers} label="Raqamli röyxat" on={fmt.ol} onClick={() => run('insertOrderedList')} />
              <Tool icon={Quotes} label="Iqtibos" onClick={() => run('formatBlock', '<blockquote>')} />
              <Tool icon={Table} label="Jadval (3×3)" onClick={insertTable} />
              <span className="fe-sep" />
              <Tool icon={Eraser} label="Formatni tozalaş" onClick={() => { run('removeFormat'); setBlock('p') }} />
              <Tool icon={Printer} label="Çop etiş" onClick={() => doExport('pdf')} />
            </div>

            {/* A4 sheet */}
            <div className="fe-desk">
              <div
                ref={editor}
                className="fe-page"
                contentEditable
                suppressContentEditableWarning
                spellCheck
                lang="uz"
                onInput={onInput}
                onPaste={onPaste}
                data-placeholder="Yozişni boşlang…"
              />
            </div>

            <div className="fe-status">
              <span>{stats.words} söz</span>
              <span>{stats.chars} belgi</span>
              <span>~{stats.pages} sahifa</span>
              <span className="fe-status-std">A4 · Times New Roman 14 · interval 1.5</span>
            </div>
          </>
        )}
      </section>

      {drag && (
        <div className="md-drop fe-drop" aria-hidden="true">
          <div>
            <CloudArrowUp size={44} weight="duotone" />
            <b>Faylni şu yerga taşlang</b>
            <span>DOCX, TXT, MD yoki HTML — tahrirlaş uçun oçiladi</span>
          </div>
        </div>
      )}
    </div>
  )
}
