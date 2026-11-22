// Small building blocks shared by the file studio, tool workspace and editor.
import { useEffect, useState } from 'react'
import { FilePdf, FileDoc, FileImage, File as FileIcon, FileText, WarningCircle } from '@phosphor-icons/react'
import { apiUrl } from '../api.js'
import { pdfThumb } from './store.js'
import { COLORS } from '../data.js'
import { TOOL_UI } from './toolMeta.js'
import { t } from '../i18n/index.js'

export function ToolIcon({ id, size = 46 }) {
  const ui = TOOL_UI[id] ?? { icon: FileIcon, color: 'teal' }
  const c = COLORS[ui.color]
  const Icon = ui.icon
  return (
    <span className="fs-ticon" style={{ width: size, height: size, borderRadius: size * 0.3, background: `linear-gradient(145deg, ${c.from}, ${c.to})` }}>
      <Icon size={size * 0.52} weight="duotone" />
    </span>
  )
}

export function KindIcon({ file, size = 20 }) {
  const Icon = file.kind === 'pdf' ? FilePdf : file.kind === 'image' ? FileImage : file.ext === 'docx' ? FileDoc : FileText
  return <Icon size={size} weight="duotone" className={`fs-kind k-${file.kind}`} />
}

/** Thumbnail for a stored file, or an icon while/if there is none. */
export function Thumb({ file, className = '' }) {
  const [failed, setFailed] = useState(false)
  const [drawn, setDrawn] = useState(null)
  // a PDF on the device has no server thumbnail: render its first page here
  useEffect(() => {
    if (!file.local || file.kind !== 'pdf') return
    let live = true
    pdfThumb(file).then((u) => live && setDrawn(u), () => live && setFailed(true))
    return () => {
      live = false
    }
  }, [file])
  const src = file.thumbUrl ?? drawn
  if (!src || failed) {
    return (
      <span className={`fs-thumb icon ${className}`}>
        <KindIcon file={file} size={30} />
        <b>{file.ext.toUpperCase()}</b>
      </span>
    )
  }
  return (
    <span className={`fs-thumb ${file.kind === 'image' ? 'checker' : ''} ${className}`}>
      <img src={apiUrl(src)} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}

export function Offline({ error, onRetry }) {
  return (
    <div className="fs-offline">
      <WarningCircle size={34} weight="duotone" />
      <b>{error?.code === 'OFFLINE' ? t('fs.offline') : t('fs.error')}</b>
      <span>{error?.message}</span>
      {error?.code === 'OFFLINE' && <code>cd server && npm install && npm run dev</code>}
      <button className="fs-btn" onClick={onRetry}>
        {t('fs.retry')}
      </button>
    </div>
  )
}

