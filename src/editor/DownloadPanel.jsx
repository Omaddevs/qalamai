// "Yuklab oliş" panel: file type, pages, per-format settings, then the file is made on this device
// (src/editor/exporter.jsx) and saved. Nothing goes to the server, nothing is printed.
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Crown, FileText, Film, Image as ImageIcon, Images, Loader2, Presentation, Printer, ShieldCheck } from 'lucide-react'
import { parsePageRange } from '../../server/src/converters/core/ranges.js'
import { openCoinShop } from '../coins.js'
import { t } from '../i18n/index.js'
import { saveBlob, supports } from './exporter.jsx'

const FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText, suggested: true },
  { id: 'pptx', label: 'PPTX', icon: Presentation },
  { id: 'mp4', label: 'MP4', icon: Film, motion: true, needs: 'mp4' },
  { id: 'jpg', label: 'JPG', icon: ImageIcon, image: true },
  { id: 'png', label: 'PNG', icon: ImageIcon, image: true },
  { id: 'svg', label: 'SVG', icon: ImageIcon, premium: true },
  { id: 'gif', label: 'GIF', icon: Images, motion: true },
  { id: 'webp', label: 'WebP', icon: ImageIcon, image: true, needs: 'webp' },
]

const KEY = 'qalamai.export.v1'
const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

/** "1-3, 5" → 0-based indexes, or null when it isn't a valid range for `total` pages. */
function customPages(text, total) {
  if (!/^\s*\d+\s*(-\s*\d+\s*)?(,\s*\d+\s*(-\s*\d+\s*)?)*$/.test(text)) return null
  const pages = parsePageRange(text, total)
  return pages.length ? pages : null
}

export default function DownloadPanel({ slides, theme, current, name, premium, beforeDownload, onPrint, notify, close }) {
  const saved = useMemo(loadSaved, [])
  const [format, setFormat] = useState(saved?.format ?? 'pdf')
  const [picking, setPicking] = useState(false)
  const [which, setWhich] = useState(saved?.which === 'custom' ? 'all' : saved?.which ?? 'all') // all | this | custom
  const [range, setRange] = useState('')
  const [seconds, setSeconds] = useState(saved?.seconds ?? 3)
  const [scale, setScale] = useState(saved?.scale ?? 1)
  const [remember, setRemember] = useState(Boolean(saved))
  const [busy, setBusy] = useState(null) // { done, total }

  const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0]
  const usable = (f) => !f.needs || supports[f.needs]()
  const locked = (f) => f.premium && !premium
  useEffect(() => {
    if (!usable(fmt) || locked(fmt)) setFormat('pdf')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = slides.length
  const indexes = which === 'this' ? [current] : which === 'custom' ? customPages(range, total) : slides.map((_, i) => i)
  const rangeBad = which === 'custom' && range.trim() !== '' && !indexes

  async function run() {
    if (!indexes?.length || busy) return
    if (remember) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ format, which, seconds, scale }))
      } catch {
        /* storage unavailable */
      }
    } else localStorage.removeItem(KEY)
    if (!(await beforeDownload())) return
    setBusy({ done: 0, total: indexes.length })
    try {
      const { exportDeck } = await import('./exporter.jsx')
      const { blob, name: file } = await exportDeck({
        format,
        slides,
        theme,
        indexes,
        name,
        watermark: !premium,
        scale: fmt.image ? scale : 1,
        seconds,
        onProgress: (done, all) => setBusy({ done, total: all }),
      })
      saveBlob(blob, file)
      notify(t('ex.done'))
      close()
    } catch (err) {
      console.error('export failed', err)
      notify(t('ex.failed'))
    } finally {
      setBusy(null)
    }
  }

  const Icon = fmt.icon
  return (
    <div className="ex" onKeyDown={(e) => e.key === 'Enter' && e.target.tagName === 'INPUT' && run()}>
      <div className="ex-head">{t('ex.title')}</div>

      <label className="ex-label">{t('ex.fileType')}</label>
      <div className="ex-select-wrap">
        <button type="button" className={`ex-select ${picking ? 'open' : ''}`} onClick={() => setPicking((p) => !p)} disabled={Boolean(busy)} aria-expanded={picking}>
          <Icon size={18} />
          <b>{fmt.label}</b>
          {fmt.suggested && <span className="ex-badge">{t('ex.suggested')}</span>}
          <ChevronDown size={18} className="ex-caret" />
        </button>
        {picking && (
          <div className="ex-list" role="listbox">
            {FORMATS.map((f) => {
              const FIcon = f.icon
              const off = !usable(f)
              return (
                <button
                  key={f.id}
                  type="button"
                  role="option"
                  aria-selected={f.id === format}
                  className={`ex-opt ${f.id === format ? 'on' : ''}`}
                  disabled={off}
                  onClick={() => {
                    if (locked(f)) {
                      notify(t('ex.svgPremium'))
                      return openCoinShop()
                    }
                    setFormat(f.id)
                    setPicking(false)
                  }}
                >
                  <FIcon size={20} />
                  <span className="ex-opt-text">
                    <span className="ex-opt-name">
                      {f.label}
                      {f.suggested && <span className="ex-badge">{t('ex.suggested')}</span>}
                      {f.premium && !premium && (
                        <span className="ex-crown" title={t('ex.svgPremium')}>
                          <Crown size={12} />
                        </span>
                      )}
                    </span>
                    <small>{off ? t('ex.unsupported') : t(`ex.${f.id}`)}</small>
                  </span>
                  {f.id === format && <Check size={18} className="ex-check" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {fmt.motion && (
        <>
          <label className="ex-label">{t('ex.duration')}</label>
          <div className="ex-seg">
            {[2, 3, 5, 8].map((s) => (
              <button key={s} type="button" className={seconds === s ? 'on' : ''} onClick={() => setSeconds(s)}>
                {t('ex.seconds', { n: s })}
              </button>
            ))}
          </div>
        </>
      )}

      {fmt.image && (
        <>
          <label className="ex-label">{t('ex.size')}</label>
          <div className="ex-seg">
            <button type="button" className={scale === 1 ? 'on' : ''} onClick={() => setScale(1)}>
              {t('ex.sizeStd')}
            </button>
            <button type="button" className={scale === 2 ? 'on' : ''} onClick={() => setScale(2)}>
              {t('ex.sizeHigh')}
            </button>
          </div>
        </>
      )}

      <label className="ex-label">{t('ex.pages')}</label>
      <div className="ex-seg">
        <button type="button" className={which === 'all' ? 'on' : ''} onClick={() => setWhich('all')}>
          {t('ex.all')}
        </button>
        <button type="button" className={which === 'this' ? 'on' : ''} onClick={() => setWhich('this')}>
          {t('ex.thisPage', { n: current + 1 })}
        </button>
        <button type="button" className={which === 'custom' ? 'on' : ''} onClick={() => setWhich('custom')}>
          {t('ex.custom')}
        </button>
      </div>
      {which === 'custom' && (
        <>
          <input className={`ex-range ${rangeBad ? 'bad' : ''}`} value={range} onChange={(e) => setRange(e.target.value)} placeholder={t('ex.rangeHint')} autoFocus inputMode="numeric" />
          {rangeBad && <small className="ex-err">{t('ex.rangeBad', { n: total })}</small>}
        </>
      )}

      <label className="ex-toggle">
        <span>{t('ex.remember')}</span>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <i aria-hidden="true" />
      </label>

      <button type="button" className="btn primary ex-go" onClick={run} disabled={!indexes?.length || Boolean(busy)}>
        {busy ? (
          <>
            <Loader2 size={16} className="spin" /> {t('ex.working', { done: busy.done, total: busy.total })}
          </>
        ) : (
          t('ex.download')
        )}
      </button>
      {busy && (
        <span className="ex-bar">
          <i style={{ width: `${Math.max(4, (busy.done / Math.max(1, busy.total)) * 100)}%` }} />
        </span>
      )}

      <p className="ex-note">
        <ShieldCheck size={14} /> {t('ex.onDevice')}
      </p>
      {!premium && (
        <div className="ex-wm">
          <Crown size={14} />
          <span>
            {t('ex.watermark')}{' '}
            <button
              type="button"
              onClick={() => {
                close()
                openCoinShop()
              }}
            >
              {t('ex.removeWm')}
            </button>
          </span>
        </div>
      )}
      <button
        type="button"
        className="ex-print"
        onClick={() => {
          close()
          onPrint()
        }}
        disabled={Boolean(busy)}
      >
        <Printer size={14} /> {t('ex.print')}
      </button>
    </div>
  )
}
