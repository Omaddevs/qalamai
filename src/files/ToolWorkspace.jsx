// Full-screen workspace for one tool: pick files → set options → run with live
// progress → results (previews, downloads, before/after) → chain the next tool.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, X, Plus, DotsSixVertical, ArrowRight, DownloadSimple, NotePencil, FileDoc, CheckCircle, WarningCircle,
  ArrowCounterClockwise, Sparkle, CloudArrowUp, Crown, FileZip, ShieldCheck,
} from '@phosphor-icons/react'
import { ApiError, apiUrl, downloadFile, fetchFile, formatSize } from '../api.js'
import { addLocalFiles, runTool, runsHere } from './store.js'
import { blankDoc, importFile, loadDocs, saveDocs } from '../docs.js'
import { ToolIcon, Thumb } from './parts.jsx'
import OptionsForm from './OptionsForm.jsx'
import BgCompare from './BgCompare.jsx'
import { TOOL_UI, defaultsOf, suggest } from './toolMeta.js'
import { t } from '../i18n/index.js'

const ACCEPT = {
  pdf: '.pdf',
  image: '.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif,.tif,.tiff,.bmp,.svg',
  document: '.docx',
  spreadsheet: '.xlsx',
  presentation: '.pptx',
  text: '.txt,.md,.html,.htm,.csv',
}
/** Picker extensions for a tool that takes only some formats. */
const EXT_ALIASES = { jpg: '.jpg,.jpeg', heic: '.heic,.heif', html: '.html,.htm' }

function Ring({ value }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg className="tw-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={r} className="track" />
      <circle cx="60" cy="60" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
    </svg>
  )
}

function summaryLine(tool, job) {
  const r = job.result ?? {}
  if (r.before && r.after) return `${formatSize(r.before)} → ${formatSize(r.after)} · ${r.saved ? `−${r.saved}%` : t('tw.summary.saved')}`
  if (r.pages && tool.id === 'pdf-to-images') return t('tw.summary.images', { n: r.pages, dpi: r.dpi })
  if (r.slides) return t('tw.summary.slides', { n: r.slides })
  if (r.parts) return t('tw.summary.files', { n: r.parts })
  if (r.pages) return t('fs.pages', { n: r.pages })
  if (r.files) return t('tw.summary.files', { n: r.files })
  return ''
}

export default function ToolWorkspace({ tool, tools, initialFiles, notify, onClose, onSwitch, onEdit, onOpenDocs, onOpenPricing }) {
  const [files, setFiles] = useState(initialFiles)
  const [options, setOptions] = useState(() => defaultsOf(tool.options))
  const [phase, setPhase] = useState('setup') // setup | running | done | error
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [dropping, setDropping] = useState(false)
  const picker = useRef(null)
  const abort = useRef(null)
  const starting = useRef(false)
  const dragFrom = useRef(null)
  const ui = TOOL_UI[tool.id] ?? {}
  // the PDF editor opens one PDF (the server also takes images, but only as pages to insert)
  const accepts = tool.editor ? ['pdf'] : tool.accepts
  const maxFiles = tool.editor ? 1 : tool.maxFiles
  const multi = maxFiles > 1
  const accept = tool.exts ? tool.exts.map((e) => EXT_ALIASES[e] ?? `.${e}`).join(',') : accepts.map((k) => ACCEPT[k]).join(',')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && phase !== 'running' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, phase])
  useEffect(() => () => abort.current?.abort(), [])

  async function add(list) {
    const picked = [...list]
    if (!picked.length) return
    setUploading(0)
    try {
      const records = await addLocalFiles(picked, setUploading)
      const ok = records.filter((f) => accepts.includes(f.kind) && (!tool.exts || tool.exts.includes(f.ext)))
      if (ok.length < records.length) notify(t('tw.notFit', { name: tool.title }))
      setFiles((xs) => (multi ? [...xs, ...ok] : ok.slice(0, 1)).slice(0, maxFiles))
    } catch (err) {
      notify(err.message)
    } finally {
      setUploading(null)
    }
  }

  async function start() {
    // a quick double click lands twice before the button re-renders as disabled
    if (starting.current) return
    starting.current = true
    setPhase('running')
    setError(null)
    setJob({ progress: 0, stage: t('tw.queued') })
    abort.current = new AbortController()
    try {
      const clean = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined && v !== ''))
      const done = await runTool(tool.id, files, clean, { onUpdate: setJob, signal: abort.current.signal })
      setJob(done)
      setPhase('done')
    } catch (err) {
      if (err.name === 'AbortError') return setPhase('setup')
      setError(err)
      setPhase('error')
    } finally {
      starting.current = false
    }
  }

  async function openInDocs(out) {
    try {
      const file = await fetchFile(out)
      const { name, html } = await importFile(file)
      if (!saveDocs([blankDoc(name, html), ...loadDocs()])) throw new Error('quota')
      notify(t('tw.openedInDocs'))
      onOpenDocs()
    } catch {
      notify(t('tw.openDocFailed'))
    }
  }

  const outputs = job?.outputs ?? []
  const zipOut = outputs.find((o) => o.ext === 'zip')
  const singles = outputs.filter((o) => o.ext !== 'zip')
  const next = useMemo(() => (phase === 'done' && singles[0] ? suggest(tools, [singles[0]]).filter((t) => t.id !== tool.id).slice(0, 4) : []), [phase, singles, tools, tool.id])
  const canRun = files.length >= tool.minFiles && uploading === null
  const totalSize = files.reduce((s, f) => s + f.size, 0)
  const quota = error instanceof ApiError && error.code === 'QUOTA_EXCEEDED'

  return (
    <div className="tw-overlay" role="dialog" aria-modal="true" aria-label={tool.title}>
      <div className="tw">
        <header className="tw-head">
          <button className="fs-btn ghost" onClick={onClose} disabled={phase === 'running'}>
            <ArrowLeft size={16} weight="bold" /> {t('tw.back')}
          </button>
          <div className="tw-title">
            <ToolIcon id={tool.id} size={40} />
            <div>
              <h3>
                {tool.title}
                {ui.tag && <span className={`fs-tag ${ui.tag === 'AI' ? 'ai' : ''}`}>{ui.tag}</span>}
              </h3>
              <p>{tool.description}</p>
            </div>
          </div>
          <button className="fs-ibtn" onClick={onClose} disabled={phase === 'running'} aria-label={t('ui.close')}>
            <X size={18} />
          </button>
        </header>

        <div className="tw-body">
          <main
            className={`tw-main ${dropping ? 'drop' : ''}`}
            onDragOver={(e) => {
              if (phase !== 'setup') return
              e.preventDefault()
              setDropping(true)
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(e) => {
              if (phase !== 'setup') return
              e.preventDefault()
              setDropping(false)
              add(e.dataTransfer.files)
            }}
          >
            {phase === 'setup' &&
              (files.length === 0 ? (
                <button className="tw-pick" onClick={() => picker.current?.click()} disabled={uploading !== null}>
                  <span className="tw-pick-icon">
                    <CloudArrowUp size={40} weight="duotone" />
                  </span>
                  <b>{uploading !== null ? t('fs.uploadingPct', { n: Math.round(uploading * 100) }) : multi ? t('tw.pickMany') : t('tw.pickOne')}</b>
                  <span>{accept.replace(/\./g, '').toUpperCase().split(',').slice(0, 7).join(' · ')}</span>
                  {uploading !== null && (
                    <span className="fs-bar wide">
                      <i style={{ width: `${Math.max(4, uploading * 100)}%` }} />
                    </span>
                  )}
                </button>
              ) : (
                <div className="tw-files">
                  <div className="tw-files-head">
                    <b>
                      {t('tw.filesTotal', { n: files.length, size: formatSize(totalSize) })}
                    </b>
                    {multi && <small>{t('tw.dragOrder')}</small>}
                  </div>
                  <ol className={`tw-list ${multi ? 'multi' : 'single'}`}>
                    {files.map((f, i) => (
                      <li
                        key={f.id}
                        draggable={multi}
                        onDragStart={() => (dragFrom.current = i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const from = dragFrom.current
                          if (from === null || from === i) return
                          setFiles((xs) => {
                            const copy = [...xs]
                            const [m] = copy.splice(from, 1)
                            copy.splice(i, 0, m)
                            return copy
                          })
                          dragFrom.current = null
                        }}
                      >
                        {multi && (
                          <span className="tw-grip">
                            <DotsSixVertical size={16} weight="bold" />
                            <em>{i + 1}</em>
                          </span>
                        )}
                        <Thumb file={f} className={multi ? 'md' : 'lg'} />
                        <div className="tw-file-text">
                          <b title={f.name}>{f.name}</b>
                          <small>
                            {formatSize(f.size)}
                            {f.meta?.pages ? ` · ${t('fs.pages', { n: f.meta.pages })}` : ''}
                            {f.meta?.width ? ` · ${f.meta.width}×${f.meta.height}px` : ''}
                          </small>
                        </div>
                        <button className="fs-x" onClick={() => setFiles((xs) => xs.filter((x) => x.id !== f.id))} aria-label={t('fs.remove')}>
                          <X size={14} weight="bold" />
                        </button>
                      </li>
                    ))}
                    {multi && files.length < maxFiles && (
                      <li className="tw-add">
                        <button onClick={() => picker.current?.click()} disabled={uploading !== null}>
                          <Plus size={18} weight="bold" /> {uploading !== null ? `${Math.round(uploading * 100)}%` : t('tw.addFile')}
                        </button>
                      </li>
                    )}
                  </ol>
                  {!multi && (
                    <button className="fs-btn ghost tw-replace" onClick={() => picker.current?.click()}>
                      {t('tw.otherFile')}
                    </button>
                  )}
                </div>
              ))}

            {phase === 'running' && (
              <div className="tw-run">
                <div className="tw-ring-wrap">
                  <Ring value={job?.progress ?? 0} />
                  <div className="tw-ring-center">
                    <ToolIcon id={tool.id} size={46} />
                    <b>{job?.progress ?? 0}%</b>
                  </div>
                </div>
                <h4>{job?.stage ?? t('tw.running')}</h4>
                <p>{ui.tag === 'AI' ? t('tw.aiWorking') : t('tw.working')}</p>
                <button className="fs-btn ghost" onClick={() => abort.current?.abort()}>
                  {t('ui.cancel')}
                </button>
              </div>
            )}

            {phase === 'error' && (
              <div className="tw-error">
                <span className={`tw-error-icon ${quota ? 'gold' : ''}`}>{quota ? <Crown size={30} weight="fill" /> : <WarningCircle size={32} weight="duotone" />}</span>
                <h4>{quota ? t('tw.quota') : t('tw.failed')}</h4>
                <p>{error?.message}</p>
                <div className="tw-row">
                  {quota ? (
                    <button className="fs-btn dark" onClick={onOpenPricing}>
                      <Crown size={15} weight="fill" /> {t('tw.unlock')}
                    </button>
                  ) : (
                    <button className="fs-btn dark" onClick={start}>
                      <ArrowCounterClockwise size={15} weight="bold" /> {t('fs.retry')}
                    </button>
                  )}
                  <button className="fs-btn" onClick={() => setPhase('setup')}>
                    {t('tw.backSettings')}
                  </button>
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div className="tw-done">
                <div className="tw-done-head">
                  <span className="tw-check">
                    <CheckCircle size={30} weight="fill" />
                  </span>
                  <div>
                    <h4>{t('tw.ready')}</h4>
                    <p>{summaryLine(tool, job) || t('tw.downloadResult')}</p>
                  </div>
                  {zipOut && (
                    <button className="fs-btn dark" onClick={() => downloadFile(zipOut)}>
                      <FileZip size={16} weight="bold" /> {t('tw.zip')}
                    </button>
                  )}
                </div>

                {tool.id === 'image-remove-bg' ? (
                  <div className="tw-bg">
                    {singles.map((out, i) => (
                      <BgCompare key={out.id} original={files[i] ?? files[0]} result={out} notify={notify} />
                    ))}
                  </div>
                ) : (
                  <div className={`tw-outs ${singles.length > 2 ? 'grid' : ''}`}>
                    {singles.map((out) => (
                      <article key={out.id} className="tw-out">
                        {out.kind === 'image' ? (
                          <span className="tw-out-preview checker">
                            <img src={apiUrl(out.url)} alt="" loading="lazy" />
                          </span>
                        ) : (
                          <Thumb file={out} className="preview" />
                        )}
                        <div className="tw-out-body">
                          <b title={out.name}>{out.name}</b>
                          <small>
                            {formatSize(out.size)}
                            {out.meta?.pages ? ` · ${t('fs.pages', { n: out.meta.pages })}` : ''}
                            {out.meta?.width ? ` · ${out.meta.width}×${out.meta.height}` : ''}
                          </small>
                        </div>
                        <div className="tw-out-actions">
                          <button className="fs-btn dark" onClick={() => downloadFile(out)}>
                            <DownloadSimple size={16} weight="bold" /> {t('ui.download')}
                          </button>
                          {out.kind === 'pdf' && (
                            <button className="fs-btn" onClick={() => onEdit(out)}>
                              <NotePencil size={16} /> {t('tw.edit')}
                            </button>
                          )}
                          {out.ext === 'docx' && (
                            <button className="fs-btn" onClick={() => openInDocs(out)}>
                              <FileDoc size={16} /> {t('tw.openInEditor')}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>

          <aside className="tw-side">
            {phase === 'done' ? (
              <>
                <h4>{t('tw.nextStep')}</h4>
                {next.length ? (
                  <div className="tw-next">
                    {next.map((tl) => (
                      <button key={tl.id} onClick={() => onSwitch(tl, singles.slice(0, 1))}>
                        <ToolIcon id={tl.id} size={34} />
                        <span>
                          <b>{tl.title}</b>
                          <small>{tl.description}</small>
                        </span>
                        <ArrowRight size={15} weight="bold" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="of-none">{t('tw.noNext')}</p>
                )}
                <div className="tw-side-foot">
                  <button
                    className="fs-btn block"
                    onClick={() => {
                      setPhase('setup')
                      setJob(null)
                    }}
                  >
                    <ArrowCounterClockwise size={15} weight="bold" /> {t('tw.otherSettings')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4>{tool.editor ? t('tw.editor') : t('tw.settings')}</h4>
                {tool.editor ? (
                  <p className="of-none">{t('tw.editorHint')}</p>
                ) : (
                  <OptionsForm tool={tool.id} schema={tool.options} value={options} onChange={setOptions} />
                )}
                <div className="tw-side-foot">
                  {tool.editor ? (
                    <button className="fs-btn dark lg block" disabled={!files[0]} onClick={() => onEdit(files[0])}>
                      <NotePencil size={16} weight="bold" /> {t('tw.openInEditor')}
                    </button>
                  ) : (
                  <button className="fs-btn dark lg block" disabled={!canRun || phase === 'running'} onClick={start}>
                    {ui.tag === 'AI' && <Sparkle size={16} weight="fill" />}
                    {phase === 'running' ? t('tw.runningDots') : t('tw.start')} <ArrowRight size={16} weight="bold" />
                  </button>
                  )}
                  {files.length > 0 && runsHere(tool.id, files, options) && (
                    <small className="tw-device">
                      <ShieldCheck size={13} weight="fill" /> {t('tw.onDevice')}
                    </small>
                  )}
                  <small>{files.length < tool.minFiles ? (tool.minFiles > 1 ? t('tw.minFiles', { n: tool.minFiles }) : t('tw.pickFirst')) : t('tw.filesReady', { n: files.length })}</small>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
      <input ref={picker} type="file" hidden multiple={multi} accept={accept} onChange={(e) => { add(e.target.files); e.target.value = '' }} />
    </div>
  )
}
