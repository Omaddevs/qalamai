import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  UserCircle, LinkSimple, ShareNetwork, Palette, Globe, Star, Eye, EyeSlash, Copy, ArrowSquareOut, CircleNotch, CheckCircle, WarningCircle, DownloadSimple, ChartBar,
  ArrowCounterClockwise, ArrowClockwise, Plus, SlidersHorizontal,
} from '@phosphor-icons/react'
import { checkBioSlug, exportBioHtml, getBioPage, publishBio, unpublishBio } from '../api.js'
import { SOCIALS, normalizeUrl } from '../../shared/bio.js'
import { FONTS2, toV2 } from '../../shared/bio2.js'
import BioPhone, { BioPage, SOCIAL_ICONS, useFonts } from './BioPhone.jsx'
import Inspector, { AddMenu } from './bioInspector.jsx'
import { BIO_TEMPLATES } from './bioTemplates.js'
import { Area, Field, ImagePick, Input, Panel, Repeater } from './controls.jsx'
import { rid } from './cv.js'
import { saveBlob } from './logo.js'

const suggestSlug = (name) =>
  (name || '')
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)

function Publish({ design, data, notify }) {
  const [page, setPage] = useState(undefined) // undefined = loading, null = not published
  const [slug, setSlug] = useState('')
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    getBioPage(design.id)
      .then((p) => {
        setPage(p)
        setSlug(p?.slug ?? suggestSlug(data.name))
      })
      .catch(() => {
        setPage(null)
        setSlug(suggestSlug(data.name))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!slug) return setCheck(null)
    timer.current = setTimeout(() => {
      checkBioSlug(slug)
        .then(setCheck)
        .catch(() => setCheck(null))
    }, 350)
    return () => clearTimeout(timer.current)
  }, [slug])

  async function publish() {
    setBusy(true)
    try {
      const p = await publishBio(slug, design.id, data)
      setPage(p)
      notify(page ? 'Sahifa yangilandi' : 'Sahifa eʼlon qilindi 🎉')
    } catch (err) {
      notify(err.message)
    } finally {
      setBusy(false)
    }
  }

  const ok = check?.available
  return (
    <div className="bio-pub">
      <Field label="Sahifa manzili">
        <div className={`bio-slug ${check ? (ok ? 'ok' : 'bad') : ''}`}>
          <span>{window.location.host}/b/</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} maxLength={30} placeholder="ismingiz" />
          {check && (ok ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />)}
        </div>
        <small className={`cs-hint ${check && !ok ? 'err' : ''}`}>{check && !ok ? check.reason : check?.mine ? 'Bu sizning manzilingiz' : '3–30 belgi: lotin harflari, raqam, «-» va «_»'}</small>
      </Field>
      <button className="cs-btn dark block lg" disabled={!ok || busy} onClick={publish}>
        {busy ? <CircleNotch size={16} className="spin" /> : <Globe size={16} weight="bold" />} {page ? 'Özgarişlarni eʼlon qiliş' : 'Eʼlon qiliş'}
      </button>

      {page && (
        <div className="bio-live">
          <span className="bio-live-dot">Jonli</span>
          <a href={page.url} target="_blank" rel="noreferrer">
            {page.url.replace(/^https?:\/\//, '')}
          </a>
          <div className="bio-live-actions">
            <button
              className="cs-btn"
              onClick={() => {
                navigator.clipboard?.writeText(page.url)
                notify('Havola nusxalandi — Instagram profilingizga qöying')
              }}
            >
              <Copy size={14} /> Nusxa
            </button>
            <a className="cs-btn" href={page.url} target="_blank" rel="noreferrer">
              <ArrowSquareOut size={14} /> Oçiş
            </a>
          </div>
          <div className="bio-stats">
            <span>
              <Eye size={15} /> <b>{page.views}</b> köriş
            </span>
            <span>
              <ChartBar size={15} /> <b>{page.clicks}</b> bosiş
            </span>
          </div>
          <button
            className="cs-btn ghost danger"
            onClick={async () => {
              if (!window.confirm('Sahifa internetdan olib taşlansinmi?')) return
              await unpublishBio(page.slug).catch(() => {})
              setPage(null)
              notify('Sahifa olib taşlandi')
            }}
          >
            Eʼlondan oliş
          </button>
        </div>
      )}
      {page === undefined && <small className="cs-hint">Holat tekşirilmoqda…</small>}
      <button
        className="cs-btn block"
        onClick={() =>
          exportBioHtml(data)
            .then((b) => saveBlob(b, `${suggestSlug(data.name) || 'link-in-bio'}.html`))
            .catch((e) => notify(e.message))
        }
      >
        <DownloadSimple size={15} /> HTML fayl sifatida yuklab oliş
      </button>
    </div>
  )
}

/** Link-in-bio editor parts: { left, stage } — called as a hook by CreatorStudio. */
export default function useBioStudio({ design, data: raw, setData, notify }) {
  // older pages (theme + button style) become an element-by-element design, keeping their look
  useEffect(() => {
    if (raw?.v !== 2) setData(toV2(raw))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const data = useMemo(() => toV2(raw), [raw])

  const [sel, setSel] = useState('page')
  const [adding, setAdding] = useState(false)
  const past = useRef([])
  const future = useRef([])
  const lastPush = useRef(0)
  const [, bump] = useState(0)

  // fonts for the font pickers
  useFonts(Object.values(FONTS2).map((f) => f.g))

  /** Apply an edit to a deep copy; consecutive edits within 600 ms form one undo step. */
  const patch = useCallback(
    (fn) =>
      setData((prev) => {
        const base = toV2(prev)
        const draft = structuredClone(base)
        fn(draft)
        const now = Date.now()
        if (now - lastPush.current > 600) {
          past.current = [...past.current.slice(-80), base]
          future.current = []
        }
        lastPush.current = now
        return draft
      }),
    [setData],
  )
  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(toV2(raw))
    lastPush.current = 0
    setData(prev)
    bump((x) => x + 1)
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(toV2(raw))
    lastPush.current = 0
    setData(next)
    bump((x) => x + 1)
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea,select,[contenteditable]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const set = (patchObj) => patch((d) => Object.assign(d, patchObj))
  const moveDeco = (id, x, y, done) =>
    patch((d) => {
      const k = d.style.deco.findIndex((z) => z.id === id)
      if (k >= 0) d.style.deco[k] = { ...d.style.deco[k], x: Math.round(Math.min(110, Math.max(-10, x)) * 10) / 10, y: Math.round(Math.min(110, Math.max(-10, y)) * 10) / 10 }
      void done
    })

  const left = (
    <>
      <Panel title="Profil" icon={UserCircle} open>
        <ImagePick value={data.avatar} onChange={(v) => set({ avatar: v })} size={720} label="Rasm yuklaş" notify={notify} />
        <Field label="Ism yoki brend">
          <Input value={data.name} onChange={(v) => set({ name: v.slice(0, 60) })} maxLength={60} placeholder="Ismingiz" />
        </Field>
        <Field label="Kasb">
          <Input value={data.role} onChange={(v) => set({ role: v.slice(0, 80) })} maxLength={80} placeholder="Masalan: Dizayner" />
        </Field>
        <Field label="Qisqaça" hint={`${data.bio.length}/300`}>
          <Area value={data.bio} onChange={(v) => set({ bio: v.slice(0, 300) })} rows={3} placeholder="Kimsiz va nima qilasiz?" />
        </Field>
      </Panel>

      <Panel title={`Havolalar · ${data.links.length}`} icon={LinkSimple} open>
        <Repeater
          items={data.links}
          onChange={(links) => set({ links })}
          make={() => ({ id: rid(), title: '', url: '', highlight: false, enabled: true })}
          addLabel="Havola qöşiş"
          titleOf={(l) => (
            <>
              {l.highlight && <Star size={12} weight="fill" className="gold" />} {l.title || 'Yangi havola'}
              {l.enabled === false && <em className="cs-off">yaşirin</em>}
              {l.url && !normalizeUrl(l.url) && <em className="cs-off err">havola xato</em>}
            </>
          )}
          render={(l, p) => (
            <>
              <Field label="Matn">
                <Input value={l.title} onChange={(v) => p({ title: v })} maxLength={80} placeholder="Masalan: Portfolio" />
              </Field>
              <Field label="Izoh qatori">
                <Input value={l.sub ?? ''} onChange={(v) => p({ sub: v })} maxLength={80} placeholder="ixtiyoriy" />
              </Field>
              <Field label="Havola">
                <Input value={l.url} onChange={(v) => p({ url: v })} maxLength={500} placeholder="https://… yoki t.me/…" />
              </Field>
              <div className="cs-row">
                <button type="button" className={`cs-btn ${l.highlight ? 'on' : ''}`} onClick={() => p({ highlight: !l.highlight })}>
                  <Star size={14} weight={l.highlight ? 'fill' : 'regular'} /> Ajratiş
                </button>
                <button type="button" className="cs-btn" onClick={() => p({ enabled: l.enabled === false })}>
                  {l.enabled === false ? <EyeSlash size={14} /> : <Eye size={14} />} {l.enabled === false ? 'Yaşirin' : 'Körinadi'}
                </button>
                <button type="button" className="cs-btn" onClick={() => setSel(`link:${l.id}`)}>
                  <SlidersHorizontal size={14} /> Dizayn
                </button>
              </div>
            </>
          )}
        />
      </Panel>

      <Panel title="Ijtimoiy tarmoqlar" icon={ShareNetwork}>
        <div className="bio-socials">
          {SOCIALS.map((so) => {
            const Icon = SOCIAL_ICONS[so.id]
            return (
              <label key={so.id} className="bio-social">
                <Icon size={18} />
                <input value={data.socials[so.id] ?? ''} placeholder={`${so.label}: ${so.placeholder}`} maxLength={200} onChange={(e) => set({ socials: { ...data.socials, [so.id]: e.target.value } })} />
              </label>
            )
          })}
        </div>
      </Panel>

      <Panel title="Uslubni almaştiriş" icon={Palette}>
        <p className="cs-hint">Matn va havolalaringiz saqlanadi, faqat dizayn almaşadi.</p>
        <div className="bio-tpls">
          {BIO_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="bio-tpl"
              title={t.name}
              onClick={() => {
                patch((d) => {
                  d.style = structuredClone(t.data.style)
                  // template blocks that need content get the template's sample text
                  for (const k of ['headline', 'brand']) if (!d[k] && t.data[k]) d[k] = t.data[k]
                })
                setSel('page')
                notify(`«${t.name}» uslubi qöllandi`)
              }}
            >
              <span className="bio-tpl-page">
                <BioPage data={t.data} compact />
              </span>
              <small>{t.name}</small>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Eʼlon qiliş" icon={Globe} open>
        <Publish design={design} data={data} notify={notify} />
      </Panel>
    </>
  )

  const stage = (
    <div className="bio-stage bio2-stage">
      <div className="bio2-canvas">
        <div className="bio2-tools">
          <button type="button" className="cs-btn" onClick={undo} disabled={!past.current.length} title="Ortga (⌘Z)">
            <ArrowCounterClockwise size={15} weight="bold" />
          </button>
          <button type="button" className="cs-btn" onClick={redo} disabled={!future.current.length} title="Qaytariş (⇧⌘Z)">
            <ArrowClockwise size={15} weight="bold" />
          </button>
          <button type="button" className={`cs-btn dark ${adding ? 'on' : ''}`} onClick={() => setAdding((v) => !v)}>
            <Plus size={15} weight="bold" /> Element qöşiş
          </button>
          <button type="button" className={`cs-btn ${sel === 'page' ? 'on' : ''}`} onClick={() => setSel('page')}>
            <Palette size={15} /> Fon va şriftlar
          </button>
        </div>
        {adding && <AddMenu data={data} patch={patch} setSel={setSel} onClose={() => setAdding(false)} />}
        <BioPhone data={data} editor selected={sel} onSelect={setSel} onMoveDeco={moveDeco} />
        <p className="cs-stage-note">Elementni bosing — öngda uning sozlamalari oçiladi · bezaklarni sichqonça bilan suring</p>
      </div>
      <aside className="bio2-inspector">
        <Inspector data={data} sel={sel} setSel={setSel} patch={patch} notify={notify} />
      </aside>
    </div>
  )

  return { left, stage }
}
