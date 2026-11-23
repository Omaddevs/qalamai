import { useState } from 'react'
import { Check, Lightning, ArrowRight, Gift, Minus, Plus, CreditCard } from '@phosphor-icons/react'
import { CoinIcon } from '../components/Coins.jsx'
import { COIN_COSTS, COIN_PACKS, CUSTOM_COINS, SIGNUP_BONUS, coinRate, freeFeatures, premiumPerks, priceFor, rememberPurchase, som } from '../coins.js'
import { t } from '../i18n/index.js'
import './plans.css'

const spot = (e) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

const fits = (coins, id) => Math.floor(coins / COIN_COSTS[id].cost)

function List({ title, items }) {
  return (
    <>
      <div className="pr-sep"><span>{title}</span></div>
      <ul className="pr-list">
        {items.map((x, i) => (
          <li key={x} style={{ '--k': i }}>
            <span className="pr-check"><Check size={11} weight="bold" /></span>
            {x}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Any amount of coins, priced live — the same rule as the checkout (shared/coins.js priceFor). */
function CustomAmount({ onBuy }) {
  const [n, setN] = useState(150)
  const [text, setText] = useState('150')
  const set = (v) => {
    const x = Math.max(CUSTOM_COINS.min, Math.min(CUSTOM_COINS.max, Math.round(v) || CUSTOM_COINS.min))
    setN(x)
    setText(String(x))
  }
  const price = priceFor(n)
  const step = n >= 100 ? 10 : 5
  return (
    <div className="pr-custom lp-reveal">
      <div className="pr-custom-copy">
        <span className="pr-custom-tag">
          <Lightning size={13} weight="fill" /> {t('pay.custom')}
        </span>
        <h3>{t('lp.pr.customTitle')}</h3>
        <p>{t('lp.pr.customText', { n: CUSTOM_COINS.min })}</p>
        <span className="pr-custom-cards">
          <CreditCard size={16} weight="duotone" /> {t('lp.pr.cards')}
          <i className="pc humo">HUMO</i>
          <i className="pc uzcard">UZCARD</i>
          <i className="pc visa">VISA</i>
        </span>
      </div>
      <div className="pr-custom-calc">
        <div className="pr-custom-input">
          <button type="button" onClick={() => set(n - step)} disabled={n <= CUSTOM_COINS.min} aria-label="−">
            <Minus size={18} weight="bold" />
          </button>
          <label>
            <CoinIcon size={28} />
            <input
              inputMode="numeric"
              value={text}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                setText(v)
                if (Number(v) >= CUSTOM_COINS.min) setN(Math.min(CUSTOM_COINS.max, Number(v)))
              }}
              onBlur={() => set(Number(text))}
              aria-label={t('pay.coinsLabel')}
            />
            <span>coin</span>
          </label>
          <button type="button" onClick={() => set(n + step)} aria-label="+">
            <Plus size={18} weight="bold" />
          </button>
        </div>
        <div className="pr-custom-quick">
          {[50, 150, 500, 2000].map((q) => (
            <button key={q} type="button" className={n === q ? 'on' : ''} onClick={() => set(q)}>
              {som(q)}
            </button>
          ))}
        </div>
        <div className="pr-custom-total">
          <div>
            <b key={price}>{som(price ?? 0)}</b> <span>{t('lp.pr.som')}</span>
            <small>
              {t('pay.perCoin', { price: Math.round((price ?? 0) / n) })}
              {n * coinRate(CUSTOM_COINS.min) > price && <em> · −{Math.round((1 - price / (n * coinRate(CUSTOM_COINS.min))) * 100)}%</em>}
            </small>
          </div>
          <button type="button" className="pr-btn light" onClick={() => onBuy({ coins: n })}>
            {t('lp.pr.customBuy', { n: som(n) })} <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Pricing({ onStart }) {
  // the pick is remembered: after signing in the app opens the checkout with it
  const buy = (intent) => {
    rememberPurchase(intent)
    onStart?.()
  }
  return (
    <section className="lp-section pr" id="narxlar">
      <div className="lp-head lp-reveal">
        <span className="lp-eyebrow">{t('lp.pr.eyebrow')}</span>
        <h2 className="lp-h2">{t('lp.pr.title1')} <em>{t('lp.pr.titleEm')}</em> {t('lp.pr.title2')}</h2>
        <p className="pr-lead">
          {t('lp.pr.lead')} <b>{t('lp.pr.gift', { n: SIGNUP_BONUS })}</b>.
        </p>
      </div>

      <div className="pr-grid">
        {COIN_PACKS.map((p, i) => (
          <article key={p.id} className={`pr-card lp-reveal${p.featured ? ' pro' : ''}`} style={{ '--i': i }} onPointerMove={spot}>
            {p.featured && (
              <>
                <span className="pr-glow" aria-hidden="true" />
                <span className="pr-aurora" aria-hidden="true"><i /><i /><i /></span>
              </>
            )}
            <header className="pr-top">
              <span className="pr-ic pr-coin"><CoinIcon size={26} /></span>
              {p.featured && <span className="pr-badge"><Lightning size={12} weight="fill" /> {t('lp.pr.featured')}</span>}
            </header>
            <h3>{t('lp.pr.coins', { n: p.coins })}</h3>
            <p className="pr-note">{t('lp.pr.note', { label: p.label, price: Math.round(p.price / p.coins) })}</p>
            <div className="pr-price">
              <b>{som(p.price)}</b>
              <span className="pr-cur">{t('lp.pr.som')}</span>
              <span className="pr-per">{t('lp.pr.once')}</span>
            </div>
            <p className="pr-hint">
              {t('lp.pr.hint', { p: fits(p.coins, 'prezentatsiya'), r: fits(p.coins, 'referat'), k: fits(p.coins, 'kurs-ishi') })}
            </p>
            <button type="button" className={`pr-btn ${p.featured ? 'light' : 'soft'}`} onClick={() => buy({ pack: p.id })}>
              {t('lp.pr.buy')} {p.featured && <ArrowRight size={15} weight="bold" />}
            </button>
            {i === 0 && <List title={t('lp.pr.free')} items={freeFeatures()} />}
            {i === 1 && <List title={t('lp.pr.perks')} items={premiumPerks()} />}
            {i === 2 && (
              <List
                title={t('lp.pr.big')}
                items={[t('lp.pr.big1', { d: fits(p.coins, 'diplom'), k: fits(p.coins, 'kurs-ishi') }), t('lp.pr.big2'), t('lp.pr.big3')]}
              />
            )}
          </article>
        ))}
      </div>

      <CustomAmount onBuy={buy} />

      <div className="pr-costs lp-reveal">
        <div className="pr-costs-head">
          <b>{t('lp.pr.costs')}</b>
          <span>
            <Gift size={15} weight="duotone" /> {t('lp.pr.refund')}
          </span>
        </div>
        <ul>
          {Object.entries(COIN_COSTS).map(([id, c]) => (
            <li key={id}>
              <span>{c.label}</span>
              <small>{c.per ?? c.note}</small>
              <b>
                <CoinIcon size={15} />
                {c.cost}
              </b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
