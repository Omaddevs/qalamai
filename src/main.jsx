import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import OfflineScreen from './components/OfflineScreen.jsx'
import AppErrorBoundary, { reloadForNewVersion, watchNewVersion } from './components/AppErrorBoundary.jsx'
import { ready, useLang } from './i18n/index.js'
import './styles.css'
import './components/pro-badge.css' // after page CSS, so badge placements win
import { startSync } from './sync.js'
import { startTracking } from './track.js'
import { captureReferral } from './promos.js'

// a tab opened before a deploy reloads itself when it asks for a chunk that is gone
watchNewVersion()

// /admin is a separate app: no guest session, no sync, no tracking.
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

if (!isAdmin) {
  // opened through a friend's invite link (?ref=CODE): remember it for sign-up
  captureReferral()
  // localStorage ⇄ server, in the background (designs, documents, profile)
  startSync()
  startTracking()
}

// Changing the language remounts the app so every text — including module data — is read again.
function Root() {
  const lang = useLang()
  return (
    <>
      <AppErrorBoundary key={lang}>
        <App />
      </AppErrorBoundary>
      <OfflineScreen />
    </>
  )
}

// Only the shown language's texts are downloaded; render once they are in.
if (isAdmin) {
  import('./admin/AdminApp.jsx').catch((e) => (reloadForNewVersion(), Promise.reject(e))).then(({ default: AdminApp }) =>
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <AppErrorBoundary
          texts={{
            'eb.newTitle': 'Yangi versiya çiqdi',
            'eb.newText': 'Davom etiş uçun sahifani yangilang.',
            'eb.title': 'Nimadir xato ketdi',
            'eb.text': 'Bu ekranda xatolik yuz berdi. Sahifani yangilang.',
            'eb.retry': 'Qayta urinib köriş',
            'eb.reload': 'Yangilaş',
          }}
        >
          <AdminApp />
        </AppErrorBoundary>
      </React.StrictMode>,
    ),
  )
} else ready().then(() =>
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  ),
)
