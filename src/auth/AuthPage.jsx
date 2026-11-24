import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EnvelopeSimple, LockSimple, Eye, EyeSlash, User, ArrowLeft, ArrowRight, CircleNotch, WarningCircle, Info,
  TelegramLogo, Check, Sparkle,
} from '@phosphor-icons/react'
import { Wordmark } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { TEMPLATES, sampleDeck } from '../editor/templates.js'
import { TOOL_UI } from '../files/toolMeta.js'
import { login, peekSession, register, signInWithGoogle } from '../api.js'
import TelegramFlow from './TelegramFlow.jsx'
import '../editor/editor.css'
import './auth.css'
import { t } from '../i18n/index.js'
import { applySeo, NOINDEX } from '../seo.js'
import { pathOf } from '../landing/pages.js'

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
const GOOGLE_ERRORS = { google_off: 'au.g.off', google_cancelled: 'au.g.cancelled', google_state: 'au.g.state', google_failed: 'au.g.failed', google_no_account: 'au.g.noAccount', google_exists: 'au.g.exists' }

/** Read ?auth_error once and drop it from the address bar. */
function takeAuthError() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('auth_error')
  if (!code) return null
  url.searchParams.delete('auth_error')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  // "no account yet" / "already registered" come with a button to the other form
  const code2 = code === 'google_no_account' ? 'ACCOUNT_NOT_FOUND' : code === 'google_exists' ? 'ACCOUNT_EXISTS' : null
  return { msg: t(GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.google_failed), code: code2 }
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

/** Real template slides and document pages, laid out as a slowly scrolling, tilted wall. */
const WALL_COLS = 4

function DocPage({ kind }) {
  const [uni, type, topic, done, sup, toc, ...rows] = t('au.vis.doc').split('|')
  if (kind === 'title') {
    return (
      <div className="au-page title">
        <small>{t('bp.ministry')}</small>
        <small>{uni}</small>
        <b>{type}</b>
        <span>{topic}</span>
        <em>{done}<br />{sup}</em>
      </div>
    )
  }
  return (
    <div className="au-page toc">
      <b>{toc}</b>
      {rows.map((row, i) => (
        <span key={row} className={row.startsWith('1.') ? 'sub' : ''}><em>{row}</em><i />{3 + i * 5}</span>
      ))}
    </div>
  )
}

function useWallColumns() {
  return useMemo(() => {
    // cover + one inner page of every template, interleaved so neighbours differ
    const covers = TEMPLATES.map((tpl) => ({ tpl, slide: sampleDeck(tpl, 1)[0] }))
    const inner = TEMPLATES.map((tpl) => ({ tpl, slide: sampleDeck(tpl, 3)[2] ?? sampleDeck(tpl, 2)[1] })).filter((x) => x.slide)
    const pool = covers.flatMap((c, i) => (inner[i] ? [c, inner[(i * 7) % inner.length]] : [c]))
    const cols = Array.from({ length: WALL_COLS }, () => [])
    pool.forEach((item, i) => cols[i % WALL_COLS].push({ ...item, key: `s${i}` }))
    // a title page and a contents page in two of the columns
    cols[1].splice(2, 0, { doc: 'title', key: 'd1' })
    cols[3].splice(3, 0, { doc: 'toc', key: 'd2' })
    return cols
  }, [])
}

function Wall() {
  const cols = useWallColumns()
  const card = (it, dup) =>
    it.doc ? (
      <div key={it.key + dup} className="au-wall-card doc"><DocPage kind={it.doc} /></div>
    ) : (
      <div key={it.key + dup} className="au-wall-card">
        <Slide slide={it.slide} theme={it.tpl.theme} preview />
      </div>
    )
  return (
    <div className="au-wall">
      <div className="au-wall-tilt">
        {cols.map((col, c) => (
          <div key={c} className={`au-wall-col ${c % 2 ? 'down' : 'up'}`} style={{ '--dur': `${70 + c * 9}s` }}>
            {/* the list twice, so moving by half its height loops seamlessly */}
            <div className="au-wall-track">
              {col.map((it) => card(it, 'a'))}
              {col.map((it) => card(it, 'b'))}
            </div>
          </div>
        ))}
      </div>
      <span className="au-vis-chip">
        <span className="spark"><Sparkle size={11} weight="fill" /></span>
        {t('au.vis.chip')}
        <Check size={11} weight="bold" />
      </span>
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
      <div className="au-show-stage" aria-hidden="true"><Wall /></div>
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

export default function AuthPage({ mode, onMode, onDone, onBack }) {
  const isSignup = mode === 'register'
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState({})
  const [busy, setBusy] = useState(false)
  // { msg, code } — code ACCOUNT_EXISTS / ACCOUNT_NOT_FOUND adds a button to the other form
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
    peekSession().then((u) => live && u && !u.isGuest && done.current(u))
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
    // sign-in / sign-up forms have public addresses but stay out of search results
    applySeo({
      title: isSignup ? t('au.titleSignup') : t('au.titleLogin'),
      description: isSignup ? t('au.descSignup') : t('au.descLogin'),
      path: pathOf(isSignup ? 'signup' : 'login'),
      robots: NOINDEX,
    })
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
      setError({ msg: err.message || t('au.err.generic'), code: err.code })
    } finally {
      setBusy(false)
    }
  }
  const switchTo = error?.code === 'ACCOUNT_EXISTS' || error?.code === 'ALREADY_SIGNED_IN' ? 'login' : error?.code === 'ACCOUNT_NOT_FOUND' ? 'register' : null

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
            <TelegramFlow
              name={name.trim()}
              mode={isSignup ? 'signup' : 'login'}
              onDone={onDone}
              onCancel={() => setViaTelegram(false)}
              onSwitch={() => onMode(isSignup ? 'login' : 'register')}
            />
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
                <WarningCircle size={16} weight="fill" /> <span>{error.msg}</span>
                {switchTo && switchTo !== mode && (
                  <button type="button" className="au-alert-go" onClick={() => onMode(switchTo)}>
                    {switchTo === 'login' ? t('au.login') : t('au.createAccount')} <ArrowRight size={12} weight="bold" />
                  </button>
                )}
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
                signInWithGoogle(isSignup ? 'signup' : 'login')
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
