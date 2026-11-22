import { useEffect, useRef, useState } from 'react'
import { Phone, ArrowLeft, CircleNotch, WarningCircle, TelegramLogo, CheckCircle, Key } from '@phosphor-icons/react'
import { setTgAutofill, telegramStart, telegramStatus, telegramVerify, tgAutofill } from '../api.js'
import { t } from '../i18n/index.js'
import { loadProfile, saveProfile } from '../profile.js'

const digits = (v) => v.replace(/\D/g, '')
/** "901234567" → "90 123 45 67" while typing. */
const pretty = (v) => {
  const d = digits(v).replace(/^998/, '').slice(0, 9)
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}

/**
 * Telegram sign-in: phone → the bot confirms it is the user's own number → 6-digit code.
 * With "avtomatik kiritiş" on, the code is filled in and submitted as soon as the bot confirms.
 */
export default function TelegramFlow({ name, mode, onDone, onCancel, onSwitch }) {
  const [phone, setPhone] = useState('')
  const [req, setReq] = useState(null) // { id, botUrl, botUsername, phone }
  const [status, setStatus] = useState('pending')
  const [code, setCode] = useState('')
  const [auto, setAuto] = useState(tgAutofill)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [errCode, setErrCode] = useState(null)
  const phoneRef = useRef(null)
  const codeRef = useRef(null)
  const submitted = useRef(false)

  useEffect(() => phoneRef.current?.focus(), [])

  const start = async (e) => {
    e.preventDefault()
    const d = digits(phone).replace(/^998/, '')
    if (d.length !== 9) return setError(t('tg.fullNumber'))
    setBusy(true)
    setError(null)
    try {
      const r = await telegramStart(`+998${d}`, mode)
      setReq(r)
      setStatus('pending')
      setCode('')
      submitted.current = false
    } catch (err) {
      setError(err.message)
      setErrCode(err.code)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (value = code) => {
    if (digits(value).length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const u = await telegramVerify(req.id, digits(value), name, mode)
      // fill the local profile (titul, slides) from Telegram where it is still empty
      const p = loadProfile()
      const next = { ...p, fullName: p.fullName.trim() || u.name || '', phone: p.phone.trim() || u.phone || '' }
      if (next.fullName !== p.fullName || next.phone !== p.phone) saveProfile(next, { touch: false })
      onDone(u)
    } catch (err) {
      setError(err.message)
      setErrCode(err.code)
      submitted.current = false
      if (err.code === 'TG_EXPIRED' || err.code === 'TG_TOO_MANY') setStatus('expired')
    } finally {
      setBusy(false)
    }
  }

  // poll while waiting for the bot; stop once expired or done
  useEffect(() => {
    if (!req || status === 'expired') return
    const ctrl = new AbortController()
    let timer
    const tick = async () => {
      try {
        const s = await telegramStatus(req.id, { signal: ctrl.signal })
        setStatus(s.status)
        if (s.status === 'verified') {
          if (auto && s.code && !submitted.current) {
            submitted.current = true
            setCode(s.code)
            verify(s.code)
          } else codeRef.current?.focus()
          return
        }
        if (s.status === 'expired') return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
      timer = setTimeout(tick, 2000)
    }
    tick()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req, auto, status === 'verified', status === 'expired'])

  const toggleAuto = (on) => {
    setAuto(on)
    setTgAutofill(on)
  }

  // "no account yet" / "already registered": one tap to the other form (the code stays valid)
  const other = errCode === 'ACCOUNT_EXISTS' ? 'login' : errCode === 'ACCOUNT_NOT_FOUND' ? 'signup' : null
  const alert = (
    <div className="au-alert" role="alert">
      <WarningCircle size={16} weight="fill" /> <span>{error}</span>
      {other && other !== mode && (
        <button
          type="button"
          className="au-alert-go"
          onClick={() => {
            setError(null)
            setErrCode(null)
            onSwitch?.()
          }}
        >
          {other === 'login' ? t('au.login') : t('au.createAccount')}
        </button>
      )}
    </div>
  )
  const back = (
    <button type="button" className="au-link tg-back" onClick={req ? () => setReq(null) : onCancel}>
      <ArrowLeft size={14} weight="bold" /> {req ? t('tg.changeNumber') : t('tg.otherWay')}
    </button>
  )

  if (!req) {
    return (
      <form className="au-form" onSubmit={start} noValidate>
        <div className="tg-head">
          <span className="tg-badge"><TelegramLogo size={22} weight="fill" /></span>
          <div>
            <b>{t('tg.title')}</b>
            <small>{t('tg.lead')}</small>
          </div>
        </div>
        <div className={`au-field ${error ? 'bad' : ''}`}>
          <span className="au-field-ic" aria-hidden="true"><Phone size={18} /></span>
          <span className="au-field-sep" aria-hidden="true" />
          <span className="tg-prefix">+998</span>
          <input
            ref={phoneRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            value={pretty(phone)}
            onChange={(e) => setPhone(e.target.value)}
            aria-label={t('tg.phone')}
          />
        </div>
        {error && alert}
        <button className="au-submit tg-submit" type="submit" disabled={busy}>
          {busy ? <CircleNotch size={18} className="au-spin" /> : <><TelegramLogo size={18} weight="fill" /> {t('tg.getCode')}</>}
        </button>
        {back}
      </form>
    )
  }

  return (
    <form className="au-form" onSubmit={(e) => (e.preventDefault(), verify())} noValidate>
      <div className="tg-head">
        <span className="tg-badge"><TelegramLogo size={22} weight="fill" /></span>
        <div>
          <b>{req.phone.replace(/^(\+998)(\d\d)(\d{3})(\d\d)(\d\d)$/, '$1 $2 $3 $4 $5')}</b>
          <small>{t('tg.goBot')}</small>
        </div>
      </div>

      {status === 'expired' ? (
        <div className="au-alert" role="alert"><WarningCircle size={16} weight="fill" /> {t('tg.expired')}</div>
      ) : (
        <>
          <a className="au-submit tg-bot" href={req.botUrl} target="_blank" rel="noreferrer">
            <TelegramLogo size={19} weight="fill" /> {t('tg.fromBot')}
          </a>
          <p className="tg-howto">{t('tg.howto')}</p>
          <p className={`tg-status s-${status}`} aria-live="polite">
            {status === 'verified' ? <CheckCircle size={15} weight="fill" /> : <CircleNotch size={14} className="au-spin" />}
            {t(`tg.st.${status === 'verified' ? 'verified' : status === 'opened' ? 'opened' : 'pending'}`)}
          </p>
        </>
      )}

      {status !== 'expired' && (
        <div className="au-field tg-code">
          <span className="au-field-ic" aria-hidden="true"><Key size={18} /></span>
          <span className="au-field-sep" aria-hidden="true" />
          <input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="• • • • • •"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const v = digits(e.target.value).slice(0, 6)
              setCode(v)
              if (v.length === 6) verify(v)
            }}
            aria-label={t('tg.code')}
          />
        </div>
      )}

      <label className="tg-auto">
        <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} />
        {t('tg.auto')}
      </label>

      {error && status !== 'expired' && alert}

      {status === 'expired' ? (
        <button className="au-submit tg-submit" type="button" onClick={() => setReq(null)}>{t('tg.restart')}</button>
      ) : (
        <button className="au-submit tg-submit" type="submit" disabled={busy || code.length !== 6}>
          {busy ? <CircleNotch size={18} className="au-spin" /> : t('tg.confirm')}
        </button>
      )}
      {back}
    </form>
  )
}
