import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EnvelopeSimple, LockSimple, Eye, EyeSlash, User, ArrowLeft, ArrowRight, CircleNotch, WarningCircle, Info,
  TelegramLogo, Check, Sparkle, ArrowsLeftRight,
} from '@phosphor-icons/react'
import { Wordmark } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { getTemplate } from '../editor/templates.js'
import { TOOL_UI } from '../files/toolMeta.js'
import { ensureSession, login, register, signInWithGoogle } from '../api.js'
import TelegramFlow from './TelegramFlow.jsx'
import '../editor/editor.css'
import './auth.css'
import { t } from '../i18n/index.js'

/* ───────── validation (mirrors the server: e-mail or Uzbek phone, password ≥ 8) ───────── */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const phoneDigits = (v) => v.replace(/[^\d]/g, '')
const isPhone = (v) => {
  const d = phoneDigits(v)
  return (d.length === 12 && d.startsWith('998')) || d.length === 9
}
const loginError = (v) => {
  const s = v.trim()
  if (!s) return t('au.err.loginEmpty')
  if (/^[+\d\s()-]+$/.test(s)) return isPhone(s) ? null : t('au.err.phone')
  return EMAIL.test(s) ? null : t('au.err.email')
}
const passwordError = (v) => (v.length < 8 ? t('au.err.password') : null)

/** 0–4 strength score with a label, for the sign-up meter. */
function strength(p) {
  if (!p) return { score: 0, label: '' }
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++
  else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += 0.5
  const score = p.length < 8 ? Math.min(1, Math.round(s)) : Math.min(4, Math.round(s)) // too short is never better than «Zaif»
  return { score, label: t('au.strength').split('|')[score] }
}

/** Reasons the server sends back after a Google trip (?auth_error=…). */
const GOOGLE_ERRORS = { google_off: 'au.g.off', google_cancelled: 'au.g.cancelled', google_state: 'au.g.state', google_failed: 'au.g.failed' }

/** Read ?auth_error once and drop it from the address bar. */
function takeAuthError() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('auth_error')
  if (!code) return null
  url.searchParams.delete('auth_error')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  return t(GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.google_failed)
}
// read once per page load: Google sends the browser back with a fresh page
let pendingAuthError = takeAuthError()

/* ───────── small parts ───────── */

function Field({ icon: Icon, error, children, trailing }) {
  return (
    <div className={`au-field ${error ? 'bad' : ''}`}>
      <span className="au-field-ic" aria-hidden="true"><Icon size={18} /></span>
      <span className="au-field-sep" aria-hidden="true" />
      {children}
      {trailing}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/* ───────── right-hand showcase carousel ───────── */

const SHOW_COUNT = 3
const showItems = () =>
  Array.from({ length: SHOW_COUNT }, (_, i) => {
    const [title, text] = t(`au.show.${i}`, { n: Object.keys(TOOL_UI).length }).split('|')
    return { title, text }
  })

const slideOf = (id) => {
  const tpl = getTemplate(id)
  return { slide: { id: `au-${id}`, type: 'title', ...tpl.sample, elements: [] }, theme: tpl.theme }
}

function VisualSlides() {
  const items = useMemo(() => ['brand', 'pitch', 'quiz'].map(slideOf), [])
  return (
    <div className="au-vis-slides">
      {items.map((s, i) => (
        <div key={i} className={`au-vs s${i + 1}`}>
          <Slide slide={s.slide} theme={s.theme} preview />
        </div>
      ))}
      <span className="au-vis-chip">
        <span className="spark"><Sparkle size={11} weight="fill" /></span>
        {t('au.vis.chip')}
        <Check size={11} weight="bold" />
      </span>
    </div>
  )
}

function VisualDoc() {
  const [uni, type, topic, done, sup, toc, ...rows] = t('au.vis.doc').split('|')
  return (
    <div className="au-vis-doc">
      <div className="au-page title">
        <small>{t('bp.ministry')}</small>
        <small>{uni}</small>
        <b>{type}</b>
        <span>{topic}</span>
        <em>{done}<br />{sup}</em>
      </div>
      <div className="au-page toc">
        <b>{toc}</b>
        {rows.map((row, i) => (
          <span key={row} className={row.startsWith('1.') ? 'sub' : ''}><em>{row}</em><i />{3 + i * 5}</span>
        ))}
      </div>
    </div>
  )
}

function VisualTools() {
  const tools = Object.values(TOOL_UI).slice(0, 12)
  return (
    <div className="au-vis-tools">
      {tools.map((tool, i) => (
        <span key={i} className="au-tool" style={{ '--i': i }}>
          <span className={`ic c-${tool.color}`}><tool.icon size={14} weight="bold" /></span>
          <span>{tool.from}</span>
          <ArrowsLeftRight size={10} weight="bold" className="arr" />
          <span>{tool.to}</span>
        </span>
      ))}
    </div>
  )
}

function Showcase() {
  const [i, setI] = useState(0)
  const paused = useRef(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => !paused.current && setI((x) => (x + 1) % SHOW_COUNT), 5200)
    return () => clearInterval(timer)
  }, [])
  const SHOW = showItems()
  return (
    <aside
      className="au-show"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      aria-label={t('au.showAria')}
    >
      <div className="au-show-lines" aria-hidden="true" />
      <div className="au-show-stage" aria-hidden="true">
        <div className={`au-vis ${i === 0 ? 'on' : ''}`}><VisualSlides /></div>
        <div className={`au-vis ${i === 1 ? 'on' : ''}`}><VisualDoc /></div>
        <div className={`au-vis ${i === 2 ? 'on' : ''}`}><VisualTools /></div>
      </div>
      <div className="au-show-copy" aria-live="polite">
        <h2 key={`h${i}`}>{SHOW[i].title}</h2>
        <p key={`p${i}`}>{SHOW[i].text}</p>
        <div className="au-dots" role="tablist">
          {SHOW.map((s, k) => (
            <button key={k} role="tab" aria-selected={k === i} aria-label={s.title} className={k === i ? 'on' : ''} onClick={() => setI(k)} />
          ))}
        </div>
      </div>
    </aside>
  )
}

/* ───────── page ───────── */

export default function AuthPage({ mode, onMode, onDone, onBack, onGuest }) {
  const isSignup = mode === 'register'
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => pendingAuthError)
  const [note, setNote] = useState(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [viaTelegram, setViaTelegram] = useState(false)
  const idRef = useRef(null)

  const done = useRef(onDone)
  done.current = onDone

  // Already signed in with a real account? Skip the form (checked once, on mount).
  useEffect(() => {
    let live = true
    ensureSession()
      .then((u) => live && u && !u.isGuest && done.current(u))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    pendingAuthError = null
  }, [])

  const shownMode = useRef(mode)
  useEffect(() => {
    // switching login ⇄ register clears old messages (but not an ?auth_error shown on arrival)
    if (shownMode.current !== mode) {
      shownMode.current = mode
      setError(null)
    }
    setNote(null)
    setTouched({})
    idRef.current?.focus()
  }, [mode])

  useEffect(() => {
    const prev = document.title
    document.title = isSignup ? t('au.titleSignup') : t('au.titleLogin')
    return () => {
      document.title = prev
    }
  }, [isSignup])

  const errs = { id: loginError(id), pw: passwordError(pw) }
  const st = strength(pw)

  const submit = async (e) => {
    e.preventDefault()
    setTouched({ id: true, pw: true })
    setError(null)
    if (errs.id || errs.pw) return
    setBusy(true)
    try {
      const value = /^[+\d\s()-]+$/.test(id.trim()) ? `+998${phoneDigits(id).slice(-9)}` : id.trim()
      const u = isSignup ? await register({ login: value, password: pw, name: name.trim() }) : await login({ login: value, password: pw })
      onDone(u)
    } catch (err) {
      setError(err.message || t('au.err.generic'))
    } finally {
      setBusy(false)
    }
  }

  const soon = (what) => {
    setError(null)
    setNote(t('au.soon', { what }))
  }

  return (
    <div className="au">
      <main className="au-card">
        <header className="au-top">
          <button className="au-back" onClick={onBack}>
            <ArrowLeft size={15} weight="bold" /> {t('au.home')}
          </button>
        </header>

        <div className="au-body">
          <div className="au-logo">
            <Wordmark size={30} />
          </div>
          <h1>{isSignup ? t('au.hSignup') : t('au.hLogin')}</h1>
          <p className="au-lead">
            {isSignup ? t('au.leadSignup') : t('au.leadLogin')}
          </p>

          {viaTelegram ? (
            <TelegramFlow name={name.trim()} onDone={onDone} onCancel={() => setViaTelegram(false)} />
          ) : (
          <>
          <form className="au-form" onSubmit={submit} noValidate>
            {isSignup && (
              <Field icon={User}>
                <input
                  type="text"
                  placeholder={t('au.namePh')}
                  autoComplete="name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  aria-label={t('au.name')}
                />
              </Field>
            )}

            <Field icon={EnvelopeSimple} error={touched.id && errs.id}>
              <input
                ref={idRef}
                type="text"
                inputMode="email"
                placeholder={t('au.idPh')}
                autoComplete="username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                onBlur={() => setTouched((x) => ({ ...x, id: true }))}
                aria-label={t('au.idPh')}
                aria-invalid={!!(touched.id && errs.id)}
                aria-describedby="au-id-err"
              />
            </Field>
            {touched.id && errs.id && <p className="au-err" id="au-id-err">{errs.id}</p>}

            <Field
              icon={LockSimple}
              error={touched.pw && errs.pw}
              trailing={
                <button type="button" className="au-eye" onClick={() => setShow((s) => !s)} aria-label={show ? t('au.hidePw') : t('au.showPw')}>
                  {show ? <Eye size={18} /> : <EyeSlash size={18} />}
                </button>
              }
            >
              <input
                type={show ? 'text' : 'password'}
                placeholder={isSignup ? t('au.pwNewPh') : t('au.pwPh')}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onBlur={() => setTouched((x) => ({ ...x, pw: true }))}
                aria-label={t('au.pw')}
                aria-invalid={!!(touched.pw && errs.pw)}
                aria-describedby="au-pw-err"
              />
            </Field>
            {touched.pw && errs.pw && <p className="au-err" id="au-pw-err">{errs.pw}</p>}

            {isSignup ? (
              pw && (
                <div className="au-meter" aria-live="polite">
                  <div className="bars">
                    {[1, 2, 3, 4].map((n) => <i key={n} className={st.score >= n ? `on s${st.score}` : ''} />)}
                  </div>
                  <span>{st.label}</span>
                </div>
              )
            ) : (
              <div className="au-row">
                <span />
                <button type="button" className="au-link" onClick={() => soon(t('au.resetPw'))}>{t('au.forgot')}</button>
              </div>
            )}

            {error && (
              <div className="au-alert" role="alert">
                <WarningCircle size={16} weight="fill" /> {error}
              </div>
            )}
            {note && (
              <div className="au-alert info" role="status">
                <Info size={16} weight="fill" /> {note}
              </div>
            )}

            <button className="au-submit" type="submit" disabled={busy}>
              {busy ? <CircleNotch size={18} className="au-spin" /> : isSignup ? t('au.signup') : t('au.login')}
            </button>
          </form>

          <div className="au-or"><span>{t('au.or')}</span></div>

          <div className="au-social">
            <button
              type="button"
              disabled={googleBusy}
              onClick={() => {
                setGoogleBusy(true)
                signInWithGoogle()
              }}
            >
              {googleBusy ? <CircleNotch size={18} className="au-spin" /> : <GoogleMark />} Google
            </button>
            <button type="button" onClick={() => setViaTelegram(true)}><TelegramLogo size={19} weight="fill" color="#229ED9" /> Telegram</button>
          </div>

          </>
          )}

          <p className="au-switch">
            {isSignup ? t('au.haveAccount') : t('au.noAccount')}{' '}
            <button type="button" onClick={() => onMode(isSignup ? 'login' : 'register')}>
              {isSignup ? t('au.login') : t('au.createAccount')}
            </button>
          </p>
          <button type="button" className="au-guest" onClick={onGuest}>
            {t('au.guest')} <ArrowRight size={13} weight="bold" />
          </button>
        </div>

        <footer className="au-foot">
          <span>{t('lp.ft.rights', { year: new Date().getFullYear() })}</span>
          {isSignup && <span>{t('au.agree')}</span>}
        </footer>
      </main>

      <Showcase />
    </div>
  )
}
