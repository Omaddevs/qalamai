import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CloudArrowUp, X, ArrowRight, Sparkle, DownloadSimple, Trash, NotePencil, ShieldCheck, Lightning, FolderOpen, CheckCircle, CircleNotch,
} from '@phosphor-icons/react'
import { ApiError, downloadFile, formatSize, getTools, timeLeft } from '../api.js'
import { LOCAL_TOOLS, addLocalFiles, listFiles, removeFile } from './store.js'
import { COLORS } from '../data.js'
import { Offline, Thumb, ToolIcon } from './parts.jsx'
import FileEditorView from '../home/FileEditorView.jsx'
import { CATEGORIES, TOOL_ORDER, TOOL_UI, portraitTool, suggest } from './toolMeta.js'
import ToolWorkspace from './ToolWorkspace.jsx'
import PdfEditor from './PdfEditor.jsx'
import './files.css'
import { t } from '../i18n/index.js'

export const ACCEPT_ALL = '.pdf,.docx,.txt,.md,.html,.htm,.csv,.jpg,.jpeg,.png,.webp,.gif,.avif,.tif,.tiff,.bmp,.svg'

/* ───────── Hero with drop zone ───────── */

function Hero({ onPick, dragging }) {
  return (
    <section className={`fs-hero ${dragging ? 'drag' : ''}`}>
      <div className="fs-hero-copy">
        <span className="fs-pill">
          <Sparkle size={13} weight="fill" /> {t('fs.pill', { n: Object.keys(TOOL_UI).length })}
        </span>
        <h1>
          {t('fs.h1a')}<br />
          <em>{t('fs.h1b')}</em>
        </h1>
        <p>{t('fs.lead')}</p>
        <div className="fs-hero-cta">
          <button className="fs-btn light lg" onClick={onPick}>
            <CloudArrowUp size={19} weight="bold" /> {t('fs.pick')}
          </button>
          <span>{t('fs.orDrop')}</span>
        </div>
        <ul className="fs-hero-facts">
          <li>
            <Lightning size={14} weight="fill" /> {t('fs.fact1')}
          </li>
          <li>
            <ShieldCheck size={14} weight="fill" /> {t('fs.fact2')}
          </li>
          <li>
            <CheckCircle size={14} weight="fill" /> {t('fs.fact3')}
          </li>
        </ul>
      </div>

      {/* animated illustration: a PDF turning into DOCX + a photo losing its background */}
      <div className="fs-hero-art" aria-hidden="true">
        <div className="fs-art-glow" />
        <div className="fs-art-card a">
          <span className="fs-art-badge pdf">PDF</span>
          <i />
          <i />
          <i className="short" />
          <i />
          <i className="short" />
        </div>
        <div className="fs-art-arrow">
          <ArrowRight size={18} weight="bold" />
        </div>
        <div className="fs-art-card b">
          <span className="fs-art-badge doc">DOCX</span>
          <i className="h" />
          <i />
          <i />
          <i className="short" />
          <i />
        </div>
        <div className="fs-art-photo">
          <img className="fs-art-subject" src="/hero-person.webp" alt="" draggable="false" />
          <div className="fs-art-sweep" />
          <span className="fs-art-ai">
            <Sparkle size={11} weight="fill" /> {t('fs.bgRemoved')}
          </span>
        </div>
        <div className="fs-art-chips">
          {['JPG', 'PNG', 'WEBP', 'XLSX', 'PPTX'].map((x, i) => (
            <span key={x} style={{ animationDelay: `${i * 0.35}s` }}>
              {x}
            </span>
          ))}
        </div>
      </div>

      {dragging && (
        <div className="fs-hero-drop">
          <CloudArrowUp size={46} weight="duotone" />
          <b>{t('fs.dropHere')}</b>
          <span>{t('fs.dropSafe')}</span>
        </div>
      )}
    </section>
  )
}

/* ───────── Uploaded files + suggestions ───────── */

function Staged({ staged, tools, onRemove, onClear, onTool, onAdd }) {
  const ready = staged.filter((s) => s.record).map((s) => s.record)
  const busy = staged.some((s) => s.status === 'uploading')
  const picks = suggest(tools, ready)
  return (
    <section className="fs-staged">
      <div className="fs-staged-head">
        <div>
          <h2>{busy ? t('fs.uploading') : t('fs.whatDo')}</h2>
          <p>{busy ? t('fs.sending') : picks.length ? t('fs.bestPicks') : t('fs.noTool')}</p>
        </div>
        <div className="fs-staged-actions">
          <button className="fs-btn" onClick={onAdd}>
            {t('fs.addMore')}
          </button>
          <button className="fs-btn ghost" onClick={onClear}>
            {t('hx.clear')}
          </button>
        </div>
      </div>
      <div className="fs-chips">
        {staged.map((s) => (
          <div key={s.key} className={`fs-chip ${s.status}`}>
            {s.record ? <Thumb file={s.record} className="sm" /> : <span className="fs-thumb sm icon"><CircleNotch size={20} className="spin" /></span>}
            <div className="fs-chip-text">
              <b title={s.name}>{s.name}</b>
              <small>
                {s.status === 'error' ? (
                  <span className="err">{s.error}</span>
                ) : s.record ? (
                  <>
                    {formatSize(s.record.size)}
                    {s.record.meta?.pages ? ` · ${t('fs.pages', { n: s.record.meta.pages })}` : ''}
                    {s.record.meta?.width ? ` · ${s.record.meta.width}×${s.record.meta.height}` : ''}
                  </>
                ) : (
                  `${Math.round(s.progress * 100)}%`
                )}
              </small>
              {s.status === 'uploading' && (
                <span className="fs-bar">
                  <i style={{ width: `${Math.max(4, s.progress * 100)}%` }} />
                </span>
              )}
            </div>
            <button className="fs-x" onClick={() => onRemove(s.key)} aria-label={t('fs.remove')}>
              <X size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>
      {picks.length > 0 && !busy && (
        <div className="fs-suggest">
          {picks.slice(0, 6).map((tool, i) => (
            <button key={tool.id} className={`fs-sug ${i === 0 ? 'top' : ''}`} onClick={() => onTool(tool, ready)}>
              <ToolIcon id={tool.id} size={38} />
              <span>
                <b>{tool.title}</b>
                <small>{tool.description}</small>
              </span>
              <ArrowRight size={16} weight="bold" className="go" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/* ───────── Tool grid ───────── */

function ToolCard({ tool, onOpen }) {
  const ui = TOOL_UI[tool.id] ?? {}
  return (
    <button className={`fs-tool ${ui.hero ? 'hero' : ''} ${tool.soon ? 'soon' : ''}`} onClick={() => onOpen(tool)} style={{ '--tint': COLORS[ui.color ?? 'teal'].band, '--tone': COLORS[ui.color ?? 'teal'].to }}>
      <div className="fs-tool-top">
        <ToolIcon id={tool.id} />
        {tool.soon ? (
          <span className="fs-tag soon">{t('ui.soon')}</span>
        ) : (tool.available === false && !LOCAL_TOOLS.has(tool.id)) ? (
          <span className="fs-tag warn">{t('fs.notInstalled')}</span>
        ) : (
          ui.tag && <span className={`fs-tag ${ui.tag === 'AI' ? 'ai' : ''}`}>{ui.tag === 'AI' && <Sparkle size={10} weight="fill" />} {ui.tag}</span>
        )}
      </div>
      <b>{tool.title}</b>
      <p>{tool.description}</p>
      <div className="fs-tool-foot">
        <span className="fs-fmt">
          {ui.from} <ArrowRight size={10} weight="bold" /> {ui.to}
        </span>
        {!tool.soon && (
          <span className="fs-go">
            <ArrowRight size={15} weight="bold" />
          </span>
        )}
      </div>
    </button>
  )
}

/* ───────── My files ───────── */

function MyFiles({ notify, onEdit, onUse, refreshKey }) {
  const [files, setFiles] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = useCallback(() => {
    listFiles()
      .then((xs) => {
        setFiles(xs)
        setError(null)
      })
      .catch((e) => setError(e))
  }, [])
  useEffect(load, [load, refreshKey])

  if (error) return <Offline error={error} onRetry={load} />
  if (!files) return <div className="fs-loading"><CircleNotch size={26} className="spin" /></div>
  const shown = files.filter((f) => filter === 'all' || (filter === 'tool' ? f.source === 'tool' : f.source === 'upload'))

  return (
    <section className="fs-mine">
      <div className="fs-mine-head">
        <div className="fs-seg small">
          {[
            'all',
            'tool',
            'upload',
          ].map((id) => (
            <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {t(`fs.filter.${id}`)}
            </button>
          ))}
        </div>
        <span className="fs-mine-note">
          <ShieldCheck size={14} /> {t('fs.keepLocal')}
        </span>
      </div>
      {!shown.length ? (
        <div className="fs-empty">
          <FolderOpen size={40} weight="duotone" />
          <b>{t('fs.noFiles')}</b>
          <span>{t('fs.noFilesHint')}</span>
        </div>
      ) : (
        <div className="fs-files">
          {shown.map((f) => (
            <article key={f.id} className="fs-file">
              <Thumb file={f} />
              <div className="fs-file-body">
                <b title={f.name}>{f.name}</b>
                <small>
                  {formatSize(f.size)} · {f.source === 'tool' ? t('fs.result') : t('fs.uploaded')}
                  {f.meta?.pages ? ` · ${t('fs.pages', { n: f.meta.pages })}` : ''}
                </small>
                {f.local ? <small className="fs-ttl device">{t('fs.onDevice')}</small> : f.expiresAt && <small className="fs-ttl">{timeLeft(f.expiresAt)}</small>}
              </div>
              <div className="fs-file-actions">
                <button className="fs-ibtn" title={t('ui.download')} onClick={() => downloadFile(f)}>
                  <DownloadSimple size={17} />
                </button>
                {f.kind === 'pdf' && (
                  <button className="fs-ibtn" title={t('fs.openInPdf')} onClick={() => onEdit(f)}>
                    <NotePencil size={17} />
                  </button>
                )}
                <button className="fs-ibtn" title={t('fs.otherAction')} onClick={() => onUse(f)}>
                  <Lightning size={17} />
                </button>
                <button
                  className="fs-ibtn danger"
                  title={t('ui.delete')}
                  onClick={async () => {
                    await removeFile(f).catch(() => {})
                    setFiles((xs) => xs.filter((x) => x.id !== f.id))
                    notify(t('fs.deleted'))
                  }}
                >
                  <Trash size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

/* ───────── Page ───────── */

export default function FilesStudio({ notify, onOpenPricing, initialTab = 'tools' }) {
  const [tab, setTab] = useState(initialTab)
  const [tools, setTools] = useState([])
  const [toolsError, setToolsError] = useState(null)
  const [cat, setCat] = useState('all')
  const [staged, setStaged] = useState([])
  const [dragging, setDragging] = useState(false)
  const [workspace, setWorkspace] = useState(null)
  const [editing, setEditing] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const picker = useRef(null)
  const depth = useRef(0)

  const loadTools = useCallback(() => {
    setToolsError(null)
    getTools()
      .then((list) => setTools([...list, portraitTool()]))
      .catch(setToolsError)
  }, [])
  useEffect(loadTools, [loadTools])

  const ordered = useMemo(() => {
    const byId = new Map(tools.map((x) => [x.id, x]))
    return TOOL_ORDER.map((id) => byId.get(id)).filter(Boolean)
  }, [tools])
  const shown = ordered.filter((x) => cat === 'all' || x.category === cat)

  const addFiles = useCallback(
    async (list) => {
      const files = [...list]
      if (!files.length) return
      setTab('tools')
      const entries = files.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, name: f.name, status: 'uploading', progress: 0 }))
      setStaged((xs) => [...xs, ...entries])
      const keys = new Set(entries.map((e) => e.key))
      try {
        const records = await addLocalFiles(files, (p) => setStaged((xs) => xs.map((s) => (keys.has(s.key) ? { ...s, progress: p } : s))))
        setStaged((xs) => {
          let i = 0
          return xs.map((s) => (keys.has(s.key) ? { ...s, status: 'ready', progress: 1, record: records[i++] } : s))
        })
        setRefreshKey((k) => k + 1)
      } catch (err) {
        setStaged((xs) => xs.map((s) => (keys.has(s.key) ? { ...s, status: 'error', error: err.message } : s)))
        if (err instanceof ApiError && err.code === 'FILE_TOO_LARGE') notify(err.message)
      }
    },
    [notify],
  )

  // whole-page drag & drop on the tools tab
  useEffect(() => {
    if (tab !== 'tools' || workspace || editing) return
    const has = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')
    const enter = (e) => {
      if (!has(e)) return
      e.preventDefault()
      depth.current++
      setDragging(true)
    }
    const over = (e) => has(e) && e.preventDefault()
    const leave = (e) => {
      if (!has(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (!depth.current) setDragging(false)
    }
    const drop = (e) => {
      if (!has(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      addFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [tab, workspace, editing, addFiles])

  const openTool = (tool, files) => {
    if (tool.soon) return notify(`${tool.title} — ${t('ui.soon').toLowerCase()}`)
    if ((tool.available === false && !LOCAL_TOOLS.has(tool.id))) return notify(t('fs.engineMissing', { name: tool.title }))
    const usable = (files ?? staged.filter((s) => s.record).map((s) => s.record)).filter((f) => (tool.editor ? ['pdf'] : tool.accepts).includes(f.kind) && (!tool.exts || tool.exts.includes(f.ext)))
    if (tool.editor) {
      const pdf = usable.find((f) => f.kind === 'pdf')
      if (pdf) return setEditing(pdf)
    }
    setWorkspace({ tool, files: usable.slice(0, tool.editor ? 1 : tool.maxFiles) })
  }

  return (
    <div className="fs">
      <header className="fs-head">
        <div>
          <span className="fs-eyebrow">{t('fs.eyebrow')}</span>
          <h2 className="fs-title">{t('fs.title')}</h2>
        </div>
        <div className="fs-seg">
          {[
            'tools',
            'docs',
            'mine',
          ].map((id) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {t(`fs.tab.${id}`)}
            </button>
          ))}
        </div>
      </header>

      {tab === 'docs' && <FileEditorView notify={notify} />}

      {tab === 'mine' && <MyFiles notify={notify} refreshKey={refreshKey} onEdit={setEditing} onUse={(f) => { setStaged([{ key: f.id, name: f.name, status: 'ready', progress: 1, record: f }]); setTab('tools') }} />}

      {tab === 'tools' && (
        <>
          <Hero onPick={() => picker.current?.click()} dragging={dragging} />
          {staged.length > 0 && (
            <Staged
              staged={staged}
              tools={tools}
              onRemove={(key) => setStaged((xs) => xs.filter((s) => s.key !== key))}
              onClear={() => setStaged([])}
              onAdd={() => picker.current?.click()}
              onTool={openTool}
            />
          )}

          <div className="fs-cats">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
                {c.label}
                <span>{c.id === 'all' ? ordered.length : ordered.filter((x) => x.category === c.id).length}</span>
              </button>
            ))}
          </div>

          {toolsError ? (
            <Offline error={toolsError} onRetry={loadTools} />
          ) : !tools.length ? (
            <div className="fs-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="fs-tool skeleton" />
              ))}
            </div>
          ) : (
            <div className="fs-grid">
              {shown.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onOpen={openTool} />
              ))}
            </div>
          )}
        </>
      )}

      <input ref={picker} type="file" multiple hidden accept={ACCEPT_ALL} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />

      {workspace && (
        <ToolWorkspace
          key={workspace.tool.id}
          tool={workspace.tool}
          tools={tools}
          initialFiles={workspace.files}
          notify={notify}
          onOpenPricing={onOpenPricing}
          onClose={() => {
            setWorkspace(null)
            setRefreshKey((k) => k + 1)
          }}
          onSwitch={(tool, files) => openTool(tool, files)}
          onEdit={(f) => {
            setWorkspace(null)
            setEditing(f)
          }}
          onOpenDocs={() => {
            setWorkspace(null)
            setTab('docs')
          }}
        />
      )}
      {editing && (
        <PdfEditor
          key={editing.id}
          file={editing}
          notify={notify}
          onClose={() => {
            setEditing(null)
            setRefreshKey((k) => k + 1)
          }}
          onReopen={(f) => setEditing(f)}
        />
      )}
    </div>
  )
}
