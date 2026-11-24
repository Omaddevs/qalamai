import { useEffect } from 'react'
import { t } from '../i18n/index.js'
import { go, linkClick } from '../nav.js'
import { Wordmark } from './ui.jsx'
import { applySeo } from '../seo.js'
import shrug from './assets/notfound-shrug.png?inline'
import './notfound.css'

const Arrow = ({ back }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {back ? <path d="M19 12H5M11 18l-6-6 6-6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
  </svg>
)

/** 404: an address that is neither "/", a public page nor the app. Kept out of search results. */
export default function NotFound() {
  useEffect(() => {
    // no canonical / alternates: this address isn't a page (nginx also answers it with status 404)
    applySeo({ title: `404 — ${t('nf.title')} · QalamAI`, description: t('nf.text'), path: null, robots: 'noindex' })
  }, [])

  // a malformed escape (/%E0%A4%A) makes decodeURIComponent throw: show the raw path instead
  const path = (() => {
    try {
      return decodeURIComponent(window.location.pathname)
    } catch {
      return window.location.pathname
    }
  })()
  const canGoBack = window.history.length > 1 && document.referrer.startsWith(window.location.origin)

  return (
    <div className="nf-page">
      <header className="nf-top">
        <a href="/" onClick={linkClick(() => go('/'))} aria-label={t('nf.home')}>
          <Wordmark size={19} />
        </a>
      </header>

      <main className="nf-main">
        <div className="nf-stage" aria-hidden="true">
          <span className="nf-code">404</span>
          <div className="nf-img" style={{ '--nf-img': `url(${shrug})` }} />
          <span className="nf-ground" />
        </div>

        <h1 className="nf-title">{t('nf.title')}</h1>
        <p className="nf-text">{t('nf.text')}</p>
        <code className="nf-path" title={path}>
          {path}
        </code>

        <div className="nf-actions">
          <a className="nf-btn nf-btn-primary" href="/" onClick={linkClick(() => go('/'))}>
            {t('nf.home')}
            <Arrow />
          </a>
          {canGoBack && (
            <button type="button" className="nf-btn nf-btn-ghost" onClick={() => window.history.back()}>
              <Arrow back />
              {t('nf.back')}
            </button>
          )}
        </div>

        <a className="nf-app" href="/#/" onClick={linkClick(() => go('/#/'))}>
          {t('nf.app')}
        </a>
      </main>
    </div>
  )
}
