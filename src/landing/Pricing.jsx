import { Check, Lightning, ArrowRight, Gift } from '@phosphor-icons/react'
import { CoinIcon } from '../components/Coins.jsx'
import { COIN_COSTS, COIN_PACKS, SIGNUP_BONUS, freeFeatures, premiumPerks, som } from '../coins.js'
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

export default function Pricing({ onStart }) {
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
            <button type="button" className={`pr-btn ${p.featured ? 'light' : 'soft'}`} onClick={onStart}>
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
