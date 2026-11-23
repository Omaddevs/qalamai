import { Suspense, lazy, useEffect, useId, useState } from 'react'
import { onCoinShop, som, takePurchase, useWallet } from '../coins.js'
import { t } from '../i18n/index.js'
import './pricing.css'

// the checkout (cards, receipt upload) loads when the shop is first opened
const CoinCheckout = lazy(() => import('./CoinCheckout.jsx'))

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

/** Mount once per screen: opens the shop whenever openCoinShop() is called. */
export function CoinShopHost() {
  const [state, setState] = useState(null)
  const { ready, guest } = useWallet()
  useEffect(() => onCoinShop((detail) => setState({ reason: detail.reason ?? null, intent: detail.intent ?? null })), [])
  // a pack / amount picked on the landing page before signing in
  useEffect(() => {
    if (!ready || guest) return
    const intent = takePurchase()
    if (intent) setState({ reason: null, intent })
  }, [ready, guest])
  return state ? (
    <Suspense fallback={null}>
      <CoinCheckout reason={state.reason} intent={state.intent} onClose={() => setState(null)} />
    </Suspense>
  ) : null
}
