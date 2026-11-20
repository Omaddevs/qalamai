import { useRef, useState } from 'react'
import { Check, UploadSimple } from '@phosphor-icons/react'
import { Modal } from '../components/ui.jsx'
import { setAvatar } from '../api.js'
import { t } from '../i18n/index.js'

export const AVATAR_PRESETS = 15
const presetUrl = (n) => `/avatars/${String(n).padStart(2, '0')}.webp`
const presetOf = (url) => {
  const m = /^\/avatars\/(\d{2})\.webp$/.exec(url ?? '')
  return m ? Number(m[1]) : 0
}

/** Downscale a picked photo in the browser (square crop, 512 px JPEG) so the upload stays small. */
async function toSquareJpeg(file, size = 512) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const side = Math.min(bmp.width, bmp.height)
  const out = Math.min(size, side)
  const c = document.createElement('canvas')
  c.width = c.height = out
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, out, out)
  g.imageSmoothingQuality = 'high'
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out)
  bmp.close?.()
  return c.toDataURL('image/jpeg', 0.9)
}

/** Pick one of the drawn avatars or upload an own photo. */
export default function AvatarPicker({ current, onClose, notify }) {
  const [busy, setBusy] = useState(0) // preset number being saved, or -1 for an upload
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const selected = presetOf(current)

  const save = async (body, mark) => {
    setBusy(mark)
    setErr('')
    try {
      await setAvatar(body)
      notify?.(t('pf.avatar.saved'))
      onClose()
    } catch (e) {
      setErr(e?.message || t('pf.avatar.err'))
      setBusy(0)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp|heic|heif|gif|avif)$/.test(file.type)) return setErr(t('pf.avatar.badType'))
    try {
      setBusy(-1)
      await save({ image: await toSquareJpeg(file) }, -1)
    } catch {
      setErr(t('pf.avatar.badType'))
      setBusy(0)
    }
  }

  return (
    <Modal title={t('pf.avatar.title')} onClose={onClose} className="pf-av-modal">
      <p className="pf-av-hint">{t('pf.avatar.hint')}</p>
      <div className="pf-av-grid" role="listbox" aria-label={t('pf.avatar.title')}>
        {Array.from({ length: AVATAR_PRESETS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={n === selected}
            className={`pf-av-opt ${n === selected ? 'on' : ''} ${busy === n ? 'busy' : ''}`}
            disabled={busy !== 0}
            onClick={() => (n === selected ? onClose() : save({ preset: n }, n))}
          >
            <img src={presetUrl(n)} alt="" loading="lazy" width="96" height="96" />
            {n === selected && (
              <span className="pf-av-check">
                <Check size={12} weight="bold" />
              </span>
            )}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <button type="button" className="btn pf-av-upload" disabled={busy !== 0} onClick={() => fileRef.current?.click()}>
        <UploadSimple size={16} weight="bold" /> {busy === -1 ? t('pf.avatar.uploading') : t('pf.avatar.upload')}
      </button>
      {err && <p className="pf-av-err">{err}</p>}
    </Modal>
  )
}
