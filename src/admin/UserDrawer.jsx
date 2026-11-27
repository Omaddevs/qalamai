import { useEffect, useState } from 'react'
import { Check, Copy, FileText, Globe, Laptop, LayoutTemplate, Link2, Mail, MapPin, Monitor, Phone, Send, Smartphone, Tablet, X } from 'lucide-react'
import { admin } from './api.js'
import { DEVICE, METHOD, REASON, SOURCE, ago, countryName, dateTime, fmt, pageLabel, timeOnly } from './format.js'
import { Avatar, Flag, MethodDot, useLoad } from './parts.jsx'
import { KINDS } from './kinds.jsx'
import { creationKind } from '../../shared/creations.js'

const DEVICE_IC = { mobile: Smartphone, tablet: Tablet, desktop: Monitor }
const PROFILE = {
  fullName: 'F.I.Ş.',
  uniId: 'OTM',
  uniCustom: 'OTM nomi',
  faculty: 'Fakultet',
  direction: 'Yönaliş',
  course: 'Kurs',
  group: 'Guruh',
  supervisor: 'Ilmiy rahbar',
  city: 'Şahar',
  year: 'Yil',
  phone: 'Telefon',
  company: 'Taşkilot',
  position: 'Lavozim',
  director: 'Rahbar',
  stir: 'STIR',
  address: 'Manzil',
  workType: 'Iş turi',
  topic: 'Mavzu',
  subject: 'Fan',
}
const PROFILE_SKIP = new Set(['bank', 'mfo', 'account'])

export default function UserDrawer({ id, onClose, onChanged }) {
  const { data, error, reload } = useLoad(() => admin.user(id), [id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="ad-drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="ad-drawer" role="dialog" aria-modal="true" aria-label="Foydalanuvçi">
        <button className="ad-icon ad-drawer-x" onClick={onClose} aria-label="Yopiş">
          <X size={18} />
        </button>
        {error ? (
          <p className="ad-empty">{error.message}</p>
        ) : !data ? (
          <div className="ad-drawer-sk">
            <div className="ad-sk ad-sk-avatar" />
            <div className="ad-sk ad-sk-line" />
            <div className="ad-sk ad-sk-block" />
            <div className="ad-sk ad-sk-block" />
          </div>
        ) : (
          <Detail d={data} reload={() => (reload(), onChanged?.())} />
        )}
      </aside>
    </div>
  )
}

function Detail({ d, reload }) {
  const u = d.user
  const s = u.signup
  const DevIc = DEVICE_IC[s.device] ?? Laptop
  const profile = Object.entries(u.profile ?? {}).filter(([k, v]) => v && typeof v !== 'object' && !PROFILE_SKIP.has(k) && !(k === 'uniId' && v === 'other'))
  return (
    <div className="ad-detail">
      <div className="ad-detail-hero">
        <Avatar u={u} size={64} />
        <div>
          <h3>{u.name || 'Ismsiz foydalanuvçi'}</h3>
          <div className="ad-detail-tags">
            {u.isGuest ? (
              <span className="ad-badge muted">Mehmon</span>
            ) : (
              <span className={`ad-badge m-${u.method ?? 'password'}`}>
                <MethodDot m={u.method ?? 'password'} /> {METHOD[u.method] ?? 'Email / telefon'}
              </span>
            )}
            {u.premium && <span className="ad-badge gold">Premium</span>}
            {u.role === 'admin' && <span className="ad-badge">admin</span>}
          </div>
          <CopyId id={u.id} />
        </div>
      </div>

      <div className="ad-detail-stats">
        <div>
          <b>{fmt(u.coins)}</b>
          <span>coin</span>
        </div>
        <div>
          <b>{fmt(d.counts.designs)}</b>
          <span>dizayn</span>
        </div>
        <div>
          <b>{fmt(d.counts.documents)}</b>
          <span>hujjat</span>
        </div>
        <div>
          <b>{fmt(d.counts.files)}</b>
          <span>fayl</span>
        </div>
      </div>

      {d.created && <Created c={d.created} />}

      <Section title="Bağlanış">
        <Row icon={Mail} k="Email" v={u.email} copy />
        <Row icon={Phone} k="Telefon" v={u.phone && `${u.phone}${u.phoneVerifiedAt ? ' ✓' : ''}`} copy={u.phone} />
        <Row icon={Send} k="Telegram" v={u.telegramUsername ? <a href={`https://t.me/${u.telegramUsername}`} target="_blank" rel="noreferrer">@{u.telegramUsername}</a> : u.telegramId ? `ID ${u.telegramId}` : null} />
        <Row k="Kiriş usullari" v={[u.linked.google && 'Google', u.linked.telegram && 'Telegram', u.linked.password && 'Parol'].filter(Boolean).join(', ') || '—'} />
      </Section>

      <Section title="Röyxatdan ötiş">
        <Row k="Sana va vaqt" v={u.registeredAt ? dateTime(u.registeredAt) : 'Röyxatdan ötmagan (mehmon)'} />
        <Row k="Saytga birinçi kirgan" v={dateTime(u.createdAt)} />
        <Row icon={MapPin} k="Davlat" v={s.country ? <><Flag cc={s.country} /> {countryName(s.country)}</> : null} />
        <Row icon={DevIc} k="Qurilma" v={[DEVICE[s.device], s.browser, s.os].filter(Boolean).join(' · ') || null} />
        <Row icon={Globe} k="IP manzil" v={s.ip} copy />
        <Row icon={Link2} k="Manba" v={s.source ? `${SOURCE[s.source] ?? s.source}${s.referrer ? ` — ${s.referrer}` : ''}` : null} />
        {s.utm && <Row k="UTM" v={[s.utm.source, s.utm.medium, s.utm.campaign].filter(Boolean).join(' / ')} />}
        <Row k="Kiriş sahifasi" v={s.landing && pageLabel(s.landing)} />
      </Section>

      <Section title="Faollik">
        <Row k="Oxirgi faollik" v={`${ago(u.lastSeenAt)} · ${dateTime(u.lastSeenAt)}`} />
        {d.bio.length > 0 && <Row k="Link in Bio" v={d.bio.map((b) => `/b/${b.slug} (${fmt(b.views)} köriş)`).join(', ')} />}
      </Section>

      {profile.length > 0 && (
        <Section title="Titul profili">
          {profile.map(([k, v]) => (
            <Row key={k} k={PROFILE[k] ?? k} v={String(v)} />
          ))}
        </Section>
      )}

      {!u.isGuest && <Grant u={u} onDone={reload} />}

      {d.ledger.length > 0 && (
        <Section title="Coin tarixi">
          <ul className="ad-ledger">
            {d.ledger.map((l, i) => (
              <li key={i}>
                <span className={`ad-ledger-d ${l.delta > 0 ? 'plus' : 'minus'}`}>{l.delta > 0 ? `+${fmt(l.delta)}` : fmt(l.delta)}</span>
                <span className="ad-two">
                  <span>
                    {REASON[l.reason] ?? l.reason}
                    {l.item ? ` · ${l.item}` : ''}
                  </span>
                  <small>
                    {dateTime(l.createdAt)}
                    {l.note ? ` · ${l.note}` : ''}
                  </small>
                </span>
                <span className="ad-muted">{fmt(l.balance)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(d.designs.length > 0 || d.documents.length > 0) && (
        <Section title="Oxirgi işlari">
          <ul className="ad-works">
            {[...d.designs.map((x) => ({ ...x, ic: LayoutTemplate, sub: x.kind })), ...d.documents.map((x) => ({ ...x, ic: FileText, sub: x.kind ? (KINDS[creationKind(x.kind, 'document')]?.label ?? x.kind) : 'Hujjat' }))]
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .slice(0, 12)
              .map((w) => (
                <li key={w.id}>
                  <w.ic size={15} />
                  <span className="ad-two">
                    <span>{w.name || 'Nomsiz'}</span>
                    <small>
                      {w.sub} · {ago(w.updatedAt)}
                    </small>
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      )}

      {d.journey.length > 0 && (
        <Section title="Saytdagi yöli" sub="Röyxatdan ötgan brauzerdagi sahifalar">
          <ol className="ad-journey">
            {d.journey.map((j, i) => {
              const newDay = i === 0 || new Date(j.at).toDateString() !== new Date(d.journey[i - 1].at).toDateString()
              return (
                <li key={i} className={newDay ? 'day' : ''}>
                  {newDay && <span className="ad-journey-day">{dateTime(j.at).split(',')[0]}</span>}
                  <span className="ad-journey-t">{timeOnly(j.at)}</span>
                  <span className="ad-journey-p">
                    {pageLabel(j.path)}
                    {j.referrer && i === 0 && <small> ← {j.referrer}</small>}
                  </span>
                </li>
              )
            })}
          </ol>
        </Section>
      )}

      {d.sessions.length > 0 && (
        <Section title="Kiriş sessiyalari">
          <ul className="ad-sessions">
            {d.sessions.map((x, i) => {
              const Ic = DEVICE_IC[x.device] ?? Laptop
              const live = !x.revokedAt && new Date(x.expiresAt) > new Date()
              return (
                <li key={i} title={x.userAgent ?? ''}>
                  <Ic size={16} />
                  <span className="ad-two">
                    <span>
                      {x.browser} · {x.os}
                    </span>
                    <small>
                      {x.ip ?? '—'} · {dateTime(x.createdAt)}
                    </small>
                  </span>
                  <span className={`ad-dot ${live ? 'on' : ''}`} title={live ? 'Faol' : 'Tugagan'} />
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}

/** Everything this user made, all time: by kind (AI share) and the file tools they ran. */
function Created({ c }) {
  return (
    <Section title="Yaratganlari" sub={c.total ? `Jami ${fmt(c.total)} ta · AI yozgani ${fmt(c.ai)} ta (öçirilganlari ham)` : 'Hali heç narsa yaratmagan'}>
      {c.kinds.length > 0 && (
        <div className="ad-ucreated">
          {c.kinds.map((x) => {
            const meta = KINDS[x.kind] ?? KINDS.boshqa
            const Icon = meta.icon
            return (
              <div key={x.kind} className="ad-ucreated-i" style={{ '--kc': meta.color }}>
                <span className="ad-kind-ic">
                  <Icon size={15} />
                </span>
                <span>{meta.label}</span>
                <b>{fmt(x.total)}</b>
                <small>{x.ai ? `AI ${fmt(x.ai)}` : ''}</small>
              </div>
            )
          })}
        </div>
      )}
      {c.toolsTotal > 0 && (
        <Row k="Fayl vositalari" v={`${fmt(c.toolsTotal)} marta: ${c.tools.slice(0, 5).map((x) => `${x.label} ${x.n}`).join(', ')}${c.tools.length > 5 ? ' …' : ''}`} />
      )}
    </Section>
  )
}

function Section({ title, sub, children }) {
  return (
    <section className="ad-section">
      <h4>
        {title}
        {sub && <small>{sub}</small>}
      </h4>
      {children}
    </section>
  )
}

function Row({ icon: Icon, k, v, copy }) {
  const [done, setDone] = useState(false)
  const text = copy === true ? v : copy
  return (
    <div className="ad-row">
      <span className="ad-row-k">
        {Icon && <Icon size={14} />}
        {k}
      </span>
      <span className="ad-row-v">
        {v || <span className="ad-muted">—</span>}
        {v && text && (
          <button
            className="ad-copy"
            onClick={() => navigator.clipboard.writeText(String(text)).then(() => (setDone(true), setTimeout(() => setDone(false), 1200)))}
            aria-label="Nusxa oliş"
          >
            {done ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </span>
    </div>
  )
}

function CopyId({ id }) {
  const [done, setDone] = useState(false)
  return (
    <button className="ad-id" onClick={() => navigator.clipboard.writeText(id).then(() => (setDone(true), setTimeout(() => setDone(false), 1200)))}>
      {id} {done ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

function Grant({ u, onDone }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    const n = parseInt(amount, 10)
    if (!n) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await admin.grantCoins(u.id, n, note)
      setMsg({ ok: true, text: `Bajarildi. Yangi balans: ${fmt(r.balance)} coin` })
      setAmount('')
      setNote('')
      onDone()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section title="Coin beriş / ayiriş">
      <form className="ad-grant" onSubmit={submit}>
        <input className="ad-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+50 yoki -20" />
        <input className="ad-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy)" maxLength={200} />
        <button className="ad-btn ad-btn-primary" disabled={busy || !parseInt(amount, 10)}>
          {busy ? <span className="ad-spin" /> : 'Saqlaş'}
        </button>
      </form>
      {msg && <p className={msg.ok ? 'ad-success' : 'ad-error'}>{msg.text}</p>}
    </Section>
  )
}
