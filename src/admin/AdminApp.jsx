// QalamAI admin panel — /admin. Its own small app: a password gate, then Statistika,
// Foydalanuvçilar and Sozlamalar. Pages are picked by the hash (#users, #settings).
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, BarChart3, LogOut, Menu, MessageSquare, Moon, Settings, Sun, Users, X } from 'lucide-react'
import { Wordmark } from '../components/ui.jsx'
import { admin, onSignedOut } from './api.js'
import Login from './Login.jsx'
import './admin.css'

const Dashboard = lazy(() => import('./Dashboard.jsx'))
const UsersPage = lazy(() => import('./Users.jsx'))
const SettingsPage = lazy(() => import('./Settings.jsx'))
const ChatPage = lazy(() => import('./Chat.jsx'))
// same event name as Chat.jsx (kept here so the sidebar does not load that chunk)
const CHAT_CHANGED = 'qalam-admin-chat'

const NAV = [
  { id: 'stats', label: 'Statistika', icon: BarChart3 },
  { id: 'users', label: 'Foydalanuvçilar', icon: Users },
  { id: 'chat', label: 'ChatBot', icon: MessageSquare },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
]
const pageFromHash = () => {
  const h = window.location.hash.slice(1)
  return NAV.some((n) => n.id === h) ? h : 'stats'
}

const THEME_KEY = 'qalam.admin.theme'
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.dataset.adTheme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0c0e12' : '#f5f6f8')
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export default function AdminApp() {
  const [state, setState] = useState('checking') // checking | out | in
  const [theme, toggleTheme] = useTheme()

  useEffect(() => {
    document.title = 'Admin — QalamAI'
    let robots = document.querySelector('meta[name=robots]')
    robots?.setAttribute('content', 'noindex, nofollow')
    admin.me().then(
      () => setState('in'),
      () => setState('out'),
    )
    return onSignedOut(() => setState('out'))
  }, [])

  if (state === 'checking') return <div className="ad-root ad-boot" />
  if (state === 'out') return <Login onIn={() => setState('in')} theme={theme} toggleTheme={toggleTheme} />
  return <Shell theme={theme} toggleTheme={toggleTheme} onOut={() => setState('out')} />
}

function Shell({ theme, toggleTheme, onOut }) {
  const [page, setPage] = useState(pageFromHash)
  const [menu, setMenu] = useState(false)
  const unread = useUnreadChat()

  useEffect(() => {
    const on = () => setPage(pageFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = (id) => {
    window.location.hash = id === 'stats' ? '' : id
    setPage(id)
    setMenu(false)
    window.scrollTo({ top: 0 })
  }
  const logout = useCallback(async () => {
    await admin.logout().catch(() => {})
    onOut()
  }, [onOut])

  return (
    <div className={`ad-root ad-shell ${menu ? 'menu-open' : ''}`}>
      <aside className="ad-side">
        <div className="ad-brand">
          <Wordmark size={21} />
          <span className="ad-brand-tag">Admin</span>
          <button className="ad-icon ad-side-close" onClick={() => setMenu(false)} aria-label="Yopiş">
            <X size={18} />
          </button>
        </div>
        <nav className="ad-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`ad-nav-item ${page === id ? 'on' : ''}`} onClick={() => go(id)}>
              <Icon size={18} strokeWidth={1.9} />
              {label}
              {id === 'chat' && unread > 0 && <span className="ad-nav-count">{unread > 99 ? '99+' : unread}</span>}
            </button>
          ))}
        </nav>
        <div className="ad-side-foot">
          <button className="ad-nav-item" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.9} /> : <Moon size={18} strokeWidth={1.9} />}
            {theme === 'dark' ? 'Yoruğ rejim' : 'Qoronği rejim'}
          </button>
          <a className="ad-nav-item" href="/" target="_blank" rel="noreferrer">
            <ArrowUpRight size={18} strokeWidth={1.9} />
            Saytni oçiş
          </a>
          <button className="ad-nav-item" onClick={logout}>
            <LogOut size={18} strokeWidth={1.9} />
            Çiqiş
          </button>
        </div>
      </aside>
      <div className="ad-scrim" onClick={() => setMenu(false)} />
      <main className="ad-main">
        <div className="ad-topbar">
          <button className="ad-icon" onClick={() => setMenu(true)} aria-label="Menyu">
            <Menu size={20} />
          </button>
          <Wordmark size={18} />
          <span className="ad-brand-tag">Admin</span>
        </div>
        <Suspense fallback={<PageSkeleton />}>
          {page === 'stats' && <Dashboard />}
          {page === 'users' && <UsersPage />}
          {page === 'chat' && <ChatPage />}
          {page === 'settings' && <SettingsPage onOut={onOut} />}
        </Suspense>
      </main>
    </div>
  )
}

/** New QalamChat messages for the sidebar badge: on load, every minute, and after a status change. */
function useUnreadChat() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    const load = () => admin.chat({ status: 'new', limit: 1 }).then((r) => live && setN(r.counts.new), () => {})
    load()
    const id = setInterval(load, 60_000)
    window.addEventListener(CHAT_CHANGED, load)
    return () => {
      live = false
      clearInterval(id)
      window.removeEventListener(CHAT_CHANGED, load)
    }
  }, [])
  return n
}

export function PageSkeleton() {
  return (
    <div className="ad-page">
      <div className="ad-sk ad-sk-title" />
      <div className="ad-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ad-card ad-sk ad-sk-kpi" />
        ))}
      </div>
      <div className="ad-card ad-sk ad-sk-chart" />
    </div>
  )
}
