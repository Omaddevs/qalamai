// «Ulaşiş»: a view-only link to the presentation (/v/<shareId>). The design is pushed to the
// server first, then the server hands out (or reuses) the link id. The link follows later edits.
import { isShared, markShared } from '../assets.js'
import { getDesign, saveDesign } from '../store.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
import { Modal } from '../components/ui.jsx'
import { api } from '../api.js'
import { syncNow, syncStatus } from '../sync.js'
import { t } from '../i18n/index.js'
import './share.css'

const linkOf = (shareId) => `${window.location.origin}/v/${shareId}`

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // no clipboard permission (http, old browser): select the field and use the legacy command
    input?.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    }
  }
}

/**
 * @param {{ deckId: string, flush: () => void, onClose: () => void, notify: (msg: string) => void }} p
 *   flush: write the editor's latest state to local storage right now (skips the autosave delay)
 */
/** Marks the design as changed, so the next sync sends it again. */
const touch = (id) => {
  const d = getDesign(id)
  if (d) saveDesign({ ...d, updatedAt: Date.now() })
}

export default function ShareDialog({ deckId, flush, onClose, notify }) {
  const [state, setState] = useState({ step: 'loading' }) // loading · ready {url} · error {msg}
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => void (alive.current = false)
  }, [])

  const prepare = useCallback(async () => {
    setState({ step: 'loading' })
    try {
      flush()
      // a shared design carries its pictures (compressed) — re-send it with them
      if (!isShared(deckId)) {
        markShared(deckId, true)
        touch(deckId)
      }
      await syncNow()
      const st = syncStatus()
      const refused = st.rejected.find((r) => r.id === deckId)
      if (refused) throw Object.assign(new Error(t('share.notSaved', { reason: refused.message })), { shown: true })
      if (st.state === 'offline') throw Object.assign(new Error(t('share.offline')), { shown: true })
      const { shareId } = await api.post(`/designs/${encodeURIComponent(deckId)}/share`)
      if (alive.current) setState({ step: 'ready', url: linkOf(shareId) })
    } catch (e) {
      const msg = e.shown ? e.message : e.code === 'OFFLINE' || e.status === 404 ? t('share.offline') : e.message
      if (alive.current) setState({ step: 'error', msg })
    }
  }, [deckId, flush])

  useEffect(() => {
    prepare()
  }, [prepare])

  // the link is selected as soon as it is there, so ⌘C works too
  useEffect(() => {
    if (state.step === 'ready') input.current?.select()
  }, [state.step])

  const copy = async () => {
    if (await copyText(state.url, input.current)) {
      setCopied(true)
      notify(t('share.copied'))
      setTimeout(() => alive.current && setCopied(false), 1600)
    }
  }

  const stop = async () => {
    setBusy(true)
    try {
      await api.del(`/designs/${encodeURIComponent(deckId)}/share`)
      // no link any more → the server copy goes back to picture references only
      markShared(deckId, false)
      touch(deckId)
      syncNow().catch(() => {})
      notify(t('share.stopped'))
      onClose()
    } catch (e) {
      notify(e.message)
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Modal title={t('share.title')} onClose={onClose} className="share-modal">
      {state.step === 'loading' && (
        <p className="share-wait">
          <Loader2 size={18} className="spin" /> {t('share.preparing')}
        </p>
      )}
      {state.step === 'error' && (
        <div className="share-err" role="alert">
          <p>{state.msg}</p>
          <button className="btn primary" onClick={prepare}>
            {t('pe.retry')}
          </button>
        </div>
      )}
      {state.step === 'ready' && (
        <>
          <label className="share-label" htmlFor="share-link">
            <Link2 size={15} /> {t('share.linkLabel')}
          </label>
          <div className="share-row">
            <input id="share-link" ref={input} className="share-input" readOnly value={state.url} onFocus={(e) => e.target.select()} />
            <button className="btn primary" onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />} <span>{copied ? t('share.copied') : t('share.copy')}</span>
            </button>
          </div>
          <p className="share-note">{t('share.note')}</p>
          <div className="share-foot">
            <a className="btn" href={state.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> <span>{t('share.open')}</span>
            </a>
            <button className="btn share-stop" onClick={stop} disabled={busy}>
              {t('share.stop')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
