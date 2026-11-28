import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Download, FileText, Upload, X, Loader2 } from 'lucide-react'
import { SCRIPTS } from '../lib/alifbo.js'
import { readDocx, convertDocx } from '../lib/alifboDocx.js'
import { t } from '../i18n/index.js'

// Word file → chosen alphabet → download. Everything happens in the browser; the file never leaves the device.
export default function AlifboDocx() {
  const inputRef = useRef(null)
  const [doc, setDoc] = useState(null) // result of readDocx()
  const [from, setFrom] = useState('auto')
  const [to, setTo] = useState('new')
  const [result, setResult] = useState(null) // { blob, fileName, words }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)

  const source = doc ? (from === 'auto' ? doc.detected : from) : null
  const label = (id) => SCRIPTS.find((s) => s.id === id).label

  const open = async (file) => {
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      setDoc(await readDocx(file))
    } catch (e) {
      setDoc(null)
      setError(t(`av.doc.err.${e.code || 'read'}`))
    } finally {
      setBusy(false)
    }
  }

  // re-convert whenever the file or the scripts change (reading is done once, so this is quick)
  useEffect(() => {
    if (!doc) return
    let alive = true
    setBusy(true)
    setResult(null)
    convertDocx(doc, source, to, label(to))
      .then((r) => alive && setResult(r))
      .catch(() => alive && setError(t('av.doc.err.read')))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [doc, source, to])

  const download = () => {
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const reset = () => {
    setDoc(null)
    setResult(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    open(e.dataTransfer.files?.[0])
  }

  return (
    <div className="avd">
      <div className="avd-head">
        <div>
          <h2 className="avd-title">{t('av.doc.title')}</h2>
          <p className="avd-sub">{t('av.doc.sub')}</p>
        </div>
      </div>

      <div className="conv-bar">
        <div className="seg">
          <button className={from === 'auto' ? 'on' : ''} onClick={() => setFrom('auto')}>
            {t('av.auto')}
          </button>
          {SCRIPTS.map((s) => (
            <button key={s.id} className={from === s.id ? 'on' : ''} onClick={() => setFrom(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <ArrowLeftRight size={16} className="avd-arrow" aria-hidden="true" />
        <div className="seg">
          {SCRIPTS.map((s) => (
            <button key={s.id} className={to === s.id ? 'on' : ''} onClick={() => setTo(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => open(e.target.files?.[0])}
      />

      {!doc ? (
        <button
          type="button"
          className={`avd-drop${drag ? ' on' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          disabled={busy}
        >
          {busy ? <Loader2 size={22} className="avd-spin" /> : <Upload size={22} />}
          <b>{busy ? t('av.doc.working') : t('av.doc.drop')}</b>
          <span>{t('av.doc.hint')}</span>
        </button>
      ) : (
        <div className="avd-file">
          <span className="avd-ic">
            <FileText size={20} />
          </span>
          <div className="avd-meta">
            <b title={doc.name}>{doc.name}</b>
            <span>
              {from === 'auto' && `${t('av.detected', { name: label(doc.detected) })} · `}
              {busy
                ? t('av.doc.working')
                : result && (source === to || !result.words ? t('av.doc.same', { name: label(to) }) : t('av.doc.done', { n: result.words }))}
            </span>
          </div>
          <button className="btn primary avd-dl" onClick={download} disabled={!result || busy}>
            {busy ? <Loader2 size={15} className="avd-spin" /> : <Download size={15} />}
            {t('av.doc.download')}
          </button>
          <button className="icon-btn" onClick={reset} aria-label={t('av.doc.other')} title={t('av.doc.other')}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && <p className="avd-err">{error}</p>}
    </div>
  )
}
