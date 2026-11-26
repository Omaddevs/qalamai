// Sayt: the content of the site's "Haqimizda" menu — Yangiliklar (/yangiliklar), Jamoa (/jamoa),
// Hamkorlar (/hamkorlar). Texts are written per language (Özbekça is required, Rusça and Inglizça are
// optional; Cyrillic Uzbek is made from Özbekça automatically). Pictures are uploaded first, then saved.
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, ImagePlus, Newspaper, Pencil, Plus, Trash2, Users, Handshake, X } from 'lucide-react'
import { admin } from './api.js'
import { dateTime } from './format.js'
import { Card, ErrorBox, PageHead, Segmented, useLoad } from './parts.jsx'
import './site.css'

const LANGS = [
  { id: 'uz', label: 'Özbekça' },
  { id: 'ru', label: 'Rusça' },
  { id: 'en', label: 'Inglizça' },
]
const TABS = [
  { value: 'news', label: 'Yangiliklar' },
  { value: 'team', label: 'Jamoa' },
  { value: 'partners', label: 'Hamkorlar' },
]

export default function SitePage() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('qalam.admin.site') || 'news')
  useEffect(() => sessionStorage.setItem('qalam.admin.site', tab), [tab])
  return (
    <div className="ad-page ad-site">
      <PageHead title="Sayt" sub="Saytdagi «Haqimizda» bölimi: yangiliklar, jamoa va hamkorlar. Özgarişlar saytda darhol körinadi.">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </PageHead>
      {tab === 'news' && <NewsTab />}
      {tab === 'team' && <ListTab kind="team" />}
      {tab === 'partners' && <ListTab kind="partners" />}
    </div>
  )
}

/* ───────── shared pieces ───────── */

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Faylni öqib bölmadi'))
    r.readAsDataURL(file)
  })

/** Picture field: upload → { key, url } kept in the form; "×" removes it. */
function PictureField({ label, kind, value, url, onChange, hint }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 10 * 1048576) return setErr('Rasm 10 MB dan katta bölmasin')
    setBusy(true)
    setErr(null)
    try {
      const res = await admin.siteMedia(await readFile(file), kind)
      onChange(res.key, res.url)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="ad-field">
      <span>{label}</span>
      <div className={`ad-site-pic ${kind}`}>
        {value && url ? (
          <>
            <img src={url} alt="" />
            <button type="button" className="ad-icon ad-site-pic-x" onClick={() => onChange(null, null)} aria-label="Rasmni olib taşlaş" title="Olib taşlaş">
              <X size={15} />
            </button>
          </>
        ) : (
          <button type="button" className="ad-site-pic-add" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <span className="ad-spin" /> : <ImagePlus size={22} />}
            <small>{busy ? 'Yuklanmoqda…' : 'Rasm tanlaş'}</small>
          </button>
        )}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif,image/gif" hidden onChange={pick} />
      </div>
      {hint && <small className="ad-hint">{hint}</small>}
      {err && <small className="ad-error">{err}</small>}
    </div>
  )
}

/** UZ / RU / EN switch above the language fields; a dot marks languages that have text. */
function LangTabs({ value, onChange, filled }) {
  return (
    <div className="ad-site-langs" role="tablist">
      {LANGS.map((l) => (
        <button key={l.id} type="button" role="tab" aria-selected={value === l.id} className={value === l.id ? 'on' : ''} onClick={() => onChange(l.id)}>
          {l.label}
          {l.id === 'uz' && <b>*</b>}
          {filled(l.id) && <i aria-label="toldirilgan" />}
        </button>
      ))}
    </div>
  )
}

const hasText = (obj) => Object.values(obj ?? {}).some((v) => String(v ?? '').trim())

/* ───────── news ───────── */

const emptyPost = () => ({ id: null, slug: '', i18n: { uz: { title: '', excerpt: '', body: '' } }, coverKey: null, cover: null, published: false, publishedAt: null })
const toLocalInput = (d) => {
  if (!d) return ''
  const x = new Date(d)
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function postStatus(n) {
  if (!n.published) return { label: 'Qoralama', cls: 'muted' }
  if (n.publishedAt && new Date(n.publishedAt) > new Date()) return { label: 'Rejalaştirilgan', cls: 'gold' }
  return { label: 'Çop etilgan', cls: 'ok' }
}

function NewsTab() {
  const { data, error, reload } = useLoad(() => admin.siteNews(), [])
  const [edit, setEdit] = useState(null)
  const remove = async (n) => {
    if (!window.confirm(`«${n.i18n.uz?.title}» öçirilsinmi? Saytdan ham yöqoladi.`)) return
    try {
      await admin.deleteSiteNews(n.id)
      if (edit?.id === n.id) setEdit(null)
      reload()
    } catch (e) {
      window.alert(e.message)
    }
  }
  return (
    <div className="ad-grid-2 ad-site-grid">
      <div className="ad-col">
        <Card
          title="Yangiliklar"
          sub={data ? `${data.items.length} ta` : ''}
          right={<button className="ad-btn ad-btn-primary" onClick={() => setEdit(emptyPost())}><Plus size={16} /> Yangi</button>}
        >
          {error && !data && <ErrorBox error={error} onRetry={reload} />}
          {data && data.items.length === 0 && <p className="ad-muted">Hali yangilik yöq. «Yangi» tugmasini bosing.</p>}
          {data && data.items.length > 0 && (
            <ul className="ad-site-list">
              {data.items.map((n) => {
                const st = postStatus(n)
                return (
                  <li key={n.id} className={edit?.id === n.id ? 'on' : ''}>
                    <span className="ad-site-thumb">{n.cover ? <img src={n.cover} alt="" /> : <Newspaper size={18} />}</span>
                    <div className="ad-site-li-txt">
                      <b>{n.i18n.uz?.title}</b>
                      <small>
                        <span className={`ad-badge ${st.cls}`}>{st.label}</span> {n.publishedAt ? dateTime(n.publishedAt) : dateTime(n.createdAt)}
                        {n.i18n.ru?.title && ' · RU'}
                        {n.i18n.en?.title && ' · EN'}
                      </small>
                    </div>
                    <div className="ad-site-li-act">
                      {n.published && (
                        <a className="ad-icon" href={`/yangiliklar/${n.slug}`} target="_blank" rel="noreferrer" title="Saytda körish" aria-label="Saytda körish"><ExternalLink size={16} /></a>
                      )}
                      <button className="ad-icon" onClick={() => setEdit({ ...emptyPost(), ...n })} title="Tahrirlaş" aria-label="Tahrirlaş"><Pencil size={16} /></button>
                      <button className="ad-icon" onClick={() => remove(n)} title="Öçiriş" aria-label="Öçiriş"><Trash2 size={16} /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="ad-col">
        {edit ? (
          <NewsEditor key={edit.id ?? 'new'} post={edit} onClose={() => setEdit(null)} onSaved={(item) => { setEdit({ ...emptyPost(), ...item }); reload() }} />
        ) : (
          <Card title="Qanday yoziladi" sub="Yangilikni tanlang yoki yangisini oçing">
            <ul className="ad-site-help">
              <li><b>Sarlavha</b> va <b>qisqa matn</b> röyxatda hamda Google’da körinadi.</li>
              <li>Matnda: böş qator — yangi xatboşi, <code>## </code> — sarlavha, <code>- </code> — röyxat, <code>**qalin**</code>, <code>*kursiv*</code>, <code>[matn](https://…)</code> — havola, <code>&gt; </code> — iqtibos.</li>
              <li>Rusça va Inglizça ixtiyoriy: yozilmasa, Özbekça matn körinadi. Kirill yozuvi Özbekçadan özi yasaladi.</li>
              <li>«Çop etiş» yoqilmaguniça yangilik saytda körinmaydi. Kelajakdagi sana qöysangiz, öşa vaqtda çiqadi.</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function NewsEditor({ post, onClose, onSaved }) {
  const [f, setF] = useState(post)
  const [lang, setLang] = useState('uz')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const tx = f.i18n[lang] ?? {}
  const setText = (field, v) => setF((x) => ({ ...x, i18n: { ...x.i18n, [lang]: { ...x.i18n[lang], [field]: v } } }))
  const ok = Boolean(f.i18n.uz?.title?.trim())

  const save = async (e) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setMsg(null)
    const body = {
      i18n: f.i18n,
      coverKey: f.coverKey ?? null,
      published: f.published,
      publishedAt: f.publishedAt ? new Date(f.publishedAt).toISOString() : null,
      ...(f.slug ? { slug: f.slug } : {}),
    }
    try {
      const { item } = f.id ? await admin.updateSiteNews(f.id, body) : await admin.createSiteNews(body)
      setMsg({ ok: true, text: item.published ? 'Saqlandi va saytda çop etildi.' : 'Qoralama saqlandi.' })
      onSaved(item)
    } catch (ex) {
      setMsg({ ok: false, text: ex.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={f.id ? 'Yangilikni tahrirlaş' : 'Yangi yangilik'} right={<button className="ad-icon" onClick={onClose} aria-label="Yopiş"><X size={18} /></button>}>
      <form className="ad-form" onSubmit={save}>
        <LangTabs value={lang} onChange={setLang} filled={(l) => hasText(f.i18n[l])} />
        <label className="ad-field">
          <span>Sarlavha{lang === 'uz' && ' *'}</span>
          <input className="ad-input" value={tx.title ?? ''} onChange={(e) => setText('title', e.target.value)} maxLength={160} placeholder="Masalan: 20 ta yangi prezentatsiya şabloni" />
        </label>
        <label className="ad-field">
          <span>Qisqa matn</span>
          <textarea className="ad-input ad-textarea" rows={2} value={tx.excerpt ?? ''} onChange={(e) => setText('excerpt', e.target.value)} maxLength={400} placeholder="1–2 gap: röyxatda va Google’da körinadi" />
          <small className="ad-hint">{(tx.excerpt ?? '').length} / 400</small>
        </label>
        <label className="ad-field">
          <span>Matn</span>
          <textarea className="ad-input ad-textarea ad-site-body" rows={12} value={tx.body ?? ''} onChange={(e) => setText('body', e.target.value)} maxLength={40000} placeholder={'Birinçi xatboşi…\n\n## Nima yangi\n\n- birinçi\n- ikkinçi'} />
        </label>
        <PictureField label="Muqova rasmi" kind="cover" value={f.coverKey} url={f.cover} onChange={(key, url) => setF((x) => ({ ...x, coverKey: key, cover: url }))} hint="Keng rasm (masalan 1600×1000). Ulaşilganda havola rasmi ham şu." />
        <div className="ad-site-row">
          <label className="ad-field">
            <span>Manzil (slug)</span>
            <input className="ad-input ad-mono" value={f.slug} onChange={(e) => setF((x) => ({ ...x, slug: e.target.value.toLowerCase() }))} maxLength={90} placeholder="Sarlavhadan özi yasaladi" />
          </label>
          <label className="ad-field">
            <span>Sana</span>
            <input className="ad-input" type="datetime-local" value={toLocalInput(f.publishedAt)} onChange={(e) => setF((x) => ({ ...x, publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
          </label>
        </div>
        <label className="ad-site-switch">
          <input type="checkbox" checked={f.published} onChange={(e) => setF((x) => ({ ...x, published: e.target.checked }))} />
          <span className="track" aria-hidden="true" />
          <span>Çop etiş — saytda körinsin</span>
        </label>
        {msg && <p className={msg.ok ? 'ad-success' : 'ad-error'}>{msg.text}</p>}
        <div className="ad-site-actions">
          <button className="ad-btn ad-btn-primary" disabled={!ok || busy}>{busy ? <span className="ad-spin" /> : 'Saqlaş'}</button>
          {f.id && f.published && <a className="ad-btn" href={`/yangiliklar/${f.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Saytda körish</a>}
        </div>
      </form>
    </Card>
  )
}

/* ───────── team and partners ───────── */

const KINDS = {
  team: {
    title: 'Jamoa',
    one: 'Jamoa a’zosi',
    Icon: Users,
    picture: 'photoKey',
    pictureUrl: 'photo',
    pictureKind: 'photo',
    pictureLabel: 'Surat',
    pictureHint: 'Kvadrat surat yaxşi: yuz markazda qirqiladi.',
    fields: [
      { id: 'role', label: 'Lavozimi', required: true, max: 120, placeholder: 'Masalan: Dasturçi va loyiha asoşçisi' },
      { id: 'badge', label: 'Belgi (ismning tepasida)', max: 80, placeholder: 'Masalan: Loyiha asoşçisi' },
      { id: 'bio', label: 'Qisqaça', max: 600, rows: 3, placeholder: 'Masalan: Mobil ilovalar, veb-saytlar va Telegram botlarni yarataman — ğoyadan tortib tayyor mahsulotgaça.' },
      {
        id: 'tracks',
        label: 'Yönalişlar va texnologiyalar',
        max: 1500,
        rows: 4,
        mono: true,
        placeholder: 'Mobil ilovalar: Flutter, React Native, iOS, Android\nVeb-saytlar: React, Vite, Node.js, UI/UX\nTelegram botlar: Python, Aiogram, Node.js, API',
        hint: 'Har qatorda bitta yönaliş: «Nomi: texnologiya, texnologiya». Saytda tugma va vaqt şkalasi bölib çiqadi.',
      },
      {
        id: 'stats',
        label: 'Raqamlar (3 tagaça)',
        max: 400,
        rows: 3,
        mono: true,
        placeholder: '3 in 1 | Mobil · Web · Bot\n20+ | Tayyor loyiha\n24/7 | Qöllab-quvvatlaş',
        hint: 'Har qatorda: «raqam | izoh».',
      },
    ],
    links: [
      { id: 'telegram', label: 'Telegram', placeholder: '@username yoki havola' },
      { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/…' },
      { id: 'instagram', label: 'Instagram', placeholder: '@username yoki havola' },
      { id: 'github', label: 'GitHub', placeholder: 'https://github.com/…' },
      { id: 'site', label: 'Sayt', placeholder: 'https://…' },
    ],
    page: '/jamoa',
  },
  partners: {
    title: 'Hamkorlar',
    one: 'Hamkor',
    Icon: Handshake,
    picture: 'logoKey',
    pictureUrl: 'logo',
    pictureKind: 'logo',
    pictureLabel: 'Logotip',
    pictureHint: 'Şaffof fonli PNG yoki SVG eñ çiroyli çiqadi.',
    fields: [{ id: 'about', label: 'Qisqaça', max: 400, rows: 3, placeholder: 'Hamkorlik haqida 1–2 gap' }],
    url: true,
    page: '/hamkorlar',
  },
}

const emptyItem = (k) => ({ id: null, name: '', i18n: { uz: {} }, [k.picture]: null, [k.pictureUrl]: null, links: {}, url: '', visible: true })

function ListTab({ kind }) {
  const k = KINDS[kind]
  const { data, error, reload } = useLoad(() => admin.siteList(kind), [kind])
  const [edit, setEdit] = useState(null)
  const [items, setItems] = useState(null)
  useEffect(() => setItems(data?.items ?? null), [data])

  const move = async (i, d) => {
    const next = [...items]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setItems(next)
    try {
      await admin.siteOrder(kind, next.map((x) => x.id))
    } catch (e) {
      window.alert(e.message)
      reload()
    }
  }
  const toggle = async (x) => {
    try {
      await admin.updateSiteItem(kind, x.id, { visible: !x.visible })
      reload()
    } catch (e) {
      window.alert(e.message)
    }
  }
  const remove = async (x) => {
    if (!window.confirm(`«${x.name}» öçirilsinmi?`)) return
    try {
      await admin.deleteSiteItem(kind, x.id)
      if (edit?.id === x.id) setEdit(null)
      reload()
    } catch (e) {
      window.alert(e.message)
    }
  }

  return (
    <div className="ad-grid-2 ad-site-grid">
      <div className="ad-col">
        <Card
          title={k.title}
          sub={items ? `${items.length} ta · tartibni ↑↓ bilan özgartiring` : ''}
          right={<button className="ad-btn ad-btn-primary" onClick={() => setEdit(emptyItem(k))}><Plus size={16} /> Qöşiş</button>}
        >
          {error && !data && <ErrorBox error={error} onRetry={reload} />}
          {items && items.length === 0 && <p className="ad-muted">Hali heç kim qöşilmagan.</p>}
          {items && items.length > 0 && (
            <ul className="ad-site-list">
              {items.map((x, i) => (
                <li key={x.id} className={`${edit?.id === x.id ? 'on' : ''} ${x.visible ? '' : 'hidden'}`}>
                  <span className={`ad-site-thumb ${kind}`}>{x[k.pictureUrl] ? <img src={x[k.pictureUrl]} alt="" /> : <k.Icon size={18} />}</span>
                  <div className="ad-site-li-txt">
                    <b>{x.name}</b>
                    <small>{kind === 'team' ? x.i18n.uz?.role : x.url || x.i18n.uz?.about || '—'}{!x.visible && ' · yaşirin'}</small>
                  </div>
                  <div className="ad-site-li-act">
                    <button className="ad-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga"><ArrowUp size={15} /></button>
                    <button className="ad-icon" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Pastga"><ArrowDown size={15} /></button>
                    <button className="ad-icon" onClick={() => toggle(x)} title={x.visible ? 'Yaşiriş' : 'Körsatiş'} aria-label={x.visible ? 'Yaşiriş' : 'Körsatiş'}>{x.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                    <button className="ad-icon" onClick={() => setEdit({ ...emptyItem(k), ...x, url: x.url ?? '' })} aria-label="Tahrirlaş"><Pencil size={16} /></button>
                    <button className="ad-icon" onClick={() => remove(x)} aria-label="Öçiriş"><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="ad-hint ad-site-open"><a href={k.page} target="_blank" rel="noreferrer">Saytda körish <ExternalLink size={13} /></a></p>
        </Card>
      </div>
      <div className="ad-col">
        {edit ? (
          <ItemEditor key={edit.id ?? 'new'} k={k} kind={kind} item={edit} onClose={() => setEdit(null)} onSaved={(item) => { setEdit({ ...emptyItem(k), ...item, url: item.url ?? '' }); reload() }} />
        ) : (
          <Card title={`${k.one} qöşiş`} sub="Röyxatdan tanlang yoki «Qöşiş» ni bosing">
            <p className="ad-muted">Yaşirin qilinganlar saytda körinmaydi, lekin öçirilmaydi. Tartib saytda ham şunday böladi.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

function ItemEditor({ k, kind, item, onClose, onSaved }) {
  const [f, setF] = useState(item)
  const [lang, setLang] = useState('uz')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const tx = f.i18n[lang] ?? {}
  const setText = (field, v) => setF((x) => ({ ...x, i18n: { ...x.i18n, [lang]: { ...x.i18n[lang], [field]: v } } }))
  const ok = f.name.trim() && k.fields.filter((x) => x.required).every((x) => f.i18n.uz?.[x.id]?.trim())

  const save = async (e) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setMsg(null)
    const body = {
      name: f.name,
      i18n: f.i18n,
      [k.picture]: f[k.picture] ?? null,
      visible: f.visible,
      ...(k.links ? { links: f.links ?? {} } : {}),
      ...(k.url ? { url: f.url?.trim() || null } : {}),
    }
    try {
      const { item: saved } = f.id ? await admin.updateSiteItem(kind, f.id, body) : await admin.createSiteItem(kind, body)
      setMsg({ ok: true, text: 'Saqlandi.' })
      onSaved(saved)
    } catch (ex) {
      setMsg({ ok: false, text: ex.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={f.id ? f.name || k.one : `Yangi: ${k.one.toLowerCase()}`} right={<button className="ad-icon" onClick={onClose} aria-label="Yopiş"><X size={18} /></button>}>
      <form className="ad-form" onSubmit={save}>
        <div className="ad-site-row top">
          <PictureField label={k.pictureLabel} kind={k.pictureKind} value={f[k.picture]} url={f[k.pictureUrl]} onChange={(key, url) => setF((x) => ({ ...x, [k.picture]: key, [k.pictureUrl]: url }))} hint={k.pictureHint} />
          <label className="ad-field">
            <span>{kind === 'team' ? 'Ism va familiya *' : 'Nomi *'}</span>
            <input className="ad-input" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} maxLength={120} />
          </label>
        </div>
        <LangTabs value={lang} onChange={setLang} filled={(l) => hasText(f.i18n[l])} />
        {k.fields.map((fl) => (
          <label key={fl.id} className="ad-field">
            <span>{fl.label}{fl.required && lang === 'uz' && ' *'}</span>
            {fl.rows ? (
              <textarea className={`ad-input ad-textarea${fl.mono ? ' ad-site-body' : ''}`} rows={fl.rows} value={tx[fl.id] ?? ''} onChange={(e) => setText(fl.id, e.target.value)} maxLength={fl.max} placeholder={fl.placeholder} />
            ) : (
              <input className="ad-input" value={tx[fl.id] ?? ''} onChange={(e) => setText(fl.id, e.target.value)} maxLength={fl.max} placeholder={fl.placeholder} />
            )}
            {fl.hint && <small className="ad-hint">{fl.hint}</small>}
          </label>
        ))}
        {k.url && (
          <label className="ad-field">
            <span>Sayt</span>
            <input className="ad-input" value={f.url ?? ''} onChange={(e) => setF((x) => ({ ...x, url: e.target.value }))} maxLength={500} placeholder="https://…" />
          </label>
        )}
        {k.links && (
          <fieldset className="ad-site-links">
            <legend>Havolalar (ixtiyoriy)</legend>
            {k.links.map((l) => (
              <label key={l.id} className="ad-field">
                <span>{l.label}</span>
                <input className="ad-input" value={f.links?.[l.id] ?? ''} onChange={(e) => setF((x) => ({ ...x, links: { ...x.links, [l.id]: e.target.value } }))} maxLength={300} placeholder={l.placeholder} />
              </label>
            ))}
          </fieldset>
        )}
        <label className="ad-site-switch">
          <input type="checkbox" checked={f.visible} onChange={(e) => setF((x) => ({ ...x, visible: e.target.checked }))} />
          <span className="track" aria-hidden="true" />
          <span>Saytda körinsin</span>
        </label>
        {msg && <p className={msg.ok ? 'ad-success' : 'ad-error'}>{msg.text}</p>}
        <div className="ad-site-actions">
          <button className="ad-btn ad-btn-primary" disabled={!ok || busy}>{busy ? <span className="ad-spin" /> : 'Saqlaş'}</button>
        </div>
      </form>
    </Card>
  )
}
