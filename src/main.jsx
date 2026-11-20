import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ready, useLang } from './i18n/index.js'
import './styles.css'
import './components/pro-badge.css' // after page CSS, so badge placements win
import { startSync } from './sync.js'

// localStorage ⇄ server, in the background (designs, documents, profile)
startSync()

// Changing the language remounts the app so every text — including module data — is read again.
function Root() {
  const lang = useLang()
  return <App key={lang} />
}

// Only the shown language's texts are downloaded; render once they are in.
ready().then(() =>
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  ),
)
