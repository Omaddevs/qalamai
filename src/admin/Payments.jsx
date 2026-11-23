// Tölovlar: coin purchases paid by card transfer. Each one comes with the buyer's receipt; the team
// opens it, checks the money arrived and approves (the coins are credited then) or rejects with a
// reason the buyer sees. On top: the HUMO / UZCARD / VISA cards buyers are shown.
import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Coins, CreditCard, ExternalLink, FileText, Inbox, Pencil, Search, Send, X, XCircle,
} from 'lucide-react'
import { admin, apiUrl } from './api.js'
import { ago, dateOnly, fmt, timeOnly } from './format.js'
import { Avatar, ErrorBox, Kpi, PageHead, RefreshButton, Segmented, useLoad } from './parts.jsx'
import UserDrawer from './UserDrawer.jsx'

const LIMIT = 20
const METHODS = ['humo', 'uzcard', 'visa']
const STATUS = { pending: 'Kutilmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' }
const REASONS = ['Pul tuşmagan', 'Çekdagi summa mos emas', 'Çek önqib bölmaydi yoki notöğri', 'Bu çek avval işlatilgan']
const groups = (n) => (n ?? '').replace(/(\d{4})(?=\d)/g, '$1 ')

/** Tells the sidebar badge to recount waiting payments. */
export const PAYMENTS_CHANGED = 'qalam-admin-payments'

export default function PaymentsPage() {
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [user, setUser] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [local, setLocal] = useState({}) // id → { status, reason } decided here before the list reloads

  useEffect(() => {
    const id = setTimeout(() => (setQuery(q), setPage(1)), 300)
    return () => clearTimeout(id)
  }, [q])
  const params = useMemo(() => ({ status, q: query, page, limit: LIMIT }), [status, query, page])
  const { data, error, busy, reload } = useLoad(() => admin.payments(params), [params])
  useEffect(() => setLocal({}), [data])
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1
  const decided = Object.keys(local).length

  const decide = async (p, action, reason) => {
    const res = action === 'approve' ? await admin.approvePayment(p.id) : await admin.rejectPayment(p.id, reason)
    setLocal((x) => ({ ...x, [p.id]: { status: res.status, reason: res.reason ?? null, balance: res.balance } }))
    window.dispatchEvent(new Event(PAYMENTS_CHANGED))
    return res
  }

  return (
    <div className="ad-page">
      <PageHead title="Tölovlar" sub="Karta orqali coin xaridlari: çekni tekşiring va tasdiqlang — coinlar şunda hisobga tuşadi">
        <RefreshButton onClick={reload} busy={busy} />
      </PageHead>

      <div className="ad-kpis">
        <Kpi accent icon={Clock} label="Tekşiruv kutmoqda" value={data ? fmt(Math.max(0, data.counts.pending - decided)) : '—'} foot={data ? `${fmt(data.amounts.pending)} söm` : ' '} />
        <Kpi icon={Banknote} label="Bugun tasdiqlangan" value={data ? `${fmt(data.today.som)} söm` : '—'} foot={data ? `${fmt(data.today.n)} ta tölov · ${fmt(data.today.coins)} coin` : ' '} />
        <Kpi icon={CheckCircle2} label="Jami tuşum" value={data ? `${fmt(data.amounts.approved)} söm` : '—'} foot={data ? `${fmt(data.counts.approved)} ta tölov` : ' '} />
        <Kpi icon={Coins} label="Sotilgan coin" value={data ? fmt(data.coinsSold) : '—'} foot={data ? `${fmt(data.counts.rejected)} ta rad etilgan` : ' '} />
      </div>

      <CardsPanel />

      <section className="ad-card ad-pay">
        <div className="ad-card-head ad-users-head">
          <div>
            <h2>Çeklar</h2>
            <p>{data ? `${fmt(data.total)} ta topildi` : 'Yuklanmoqda…'}</p>
          </div>
          <div className="ad-users-tools">
            <label className="ad-search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, telefon, email, izoh yoki ID" />
            </label>
          </div>
        </div>
        <div className="ad-chips">
          <Segmented
            key={data ? `${data.counts.pending}-${data.counts.approved}-${data.counts.rejected}` : 'loading'}
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
            options={[
              { value: 'pending', label: `Kutilmoqda${data ? ` · ${fmt(data.counts.pending)}` : ''}` },
              { value: 'approved', label: `Tasdiqlangan${data ? ` · ${fmt(data.counts.approved)}` : ''}` },
              { value: 'rejected', label: `Rad etilgan${data ? ` · ${fmt(data.counts.rejected)}` : ''}` },
              { value: 'all', label: 'Hammasi' },
            ]}
          />
        </div>

        {error && !data ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : (
          <div className={`ad-pay-list ${busy ? 'is-busy' : ''}`}>
            {data?.items.map((p) => (
              <Payment key={p.id} p={{ ...p, ...(local[p.id] ?? {}) }} onDecide={decide} onUser={setUser} onView={setViewer} />
            ))}
            {data && !data.items.length && (
              <div className="ad-chat-empty">
                <Inbox size={28} strokeWidth={1.6} />
                <b>{status === 'pending' ? 'Tekşiriladigan çek yöq' : 'Tölov topilmadi'}</b>
                <span>{status === 'pending' ? 'Hammasi körib çiqilgan — zör!' : 'Filtrni özgartirib köring'}</span>
              </div>
            )}
            {!data && Array.from({ length: 3 }, (_, i) => <div key={i} className="ad-card ad-sk ad-chat-sk" />)}
          </div>
        )}

        {data && data.total > LIMIT && (
          <div className="ad-pager">
            <span>
              {fmt((page - 1) * LIMIT + 1)}–{fmt(Math.min(page * LIMIT, data.total))} / {fmt(data.total)}
            </span>
            <button className="ad-icon ad-icon-line" disabled={page <= 1} onClick={() => setPage((x) => x - 1)} aria-label="Oldingi">
              <ChevronLeft size={16} />
            </button>
            <span className="ad-pager-n">
              {page} / {pages}
            </span>
            <button className="ad-icon ad-icon-line" disabled={page >= pages} onClick={() => setPage((x) => x + 1)} aria-label="Keyingi">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
      {user && <UserDrawer id={user} onClose={() => setUser(null)} onChanged={reload} />}
      {viewer && <ReceiptViewer p={viewer} onClose={() => setViewer(null)} onDecide={decide} />}
    </div>
  )
}

/* ───────── one payment ───────── */

function Receipt({ p, onView }) {
  const url = apiUrl(p.receipt.url)
  const image = p.receipt.mime.startsWith('image/') && !p.receipt.mime.includes('heic')
  return (
    <button className="ad-pay-receipt" onClick={() => onView(p)} title="Çekni kattalaştiriş">
      {image ? (
        <img src={url} alt="Çek" loading="lazy" />
      ) : (
        <span className="ad-pay-receipt-file">
          <FileText size={26} />
          {p.receipt.mime.includes('pdf') ? 'PDF' : 'HEIC'}
        </span>
      )}
      <span className="ad-pay-receipt-zoom">Körish</span>
    </button>
  )
}

function Decision({ p, onDecide, compact = false }) {
  const [mode, setMode] = useState(null) // null | reject
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const run = async (action) => {
    setBusy(action)
    setErr(null)
    try {
      await onDecide(p, action, reason.trim())
      setMode(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(null)
    }
  }
  if (p.status !== 'pending') return null
  if (mode === 'reject') {
    return (
      <div className={`ad-pay-reject ${compact ? 'compact' : ''}`}>
        <div className="ad-pay-reasons">
          {REASONS.map((r) => (
            <button key={r} className={reason === r ? 'on' : ''} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <input className="ad-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sabab — xaridor şuni köradi" maxLength={300} autoFocus />
        {err && <p className="ad-pay-err">{err}</p>}
        <div className="ad-pay-actions">
          <button className="ad-btn" onClick={() => setMode(null)} disabled={Boolean(busy)}>
            Bekor qiliş
          </button>
          <button className="ad-btn ad-btn-danger" onClick={() => run('reject')} disabled={reason.trim().length < 2 || Boolean(busy)}>
            <XCircle size={15} /> {busy ? 'Yuborilmoqda…' : 'Rad etiş'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="ad-pay-actions">
      {err && <p className="ad-pay-err">{err}</p>}
      <button className="ad-btn" onClick={() => setMode('reject')} disabled={Boolean(busy)}>
        <X size={15} /> Rad etiş
      </button>
      <button className="ad-btn ad-btn-primary ad-pay-approve" onClick={() => run('approve')} disabled={Boolean(busy)}>
        <Check size={15} /> {busy ? 'Tasdiqlanmoqda…' : `Tasdiqlaş · ${fmt(p.coins)} coin`}
      </button>
    </div>
  )
}

function Payment({ p, onDecide, onUser, onView }) {
  const u = p.user
  return (
    <article className={`ad-pay-item st-${p.status}`}>
      <Receipt p={p} onView={onView} />
      <div className="ad-pay-main">
        <header className="ad-pay-head">
          <span className="ad-pay-sum">
            {fmt(p.amount)} <small>söm</small>
          </span>
          <span className="ad-pay-coins">
            <Coins size={14} /> {fmt(p.coins)} coin{p.pack ? ` · ${p.pack}` : ' · istalgan miqdor'}
          </span>
          <span className={`ad-pay-status st-${p.status}`}>
            {p.status === 'pending' ? <Clock size={13} /> : p.status === 'approved' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {STATUS[p.status]}
          </span>
        </header>
        <div className="ad-pay-meta">
          <span className={`ad-pay-method m-${p.method}`}>{p.method.toUpperCase()}</span>
          <span className="ad-pay-card">→ {groups(p.card?.number)}</span>
          <span title={`${dateOnly(p.createdAt)} ${timeOnly(p.createdAt)}`}>
            {ago(p.createdAt)} · {dateOnly(p.createdAt)}, {timeOnly(p.createdAt)}
          </span>
        </div>
        {p.note && <p className="ad-pay-note">“{p.note}”</p>}
        {p.status === 'rejected' && p.reason && <p className="ad-pay-reason">Sabab: {p.reason}</p>}
        <footer className="ad-pay-foot">
          {u ? (
            <button className="ad-msg-account" onClick={() => onUser(u.id)} title="Foydalanuvçi hisobini oçiş">
              <Avatar u={u} size={24} />
              <span>
                <b>{u.name || u.email || u.phone || u.id}</b>
                {u.phone && <> · {u.phone}</>}
                {u.telegramUsername && (
                  <>
                    {' '}
                    · <Send size={11} /> @{u.telegramUsername}
                  </>
                )}
                {p.balance != null ? <> · balans {fmt(p.balance)}</> : <> · balans {fmt(u.coins)}</>}
              </span>
            </button>
          ) : (
            <span className="ad-muted">Hisob öçirilgan</span>
          )}
          <Decision p={p} onDecide={onDecide} />
        </footer>
      </div>
    </article>
  )
}

function ReceiptViewer({ p, onClose, onDecide }) {
  const [state, setState] = useState(p)
  const url = apiUrl(p.receipt.url)
  const image = p.receipt.mime.startsWith('image/') && !p.receipt.mime.includes('heic')
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="ad-pay-viewer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ad-pay-viewer-box">
        <div className="ad-pay-viewer-doc">
          {image ? <img src={url} alt="Çek" /> : p.receipt.mime.includes('pdf') ? <iframe src={url} title="Çek" /> : <p>Bu fayl turini brauzer körsata olmaydi — yuklab oling.</p>}
        </div>
        <aside className="ad-pay-viewer-side">
          <button className="ad-icon ad-pay-viewer-x" onClick={onClose} aria-label="Yopiş">
            <X size={18} />
          </button>
          <span className="ad-pay-viewer-label">Ötkazilişi kerak</span>
          <b className="ad-pay-viewer-sum">
            {fmt(p.amount)} <small>söm</small>
          </b>
          <span className="ad-pay-coins">
            <Coins size={14} /> {fmt(p.coins)} coin
          </span>
          <dl>
            <dt>Karta</dt>
            <dd>
              {p.method.toUpperCase()} · {groups(p.card?.number)}
            </dd>
            <dt>Xaridor</dt>
            <dd>{p.user?.name || p.user?.email || p.user?.phone || '—'}</dd>
            <dt>Yuborilgan</dt>
            <dd>
              {dateOnly(p.createdAt)}, {timeOnly(p.createdAt)}
            </dd>
            {p.note && (
              <>
                <dt>Izoh</dt>
                <dd>{p.note}</dd>
              </>
            )}
          </dl>
          <a className="ad-btn" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Yangi oynada oçiş
          </a>
          {state.status === 'pending' ? (
            <Decision
              p={state}
              compact
              onDecide={async (x, action, reason) => {
                const r = await onDecide(x, action, reason)
                setState((s) => ({ ...s, status: r.status }))
                return r
              }}
            />
          ) : (
            <span className={`ad-pay-status big st-${state.status}`}>
              {state.status === 'approved' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {STATUS[state.status]}
            </span>
          )}
        </aside>
      </div>
    </div>
  )
}

/* ───────── cards buyers pay to ───────── */

function CardsPanel() {
  const { data, error, reload } = useLoad(() => admin.paymentCards(), [])
  const [edit, setEdit] = useState(null) // method being edited
  const [form, setForm] = useState({ number: '', holder: '', enabled: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const cards = data?.cards
  const live = cards ? METHODS.filter((m) => cards[m].enabled && cards[m].number).length : 0

  const open = (m) => {
    setEdit(m)
    setErr(null)
    setForm({ number: groups(cards[m].number), holder: cards[m].holder, enabled: cards[m].enabled })
  }
  const save = async (m, patch) => {
    setBusy(true)
    setErr(null)
    try {
      await admin.savePaymentCards({ [m]: patch })
      setEdit(null)
      reload()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ad-card ad-paycards">
      <div className="ad-card-head">
        <div>
          <h2>
            <CreditCard size={18} /> Tölov kartalari
          </h2>
          <p>{cards ? (live ? `${live} ta karta xaridorlarga körsatilmoqda` : 'Hali karta yöq — xaridorlar tölov qila olmaydi') : 'Yuklanmoqda…'}</p>
        </div>
      </div>
      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <div className="ad-paycards-grid">
          {METHODS.map((m) => {
            const c = cards?.[m]
            const on = c?.enabled && c?.number
            return edit === m ? (
              <form
                key={m}
                className={`ad-paycard editing m-${m}`}
                onSubmit={(e) => {
                  e.preventDefault()
                  save(m, { number: form.number, holder: form.holder, enabled: form.enabled })
                }}
              >
                <span className="ad-paycard-brand">{m.toUpperCase()}</span>
                <input
                  className="ad-input mono"
                  inputMode="numeric"
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: groups(e.target.value.replace(/\D/g, '').slice(0, 16)) }))}
                  placeholder="0000 0000 0000 0000"
                  autoFocus
                />
                <input className="ad-input" value={form.holder} onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))} placeholder="Karta egasi (masalan: ALIYEV ALI)" maxLength={80} />
                <label className="ad-paycard-toggle">
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Xaridorlarga körsatiş
                </label>
                {err && <p className="ad-pay-err">{err}</p>}
                <div className="ad-pay-actions">
                  <button type="button" className="ad-btn" onClick={() => setEdit(null)} disabled={busy}>
                    Bekor qiliş
                  </button>
                  <button className="ad-btn ad-btn-primary" disabled={busy || (form.number.replace(/\D/g, '').length !== 16 && form.number.replace(/\D/g, '').length !== 0)}>
                    {busy ? 'Saqlanmoqda…' : 'Saqlaş'}
                  </button>
                </div>
              </form>
            ) : (
              <div key={m} className={`ad-paycard m-${m} ${on ? 'on' : 'off'}`}>
                <div className="ad-paycard-top">
                  <span className="ad-paycard-brand">{m.toUpperCase()}</span>
                  <span className={`ad-paycard-state ${on ? 'on' : ''}`}>{on ? 'Faol' : c?.number ? 'Öçirilgan' : 'Kiritilmagan'}</span>
                </div>
                <b className="ad-paycard-number">{c?.number ? groups(c.number) : '•••• •••• •••• ••••'}</b>
                <span className="ad-paycard-holder">{c?.holder || 'Karta egasi kiritilmagan'}</span>
                <div className="ad-paycard-btns">
                  {c?.number && (
                    <button className="ad-paycard-btn" onClick={() => save(m, { enabled: !c.enabled })} disabled={busy || !cards}>
                      {c.enabled ? 'Öçiriş' : 'Yoqiş'}
                    </button>
                  )}
                  <button className="ad-paycard-btn" onClick={() => open(m)} disabled={!cards}>
                    <Pencil size={13} /> {c?.number ? 'Tahrirlaş' : 'Karta qöşiş'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
