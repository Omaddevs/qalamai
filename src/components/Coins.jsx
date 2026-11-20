import { useEffect, useId, useState } from 'react'
import { Check, Gift, Sparkles } from 'lucide-react'
import { Modal } from './ui.jsx'
import { COIN_COSTS, COIN_PACKS, SIGNUP_BONUS, buyPack, freeFeatures, onCoinShop, premiumPerks, som, useWallet } from '../coins.js'
import { t, tr } from '../i18n/index.js'
import './pricing.css'

/** QalamCoin: silver rim, black face, the smiling white nib. */
export function CoinIcon({ size = 18 }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="coin-ico">
      <defs>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f5f7" />
          <stop offset=".45" stopColor="#9a9da4" />
          <stop offset=".7" stopColor="#e6e7ea" />
          <stop offset="1" stopColor="#6d7077" />
        </linearGradient>
        <radialGradient id={`face${id}`} cx=".4" cy=".35" r=".75">
          <stop offset="0" stopColor="#2a2b30" />
          <stop offset="1" stopColor="#050506" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#rim${id})`} />
      <circle cx="50" cy="50" r="40" fill={`url(#face${id})`} />
      <g transform="translate(36 24) scale(.15)">
        <path
          d="M30 12C80 2 140 0 170 6c16 4 20 16 19 34l3 110c0 50-32 130-64 190-4 8-12 8-16 0C80 280 30 220 12 160 2 120 0 70 4 40 7 22 16 15 30 12z"
          fill="#f7f7f8"
        />
        <path d="M40 152q20-24 40 0M114 142q20-24 40 0" fill="none" stroke="#111" strokeWidth="16" strokeLinecap="round" />
        <circle cx="108" cy="230" r="10" fill="#111" />
        <path d="M111 250l6 76" stroke="#111" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** "20 coin" with the coin glyph — for buttons and price tags. */
export function CoinPrice({ cost, size = 14, className = '' }) {
  return (
    <span className={`coin-price ${className}`}>
      <CoinIcon size={size} />
      {cost}
    </span>
  )
}

/** Balance chip for headers. Opens the coin shop. */
export function CoinChip({ onClick, className = '' }) {
  const { coins, ready } = useWallet()
  return (
    <button className={`coin-chip ${className}`} onClick={onClick} title={t('coin.chipTitle')}>
      <CoinIcon size={20} />
      <b>{ready ? som(coins) : '—'}</b>
      <span className="coin-chip-plus" aria-hidden="true">+</span>
    </button>
  )
}

const covers = (coins) => {
  const fits = (id) => Math.floor(coins / COIN_COSTS[id].cost)
  return t('coin.covers', { p: fits('prezentatsiya'), r: fits('referat') })
}

export function CoinShop({ reason, onClose, notify }) {
  const { coins, premium, guest } = useWallet()
  const [busy, setBusy] = useState(null)
  const short = reason?.code === 'NOT_ENOUGH_COINS'

  const buy = async (pack) => {
    if (guest) {
      onClose()
      window.location.hash = '#/auth'
      return
    }
    setBusy(pack.id)
    try {
      const r = await buyPack(pack.id)
      notify?.(t('coin.added', { n: pack.coins, balance: r.balance }))
      onClose()
    } catch (err) {
      notify?.(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      title="QalamCoin"
      onClose={onClose}
      className="pricing"
      header={
        <div className="pm-hero">
          <CoinIcon size={54} />
          <h2>QalamCoin</h2>
          <p>{t('coin.heroText')}</p>
        </div>
      }
    >
      {guest ? (
        <div className="cs-alert gift">
          <Gift size={18} />
          <span>
            {t('coin.guest1')} <b>{t('coin.guestGift', { n: SIGNUP_BONUS })}</b>{t('coin.guest2') === '.' ? '.' : ` ${t('coin.guest2')}`}
          </span>
          <button
            className="cs-alert-btn"
            onClick={() => {
              onClose()
              window.location.hash = '#/auth'
            }}
          >
            {t('coin.signup')}
          </button>
        </div>
      ) : (
        <div className={`cs-alert ${short ? 'warn' : ''}`}>
          <CoinIcon size={22} />
          <span>
            {short ? (
              tr('coin.short', { need: reason.need, have: som(coins) })
            ) : (
              tr('coin.balance', { n: som(coins) })
            )}
          </span>
          {premium && (
            <span className="cs-premium">
              <Sparkles size={12} /> Premium
            </span>
          )}
        </div>
      )}

      <div className="cs-packs">
        {COIN_PACKS.map((p) => (
          <article key={p.id} className={`cs-pack ${p.featured ? 'featured' : ''}`}>
            {p.featured && <span className="cs-tag">{t('coin.featured')}</span>}
            <span className="cs-pack-label">{p.label}</span>
            <div className="cs-pack-coins">
              <CoinIcon size={30} />
              <b>{som(p.coins)}</b>
              <span>{t('coin.unit', { n: p.coins })}</span>
            </div>
            <div className="cs-pack-price">
              <b>{som(p.price)}</b> {t('lp.pr.som')}
            </div>
            <p className="cs-pack-note">
              {t('coin.perCoin', { price: Math.round(p.price / p.coins) })} · {covers(p.coins)}
            </p>
            <button className={`cs-buy ${p.featured ? 'dark' : ''}`} disabled={Boolean(busy)} onClick={() => buy(p)}>
              {busy === p.id ? t('ui.wait') : t('coin.buy')}
            </button>
          </article>
        ))}
      </div>

      <div className="cs-info">
        <section>
          <h4>{t('coin.costs')}</h4>
          <ul className="cs-costs">
            {Object.entries(COIN_COSTS).map(([id, c]) => (
              <li key={id}>
                <span>
                  {c.label}
                  <small>{c.per ?? c.note}</small>
                </span>
                <CoinPrice cost={c.cost} size={13} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4>{t('coin.oncePerks')}</h4>
          <ul className="cs-perks">
            {premiumPerks().map((x) => (
              <li key={x}>
                <Check size={14} strokeWidth={2.6} /> {x}
              </li>
            ))}
          </ul>
          <h4>{t('coin.alwaysFree')}</h4>
          <ul className="cs-perks free">
            {freeFeatures().map((x) => (
              <li key={x}>
                <Check size={14} strokeWidth={2.6} /> {x}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="pm-foot">
        <span className="pm-pay">
          {t('coin.payment')}
          <b>Click</b>
          <b>Payme</b>
          <b>Uzum</b>
        </span>
        <span className="muted">{t('coin.refund')}</span>
      </footer>
    </Modal>
  )
}

/** Mount once per screen: opens the shop whenever openCoinShop() is called. */
export function CoinShopHost({ notify }) {
  const [state, setState] = useState(null)
  useEffect(() => onCoinShop((detail) => setState({ reason: detail.reason ?? null })), [])
  return state ? <CoinShop reason={state.reason} onClose={() => setState(null)} notify={notify} /> : null
}
