// The Friday popup: on a Friday, the first time the app opens, it offers the free coins.
// Shown once per Friday per browser; the gift also stays waiting in «Aksiyalar».
import { useEffect, useState } from 'react'
import { Gift, X } from '@phosphor-icons/react'
import { CoinIcon } from '../components/Coins.jsx'
import { claimFriday, markFridaySeen } from '../promos.js'
import { formatNumber, t } from '../i18n/index.js'
import './promos.css'

export default function FridayGift({ gift, onClose, onOpen, notify }) {
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState(null)

  useEffect(() => {
    markFridaySeen(gift.endsAt)
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [gift.endsAt, onClose])

  const claim = async () => {
    setBusy(true)
    try {
      const r = await claimFriday()
      setGot(r)
      setTimeout(onClose, 2200)
    } catch (err) {
      notify?.(err.message)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ak-pop-scrim" onClick={onClose}>
      <div className="ak-pop" role="dialog" aria-modal="true" aria-labelledby="ak-pop-title" onClick={(e) => e.stopPropagation()}>
        <button className="ak-pop-x" onClick={onClose} aria-label={t('ak.close')}>
          <X size={18} weight="bold" />
        </button>
        <div className="ak-pop-art" aria-hidden="true">
          <div className="ak-fr-glow" />
          <span className="ak-pop-ring" />
          <span className="ak-pop-coin"><CoinIcon size={92} /></span>
          {got && (
            <span className="ak-burst big">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} style={{ '--a': `${i * 30}deg`, '--d': `${90 + (i % 3) * 26}px` }}>
                  <CoinIcon size={20} />
                </span>
              ))}
            </span>
          )}
        </div>
        <span className="ak-badge lime">{t('ak.friday.name')}</span>
        <h2 id="ak-pop-title">{got ? t('ak.pop.gotTitle', { coins: got.coins }) : t('ak.pop.title')}</h2>
        <p>{got ? t('ak.pop.gotText', { balance: formatNumber(got.balance) }) : t('ak.pop.text', { coins: gift.coins })}</p>
        {!got && (
          <div className="ak-pop-actions">
            <button className="ak-btn lime big" onClick={claim} disabled={busy}>
              <Gift size={20} weight="fill" /> {busy ? t('ak.friday.claiming') : t('ak.friday.claim', { coins: gift.coins })}
            </button>
            <button className="ak-btn ghost" onClick={() => (onClose(), onOpen())}>
              {t('ak.pop.all')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
