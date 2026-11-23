// QalamCoin checkout: pick a pack or any amount → pay by card transfer (HUMO / UZCARD / VISA)
// and attach the receipt → the team checks it and the coins arrive. Click / Payme come later.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock, Copy, FileText, Gift, History, ImagePlus, Loader2,
  Minus, Plus, ShieldCheck, Sparkles, Upload, X, XCircle,
} from 'lucide-react'
import { CoinIcon, CoinPrice } from './Coins.jsx'
import {
  COIN_COSTS, COIN_PACKS, CUSTOM_COINS, RECEIPT_MAX_MB, SIGNUP_BONUS, coinRate, freeFeatures, getPayMethods, myPayments, premiumPerks,
  priceFor, sendPayment, som, useWallet,
} from '../coins.js'
import { formatDate, t, tr } from '../i18n/index.js'
import './checkout.css'

const BASE_RATE = coinRate(CUSTOM_COINS.min) // the dearest söm per coin: savings are counted from it
const QUICK = [50, 150, 500, 2000]
const fits = (coins, id) => Math.floor(coins / COIN_COSTS[id].cost)
const groups = (n) => n.replace(/(\d{4})(?=\d)/g, '$1 ')

// slider: a log scale, so 10…5 000 coins are all easy to reach
const S_MIN = CUSTOM_COINS.min
const S_MAX = 5000
const toSlider = (v) => Math.round((Math.log(Math.max(S_MIN, Math.min(S_MAX, v)) / S_MIN) / Math.log(S_MAX / S_MIN)) * 1000)
const fromSlider = (x) => {
  const v = S_MIN * (S_MAX / S_MIN) ** (x / 1000)
  const step = v < 100 ? 5 : v < 1000 ? 10 : 50
  return Math.max(S_MIN, Math.round(v / step) * step)
}

function useCopy() {
  const [copied, setCopied] = useState(null)
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* the text is on screen anyway */
    }
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
  }
  return [copied, copy]
}

/* ───────── step 1: what to buy ───────── */

function Calculator({ value, onChange, active, onFocus }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const set = (v) => onChange(Math.max(S_MIN, Math.min(CUSTOM_COINS.max, Math.round(v) || S_MIN)))
  const price = priceFor(value)
  const bigger = COIN_PACKS.find((p) => p.coins > value && p.price === price)
  return (
    <div className={`ck-calc ${active ? 'on' : ''}`} onClick={onFocus}>
      <div className="ck-calc-head">
        <span className="ck-calc-tag">
          <Sparkles size={13} /> {t('pay.custom')}
        </span>
        <span className="ck-calc-min">{t('pay.customMin', { n: CUSTOM_COINS.min })}</span>
      </div>
      <div className="ck-calc-input">
        <button type="button" aria-label="−" onClick={(e) => (e.stopPropagation(), set(value - (value > 100 ? 10 : 5)))} disabled={value <= S_MIN}>
          <Minus size={18} />
        </button>
        <label>
          <CoinIcon size={30} />
          <input
            inputMode="numeric"
            value={text}
            onFocus={onFocus}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6)
              setText(v)
              if (Number(v) >= S_MIN) onChange(Math.min(CUSTOM_COINS.max, Number(v)))
            }}
            onBlur={() => set(Number(text))}
            aria-label={t('pay.coinsLabel')}
          />
          <span>coin</span>
        </label>
        <button type="button" aria-label="+" onClick={(e) => (e.stopPropagation(), set(value + (value >= 100 ? 10 : 5)))}>
          <Plus size={18} />
        </button>
      </div>
      <input
        type="range"
        className="ck-range"
        min={0}
        max={1000}
        value={toSlider(value)}
        style={{ '--p': `${toSlider(value) / 10}%` }}
        onChange={(e) => (onFocus(), onChange(fromSlider(Number(e.target.value))))}
        aria-label={t('pay.coinsLabel')}
      />
      <div className="ck-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" className={value === q ? 'on' : ''} onClick={(e) => (e.stopPropagation(), onFocus(), onChange(q))}>
            {som(q)}
          </button>
        ))}
      </div>
      <div className="ck-calc-foot">
        <div>
          <b>{som(price ?? 0)}</b> {t('lp.pr.som')}
          <small>{t('pay.perCoin', { price: Math.round((price ?? 0) / value) })}</small>
        </div>
        {bigger && (
          <button type="button" className="ck-upsell" onClick={(e) => (e.stopPropagation(), onChange(bigger.coins))}>
            <Gift size={14} /> {t('pay.upsell', { n: bigger.coins })}
          </button>
        )}
      </div>
    </div>
  )
}

function PickStep({ choice, setChoice, onNext, pending, onHistory }) {
  const coins = choice.pack ? COIN_PACKS.find((p) => p.id === choice.pack).coins : choice.coins
  const price = priceFor(coins)
  const saved = Math.max(0, coins * BASE_RATE - price)
  const [costsOpen, setCostsOpen] = useState(false)
  return (
    <div className="ck-pick">
      <div className="ck-left">
        {pending > 0 && (
          <button type="button" className="ck-pending" onClick={onHistory}>
            <Clock size={16} />
            <span>{t('pay.pendingBanner', { n: pending })}</span>
            <ArrowRight size={15} />
          </button>
        )}
        <div className="ck-packs" role="radiogroup" aria-label={t('pay.pickTitle')}>
          {COIN_PACKS.map((p) => {
            const on = choice.pack === p.id
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} className={`ck-pack ${on ? 'on' : ''} ${p.featured ? 'featured' : ''}`} onClick={() => setChoice({ pack: p.id, coins })}>
                {p.featured && <span className="ck-pack-badge">{t('coin.featured')}</span>}
                <span className="ck-radio" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="ck-pack-label">{p.label}</span>
                <span className="ck-pack-coins">
                  <CoinIcon size={26} />
                  <b>{som(p.coins)}</b>
                </span>
                <span className="ck-pack-price">
                  {som(p.price)} <small>{t('lp.pr.som')}</small>
                </span>
                <span className="ck-pack-rate">{t('pay.perCoin', { price: Math.round(p.price / p.coins) })}</span>
                {p.coins * BASE_RATE > p.price && <span className="ck-pack-save">−{Math.round((1 - p.price / (p.coins * BASE_RATE)) * 100)}%</span>}
              </button>
            )
          })}
        </div>
        <Calculator
          value={choice.coins}
          active={!choice.pack}
          onFocus={() => choice.pack && setChoice({ pack: null, coins: choice.coins })}
          onChange={(v) => setChoice({ pack: null, coins: v })}
        />
        <button type="button" className={`ck-costs-toggle ${costsOpen ? 'open' : ''}`} onClick={() => setCostsOpen((v) => !v)} aria-expanded={costsOpen}>
          {t('coin.costs')} <ChevronDown size={16} />
        </button>
        {costsOpen && (
          <ul className="ck-costs">
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
        )}
      </div>

      <aside className="ck-summary">
        <span className="ck-sum-glow" aria-hidden="true" />
        <span className="ck-sum-label">{t('pay.youGet')}</span>
        <div className="ck-sum-coins">
          <CoinIcon size={40} />
          <b key={coins}>{som(coins)}</b>
          <span>coin</span>
        </div>
        <p className="ck-sum-fits">{t('lp.pr.hint', { p: fits(coins, 'prezentatsiya'), r: fits(coins, 'referat'), k: fits(coins, 'kurs-ishi') })}</p>
        <div className="ck-sum-line">
          <span>{t('pay.toPay')}</span>
          <b>
            {som(price)} <small>{t('lp.pr.som')}</small>
          </b>
        </div>
        {saved > 0 && (
          <div className="ck-sum-line save">
            <span>{t('pay.saved')}</span>
            <b>−{som(saved)} {t('lp.pr.som')}</b>
          </div>
        )}
        <ul className="ck-sum-perks">
          {premiumPerks().map((x) => (
            <li key={x}>
              <Check size={14} strokeWidth={2.8} /> {x}
            </li>
          ))}
          <li>
            <Check size={14} strokeWidth={2.8} /> {t('pay.noExpiry')}
          </li>
        </ul>
        <button type="button" className="ck-cta" onClick={onNext}>
          {t('pay.toPayment')} <ArrowRight size={18} />
        </button>
        <p className="ck-sum-safe">
          <ShieldCheck size={14} /> {t('pay.safe')}
        </p>
      </aside>
    </div>
  )
}

/* ───────── step 2: pay and send the receipt ───────── */

function BankCard({ m, copied, onCopy }) {
  return (
    <div className={`ck-card m-${m.id}`}>
      <span className="ck-card-shine" aria-hidden="true" />
      <div className="ck-card-top">
        <span className="ck-card-chip" aria-hidden="true" />
        <span className="ck-card-brand">{m.id.toUpperCase()}</span>
      </div>
      <button type="button" className="ck-card-number" onClick={() => onCopy('num', m.number)} title={t('pay.copy')}>
        {groups(m.number)}
        <span className="ck-card-copy">{copied === 'num' ? <Check size={16} /> : <Copy size={16} />}</span>
      </button>
      <div className="ck-card-foot">
        <span>
          <small>{t('pay.holder')}</small>
          {m.holder || '—'}
        </span>
        <span className="ck-card-logo" aria-hidden="true">
          <CoinIcon size={26} />
        </span>
      </div>
    </div>
  )
}

function Dropzone({ file, onFile, error }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const preview = useMemo(() => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  return (
    <div
      className={`ck-drop ${drag ? 'drag' : ''} ${file ? 'has' : ''} ${error ? 'bad' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0])
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
    >
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={(e) => (e.target.files[0] && onFile(e.target.files[0]), (e.target.value = ''))} />
      {file ? (
        <>
          <span className="ck-drop-thumb">{preview ? <img src={preview} alt="" /> : <FileText size={26} />}</span>
          <span className="ck-drop-text">
            <b>{file.name}</b>
            <small>
              {file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`} · {t('pay.change')}
            </small>
          </span>
          <button type="button" className="ck-drop-x" onClick={(e) => (e.stopPropagation(), onFile(null))} aria-label={t('ui.close')}>
            <X size={16} />
          </button>
        </>
      ) : (
        <>
          <span className="ck-drop-ic">
            <ImagePlus size={24} />
          </span>
          <span className="ck-drop-text">
            <b>{t('pay.dropTitle')}</b>
            <small>{t('pay.dropHint', { mb: RECEIPT_MAX_MB })}</small>
          </span>
          <Upload size={18} className="ck-drop-up" />
        </>
      )}
    </div>
  )
}

function PayStep({ coins, pack, methods, onBack, onSent }) {
  const [method, setMethod] = useState(methods?.[0]?.id ?? null)
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, copy] = useCopy()
  const price = priceFor(coins)
  const m = methods?.find((x) => x.id === method)
  useEffect(() => {
    if (!method && methods?.length) setMethod(methods[0].id)
  }, [methods, method])

  const pick = (f) => {
    setError(null)
    if (f && f.size > RECEIPT_MAX_MB * 1048576) return setError(t('pay.tooBig', { mb: RECEIPT_MAX_MB }))
    if (f && !/^image\/|^application\/pdf$/.test(f.type) && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)) return setError(t('pay.badType'))
    setFile(f)
  }

  const submit = async () => {
    if (!file) return setError(t('pay.needReceipt'))
    setBusy(true)
    setError(null)
    try {
      const order = await sendPayment({ coins, pack, method, note, receipt: file })
      onSent(order)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (methods && !methods.length) {
    return (
      <div className="ck-pay-empty">
        <Clock size={30} />
        <b>{t('pay.noCards')}</b>
        <p>{t('pay.noCardsHint')}</p>
        <button type="button" className="ck-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> {t('pay.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="ck-pay">
      <div className="ck-pay-left">
        <div className="ck-methods" role="tablist">
          {(methods ?? [{ id: 'humo' }, { id: 'uzcard' }, { id: 'visa' }]).map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={method === x.id} className={`ck-method m-${x.id} ${method === x.id ? 'on' : ''}`} onClick={() => setMethod(x.id)} disabled={!methods}>
              <span className="ck-method-dot" />
              {x.id.toUpperCase()}
            </button>
          ))}
        </div>
        {m ? <BankCard m={m} copied={copied} onCopy={copy} /> : <div className="ck-card ck-card-sk" />}
        <div className="ck-amount">
          <div>
            <small>{t('pay.transfer')}</small>
            <b>
              {som(price)} <span>{t('lp.pr.som')}</span>
            </b>
          </div>
          <button type="button" className="ck-amount-copy" onClick={() => copy('sum', String(price))}>
            {copied === 'sum' ? <Check size={16} /> : <Copy size={16} />} {copied === 'sum' ? t('pay.copied') : t('pay.copy')}
          </button>
        </div>
        <ol className="ck-steps">
          <li>{tr('pay.step1', { sum: `${som(price)} ${t('lp.pr.som')}` })}</li>
          <li>{t('pay.step2')}</li>
          <li>{t('pay.step3', { n: som(coins) })}</li>
        </ol>
      </div>

      <div className="ck-pay-right">
        <div className="ck-order">
          <span className="ck-order-coin">
            <CoinIcon size={34} />
          </span>
          <div>
            <b>{t('pay.orderCoins', { n: som(coins) })}</b>
            <small>{pack ? COIN_PACKS.find((p) => p.id === pack)?.label : t('pay.custom')}</small>
          </div>
          <span className="ck-order-sum">
            {som(price)} <small>{t('lp.pr.som')}</small>
          </span>
        </div>
        <label className="ck-label">{t('pay.receipt')}</label>
        <Dropzone file={file} onFile={pick} error={error && !file} />
        <label className="ck-label" htmlFor="ck-note">
          {t('pay.note')} <span>{t('pay.optional')}</span>
        </label>
        <textarea id="ck-note" className="ck-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pay.notePh')} />
        {error && (
          <p className="ck-error" role="alert">
            <XCircle size={15} /> {error}
          </p>
        )}
        <div className="ck-pay-actions">
          <button type="button" className="ck-ghost" onClick={onBack} disabled={busy}>
            <ArrowLeft size={16} /> {t('pay.back')}
          </button>
          <button type="button" className="ck-cta" onClick={submit} disabled={busy || !m}>
            {busy ? <Loader2 size={18} className="ck-spin" /> : <ShieldCheck size={18} />}
            {busy ? t('pay.sending') : t('pay.send')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────── step 3 and the history ───────── */

function DoneStep({ order, onClose, onHistory }) {
  return (
    <div className="ck-done">
      <div className="ck-done-burst" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ '--a': `${i * 30}deg` }} />
        ))}
      </div>
      <span className="ck-done-ic">
        <Check size={38} strokeWidth={3} />
      </span>
      <h3>{t('pay.doneTitle')}</h3>
      <p>{t('pay.doneText', { n: som(order.coins) })}</p>
      <div className="ck-done-card">
        <div>
          <small>{t('pay.youGet')}</small>
          <b>
            <CoinIcon size={20} /> {som(order.coins)} coin
          </b>
        </div>
        <div>
          <small>{t('pay.paid')}</small>
          <b>
            {som(order.amount)} {t('lp.pr.som')}
          </b>
        </div>
        <div>
          <small>{t('pay.status')}</small>
          <b className="ck-pill pending">
            <Clock size={13} /> {t('pay.st.pending')}
          </b>
        </div>
      </div>
      <p className="ck-done-hint">{t('pay.doneHint')}</p>
      <div className="ck-done-actions">
        <button type="button" className="ck-ghost" onClick={onHistory}>
          <History size={16} /> {t('pay.history')}
        </button>
        <button type="button" className="ck-cta" onClick={onClose}>
          {t('pay.great')}
        </button>
      </div>
    </div>
  )
}

const STATUS_ICON = { pending: Clock, approved: CheckCircle2, rejected: XCircle }

function HistoryView({ orders, onBack }) {
  return (
    <div className="ck-history">
      <button type="button" className="ck-ghost" onClick={onBack}>
        <ArrowLeft size={16} /> {t('pay.back')}
      </button>
      <h3>{t('pay.history')}</h3>
      {!orders ? (
        <div className="ck-history-sk">
          <i />
          <i />
        </div>
      ) : !orders.length ? (
        <p className="ck-history-empty">{t('pay.noHistory')}</p>
      ) : (
        <ul>
          {orders.map((o) => {
            const Icon = STATUS_ICON[o.status]
            return (
              <li key={o.id} className={`st-${o.status}`}>
                <span className="ck-history-coin">
                  <CoinIcon size={26} />
                </span>
                <div className="ck-history-main">
                  <b>{t('pay.orderCoins', { n: som(o.coins) })}</b>
                  <small>
                    {som(o.amount)} {t('lp.pr.som')} · {o.method.toUpperCase()} · {formatDate(new Date(o.createdAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </small>
                  {o.status === 'rejected' && o.reason && <p className="ck-history-reason">{o.reason}</p>}
                </div>
                <span className={`ck-pill ${o.status}`}>
                  <Icon size={13} /> {t(`pay.st.${o.status}`)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ───────── the modal ───────── */

export default function CoinCheckout({ reason, intent, onClose }) {
  const { coins: balance, premium, guest } = useWallet()
  const short = reason?.code === 'NOT_ENOUGH_COINS'
  // a shortfall suggests at least what is missing
  const startCoins = intent?.coins ?? (short ? Math.max(CUSTOM_COINS.min, Math.ceil((reason.need - balance) / 10) * 10) : 150)
  const [choice, setChoice] = useState(() => (intent?.pack ? { pack: intent.pack, coins: startCoins } : intent?.coins || short ? { pack: null, coins: startCoins } : { pack: 'c300', coins: startCoins }))
  const [step, setStep] = useState('pick') // pick · pay · done · history
  const [methods, setMethods] = useState(null)
  const [orders, setOrders] = useState(null)
  const [order, setOrder] = useState(null)
  const coins = choice.pack ? COIN_PACKS.find((p) => p.id === choice.pack).coins : choice.coins

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    if (guest) return
    getPayMethods().then((r) => setMethods(r.methods), () => setMethods([]))
    myPayments().then(setOrders, () => setOrders([]))
  }, [guest])

  const pending = orders?.filter((o) => o.status === 'pending').length ?? 0
  const stepNo = { pick: 1, pay: 2, done: 3 }[step]

  const goSignup = () => {
    onClose()
    window.location.hash = '#/auth'
  }

  return (
    <div className="ck-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ck" role="dialog" aria-modal="true" aria-label="QalamCoin">
        <header className="ck-head">
          <div className="ck-brand">
            <span className="ck-brand-coin">
              <CoinIcon size={34} />
            </span>
            <div>
              <h2>QalamCoin</h2>
              {guest ? (
                <p>{t('coin.heroText')}</p>
              ) : (
                <p className={short ? 'warn' : ''}>
                  {short ? tr('coin.short', { need: reason.need, have: som(balance) }) : tr('coin.balance', { n: som(balance) })}
                  {premium && (
                    <span className="ck-premium">
                      <Sparkles size={11} /> Premium
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          {stepNo && !guest && (
            <ol className="ck-stepper" aria-label={t('pay.stepsLabel')}>
              {['pay.s1', 'pay.s2', 'pay.s3'].map((k, i) => (
                <li key={k} className={i + 1 < stepNo ? 'done' : i + 1 === stepNo ? 'on' : ''}>
                  <span>{i + 1 < stepNo ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  {t(k)}
                </li>
              ))}
            </ol>
          )}
          {!guest && step !== 'history' && orders?.length > 0 && (
            <button type="button" className="ck-head-btn" onClick={() => setStep('history')} title={t('pay.history')}>
              <History size={18} />
              {pending > 0 && <span className="ck-head-dot">{pending}</span>}
            </button>
          )}
          <button type="button" className="ck-close" onClick={onClose} aria-label={t('ui.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="ck-body">
          {guest ? (
            <div className="ck-guest">
              <Gift size={30} />
              <h3>{t('coin.guestGift', { n: SIGNUP_BONUS })}</h3>
              <p>
                {t('coin.guest1')} {t('coin.guest2') === '.' ? '' : t('coin.guest2')}
              </p>
              <button type="button" className="ck-cta" onClick={goSignup}>
                {t('coin.signup')} <ArrowRight size={18} />
              </button>
              <ul className="ck-free">
                {freeFeatures().map((x) => (
                  <li key={x}>
                    <Check size={14} strokeWidth={2.8} /> {x}
                  </li>
                ))}
              </ul>
            </div>
          ) : step === 'pick' ? (
            <PickStep choice={choice} setChoice={setChoice} onNext={() => setStep('pay')} pending={pending} onHistory={() => setStep('history')} />
          ) : step === 'pay' ? (
            <PayStep
              coins={coins}
              pack={choice.pack}
              methods={methods}
              onBack={() => setStep('pick')}
              onSent={(o) => {
                setOrder(o)
                setOrders((list) => [o, ...(list ?? [])])
                setStep('done')
              }}
            />
          ) : step === 'done' ? (
            <DoneStep order={order} onClose={onClose} onHistory={() => setStep('history')} />
          ) : (
            <HistoryView orders={orders} onBack={() => setStep(order ? 'done' : 'pick')} />
          )}
        </div>
      </div>
    </div>
  )
}
