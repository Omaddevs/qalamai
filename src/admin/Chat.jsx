// ChatBot: messages sent through QalamChat (the bottom-right chat on the site) — who wrote,
// how to reach them, and a "done" mark once the team has answered.
import { useEffect, useMemo, useState } from 'react'
import { AtSign, Check, CheckCheck, ChevronLeft, ChevronRight, Copy, Inbox, Mail, MessageSquare, Phone, RotateCcw, Search, Send, UserRound } from 'lucide-react'
import { admin } from './api.js'
import { METHOD, ago, dateOnly, fmt, timeOnly } from './format.js'
import { Avatar, ErrorBox, Kpi, PageHead, RefreshButton, Segmented, useLoad } from './parts.jsx'
import UserDrawer from './UserDrawer.jsx'

export const TOPICS = {
  question: 'Savol',
  partnership: 'Hamkorlik',
  complaint: 'Şikoyat',
  idea: 'Taklif',
  support: 'Texnik yordam',
  payment: 'Tölov',
}
const LANGS = { uz: 'Özbekça', 'uz-cyrl': 'Ўзбекча', ru: 'Ruscha', en: 'Inglizça', kk: 'Qozoqça', ky: 'Qirğizça', tg: 'Tojikça' }
const LIMIT = 20

/** Tells the sidebar badge to recount new messages. */
export const CHAT_CHANGED = 'qalam-admin-chat'

export default function ChatPage() {
  const [status, setStatus] = useState('new')
  const [topic, setTopic] = useState('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const [local, setLocal] = useState({}) // id → status changed here, shown before the list reloads

  useEffect(() => {
    const id = setTimeout(() => (setQuery(q), setPage(1)), 300)
    return () => clearTimeout(id)
  }, [q])

  const params = useMemo(() => ({ status, topic, q: query, page, limit: LIMIT }), [status, topic, query, page])
  const { data, error, busy, reload } = useLoad(() => admin.chat(params), [params])
  useEffect(() => setLocal({}), [data])
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1
  // counts follow the marks made here before the list reloads
  const c = useMemo(() => {
    if (!data) return null
    let moved = 0 // new → done
    data.items.forEach((m) => {
      const now = local[m.id]
      if (now && now !== m.status) moved += now === 'done' ? 1 : -1
    })
    return { ...data.counts, new: data.counts.new - moved, done: data.counts.done + moved }
  }, [data, local])

  const mark = async (m, next) => {
    setLocal((x) => ({ ...x, [m.id]: next }))
    try {
      await admin.setChatStatus(m.id, next)
      window.dispatchEvent(new Event(CHAT_CHANGED))
    } catch {
      setLocal((x) => ({ ...x, [m.id]: m.status }))
    }
  }

  return (
    <div className="ad-page">
      <PageHead title="ChatBot" sub="QalamChat orqali kelgan xabarlar — kim yozgani va u bilan qanday boğlaniş">
        <RefreshButton onClick={reload} busy={busy} />
      </PageHead>

      <div className="ad-kpis">
        <Kpi accent icon={Inbox} label="Yangi xabarlar" value={c ? fmt(c.new) : '—'} foot="Javob kutmoqda" />
        <Kpi icon={CheckCheck} label="Körib çiqilgan" value={c ? fmt(c.done) : '—'} />
        <Kpi icon={MessageSquare} label="Jami xabarlar" value={c ? fmt(c.all) : '—'} />
      </div>

      <section className="ad-card ad-chat">
        <div className="ad-card-head ad-users-head">
          <div>
            <h2>Xabarlar</h2>
            <p>{data ? `${fmt(data.total)} ta topildi` : 'Yuklanmoqda…'}</p>
          </div>
          <div className="ad-users-tools">
            <label className="ad-search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matn, ism, telefon, email yoki ID" />
            </label>
            <select className="ad-select" value={topic} onChange={(e) => (setTopic(e.target.value), setPage(1))} aria-label="Mavzu">
              <option value="">Barça mavzular</option>
              {Object.entries(TOPICS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ad-chips">
          <Segmented
            key={c ? `${c.new}-${c.done}` : 'loading'} // labels carry counts: re-measure the pill when they change
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
            options={[
              { value: 'new', label: `Yangi${c ? ` · ${fmt(c.new)}` : ''}` },
              { value: 'done', label: `Körib çiqilgan${c ? ` · ${fmt(c.done)}` : ''}` },
              { value: 'all', label: 'Hammasi' },
            ]}
          />
        </div>

        {error && !data ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : (
          <div className={`ad-chat-list ${busy ? 'is-busy' : ''}`}>
            {data?.items.map((m) => (
              <Message key={m.id} m={{ ...m, status: local[m.id] ?? m.status }} onMark={mark} onUser={setOpen} />
            ))}
            {data && !data.items.length && (
              <div className="ad-chat-empty">
                <Inbox size={28} strokeWidth={1.6} />
                <b>{status === 'new' ? 'Yangi xabar yöq' : 'Xabar topilmadi'}</b>
                <span>{status === 'new' ? 'Hammasiga javob berilgan — zör!' : 'Filtrni özgartirib köring'}</span>
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
            <button className="ad-icon ad-icon-line" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Oldingi">
              <ChevronLeft size={16} />
            </button>
            <span className="ad-pager-n">
              {page} / {pages}
            </span>
            <button className="ad-icon ad-icon-line" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Keyingi">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
      {open && <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  )
}

function CopyButton({ text }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className="ad-chat-copy"
      title="Nusxa oliş"
      aria-label="Nusxa oliş"
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard?.writeText(text).catch(() => {})
        setOk(true)
        setTimeout(() => setOk(false), 1200)
      }}
    >
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Message({ m, onMark, onUser }) {
  const ct = m.contact ?? {}
  const u = m.user
  const tel = ct.phone?.replace(/[^\d+]/g, '')
  const done = m.status === 'done'
  return (
    <article className={`ad-msg ${done ? 'done' : 'new'}`}>
      <header className="ad-msg-head">
        <span className={`ad-topic t-${m.topic}`}>{TOPICS[m.topic] ?? m.topic}</span>
        <span className="ad-msg-time" title={`${dateOnly(m.createdAt)} ${timeOnly(m.createdAt)}`}>
          {ago(m.createdAt)} · {dateOnly(m.createdAt)}, {timeOnly(m.createdAt)}
        </span>
        {done ? (
          <button className="ad-btn ad-msg-act" onClick={() => onMark(m, 'new')} title="Yana yangi deb belgilaş">
            <RotateCcw size={14} /> Qaytariş
          </button>
        ) : (
          <button className="ad-btn ad-btn-primary ad-msg-act" onClick={() => onMark(m, 'done')}>
            <Check size={14} /> Körib çiqildi
          </button>
        )}
      </header>

      <p className="ad-msg-text">{m.message}</p>

      <div className="ad-msg-contact">
        <span className="ad-msg-who">
          <UserRound size={15} />
          <b>{ct.name || u?.name || 'Ismsiz'}</b>
        </span>
        {ct.phone && (
          <span className="ad-msg-chip">
            <Phone size={13} />
            <a href={`tel:${tel}`}>{ct.phone}</a>
            <CopyButton text={ct.phone} />
          </span>
        )}
        {ct.email && (
          <span className="ad-msg-chip">
            <Mail size={13} />
            <a href={`mailto:${ct.email}`}>{ct.email}</a>
            <CopyButton text={ct.email} />
          </span>
        )}
        {u?.telegramUsername && (
          <span className="ad-msg-chip">
            <Send size={13} />
            <a href={`https://t.me/${u.telegramUsername}`} target="_blank" rel="noreferrer">
              @{u.telegramUsername}
            </a>
          </span>
        )}
      </div>

      <footer className="ad-msg-foot">
        {u ? (
          <button className="ad-msg-account" onClick={() => onUser(u.id)} title="Foydalanuvçi hisobini oçiş">
            <Avatar u={u} size={22} />
            <span>
              Hisob: <b>{u.name || u.email || u.phone || u.id}</b>
              {u.method && <> · {METHOD[u.method] ?? u.method}</>}
              {u.email && u.email !== ct.email && (
                <>
                  {' '}
                  · <AtSign size={11} /> {u.email}
                </>
              )}
            </span>
          </button>
        ) : (
          <span className="ad-muted">Hisob öçirilgan</span>
        )}
        {m.lang && <span className="ad-msg-lang">{LANGS[m.lang] ?? m.lang}</span>}
        {done && m.doneAt && <span className="ad-msg-done"><CheckCheck size={13} /> {ago(m.doneAt)}</span>}
      </footer>
    </article>
  )
}
