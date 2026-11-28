// «Aksiyalar»: Juma sovğasi (free coins every Friday) and Döst taklifi (coins for each friend who
// signs up through your link). The admin sets the amounts and switches them on/off.
import { useCallback, useEffect, useState } from 'react'
import {
  Gift, Confetti, Timer, CheckCircle, UsersThree, Copy, Check, TelegramLogo, WhatsappLogo, ShareNetwork, LinkSimple, UserPlus, Coins, Lock, ArrowsClockwise,
} from '@phosphor-icons/react'
import { CoinIcon } from '../components/Coins.jsx'
import { SIGNUP_BONUS } from '../coins.js'
import { claimFriday, getPromos, referralLink, useCountdown } from '../promos.js'
import { formatDate, formatNumber, t } from '../i18n/index.js'
import './promos.css'

const pad = (n) => String(n).padStart(2, '0')
/** Tashkent weekday now (0 = Sunday), so the week strip agrees with the server's Friday. */
const tashkentWeekday = () => new Date(Date.now() + 5 * 3600_000).getUTCDay()

export default function PromosView({ notify }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setError(false)
    getPromos().then(setData, () => setError(true))
  }, [])
  useEffect(load, [load])

  if (error)
    return (
      <div className="ak">
        <div className="ak-error">
          <p>{t('ak.error')}</p>
          <button className="ak-btn ghost" onClick={load}>
            <ArrowsClockwise size={16} weight="bold" /> {t('ak.retry')}
          </button>
        </div>
      </div>
    )

  return (
    <div className="ak">
      <header className="ak-head">
        <span className="ak-head-tile">
          <Gift size={26} weight="duotone" />
        </span>
        <div className="ak-head-text">
          <h1>{t('ak.title')}</h1>
          <p>{t('ak.sub')}</p>
        </div>
        {data && (
          <div className="ak-head-chips">
            <span className={`ak-chip ${data.friday.enabled ? 'on' : ''}`}>
              <i /> {t('ak.friday.name')}
            </span>
            <span className={`ak-chip ${data.referral.enabled ? 'on' : ''}`}>
              <i /> {t('ak.ref.name')}
            </span>
          </div>
        )}
      </header>

      {!data ? (
        <div className="ak-grid">
          <div className="ak-card ak-sk" />
          <div className="ak-card ak-sk" />
        </div>
      ) : (
        <div className="ak-grid">
          <FridayCard f={data.friday} onClaimed={load} notify={notify} />
          <ReferralCard r={data.referral} notify={notify} />
        </div>
      )}
    </div>
  )
}

/* ───────── Juma sovğasi ───────── */

function FridayCard({ f, onClaimed, notify }) {
  const [busy, setBusy] = useState(false)
  const [burst, setBurst] = useState(0)
  const [claimed, setClaimed] = useState(null)
  const done = f.claimed || claimed
  const ready = f.canClaim && !claimed
  const to = ready ? f.endsAt : f.nextAt
  const left = useCountdown(f.enabled ? to : null)
  // the countdown reached its end (Friday began or ended): read the state again
  useEffect(() => {
    if (left.done) onClaimed()
  }, [left.done, onClaimed])

  const claim = async () => {
    setBusy(true)
    try {
      const r = await claimFriday()
      setClaimed(r)
      setBurst(Date.now())
      notify?.(t('ak.friday.got', { coins: r.coins }))
      setTimeout(onClaimed, 1600)
    } catch (err) {
      notify?.(err.message)
      onClaimed()
    } finally {
      setBusy(false)
    }
  }

  const wd = tashkentWeekday()
  const days = t('date.weekdaysShort').split('|')
  const week = [1, 2, 3, 4, 5, 6, 0]

  return (
    <section className={`ak-card ak-friday ${f.enabled ? '' : 'off'} ${ready ? 'ready' : ''}`}>
      <div className="ak-fr-glow" aria-hidden="true" />
      <div className="ak-fr-top">
        <span className="ak-badge lime">
          <Confetti size={14} weight="fill" /> {t('ak.friday.name')}
        </span>
        {f.taken > 0 && <span className="ak-fr-taken">{t('ak.friday.taken', { n: f.taken })}</span>}
      </div>

      <div className="ak-fr-hero">
        <div className="ak-fr-coins" aria-hidden="true">
          <span className="c1"><CoinIcon size={58} /></span>
          <span className="c2"><CoinIcon size={44} /></span>
          <span className="c3"><CoinIcon size={34} /></span>
          {burst > 0 && (
            <span className="ak-burst" key={burst}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ '--a': `${i * 36}deg`, '--d': `${70 + (i % 3) * 22}px` }}>
                  <CoinIcon size={18} />
                </span>
              ))}
            </span>
          )}
        </div>
        <div>
          <div className="ak-fr-amount">
            +{formatNumber(f.coins)} <small>coin</small>
          </div>
          <h2>{!f.enabled ? t('ak.friday.offTitle') : ready ? t('ak.friday.readyTitle') : done ? t('ak.friday.doneTitle') : t('ak.friday.waitTitle')}</h2>
          <p>{!f.enabled ? t('ak.friday.offText') : ready ? t('ak.friday.readyText') : done ? t('ak.friday.doneText') : t('ak.friday.waitText', { coins: f.coins })}</p>
        </div>
      </div>

      <ol className="ak-week" aria-label={t('ak.friday.week')}>
        {week.map((d) => (
          <li key={d} className={`${d === 5 ? 'fri' : ''} ${d === wd ? 'today' : ''} ${d === 5 && done ? 'got' : ''}`}>
            <span>{days[d]}</span>
            {d === 5 ? done ? <Check size={14} weight="bold" /> : <Gift size={14} weight="fill" /> : <i />}
          </li>
        ))}
      </ol>

      {f.enabled ? (
        <div className="ak-fr-foot">
          <div className="ak-timer" aria-live="off">
            <span className="ak-timer-label">
              <Timer size={15} weight="bold" /> {ready ? t('ak.friday.endsIn') : t('ak.friday.nextIn')}
            </span>
            <span className="ak-timer-digits">
              {left.d > 0 && (
                <>
                  <b>{left.d}</b>
                  <small>{t('ak.unit.d')}</small>
                </>
              )}
              <b>{pad(left.h)}</b>
              <small>{t('ak.unit.h')}</small>
              <b>{pad(left.m)}</b>
              <small>{t('ak.unit.m')}</small>
              <b>{pad(left.s)}</b>
              <small>{t('ak.unit.s')}</small>
            </span>
          </div>
          {ready ? (
            <button className="ak-btn lime big" onClick={claim} disabled={busy}>
              <Gift size={20} weight="fill" /> {busy ? t('ak.friday.claiming') : t('ak.friday.claim', { coins: f.coins })}
            </button>
          ) : done ? (
            <span className="ak-done">
              <CheckCircle size={20} weight="fill" /> {t('ak.friday.doneShort')}
            </span>
          ) : (
            <span className="ak-next">{formatDate(f.nextAt, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          )}
        </div>
      ) : (
        <div className="ak-fr-foot">
          <span className="ak-next">
            <Lock size={16} weight="bold" /> {t('ak.paused')}
          </span>
        </div>
      )}
    </section>
  )
}

/* ───────── Döst taklifi ───────── */

function ReferralCard({ r, notify }) {
  const [copied, setCopied] = useState(false)
  const link = r.code ? referralLink(window.location.origin, r.code) : ''
  const welcome = SIGNUP_BONUS + (r.enabled ? r.friendCoins : 0)
  const text = t('ak.ref.shareText', { coins: welcome })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const el = document.createElement('textarea')
      el.value = link
      document.body.append(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setCopied(true)
    notify?.(t('ak.ref.copied'))
    setTimeout(() => setCopied(false), 1800)
  }
  const share = () => navigator.share?.({ title: 'QalamAI', text, url: link }).catch(() => {})
  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <section className={`ak-card ak-ref ${r.enabled ? '' : 'off'}`}>
      <div className="ak-fr-top">
        <span className="ak-badge dark">
          <UsersThree size={14} weight="fill" /> {t('ak.ref.name')}
        </span>
        {r.left != null && r.enabled && <span className="ak-fr-taken">{t('ak.ref.left', { n: r.left })}</span>}
      </div>

      <div className="ak-ref-hero">
        <h2>{r.enabled ? t('ak.ref.title', { coins: r.coins }) : t('ak.ref.offTitle')}</h2>
        <p>{r.enabled ? (r.friendCoins > 0 ? t('ak.ref.textBoth', { coins: r.coins, friend: welcome }) : t('ak.ref.text', { coins: r.coins, friend: welcome })) : t('ak.ref.offText')}</p>
      </div>

      <ol className="ak-steps">
        <li>
          <span className="ak-step-ic"><LinkSimple size={18} weight="bold" /></span>
          <b>{t('ak.ref.step1')}</b>
        </li>
        <li>
          <span className="ak-step-ic"><UserPlus size={18} weight="bold" /></span>
          <b>{t('ak.ref.step2')}</b>
        </li>
        <li>
          <span className="ak-step-ic lime"><Coins size={18} weight="bold" /></span>
          <b>{t('ak.ref.step3', { coins: r.coins })}</b>
        </li>
      </ol>

      <div className="ak-link">
        <label htmlFor="ak-link">{t('ak.ref.yourLink')}</label>
        <div className="ak-link-row">
          <input id="ak-link" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className={`ak-btn ${copied ? 'lime' : 'dark'}`} onClick={copy} disabled={!link}>
            {copied ? <Check size={17} weight="bold" /> : <Copy size={17} weight="bold" />} {copied ? t('ak.ref.copiedShort') : t('ak.ref.copy')}
          </button>
        </div>
        <div className="ak-share">
          <span className="ak-code">
            {t('ak.ref.code')} <b>{r.code}</b>
          </span>
          <button className="ak-sh tg" onClick={() => open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`)} aria-label="Telegram" title="Telegram">
            <TelegramLogo size={19} weight="fill" />
          </button>
          <button className="ak-sh wa" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`)} aria-label="WhatsApp" title="WhatsApp">
            <WhatsappLogo size={19} weight="fill" />
          </button>
          {typeof navigator.share === 'function' && (
            <button className="ak-sh" onClick={share} aria-label={t('ak.ref.share')} title={t('ak.ref.share')}>
              <ShareNetwork size={19} weight="bold" />
            </button>
          )}
        </div>
      </div>

      <div className="ak-stats">
        <div>
          <b>{formatNumber(r.invited)}</b>
          <span>{t('ak.ref.statInvited')}</span>
        </div>
        <div>
          <b>{formatNumber(r.rewarded)}</b>
          <span>{t('ak.ref.statRewarded')}</span>
        </div>
        <div className="lime">
          <b>
            <CoinIcon size={18} /> {formatNumber(r.earned)}
          </b>
          <span>{t('ak.ref.statEarned')}</span>
        </div>
      </div>

      <div className="ak-friends">
        <h3>{t('ak.ref.friends')}</h3>
        {r.friends.length ? (
          <ul>
            {r.friends.map((f, i) => (
              <li key={i}>
                <span className="ak-av">{(f.name || '?').slice(0, 1).toUpperCase()}</span>
                <span className="ak-fname">
                  <b>{f.name || t('ak.ref.noName')}</b>
                  <small>{formatDate(f.at, { day: 'numeric', month: 'short' })}</small>
                </span>
                {f.status === 'rewarded' ? <span className="ak-plus">+{f.coins}</span> : <span className="ak-skip">{t('ak.ref.notCounted')}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ak-empty">{t('ak.ref.empty')}</p>
        )}
      </div>
    </section>
  )
}
