// Before / after slider for background removal, with instant background presets
// (transparent, colours, blurred original) composed in the browser.
import { useEffect, useRef, useState } from 'react'
import { DownloadSimple, Drop, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { apiUrl, downloadFile } from '../api.js'
import { t } from '../i18n/index.js'

const PRESETS = [
  { id: 'none', key: 'none' },
  { id: '#ffffff', key: 'white' },
  { id: '#0b0b0d', key: 'black' },
  { id: '#e0f2fe', key: 'blue' },
  { id: '#fde68a', key: 'yellow' },
  { id: 'linear-gradient(135deg,#14b8a6,#6366f1)', key: 'gradient', grad: ['#14b8a6', '#6366f1'] },
  { id: 'blur', key: 'blur' },
].map((p) => ({ ...p, get label() { return t(`bgc.${p.key}`) } }))

const loadImg = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

export default function BgCompare({ original, result, notify }) {
  const [pos, setPos] = useState(50)
  const [bg, setBg] = useState('none')
  const [custom, setCustom] = useState('#14b8a6')
  const [blurUrl, setBlurUrl] = useState(null)
  const box = useRef(null)
  const dragging = useRef(false)
  const before = apiUrl(original.url)
  const after = apiUrl(result.url)

  // pre-render a blurred copy of the original for the "Xira fon" preset
  useEffect(() => {
    if (bg !== 'blur' || blurUrl) return
    loadImg(before).then((img) => {
      const c = document.createElement('canvas')
      const k = Math.min(1, 900 / Math.max(img.width, img.height))
      c.width = img.width * k
      c.height = img.height * k
      const ctx = c.getContext('2d')
      ctx.filter = 'blur(14px) brightness(1.05)'
      ctx.drawImage(img, -20, -20, c.width + 40, c.height + 40)
      setBlurUrl(c.toDataURL('image/jpeg', 0.85))
    })
  }, [bg, blurUrl, before])

  const move = (clientX) => {
    const r = box.current.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  const background = bg === 'none' ? undefined : bg === 'blur' ? (blurUrl ? `center / cover no-repeat url(${blurUrl})` : '#e5e7eb') : bg === 'custom' ? custom : bg

  async function download() {
    if (bg === 'none') return downloadFile(result)
    try {
      const img = await loadImg(after)
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      const preset = PRESETS.find((p) => p.id === bg)
      if (bg === 'blur') {
        const orig = await loadImg(before)
        ctx.filter = `blur(${Math.round(Math.max(c.width, c.height) / 70)}px) brightness(1.05)`
        ctx.drawImage(orig, -30, -30, c.width + 60, c.height + 60)
        ctx.filter = 'none'
      } else if (preset?.grad) {
        const g = ctx.createLinearGradient(0, 0, c.width, c.height)
        g.addColorStop(0, preset.grad[0])
        g.addColorStop(1, preset.grad[1])
        ctx.fillStyle = g
        ctx.fillRect(0, 0, c.width, c.height)
      } else {
        ctx.fillStyle = bg === 'custom' ? custom : bg
        ctx.fillRect(0, 0, c.width, c.height)
      }
      ctx.drawImage(img, 0, 0)
      c.toBlob(
        (blob) => {
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = result.name.replace(/\.[^.]+$/, '') + '.jpg'
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 2000)
        },
        'image/jpeg',
        0.93,
      )
    } catch {
      notify?.(t('bgc.failed'))
    }
  }

  return (
    <div className="bgc">
      <div
        ref={box}
        className="bgc-stage"
        style={{ aspectRatio: `${result.meta?.width ?? 4} / ${result.meta?.height ?? 3}`, '--ar': (result.meta?.width ?? 4) / (result.meta?.height ?? 3) }}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e.clientX)
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
      >
        <div className="bgc-after checker" style={{ background }}>
          <img src={after} alt={t('bgc.after')} draggable={false} />
        </div>
        <div className="bgc-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={before} alt={t('bgc.before')} draggable={false} />
        </div>
        <div className="bgc-handle" style={{ left: `${pos}%` }}>
          <span>
            <CaretLeft size={12} weight="bold" />
            <CaretRight size={12} weight="bold" />
          </span>
        </div>
        <span className="bgc-label l">{t('bgc.l')}</span>
        <span className="bgc-label r">{t('bgc.r')}</span>
      </div>

      <div className="bgc-bar">
        <div className="bgc-presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={`bgc-swatch ${bg === p.id ? 'on' : ''} ${p.id === 'none' ? 'checker' : ''}`} title={p.label} onClick={() => setBg(p.id)} style={p.id === 'none' ? undefined : p.id === 'blur' ? undefined : { background: p.id }}>
              {p.id === 'blur' && <Drop size={15} weight="duotone" />}
            </button>
          ))}
          <label className={`bgc-swatch custom ${bg === 'custom' ? 'on' : ''}`} title={t('bgc.any')} style={{ background: custom }}>
            <input
              type="color"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value)
                setBg('custom')
              }}
            />
          </label>
        </div>
        <button className="fs-btn dark" onClick={download}>
          <DownloadSimple size={16} weight="bold" /> {bg === 'none' ? t('bgc.png') : t('bgc.withBg')}
        </button>
      </div>
    </div>
  )
}
