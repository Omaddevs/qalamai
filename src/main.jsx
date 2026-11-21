import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import OfflineScreen from './components/OfflineScreen.jsx'
import { ready, useLang } from './i18n/index.js'
import './styles.css'
import './components/pro-badge.css' // after page CSS, so badge placements win
import { startSync } from './sync.js'
import { startTracking } from './track.js'

// /admin is a separate app: no guest session, no sync, no tracking.
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

if (!isAdmin) {
  // localStorage ⇄ server, in the background (designs, documents, profile)
  startSync()
  startTracking()
}

// Changing the language remounts the app so every text — including module data — is read again.
function Root() {
  const lang = useLang()
  return (
    <>
      <App key={lang} />
      <OfflineScreen />
    </>
  )
}

// Only the shown language's texts are downloaded; render once they are in.
if (isAdmin) {
  import('./admin/AdminApp.jsx').then(({ default: AdminApp }) =>
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <AdminApp />
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
