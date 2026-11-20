import { useEffect, useState } from 'react'
import { BarChart2, Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, KeyRound, LogOut, Search } from 'lucide-react'
import { admin } from './api.js'
import { dateTime } from './format.js'
import { Card, ErrorBox, PageHead, useLoad } from './parts.jsx'

export default function SettingsPage({ onOut }) {
  const { data, error, reload } = useLoad(() => admin.settings(), [])
  return (
    <div className="ad-page ad-settings">
      <PageHead title="Sozlamalar" sub="Admin paroli, Google Search Console va Google Analytics" />
      {error && !data && <ErrorBox error={error} onRetry={reload} />}
      <div className="ad-grid-2 ad-grid-settings">
        <div className="ad-col">
          <Password changedAt={data?.passwordChangedAt} />
          <Session onOut={onOut} />
        </div>
        <div className="ad-col">{data && <Google s={data} onSaved={reload} />}</div>
      </div>
    </div>
  )
}

function strength(p) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(4, s)
}
const STRENGTH = ['Juda zaif', 'Zaif', 'Örtaça', 'Yaxşi', 'Kuçli']

function Password({ changedAt }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const st = strength(next)
  const mismatch = again && next !== again
  const ok = cur && next.length >= 8 && next === again && /[A-Za-z]/.test(next) && /\d/.test(next)

  const submit = async (e) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setMsg(null)
    try {
      await admin.changePassword(cur, next)
      setMsg({ ok: true, text: 'Parol özgartirildi. Boşqa qurilmalardagi admin sessiyalari yopildi.' })
      setCur('')
      setNext('')
      setAgain('')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <Card title="Admin paroli" sub={changedAt ? `Oxirgi marta özgartirilgan: ${dateTime(changedAt)}` : 'Hali özgartirilmagan'} right={<KeyRound size={18} className="ad-muted-ic" />}>
      <form className="ad-form" onSubmit={submit}>
        <label className="ad-field">
          <span>Joriy parol</span>
          <input className="ad-input" type={type} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="ad-field">
          <span>Yangi parol</span>
          <div className="ad-input-wrap">
            <input className="ad-input" type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="Kamida 8 belgi, harf va raqam" />
            <button type="button" className="ad-input-btn" onClick={() => setShow((v) => !v)} aria-label="Körsatiş">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {next && (
            <div className={`ad-strength s${st}`}>
              <span />
              <span />
              <span />
              <span />
              <em>{STRENGTH[st]}</em>
            </div>
          )}
        </label>
        <label className="ad-field">
          <span>Yangi parolni takrorlang</span>
          <input className="ad-input" type={type} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
          {mismatch && <small className="ad-error">Parollar bir xil emas</small>}
        </label>
        {msg && <p className={msg.ok ? 'ad-success' : 'ad-error'}>{msg.text}</p>}
        <button className="ad-btn ad-btn-primary" disabled={!ok || busy}>
          {busy ? <span className="ad-spin" /> : 'Parolni özgartiriş'}
        </button>
      </form>
    </Card>
  )
}

function Session({ onOut }) {
  const { data } = useLoad(() => admin.me(), [])
  return (
    <Card title="Joriy sessiya">
      <div className="ad-row">
        <span className="ad-row-k">Kirilgan vaqt</span>
        <span className="ad-row-v">{data ? dateTime(data.since) : '…'}</span>
      </div>
      <div className="ad-row">
        <span className="ad-row-k">Tugaydi</span>
        <span className="ad-row-v">{data ? dateTime(data.expiresAt) : '…'}</span>
      </div>
      <button className="ad-btn ad-btn-danger" onClick={() => admin.logout().finally(onOut)}>
        <LogOut size={15} /> Çiqiş
      </button>
    </Card>
  )
}

function CopyLine({ text }) {
  const [done, setDone] = useState(false)
  return (
    <div className="ad-copyline">
      <code>{text}</code>
      <button type="button" className="ad-copy" onClick={() => navigator.clipboard.writeText(text).then(() => (setDone(true), setTimeout(() => setDone(false), 1200)))} aria-label="Nusxa oliş">
        {done ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}

function Google({ s, onSaved }) {
  const [gsc, setGsc] = useState(s.gscFile ?? '')
  const [ga, setGa] = useState(s.ga4Id ?? '')
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState({})
  useEffect(() => {
    setGsc(s.gscFile ?? '')
    setGa(s.ga4Id ?? '')
  }, [s.gscFile, s.ga4Id])

  const save = async (which, patch) => {
    setBusy(which)
    setMsg((m) => ({ ...m, [which]: null }))
    try {
      await admin.saveSettings(patch)
      setMsg((m) => ({ ...m, [which]: { ok: true, text: 'Saqlandi' } }))
      onSaved()
    } catch (err) {
      setMsg((m) => ({ ...m, [which]: { ok: false, text: err.message } }))
    } finally {
      setBusy(null)
    }
  }
  const site = s.siteUrl

  return (
    <>
      <Card
        title="Google Search Console"
        sub="Sayt Google qidiruvida qanday körinişini kuzatiş"
        right={s.gscFile ? <span className="ad-badge ok"><CheckCircle2 size={13} /> Fayl qöyilgan</span> : <Search size={18} className="ad-muted-ic" />}
      >
        <ol className="ad-steps">
          <li>
            <a href="https://search.google.com/search-console/welcome" target="_blank" rel="noreferrer">
              Search Console <ExternalLink size={12} />
            </a>{' '}
            → <b>URL prefix</b> → <code>{site}</code> kiriting.
          </li>
          <li>
            <b>HTML file</b> usulini tanlang va fayl nomini (masalan <code>google1a2b3c4d5e6f7a8b.html</code>) pastga kiriting — fayl saytda öz-özidan paydo böladi.
          </li>
          <li>
            Google'da <b>Verify</b> tugmasini bosing. Söng <b>Sitemaps</b> bölimiga quyidagilarni qöşing:
          </li>
        </ol>
        <CopyLine text={`${site}/sitemap.xml`} />
        <CopyLine text={`${site}/b/sitemap.xml`} />
        <form
          className="ad-inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            save('gsc', { gscFile: gsc })
          }}
        >
          <input className="ad-input" value={gsc} onChange={(e) => setGsc(e.target.value)} placeholder="google1a2b3c4d5e6f7a8b.html" spellCheck={false} />
          <button className="ad-btn ad-btn-primary" disabled={busy === 'gsc' || gsc === (s.gscFile ?? '')}>
            {busy === 'gsc' ? <span className="ad-spin" /> : 'Saqlaş'}
          </button>
        </form>
        {msg.gsc && <p className={msg.gsc.ok ? 'ad-success' : 'ad-error'}>{msg.gsc.text}</p>}
        {s.gscFile && (
          <a className="ad-link" href={`/${s.gscFile}`} target="_blank" rel="noreferrer">
            Faylni tekşiriş: /{s.gscFile} <ExternalLink size={12} />
          </a>
        )}
        <p className="ad-hint">
          Domen (DNS) usuli ham işlaydi: Google bergan <code>TXT</code> yozuvni domen DNS sozlamalariga qöşing — bu saytdagi barça subdomenlarni qamraydi.
        </p>
      </Card>

      <Card
        title="Google Analytics 4"
        sub="Ixtiyoriy: öz statistikamizga qöşimça ravişda"
        right={s.ga4Id ? <span className="ad-badge ok"><CheckCircle2 size={13} /> Ulangan</span> : <BarChart2 size={18} className="ad-muted-ic" />}
      >
        <p className="ad-hint">
          <a href="https://analytics.google.com/" target="_blank" rel="noreferrer">
            analytics.google.com <ExternalLink size={12} />
          </a>{' '}
          → Admin → Data streams → Web. <b>Measurement ID</b> ni (G-XXXXXXXXXX) kiriting — saytga kod qöşiş şart emas.
        </p>
        <form
          className="ad-inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            save('ga', { ga4Id: ga })
          }}
        >
          <input className="ad-input" value={ga} onChange={(e) => setGa(e.target.value)} placeholder="G-XXXXXXXXXX" spellCheck={false} />
          <button className="ad-btn ad-btn-primary" disabled={busy === 'ga' || ga === (s.ga4Id ?? '')}>
            {busy === 'ga' ? <span className="ad-spin" /> : 'Saqlaş'}
          </button>
        </form>
        {msg.ga && <p className={msg.ga.ok ? 'ad-success' : 'ad-error'}>{msg.ga.text}</p>}
      </Card>
    </>
  )
}
