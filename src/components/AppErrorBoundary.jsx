// Keeps the app from turning into a blank page.
//  • After a deploy the hashed files change: a tab opened before it asks for chunks that are gone
//    ("Failed to fetch dynamically imported module"). The page reloads itself once to the new version.
//  • Any other error while drawing shows a small card with "Reload" instead of an empty screen.
import { Component } from 'react'
import { has, t } from '../i18n/index.js'
import './error-boundary.css'

const RELOAD_KEY = 'qalam.versionReload'
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|Unable to preload CSS|ChunkLoadError|Loading chunk \d+ failed/i

export const isChunkError = (e) => CHUNK_ERROR.test(String(e?.message ?? e ?? ''))

/** Reload to the new version — once per 30 s, so a real outage never loops. Returns true when it reloads. */
export function reloadForNewVersion() {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
  } catch {
    /* storage unavailable */
  }
  if (Date.now() - last < 30_000) return false
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
  window.location.reload()
  return true
}

/** Listens for chunk load failures that happen outside React (preloads, background imports). */
export function watchNewVersion() {
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadForNewVersion()) e.preventDefault()
  })
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkError(e.reason)) reloadForNewVersion()
  })
}

const dict = (key, fallback) => (has(key) ? t(key) : fallback)

export default class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (isChunkError(error) && reloadForNewVersion()) return
    console.error('UI error', error, info?.componentStack)
  }

  componentDidMount() {
    // moving elsewhere in the app gives the screen another chance
    this.onNav = () => this.state.error && this.setState({ error: null })
    window.addEventListener('hashchange', this.onNav)
    window.addEventListener('popstate', this.onNav)
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onNav)
    window.removeEventListener('popstate', this.onNav)
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunk = isChunkError(this.state.error)
    // the admin panel passes its own (Uzbek) texts: it doesn't load the app's dictionary
    const text = (key, fallback) => this.props.texts?.[key] ?? dict(key, fallback)
    return (
      <div className="eb" role="alert">
        <div className="eb-card">
          <span className="eb-ic" aria-hidden="true">
            {chunk ? '↻' : '!'}
          </span>
          <h2>{chunk ? text('eb.newTitle', 'A new version is out') : text('eb.title', 'Something went wrong')}</h2>
          <p>{chunk ? text('eb.newText', 'Reload the page to continue — your work is saved.') : text('eb.text', 'This screen hit an error. Reload the page — your work is saved.')}</p>
          <div className="eb-actions">
            {!chunk && (
              <button type="button" className="eb-btn soft" onClick={() => this.setState({ error: null })}>
                {text('eb.retry', 'Try again')}
              </button>
            )}
            <button type="button" className="eb-btn" onClick={() => window.location.reload()}>
              {text('eb.reload', 'Reload')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
