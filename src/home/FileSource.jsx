// Attach a document to build a presentation from. Reading happens in this browser (docSource.js);
// the File is kept only in memory until the deck is made, then dropped — never uploaded or stored.
import { useRef, useState } from 'react'
import { Paperclip, FilePdf, FileDoc, FilePpt, FileText, X, LockSimple, CircleNotch } from '@phosphor-icons/react'
import { formatNumber, t } from '../i18n/index.js'
import { ACCEPT, DocError, MAX_MB, readDocument } from './docSource.js'
import './filesource.css'

const ICONS = { pdf: FilePdf, docx: FileDoc, pptx: FilePpt }
const errorText = (e) => (e instanceof DocError ? t(`fs.err.${e.code}`, { mb: MAX_MB }) : t('fs.err.read'))

/** The parsed document's one-line description: "12 bet · 3 400 söz". */
export const docMeta = (doc) =>
  [doc.pages ? t('fs.pagesN', { n: doc.pages }) : null, t('fs.words', { n: formatNumber(doc.words) })].filter(Boolean).join(' · ')

/**
 * variant 'pill' — a small button in the composer's tool row (the chip shows once a file is read);
 * variant 'zone' — a drop area (AI taqdimot page).
 */
export default function FileSource({ doc, onDoc, notify, variant = 'pill' }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const take = async (file) => {
    if (!file || busy) return
    setBusy(true)
    try {
      onDoc(await readDocument(file))
    } catch (e) {
      notify?.(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        take(e.target.files?.[0])
        e.target.value = '' // the File isn't kept by the input either
      }}
    />
  )

  if (doc) {
    const Icon = ICONS[doc.ext] ?? FileText
    return (
      <div className={`fs-chip ${variant} fs-${doc.ext}`}>
        <span className="fs-chip-ic">
          <Icon size={variant === 'pill' ? 16 : 22} weight="duotone" />
        </span>
        <span className="fs-chip-text">
          <b title={doc.fileName}>{doc.fileName}</b>
          <small>{docMeta(doc)}</small>
        </span>
        <button type="button" className="fs-x" onClick={() => onDoc(null)} aria-label={t('fs.remove')} title={t('fs.remove')}>
          <X size={12} weight="bold" />
        </button>
      </div>
    )
  }

  if (variant === 'pill') {
    return (
      <>
        <button type="button" className={`fs-pill ${busy ? 'busy' : ''}`} onClick={() => input.current?.click()} disabled={busy} title={t('fs.attachLong')}>
          {busy ? <CircleNotch size={15} weight="bold" className="fs-spin" /> : <Paperclip size={15} weight="bold" />}
          {busy ? t('fs.reading') : t('fs.attach')}
        </button>
        {picker}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`fs-zone ${over ? 'over' : ''} ${busy ? 'busy' : ''}`}
        onClick={() => input.current?.click()}
        disabled={busy}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files?.[0])
        }}
      >
        <span className="fs-zone-ic">{busy ? <CircleNotch size={20} weight="bold" className="fs-spin" /> : <Paperclip size={20} weight="bold" />}</span>
        <span className="fs-zone-text">
          <b>{busy ? t('fs.reading') : t('fs.attachLong')}</b>
          <small>
            {t('fs.drop')} · {t('fs.types', { mb: MAX_MB })}
          </small>
        </span>
      </button>
      {picker}
    </>
  )
}

/** "The file never leaves this browser" line. */
export function PrivateNote() {
  return (
    <p className="fs-private">
      <LockSimple size={13} weight="bold" /> {t('fs.private')}
    </p>
  )
}
