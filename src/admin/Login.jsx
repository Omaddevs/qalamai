import { useRef, useState } from 'react'
import { ArrowRight, Eye, EyeOff, FileText, Files, Lock, Moon, Presentation, ShieldCheck, Sun, Type } from 'lucide-react'
import { QalamNib, Wordmark } from '../components/ui.jsx'
import { admin } from './api.js'

// Backdrop borrowed from the landing's final CTA card: grid, light beam, rings, stars, floating tiles.
const TILES = [
  { Icon: Presentation, cls: 't1' },
  { Icon: FileText, cls: 't2' },
  { Icon: Files, cls: 't3' },
  { Icon: Type, cls: 't4' },
]
const STARS = [
  [12, 30, 0], [22, 78, 1.2], [31, 12, 2.4], [44, 88, 0.6], [57, 20, 1.8], [68, 84, 3], [79, 34, 0.9], [88, 70, 2.1], [93, 22, 1.5], [6, 58, 2.7],
]

export default function Login({ onIn, theme, toggleTheme }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const rootRef = useRef(null)

  // Spotlight follows the pointer via CSS vars — no re-render.
  const move = (e) => {
    const el = rootRef.current
    if (!el) return
    el.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`)
    el.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      await admin.login(password)
      onIn()
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ad-root ad-login" ref={rootRef} onPointerMove={move}>
      <span className="ad-login-spot" aria-hidden="true" />
      <span className="ad-login-grid" aria-hidden="true" />
      <span className="ad-login-beam" aria-hidden="true" />
      <div className="ad-login-rings" aria-hidden="true"><span /><span /><span /></div>
      {STARS.map(([x, y, d], i) => (
        <i key={i} className="ad-login-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} aria-hidden="true" />
      ))}
      {TILES.map(({ Icon, cls }) => (
        <span key={cls} className={`ad-login-tile ${cls}`} aria-hidden="true"><Icon size={26} strokeWidth={1.6} /></span>
      ))}
      <button className="ad-icon ad-login-theme" onClick={toggleTheme} aria-label="Rejim">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <form className={`ad-login-card ${error ? 'shake' : ''}`} onSubmit={submit} onAnimationEnd={(e) => e.currentTarget.classList.remove('shake')}>
        <div className="ad-login-nib">
          <QalamNib height={46} />
        </div>
        <div className="ad-login-head">
          <Wordmark size={24} />
          <span className="ad-brand-tag">Admin</span>
        </div>
        <h1>Boşqaruv paneliga kiriş</h1>
        <p className="ad-login-sub">Statistika, foydalanuvçilar va sayt sozlamalari</p>

        <label className="ad-field">
          <span>Parol</span>
          <div className="ad-input-wrap">
            <Lock size={16} className="ad-input-icon" />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••••"
              aria-invalid={Boolean(error)}
            />
            <button type="button" className="ad-input-btn" onClick={() => setShow((v) => !v)} aria-label={show ? 'Yaşiriş' : 'Körsatiş'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {error && <p className="ad-error">{error}</p>}
        <button className="ad-btn ad-btn-primary ad-btn-block" disabled={!password || busy}>
          {busy ? <span className="ad-spin" /> : <>Kiriş <ArrowRight size={16} /></>}
        </button>
        <p className="ad-login-foot">
          <ShieldCheck size={14} /> Himoyalangan ulaniş · 12 soatlik sessiya
        </p>
      </form>
    </div>
  )
}
