import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AppModal } from './components/Modals.jsx'
import { CoinShopHost } from './components/Coins.jsx'
import { openCoinShop, spendCoins } from './coins.js'
import { APPS } from './data.js'
import { onSynced } from './changes.js'
import { deleteDesign, duplicateDesign, getDesign, loadDesigns, newDeck, saveDesign } from './store.js'
import { isKit } from './creators/kitTypes.js'
import { t } from './i18n/index.js'
import { kindLabel } from './i18n/kinds.js'

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

// Routes: "" or "#/welcome" → landing, "#/" → home, "#/d/<id>" → editor for that design.
const parseRoute = () => window.location.hash.match(/^#\/d\/(.+)$/)?.[1] ?? null
const isLanding = () => ['', '#', '#/welcome'].includes(window.location.hash)
// "#/auth" → sign-up, "#/auth/login" → sign-in
const parseAuth = () => {
  const m = window.location.hash.match(/^#\/auth(?:\/(login))?$/)
  return m ? (m[1] ? 'login' : 'register') : null
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Pages />
    </Suspense>
  )
}

function Pages() {
  const [designId, setDesignId] = useState(parseRoute)
  const [landing, setLanding] = useState(isLanding)
  const [authMode, setAuthMode] = useState(parseAuth)
  const [designs, setDesigns] = useState(loadDesigns)
  const [nextPanel, setNextPanel] = useState('templates')
  const [openAppId, setOpenAppId] = useState(null)
  const [toast, setToast] = useState(null)

  // designs changed on another device arrived
  useEffect(() => onSynced((got) => got.designs && setDesigns(loadDesigns())), [])

  useEffect(() => {
    const onHash = () => {
      setDesignId(parseRoute())
      setLanding(isLanding())
      setAuthMode(parseAuth())
      setDesigns(loadDesigns())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
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
  const goHome = useCallback(() => {
    window.location.hash = '#/'
  }, [])
  const onSave = useCallback((deck) => saveDesign(deck), [])

  const create = ({ topic, templateId, kind, count, ai, slides }) => {
    const deck = newDeck({ topic, templateId, kind, count, slides })
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

  // AI presentation from an app modal: pay first, then build.
  const createPaid = async (topic) => {
    try {
      if (!(await spendCoins('prezentatsiya', { topic }))) return
    } catch (err) {
      notify(err.message)
      return
    }
    create({ topic, templateId: 'pitch', count: 10, ai: true })
  }

  const deck = useMemo(() => (designId ? getDesign(designId) : null), [designId])

  const page = landing ? 'landing' : authMode ? 'auth' : deck ? (isKit(deck) ? 'creator' : 'editor') : 'home'
  useEffect(() => prefetchAfter(page), [page])

  // Unknown design id (deleted / other browser) → back home.
  useEffect(() => {
    if (designId && !deck) goHome()
  }, [designId, deck, goHome])

  if (landing) {
    return (
      <Landing
        onStart={() => {
          window.location.hash = '#/auth'
          window.scrollTo(0, 0)
        }}
        onLogin={() => {
          window.location.hash = '#/auth/login'
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  if (authMode) {
    const toApp = () => {
      window.location.hash = '#/'
      window.scrollTo(0, 0)
    }
    return (
      <AuthPage
        mode={authMode}
        onMode={(m) => window.location.replace(m === 'login' ? '#/auth/login' : '#/auth')}
        onDone={toApp}
        onGuest={toApp}
        onBack={() => {
          window.location.hash = '#/welcome'
        }}
      />
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
