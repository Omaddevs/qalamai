// Bildirişnomalar: announcements for every user. Each one shows up on the users' notifications
// page (src/home/NotificationsView.jsx) with an unread count on their bell. Personal notices
// (welcome bonus, coins, answered QalamChat messages) are sent by the server on their own.
import { useState } from 'react'
import { Bell, Megaphone, Trash2 } from 'lucide-react'
import { admin } from './api.js'
import { dateTime, fmt } from './format.js'
import { Card, ErrorBox, PageHead, useLoad } from './parts.jsx'

const LINK_RE = /^(https:\/\/|#\/)/

export default function NotificationsPage() {
  const { data, error, reload } = useLoad(() => admin.notifications(), [])
  return (
    <div className="ad-page ad-ntf">
      <PageHead title="Bildirişnomalar" sub="Barça foydalanuvçilarga e’lon yuboriş. Şaxsiy xabarlar (bonus, coin, ChatBot javobi) özi yuboriladi." />
      <div className="ad-grid-2">
        <div className="ad-col">
          <Compose onSent={reload} />
        </div>
        <div className="ad-col">
          {error && !data && <ErrorBox error={error} onRetry={reload} />}
          {data && <Sent items={data.items} onChanged={reload} />}
        </div>
      </div>
    </div>
  )
}

function Compose({ onSent }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const badLink = link.trim() && !LINK_RE.test(link.trim())
  const ok = title.trim().length >= 2 && body.trim().length >= 2 && !badLink

  const submit = async (e) => {
    e.preventDefault()
    if (!ok || !window.confirm('E’lon barça foydalanuvçilarga yuboriladi. Davom etasizmi?')) return
    setBusy(true)
    setMsg(null)
    try {
      await admin.announce({ title: title.trim(), body: body.trim(), ...(link.trim() ? { link: link.trim() } : {}) })
      setMsg({ ok: true, text: 'Yuborildi. Foydalanuvçilar uni Bildirişnomalar bölimida köradi.' })
      setTitle('')
      setBody('')
      setLink('')
      onSent()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Yangi e’lon" sub="Bir tilda yoziladi va hammaga şu matn bilan çiqadi" right={<Megaphone size={18} className="ad-muted-ic" />}>
      <form className="ad-form" onSubmit={submit}>
        <label className="ad-field">
          <span>Sarlavha</span>
          <input className="ad-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Masalan: 10 ta yangi şablon qöşildi" />
        </label>
        <label className="ad-field">
          <span>Matn</span>
          <textarea className="ad-input ad-textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={5} placeholder="Nima özgardi, foydalanuvçi nima qilişi mumkin" />
          <small className="ad-hint">{body.length} / 1000</small>
        </label>
        <label className="ad-field">
          <span>Havola (ixtiyoriy)</span>
          <input className="ad-input" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://… yoki #/ (sayt içidagi sahifa)" aria-invalid={Boolean(badLink)} />
          {badLink && <small className="ad-error">Havola https:// yoki #/ bilan boşlanişi kerak</small>}
        </label>
        {msg && <p className={msg.ok ? 'ad-success' : 'ad-error'}>{msg.text}</p>}
        <button className="ad-btn ad-btn-primary" disabled={!ok || busy}>
          {busy ? <span className="ad-spin" /> : 'Hammaga yuboriş'}
        </button>
      </form>
    </Card>
  )
}

function Sent({ items, onChanged }) {
  const [busy, setBusy] = useState(null)
  const remove = async (id) => {
    if (!window.confirm('E’lon öçirilsinmi? U foydalanuvçilarda ham yöqoladi.')) return
    setBusy(id)
    try {
      await admin.deleteAnnouncement(id)
      onChanged()
    } catch (err) {
      window.alert(err.message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card title="Yuborilgan e’lonlar" sub={`${items.length} ta`} right={<Bell size={18} className="ad-muted-ic" />}>
      {items.length === 0 ? (
        <p className="ad-muted">Hali e’lon yuborilmagan.</p>
      ) : (
        <ul className="ad-ntf-list">
          {items.map((n) => (
            <li key={n.id}>
              <div>
                <b>{n.title}</b>
                <p>{n.body}</p>
                <small>
                  {dateTime(n.createdAt)} · {fmt(n.reads)} kişi öqidi{n.link ? ` · ${n.link}` : ''}
                </small>
              </div>
              <button className="ad-icon" onClick={() => remove(n.id)} disabled={busy === n.id} aria-label="Öçiriş" title="Öçiriş">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
