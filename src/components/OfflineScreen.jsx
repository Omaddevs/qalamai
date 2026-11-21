import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n/index.js'
// Inlined into the bundle: once the connection is gone, nothing can be fetched any more.
import scream from './assets/offline-scream.png?inline'
import './offline.css'

// Asks our own origin, past every cache: navigator.onLine can say "online" with no real connection.
async function reachable() {
  try {
    const res = await fetch(`/favicon.svg?ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

const WifiOff = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76" />
    <circle cx="12" cy="20" r="0.6" fill="currentColor" />
  </svg>
)

const Retry = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

/**
 * Covers the app while the browser is offline; "Continue offline" folds it into a small banner
 * (the app keeps working from localStorage). Coming back online removes it and says so briefly.
 */
export default function OfflineScreen() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const [minimized, setMinimized] = useState(false)
  const [checking, setChecking] = useState(false)
  const [still, setStill] = useState(false)
  const [back, setBack] = useState(false)
  const retryRef = useRef(null)

  const goOnline = useCallback(() => {
    setOffline((was) => {
      if (was) {
        setBack(true)
        setTimeout(() => setBack(false), 2600)
      }
      return false
    })
    setMinimized(false)
    setStill(false)
  }, [])

  useEffect(() => {
    const onOffline = () => {
      setOffline(true)
      setMinimized(false)
      setBack(false)
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [goOnline])

  const open = offline && !minimized
  useEffect(() => {
    if (!open) return
    retryRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && setMinimized(true)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const retry = async () => {
    if (checking) return
    setChecking(true)
    setStill(false)
    const ok = await reachable()
    setChecking(false)
    if (ok) goOnline()
    else setStill(true)
  }

  if (back) {
    return (
      <div className="off-toast" role="status">
        <span className="off-toast-dot" />
        {t('off.back')}
      </div>
    )
  }
  if (!offline) return null

  if (minimized) {
    return (
      <button type="button" className="off-banner" onClick={() => setMinimized(false)}>
        <WifiOff />
        {t('off.banner')}
      </button>
    )
  }

  return (
    <div className="off-backdrop">
      <div className="off-card" role="alertdialog" aria-modal="true" aria-labelledby="off-title" aria-describedby="off-text">
        <div className="off-art">
          <div className="off-glow" />
          <div className="off-img" style={{ '--off-img': `url(${scream})` }} aria-hidden="true" />
        </div>

        <span className="off-badge">
          <span className="off-badge-dot" />
          {t('off.badge')}
        </span>
        <h1 id="off-title" className="off-title">
          {t('off.title')}
        </h1>
        <p id="off-text" className="off-text">
          {t('off.text')}
        </p>

        <div className="off-tip">
          <WifiOff />
          {t('off.tip')}
        </div>

        <div className="off-actions">
          <button ref={retryRef} type="button" className="off-btn off-btn-primary" onClick={retry} disabled={checking}>
            <span className={checking ? 'off-spin' : undefined}>
              <Retry />
            </span>
            {checking ? t('off.checking') : t('off.retry')}
          </button>
          <button type="button" className="off-btn off-btn-ghost" onClick={() => setMinimized(true)}>
            {t('off.continue')}
          </button>
        </div>

        <p className={`off-still${still ? ' is-on' : ''}`} aria-live="polite">
          {still ? t('off.still') : ' '}
        </p>
      </div>
    </div>
  )
}
