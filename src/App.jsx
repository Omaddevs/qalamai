import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AppModal } from './components/Modals.jsx'
import { CoinShopHost } from './components/Coins.jsx'
import { openCoinShop } from './coins.js'
import { APPS } from './data.js'
import { onSynced } from './changes.js'
import { deleteDesign, duplicateDesign, getDesign, loadDesigns, newDeck, saveDesign } from './store.js'
import { isKit } from './creators/kitTypes.js'
import { t } from './i18n/index.js'
import { kindLabel } from './i18n/kinds.js'
import { pageByPath, pathOf } from './landing/pages.js'
import { go } from './nav.js'
import NotFound from './components/NotFound.jsx'
import { currentUser, ensureSession, onUser } from './api.js'
import { slimDesigns } from './slimDesigns.js'

// Each page is its own chunk: a visitor downloads only the page in front of them.
const PAGES = {
  landing: () => import('./landing/Landing.jsx'),
  auth: () => import('./auth/AuthPage.jsx'),
  home: () => import('./home/HomePage.jsx'),
  editor: () => import('./editor/EditorPage.jsx'),
  creator: () => import('./creators/CreatorStudio.jsx'),
}
const Landing = lazy(PAGES.landing)
const AuthPage = lazy(PAGES.auth)
const HomePage = lazy(PAGES.home)
const EditorPage = lazy(PAGES.editor)
const CreatorStudio = lazy(PAGES.creator)
// A shared presentation (/v/<id>) — public, view-only, no account needed.
const SharedDeck = lazy(() => import('./share/SharedDeck.jsx'))
const sharedId = () => window.location.pathname.match(/^\/v\/([A-Za-z0-9_-]{8,40})\/?$/)?.[1] ?? null
// QalamChat (bottom-right chat to the team) is its own small chunk, shown only on the landing (not inside the app after sign-up).
const QalamChat = lazy(() => import('./components/QalamChat.jsx'))

// Sign-up / sign-in have their own public addresses (/royxatdan-otish, /kirish).
const toAuth = (id) => () => go(pathOf(id))
const toSignup = toAuth('signup')
const toLogin = toAuth('login')
const chat = <Suspense fallback={null}><QalamChat onSignup={toSignup} onLogin={toLogin} /></Suspense>

// Once the first page is up and the browser is idle, fetch the pages a click away,
// so moving between them never waits on the network.
const NEXT = { landing: ['auth', 'home'], auth: ['home'], home: ['editor', 'creator'], editor: ['home'], creator: ['home'] }
const prefetched = new Set()
function prefetchAfter(page) {
  const run = () => NEXT[page].forEach((p) => prefetched.has(p) || (prefetched.add(p), PAGES[p]().catch(() => prefetched.delete(p))))
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

const PageLoading = () => <div className="page-loading" role="status" aria-busy="true" />

// Routes. The app lives behind "#/": "#/" → home, "#/d/<id>" → editor for that design,
// "#/auth" / "#/auth/login" → sign-up / sign-in (still used by in-app links).
// With no hash the path decides: "/" → landing, a public page (src/landing/pages.js) → that page.
const noHash = () => ['', '#', '#/welcome'].includes(window.location.hash)
const parseRoute = () => window.location.hash.match(/^#\/d\/(.+)$/)?.[1] ?? null
const publicPage = () => (noHash() ? pageByPath(window.location.pathname) : null)
// Landing variant to show: 'home' or a section page id; null when another screen is up.
const parseLanding = () => {
  if (!noHash()) return null
  const p = publicPage()
  if (p) return p.auth ? null : p.id
  return ['', '/index.html'].includes(window.location.pathname.replace(/\/+$/, '')) ? 'home' : 'notfound'
}
const parseAuth = () => {
  const p = publicPage()
  if (p?.auth) return p.auth
  const m = window.location.hash.match(/^#\/auth(?:\/(login))?$/)
  return m ? (m[1] ? 'login' : 'register') : null
}

export default function App() {
  const shareId = sharedId()
  return (
    <Suspense fallback={<PageLoading />}>
      {shareId ? <SharedDeck shareId={shareId} /> : <Pages />}
    </Suspense>
  )
}

function Pages() {
  const [designId, setDesignId] = useState(parseRoute)
  const [landing, setLanding] = useState(parseLanding)
  const [authMode, setAuthMode] = useState(parseAuth)
  const [designs, setDesigns] = useState(loadDesigns)
  const [nextPanel, setNextPanel] = useState('templates')
  const [openAppId, setOpenAppId] = useState(null)
  const [toast, setToast] = useState(null)
  // the app itself is for signed-in accounts only; until one is confirmed nothing of it renders
  const [me, setMe] = useState(currentUser)
  const [authFailed, setAuthFailed] = useState(null)
  useEffect(() => onUser(setMe), [])

  // designs changed on another device arrived
  useEffect(() => onSynced((got) => got.designs && setDesigns(loadDesigns())), [])

  // pictures inside designs (old base64, or downloaded from another device) move onto this device
  const meId = me && !me.isGuest ? me.id : null
  useEffect(() => {
    if (!meId) return
    const slim = () => slimDesigns().then((changed) => changed && setDesigns(loadDesigns())).catch(() => {})
    slim()
    return onSynced((got) => got.designs && slim())
  }, [meId])

  useEffect(() => {
    const onHash = () => {
      setDesignId(parseRoute())
      setLanding(parseLanding())
      setAuthMode(parseAuth())
      setDesigns(loadDesigns())
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const notify = useCallback((msg) => setToast({ msg, key: Date.now() }), [])
  const openDesign = useCallback((id) => {
    window.location.hash = `#/d/${id}`
  }, [])
  // Into the app from a public page: drop the path so the address is "/#/".
  const goHome = useCallback(() => {
    if (window.location.pathname !== '/') go('/#/')
    else window.location.hash = '#/'
  }, [])
  const onSave = useCallback((deck) => saveDesign(deck), [])

  // blank: opened from a type card (not a template) — an empty page, no template picked yet.
  const create = ({ topic, templateId, kind, count, ai, slides, blank }) => {
    const deck = newDeck({ topic, templateId, kind, count, slides, blank: blank && !ai })
    saveDesign(deck)
    setNextPanel(ai ? 'ai' : 'templates')
    setOpenAppId(null)
    if (ai) notify(t('design.aiReady', { topic, kind: kindLabel(kind ?? 'Taqdimot').toLowerCase(), n: deck.slides.length }))
    openDesign(deck.id)
  }

  // Logo, link-in-bio and resume designs open in their own studio.
  const createKit = async (type, templateId) => {
    const { newKit } = await import('./creators/kits.js') // templates load with the studio
    const kit = newKit(type, templateId)
    saveDesign(kit)
    openDesign(kit.id)
  }

  // AI presentation from an app modal: the AI taqdimot page writes it (and charges there), with this topic.
  const createPaid = (topic) => {
    setOpenAppId(null)
    sessionStorage.setItem('qalamai.tab', 'aideck')
    sessionStorage.setItem('qalamai.deckTopic', topic ?? '')
    window.dispatchEvent(new CustomEvent('qalam:ai-deck', { detail: { topic: topic ?? '' } }))
    if (designId) goHome()
  }

  const deck = useMemo(() => (designId ? getDesign(designId) : null), [designId])

  const page = landing ? 'landing' : authMode ? 'auth' : deck ? (isKit(deck) ? 'creator' : 'editor') : 'home'
  useEffect(() => prefetchAfter(page), [page])

  // Unknown design id (deleted / other browser) → back home.
  useEffect(() => {
    if (designId && !deck) goHome()
  }, [designId, deck, goHome])

  const inApp = landing !== 'notfound' && !landing && !authMode
  useEffect(() => {
    if (!inApp || currentUser()) return
    setAuthFailed(null)
    // no session: ensureSession sends the browser to sign-up / sign-in itself
    ensureSession().catch((err) => err?.code === 'OFFLINE' && setAuthFailed(err))
  }, [inApp])

  if (landing === 'notfound') return <NotFound />

  if (landing) {
    return (
      <>
        <Landing key={landing} page={landing} onStart={toSignup} onLogin={toLogin} />
        {chat}
      </>
    )
  }

  if (authMode) {
    const toApp = () => go('/#/')
    return (
      <AuthPage
        mode={authMode}
        onMode={(m) => go(pathOf(m === 'login' ? 'login' : 'signup'), { replace: true })}
        onDone={toApp}
        onBack={() => go('/')}
      />
    )
  }

  if (!me || me.isGuest) {
    return authFailed ? (
      <div className="auth-wait" role="alert">
        <p>{authFailed.message}</p>
        <button className="btn primary" onClick={() => { setAuthFailed(null); ensureSession().catch((err) => err?.code === 'OFFLINE' && setAuthFailed(err)) }}>
          {t('pe.retry')}
        </button>
      </div>
    ) : (
      <PageLoading />
    )
  }

  const toastEl = toast && (
    <div className="toast" key={toast.key} role="status">
      {toast.msg}
    </div>
  )

  if (deck && isKit(deck)) {
    return (
      <>
        <CreatorStudio key={deck.id} design={deck} onBack={goHome} onSave={onSave} notify={notify} />
        <CoinShopHost notify={notify} />
        {toastEl}
      </>
    )
  }

  if (deck) {
    return (
      <>
        <EditorPage
          key={deck.id}
          initialDeck={deck}
          initialPanel={nextPanel}
          onHome={goHome}
          onSave={onSave}
          onOpenDesign={openDesign}
          notify={notify}
        />
        <CoinShopHost notify={notify} />
        {toastEl}
      </>
    )
  }

  const openApp = APPS.find((a) => a.id === openAppId)

  return (
    <>
      <HomePage
        designs={designs}
        onCreate={create}
        onOpenDesign={openDesign}
        onDuplicateDesign={(id) => {
          duplicateDesign(id)
          setDesigns(loadDesigns())
          notify(t('design.copied'))
        }}
        onDeleteDesign={(id) => {
          deleteDesign(id)
          setDesigns(loadDesigns())
          notify(t('design.deleted'))
        }}
        onRenameDesign={(id, name) => {
          const d = getDesign(id)
          if (!d) return
          saveDesign({ ...d, name, updatedAt: Date.now() })
          setDesigns(loadDesigns())
          notify(t('design.renamed'))
        }}
        onOpenApp={setOpenAppId}
        onOpenPricing={() => openCoinShop()}
        onCreateKit={createKit}
        notify={notify}
      />

      {openApp && (
        <AppModal
          key={openApp.id}
          app={openApp}
          onClose={() => setOpenAppId(null)}
          onCreate={(app, topic) => {
            if (app.id === 'prezentatsiya') return createPaid(topic)
            setOpenAppId(null)
            notify(t('design.appDemo', { topic, app: app.name }))
          }}
          onOpenPricing={() => {
            setOpenAppId(null)
            openCoinShop()
          }}
        />
      )}

      <CoinShopHost notify={notify} />

      {toastEl}
    </>
  )
}
