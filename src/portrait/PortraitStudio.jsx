// Portrait studio: a selfie → a studio portrait or document photo, entirely on the device.
// Pick a photo → the worker finds the face and cuts the person out → choose clothes, backdrop,
// format and retouch with a live preview → download (JPG, PNG, or a 10×15 print sheet).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, X, CloudArrowUp, ShieldCheck, Sparkle, DownloadSimple, ArrowCounterClockwise, UserFocus, TShirt, Palette, Crop,
  MagicWand, Printer, Eye, CheckCircle, WarningCircle, Image as ImageIcon, MagnifyingGlassPlus, Hand,
} from '@phosphor-icons/react'
import { t } from '../i18n/index.js'
import { analyzePhoto, compose, exportImage, exportSheet, outputSize } from './render.js'
import { FORMATS, framing } from './core.js'
import { JACKETS, KNITS, OUTFITS, SHIRTS, TIES, TOPS, outfitSvg } from './outfits.js'
import { BACKDROPS, backdropCss } from './backdrops.js'
import './portrait.css'

const OUTFIT_ORDER = ['suit', 'suitOpen', 'blazerKnit', 'turtleneck', 'shirt', 'blazerTop', 'keep']
const STUDIO_BGS = ['studio', 'charcoal', 'white', 'cream', 'blue', 'navy', 'green', 'brand']
const DOC_BGS = ['docWhite', 'docBlue', 'docGrey']
const FORMAT_ORDER = ['portrait', 'square', 'social', 'doc3x4', 'doc35x45']
const TONE0 = { auto: true, smooth: 35, brightness: 0, warmth: 0, contrast: 0, sharp: 20 }
const CHOICE0 = {
  outfit: 'suit', jacket: 'navy', shirt: 'white', tie: 'burgundy', knit: 'black', top: 'white',
  bg: 'studio', custom: '#4a6fa5', format: 'portrait', zoom: 1, dx: 0, dy: 0, tone: TONE0, hairFront: false,
}
const PARTS = { jacket: JACKETS, shirt: SHIRTS, tie: TIES, knit: KNITS, top: TOPS }

/* ───────── outfit thumbnails: the real outfit drawing on a stand-in body ───────── */

const STAND_IN = { S: 3, nw: 0.78, neckEnd: 1.6, neckEnds: null }
const thumbs = new Map()
function outfitThumb(id, colors) {
  const key = id + JSON.stringify(colors)
  if (thumbs.has(key)) return thumbs.get(key)
  const W = 120
  const tf = { tx: 60, ty: 58, k: 12.5 }
  const svg = outfitSvg(STAND_IN, { outfit: id, ...colors, skin: '#d9b59b' }, W, W, tf)
  const head = `<g transform="translate(${tf.tx},${tf.ty}) scale(${tf.k})"><rect x="-0.8" y="-0.6" width="1.6" height="2.2" fill="#d9b59b"/><ellipse cx="0" cy="-1.75" rx="1.45" ry="1.95" fill="#e2c0a6"/><path d="M-1.5,-2.3 Q-1.4,-3.9 0,-3.85 Q1.45,-3.9 1.5,-2.3 Q1.1,-3.1 0,-3.05 Q-1.1,-3.1 -1.5,-2.3 Z" fill="#3b2d24"/></g>`
  const doc = svg
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${svg.back}${head}${svg.front}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${head}</svg>`
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`
  thumbs.set(key, url)
  return url
}

/* ───────── small controls ───────── */

function Slider({ label, value, min, max, onChange, suffix = '' }) {
  return (
    <label className="pt-slider">
      <span>
        {label}
        <b>
          {value > 0 && min < 0 ? '+' : ''}
          {value}
          {suffix}
        </b>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Swatches({ part, value, onChange, none }) {
  const colors = PARTS[part]
  return (
    <div className="pt-group">
      <h5>{t(`pt.part.${part}`)}</h5>
      <div className="pt-swatches">
        {none && (
          <button className={`pt-sw none ${value === 'none' ? 'on' : ''}`} title={t('pt.noTie')} aria-label={t('pt.noTie')} onClick={() => onChange('none')}>
            <X size={14} weight="bold" />
          </button>
        )}
        {Object.entries(colors).map(([k, c]) => (
          <button key={k} className={`pt-sw ${value === k ? 'on' : ''}`} style={{ background: c }} title={t(`pt.c.${k}`)} aria-label={t(`pt.c.${k}`)} onClick={() => onChange(k)} />
        ))}
      </div>
    </div>
  )
}

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

const download = (blob, name) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/* ───────── page ───────── */

export default function PortraitStudio({ initialFile, notify, onClose }) {
  const [phase, setPhase] = useState('pick') // pick | busy | edit | error
  const [progress, setProgress] = useState({ pct: 0, stage: 'load' })
  const [error, setError] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [choice, setChoice] = useState(CHOICE0)
  const [tab, setTab] = useState('outfit')
  const [comparing, setComparing] = useState(false)
  const [busyExport, setBusyExport] = useState(null)
  const [dropping, setDropping] = useState(false)
  const [rendering, setRendering] = useState(false)
  const picker = useRef(null)
  const canvas = useRef(null)
  const stage = useRef(null)
  const drag = useRef(null)
  const renderState = useRef({ running: false, again: false })
  const latest = useRef({ analysis: null, choice })
  latest.current = { analysis, choice }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busyExport && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, busyExport])
  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl])

  const start = useCallback(async (file) => {
    if (!file) return
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|avif|bmp|gif)$/i.test(file.name ?? '')) return notify?.(t('pt.err.BAD_IMAGE'))
    setPhotoUrl(URL.createObjectURL(file))
    setPhase('busy')
    setError(null)
    setProgress({ pct: 1, stage: 'load' })
    try {
      const a = await analyzePhoto(file, (pct, stage, n) => setProgress({ pct, stage, n }))
      setAnalysis(a)
      setChoice((c) => ({ ...c, zoom: 1, dx: 0, dy: 0, hairFront: a.longHair }))
      setPhase('edit')
    } catch (err) {
      setError(err.code ?? 'FAILED')
      setPhase('error')
    }
  }, [notify])

  useEffect(() => {
    if (initialFile) start(initialFile)
    // only the file the studio was opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* live preview: one render at a time; changes during a render trigger one more */
  const draw = useCallback(async () => {
    const st = renderState.current
    if (st.running) return void (st.again = true)
    st.running = true
    setRendering(true)
    try {
      do {
        st.again = false
        const { analysis: a, choice: c } = latest.current
        if (!a || !canvas.current) break
        const box = stage.current?.getBoundingClientRect()
        const side = Math.min(1400, Math.round(Math.max(box?.width ?? 600, box?.height ?? 800) * Math.min(2, window.devicePixelRatio || 1)))
        await compose(a, c, canvas.current, side)
      } while (st.again)
    } catch (err) {
      console.error('portrait render:', err)
    } finally {
      st.running = false
      setRendering(false)
    }
  }, [])
  useEffect(() => {
    if (phase === 'edit') draw()
  }, [phase, choice, draw])

  const set = (patch) => setChoice((c) => ({ ...c, ...patch }))
  const setTone = (patch) => setChoice((c) => ({ ...c, tone: { ...c.tone, ...patch } }))
  const setFormat = (format) =>
    setChoice((c) => {
      const doc = FORMATS[format].print
      const wasDoc = FORMATS[c.format].print
      // document formats want a plain backdrop; leaving them brings the studio back
      const bg = doc && !wasDoc && !DOC_BGS.includes(c.bg) ? 'docWhite' : !doc && wasDoc && DOC_BGS.includes(c.bg) ? 'studio' : c.bg
      return { ...c, format, bg, zoom: 1, dx: 0, dy: 0 }
    })

  /* drag to move, wheel / slider to zoom */
  const pxPerD = () => {
    const a = analysis
    const r = canvas.current?.getBoundingClientRect()
    if (!a || !r) return 1
    return (a.g.d * r.width) / framing(a.g, choice.format, choice.zoom).width
  }
  const onPointerDown = (e) => {
    if (phase !== 'edit') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, dx: choice.dx, dy: choice.dy, k: pxPerD() }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    set({ dx: Math.max(-3, Math.min(3, d.dx + (e.clientX - d.x) / d.k)), dy: Math.max(-4, Math.min(4, d.dy + (e.clientY - d.y) / d.k)) })
  }
  const onPointerUp = () => (drag.current = null)
  const onWheel = (e) => {
    if (phase !== 'edit') return
    set({ zoom: Math.max(0.6, Math.min(1.8, choice.zoom * Math.exp(-e.deltaY * 0.0012))) })
  }

  async function save(kind) {
    if (!analysis || busyExport) return
    setBusyExport(kind)
    try {
      const base = `qalam-portret-${choice.format}`
      if (kind === 'sheet') {
        const { blob } = await exportSheet(analysis, choice)
        download(blob, `${base}-10x15.jpg`)
      } else {
        const blob = await exportImage(analysis, choice, kind === 'png' ? 'image/png' : 'image/jpeg')
        download(blob, `${base}.${kind === 'png' ? 'png' : 'jpg'}`)
      }
      notify?.(t('pt.saved'))
    } catch (err) {
      console.error('portrait export:', err)
      notify?.(t('pt.saveFailed'))
    } finally {
      setBusyExport(null)
    }
  }

  const outfit = OUTFITS[choice.outfit]
  const isDoc = FORMATS[choice.format].print
  const sheetCount = useMemo(() => {
    const f = FORMATS[choice.format]
    if (!f.print) return 0
    return Math.floor(155 / (f.mm[0] + 3)) * Math.floor(105 / (f.mm[1] + 3))
  }, [choice.format])
  const [ow, oh] = outputSize(choice.format)
  const stageText = progress.stage === 'model' ? t('pt.stage.model', { n: progress.n ?? 0 }) : t(`pt.stage.${progress.stage}`)

  return (
    <div className="tw-overlay" role="dialog" aria-modal="true" aria-label={t('pt.title')}>
      <div className="tw pt">
        <header className="tw-head">
          <button className="fs-btn ghost" onClick={onClose} disabled={!!busyExport}>
            <ArrowLeft size={16} weight="bold" /> <span className="pt-hide-s">{t('tw.back')}</span>
          </button>
          <div className="tw-title">
            <span className="pt-logo">
              <UserFocus size={22} weight="duotone" />
            </span>
            <div>
              <h3>
                {t('pt.title')}
                <span className="fs-tag ai">AI</span>
              </h3>
              <p>{t('pt.desc')}</p>
            </div>
          </div>
          <span className="pt-private pt-hide-s">
            <ShieldCheck size={14} weight="fill" /> {t('pt.private')}
          </span>
          <button className="fs-ibtn" onClick={onClose} disabled={!!busyExport} aria-label={t('ui.close')}>
            <X size={18} />
          </button>
        </header>

        <div className={`tw-body ${phase === 'edit' ? '' : 'pt-solo'}`}>
          <main
            className={`tw-main pt-main ${dropping ? 'drop' : ''}`}
            onDragOver={(e) => {
              if (phase === 'busy') return
              e.preventDefault()
              setDropping(true)
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(e) => {
              if (phase === 'busy') return
              e.preventDefault()
              setDropping(false)
              start(e.dataTransfer.files?.[0])
            }}
          >
            {phase === 'pick' && (
              <div className="pt-pick">
                <button className="tw-pick pt-pick-btn" onClick={() => picker.current?.click()}>
                  <span className="tw-pick-icon">
                    <CloudArrowUp size={40} weight="duotone" />
                  </span>
                  <b>{t('pt.pick')}</b>
                  <span>{t('pt.pickHint')}</span>
                </button>
                <div className="pt-tips">
                  <h5>{t('pt.tipsTitle')}</h5>
                  <ul>
                    {t('pt.tips').split('|').map((tip) => (
                      <li key={tip}>
                        <CheckCircle size={16} weight="fill" /> {tip}
                      </li>
                    ))}
                  </ul>
                  <p className="pt-private">
                    <ShieldCheck size={14} weight="fill" /> {t('pt.private')}
                  </p>
                </div>
              </div>
            )}

            {phase === 'busy' && (
              <div className="tw-run pt-run">
                {photoUrl && <img className="pt-run-photo" src={photoUrl} alt="" />}
                <div className="tw-ring-wrap">
                  <Ring value={progress.pct} />
                  <div className="tw-ring-center">
                    <MagicWand size={40} weight="duotone" />
                    <b>{progress.pct}%</b>
                  </div>
                </div>
                <h4>{stageText}</h4>
                <p>{t('pt.firstTime')}</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="tw-error">
                <span className="tw-error-icon">
                  <WarningCircle size={32} weight="duotone" />
                </span>
                <h4>{t(`pt.err.${error}`)}</h4>
                <div className="tw-row">
                  <button className="fs-btn dark" onClick={() => picker.current?.click()}>
                    <ImageIcon size={15} weight="bold" /> {t('pt.tryAgain')}
                  </button>
                </div>
              </div>
            )}

            {phase === 'edit' && (
              <div className="pt-stage" ref={stage}>
                <div
                  className={`pt-canvas-wrap ${rendering ? 'busy' : ''}`}
                  style={{ aspectRatio: `${ow} / ${oh}` }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onWheel={onWheel}
                >
                  <canvas ref={canvas} className="pt-canvas" />
                  {comparing && photoUrl && (
                    <div className="pt-before">
                      <img src={photoUrl} alt={t('pt.before')} />
                      <span>{t('pt.before')}</span>
                    </div>
                  )}
                  {isDoc && <span className="pt-size-badge">{FORMATS[choice.format].mm.join('×')} mm</span>}
                </div>
                <div className="pt-stage-bar">
                  <button
                    className="fs-btn"
                    onPointerDown={() => setComparing(true)}
                    onPointerUp={() => setComparing(false)}
                    onPointerLeave={() => setComparing(false)}
                    title={t('pt.compare')}
                  >
                    <Eye size={16} /> <span className="pt-hide-s">{t('pt.before')}</span>
                  </button>
                  <span className="pt-hint">
                    <Hand size={14} /> {t('pt.dragHint')}
                  </span>
                  <button className="fs-btn ghost" onClick={() => picker.current?.click()}>
                    <ImageIcon size={16} /> <span className="pt-hide-s">{t('pt.other')}</span>
                  </button>
                </div>
              </div>
            )}
          </main>

          {phase === 'edit' && (
            <aside className="tw-side pt-side">
              <div className="pt-tabs" role="tablist">
                {[
                  ['outfit', TShirt],
                  ['bg', Palette],
                  ['format', Crop],
                  ['retouch', Sparkle],
                ].map(([id, Icon]) => (
                  <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                    <Icon size={17} weight={tab === id ? 'fill' : 'regular'} />
                    {t(`pt.tab.${id}`)}
                  </button>
                ))}
              </div>

              <div className="pt-panel">
                {tab === 'outfit' && (
                  <>
                    <div className="pt-outfits">
                      {OUTFIT_ORDER.map((id) => (
                        <button key={id} className={`pt-outfit ${choice.outfit === id ? 'on' : ''}`} onClick={() => set({ outfit: id })}>
                          <img src={outfitThumb(id, { jacket: choice.jacket, shirt: choice.shirt, tie: choice.tie, knit: choice.knit, top: choice.top })} alt="" />
                          <span>{t(`pt.o.${id}`)}</span>
                        </button>
                      ))}
                    </div>
                    {outfit.jacket && <Swatches part="jacket" value={choice.jacket} onChange={(jacket) => set({ jacket })} />}
                    {outfit.shirt && <Swatches part="shirt" value={choice.shirt} onChange={(shirt) => set({ shirt })} />}
                    {outfit.tie && <Swatches part="tie" value={choice.tie} none onChange={(tie) => set({ tie })} />}
                    {outfit.knit && <Swatches part="knit" value={choice.knit} onChange={(knit) => set({ knit })} />}
                    {outfit.top && <Swatches part="top" value={choice.top} onChange={(top) => set({ top })} />}
                    {choice.outfit === 'keep' && <p className="pt-note">{t('pt.keepNote')}</p>}
                    {analysis?.longHair && choice.outfit !== 'keep' && (
                      <label className="pt-check">
                        <input type="checkbox" checked={choice.hairFront} onChange={(e) => set({ hairFront: e.target.checked })} />
                        {t('pt.hairFront')}
                      </label>
                    )}
                  </>
                )}

                {tab === 'bg' && (
                  <>
                    <div className="pt-group">
                      <h5>{t('pt.bgStudio')}</h5>
                      <div className="pt-bgs">
                        {STUDIO_BGS.map((id) => (
                          <button key={id} className={`pt-bg ${choice.bg === id ? 'on' : ''}`} onClick={() => set({ bg: id })}>
                            <i style={{ background: backdropCss(id) }} />
                            <span>{t(`pt.bg.${id}`)}</span>
                          </button>
                        ))}
                        <button className={`pt-bg ${choice.bg === 'blur' ? 'on' : ''}`} onClick={() => set({ bg: 'blur' })}>
                          <i className="pt-bg-blur" style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined} />
                          <span>{t('pt.bg.blur')}</span>
                        </button>
                        <label className={`pt-bg ${choice.bg === 'custom' ? 'on' : ''}`}>
                          <i style={{ background: backdropCss('custom', choice.custom) }}>
                            <input type="color" value={choice.custom} onChange={(e) => set({ bg: 'custom', custom: e.target.value })} />
                          </i>
                          <span>{t('pt.bg.custom')}</span>
                        </label>
                      </div>
                    </div>
                    <div className="pt-group">
                      <h5>{t('pt.bgDoc')}</h5>
                      <div className="pt-bgs">
                        {DOC_BGS.map((id) => (
                          <button key={id} className={`pt-bg ${choice.bg === id ? 'on' : ''}`} onClick={() => set({ bg: id })}>
                            <i style={{ background: BACKDROPS[id].flat }} />
                            <span>{t(`pt.bg.${id}`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tab === 'format' && (
                  <>
                    <div className="pt-formats">
                      {FORMAT_ORDER.map((id) => {
                        const [name, sub] = t(`pt.f.${id}`).split('|')
                        const f = FORMATS[id]
                        return (
                          <button key={id} className={`pt-format ${choice.format === id ? 'on' : ''}`} onClick={() => setFormat(id)}>
                            <i style={{ aspectRatio: `${f.aspect}` }} />
                            <span>
                              <b>{name}</b>
                              <small>{sub}</small>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pt-group">
                      <Slider label={t('pt.zoom')} value={Math.round(choice.zoom * 100)} min={60} max={180} suffix="%" onChange={(v) => set({ zoom: v / 100 })} />
                      <button className="fs-btn ghost pt-reset" onClick={() => set({ zoom: 1, dx: 0, dy: 0 })}>
                        <MagnifyingGlassPlus size={15} /> {t('pt.reset')}
                      </button>
                    </div>
                    {isDoc && <p className="pt-note">{t('pt.docNote')}</p>}
                  </>
                )}

                {tab === 'retouch' && (
                  <>
                    <label className="pt-check">
                      <input type="checkbox" checked={choice.tone.auto} onChange={(e) => setTone({ auto: e.target.checked })} />
                      {t('pt.r.auto')}
                    </label>
                    <Slider label={t('pt.r.smooth')} value={choice.tone.smooth} min={0} max={100} onChange={(smooth) => setTone({ smooth })} />
                    <Slider label={t('pt.r.brightness')} value={choice.tone.brightness} min={-50} max={50} onChange={(brightness) => setTone({ brightness })} />
                    <Slider label={t('pt.r.warmth')} value={choice.tone.warmth} min={-50} max={50} onChange={(warmth) => setTone({ warmth })} />
                    <Slider label={t('pt.r.contrast')} value={choice.tone.contrast} min={-50} max={50} onChange={(contrast) => setTone({ contrast })} />
                    <Slider label={t('pt.r.sharp')} value={choice.tone.sharp} min={0} max={100} onChange={(sharp) => setTone({ sharp })} />
                    <button className="fs-btn ghost pt-reset" onClick={() => set({ tone: TONE0 })}>
                      <ArrowCounterClockwise size={15} /> {t('pt.r.reset')}
                    </button>
                  </>
                )}
              </div>

              <div className="tw-side-foot pt-foot">
                <button className="fs-btn dark lg block" onClick={() => save('jpg')} disabled={!!busyExport}>
                  <DownloadSimple size={17} weight="bold" /> {busyExport === 'jpg' ? t('pt.preparing') : t('pt.download')}
                </button>
                <div className="pt-foot-row">
                  <button className="fs-btn" onClick={() => save('png')} disabled={!!busyExport}>
                    {busyExport === 'png' ? t('pt.preparing') : t('pt.png')}
                  </button>
                  {isDoc && (
                    <button className="fs-btn" onClick={() => save('sheet')} disabled={!!busyExport} title={t('pt.sheetHint')}>
                      <Printer size={15} /> {busyExport === 'sheet' ? t('pt.preparing') : t('pt.sheet', { n: sheetCount })}
                    </button>
                  )}
                </div>
                <small>
                  {ow}×{oh} px{isDoc ? ' · 600 dpi' : ''}
                </small>
                {choice.outfit !== 'keep' && <small className="pt-disclaimer">{t('pt.note')}</small>}
              </div>
            </aside>
          )}
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/avif,image/bmp"
        onChange={(e) => {
          start(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
