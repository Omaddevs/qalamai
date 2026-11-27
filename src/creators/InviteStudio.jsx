// Taklifnoma studio: every text, picture, colour, font, the music and the order of the sections
// can be changed; the invitation is published at <domain>/<name> and guests' answers come back here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Heart, Envelope, ListBullets, Palette, MusicNotes, Globe, Eye, EyeSlash, ArrowUp, ArrowDown, Trash, Plus, CaretDown,
  UploadSimple, X, CircleNotch, CheckCircle, WarningCircle, Copy, ArrowSquareOut, TelegramLogo, Users, DownloadSimple,
  ArrowCounterClockwise, ArrowClockwise, Image as ImageIcon, CopySimple, DeviceMobile,
} from '@phosphor-icons/react'
import {
  COLOR_KEYS, INVITE_FONTS, INVITE_LANGS, INVITE_TEMPLATES, MANY_SECTIONS, SECTION_TYPES, autoDateText, checkInviteSlug,
  inviteFontsHref, inviteTitle, newSection, normalizeInvite, suggestInviteSlug,
} from '../../shared/invite.js'
import { checkInviteSlug as checkSlugApi, deleteInviteRsvp, getInvitePage, inviteRsvps, publishInvite, unpublishInvite, uploadInviteMedia } from '../api.js'
import { t } from '../i18n/index.js'
import { Area, Field, Input, Panel, Seg, Toggle } from './controls.jsx'
import { InviteLive } from './InviteFrame.jsx'
import { rid } from './cv.js'
import { saveBlob } from './logo.js'
import './invite.css'

const LANG_NAMES = { uz: 'Özbekça', 'uz-cyrl': 'Ўзбекча', ru: 'Русский', en: 'English' } // i18n-ignore (language names)
const FONT_NAMES = { classic: 'Klassik', script: 'Yozma', marck: 'Marck', lora: 'Lora', forum: 'Forum', modern: 'Modern' } // i18n-ignore (font names)

/* ───────────────────────── small pieces ───────────────────────── */

/** Pick a file and upload it; `accept` decides pictures or music. */
function useUpload(notify) {
  const [busy, setBusy] = useState(false)
  const run = async (file, kind) => {
    if (!file) return null
    if (kind === 'image' && !/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return notify(t('iv.err.image')), null
    if (kind === 'audio' && file.size > 12 * 1048576) return notify(t('iv.err.audioSize')), null
    setBusy(true)
    try {
      return (await uploadInviteMedia(file)).url
    } catch (err) {
      notify(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }
  return [busy, run]
}

function Photo({ value, onChange, notify, label }) {
  const input = useRef(null)
  const [busy, upload] = useUpload(notify)
  return (
    <div className="iv-photo">
      <button type="button" className="iv-photo-img" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <CircleNotch size={20} className="spin" /> : value ? <img src={value} alt="" /> : <ImageIcon size={22} />}
      </button>
      <div className="iv-photo-act">
        <span>{label ?? t('iv.photo')}</span>
        <div className="cs-row">
          <button type="button" className="cs-btn" onClick={() => input.current?.click()} disabled={busy}>
            <UploadSimple size={14} /> {value ? t('iv.replace') : t('iv.upload')}
          </button>
          {value && (
            <button type="button" className="cs-btn ghost" onClick={() => onChange(null)}>
              <X size={13} weight="bold" /> {t('iv.remove')}
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; const url = await upload(f, 'image'); if (url) onChange(url) }} />
    </div>
  )
}

/** Rows of two short fields (time + title, label + time) with add / delete. */
function Rows({ items, onChange, a, b, addLabel, max = 20 }) {
  const set = (id, patch) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return (
    <div className="iv-rows">
      {items.map((it) => (
        <div key={it.id} className="iv-row">
          <input className="cs-input sm" value={it[a.key]} placeholder={a.ph} maxLength={a.max} onChange={(e) => set(it.id, { [a.key]: e.target.value })} style={{ flex: a.flex ?? 1 }} />
          <input className="cs-input sm" value={it[b.key]} placeholder={b.ph} maxLength={b.max} onChange={(e) => set(it.id, { [b.key]: e.target.value })} style={{ flex: b.flex ?? 1 }} />
          <button type="button" className="cs-mini danger" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label={t('iv.remove')}>
            <Trash size={13} weight="bold" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="cs-add" onClick={() => onChange([...items, { id: rid(), [a.key]: '', [b.key]: '' }])}>
          <Plus size={14} weight="bold" /> {addLabel}
        </button>
      )}
    </div>
  )
}

function Gallery({ photos, onChange, notify }) {
  const input = useRef(null)
  const [busy, upload] = useUpload(notify)
  const add = async (files) => {
    const urls = []
    for (const f of [...files].slice(0, 24 - photos.length)) {
      const url = await upload(f, 'image')
      if (url) urls.push(url)
    }
    if (urls.length) onChange([...photos, ...urls])
  }
  return (
    <div className="iv-gal">
      {photos.map((p, i) => (
        <div key={p} className="iv-gal-i">
          <img src={p} alt="" />
          <button type="button" onClick={() => onChange(photos.filter((_, k) => k !== i))} aria-label={t('iv.remove')}>
            <X size={12} weight="bold" />
          </button>
        </div>
      ))}
      {photos.length < 24 && (
        <button type="button" className="iv-gal-add" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <CircleNotch size={18} className="spin" /> : <Plus size={18} weight="bold" />}
        </button>
      )}
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { const f = e.target.files; add(f).then(() => {}); e.target.value = '' }} />
    </div>
  )
}

/* ───────────────────────── one section's fields ───────────────────────── */

function SectionFields({ s, set, data, notify }) {
  const T = (k, label, o = {}) => (
    <Field label={label} hint={o.hint}>
      {o.area ? <Area value={s[k]} onChange={(v) => set({ [k]: v })} rows={o.rows ?? 3} maxLength={o.max} placeholder={o.ph} /> : <Input value={s[k]} onChange={(v) => set({ [k]: v })} maxLength={o.max ?? 160} placeholder={o.ph} />}
    </Field>
  )
  switch (s.type) {
    case 'hero':
      return (
        <>
          {T('top', t('iv.f.top'), { ph: 'Bismillahir Rohmanir Rohim' })}
          <Photo value={s.photo} onChange={(v) => set({ photo: v })} notify={notify} label={t('iv.f.heroPhoto')} />
          <Field label={t('iv.f.shape')}>
            <Seg small value={s.shape} onChange={(v) => set({ shape: v })} options={{ arch: t('iv.shape.arch'), circle: t('iv.shape.circle'), rect: t('iv.shape.rect') }} />
          </Field>
          {T('verse', t('iv.f.verse'), { area: true, rows: 2, max: 300 })}
          {T('arabic', t('iv.f.arabic'), { max: 200 })}
          {T('ref', t('iv.f.ref'))}
          {T('text', t('iv.f.text'), { area: true, rows: 5, max: 1200 })}
          {T('text2', t('iv.f.text2'), { area: true, rows: 3, max: 1200 })}
          {T('dateText', t('iv.f.dateText'), { max: 60, ph: autoDateText(data), hint: t('iv.f.dateHint') })}
          {T('times', t('iv.f.times'), { max: 120 })}
        </>
      )
    case 'countdown':
      return (
        <>
          {T('title', t('iv.f.title'))}
          {T('done', t('iv.f.done'))}
          <small className="cs-hint">{t('iv.f.countHint')}</small>
        </>
      )
    case 'location':
      return (
        <>
          {T('title', t('iv.f.title'))}
          {T('place', t('iv.f.place'), { max: 200 })}
          {T('addr', t('iv.f.addr'), { max: 300 })}
          <Field label={t('iv.f.schedule')}>
            <Rows items={s.items} onChange={(items) => set({ items })} a={{ key: 'label', ph: t('iv.ph.label'), max: 40, flex: 1.4 }} b={{ key: 'time', ph: '14:00', max: 20 }} addLabel={t('iv.addTime')} max={6} />
          </Field>
          {T('map', t('iv.f.map'), { max: 500, ph: 'https://maps.app.goo.gl/…', hint: t('iv.f.mapHint') })}
          {T('mapButton', t('iv.f.mapButton'), { max: 60 })}
          <Photo value={s.photo} onChange={(v) => set({ photo: v })} notify={notify} label={t('iv.f.venuePhoto')} />
        </>
      )
    case 'calendar':
      return (
        <>
          {T('title', t('iv.f.title'))}
          {T('text', t('iv.f.text'), { area: true, rows: 2, max: 400 })}
          {T('note', t('iv.f.note'), { hint: t('iv.f.noteHint') })}
        </>
      )
    case 'program':
      return (
        <>
          {T('title', t('iv.f.title'))}
          <Rows items={s.items} onChange={(items) => set({ items })} a={{ key: 'time', ph: '16:00', max: 20 }} b={{ key: 'title', ph: t('iv.ph.event'), max: 120, flex: 2.4 }} addLabel={t('iv.addItem')} />
        </>
      )
    case 'gift':
      return (
        <>
          {T('title', t('iv.f.title'))}
          {T('text', t('iv.f.text'), { area: true, rows: 2, max: 400 })}
          {T('card', t('iv.f.card'), { max: 40, ph: '8600 0000 0000 0000' })}
          {T('holder', t('iv.f.holder'), { max: 80 })}
        </>
      )
    case 'gallery':
      return (
        <>
          {T('title', t('iv.f.title'))}
          <Gallery photos={s.photos} onChange={(photos) => set({ photos })} notify={notify} />
        </>
      )
    case 'rsvp':
      return (
        <>
          {T('title', t('iv.f.title'))}
          {T('text', t('iv.f.text'), { area: true, rows: 2, max: 400 })}
          {T('yes', t('iv.f.yes'), { max: 60 })}
          {T('no', t('iv.f.no'), { max: 60 })}
          {T('button', t('iv.f.button'), { max: 40 })}
          {T('thanks', t('iv.f.thanks'), { max: 200 })}
          <Toggle checked={s.guests} onChange={(v) => set({ guests: v })} label={t('iv.f.guests')} />
          <small className="cs-hint">{t('iv.f.rsvpHint')}</small>
        </>
      )
    case 'footer':
      return (
        <>
          {T('title', t('iv.f.title'))}
          <Photo value={s.photo} onChange={(v) => set({ photo: v })} notify={notify} />
          {T('text', t('iv.f.text'), { area: true, rows: 3, max: 600 })}
        </>
      )
    default:
      return (
        <>
          {T('title', t('iv.f.title'))}
          {T('text', t('iv.f.text'), { area: true, rows: 6, max: 3000 })}
        </>
      )
  }
}

/** Every section: show/hide, order, duplicate, delete, and its fields. */
function Sections({ data, patch, notify, onOpen }) {
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const list = data.sections
  const move = (i, d) =>
    patch((x) => {
      const j = i + d
      if (j < 0 || j >= x.sections.length) return
      ;[x.sections[i], x.sections[j]] = [x.sections[j], x.sections[i]]
    })
  const toggle = (id) => {
    const next = open === id ? null : id
    setOpen(next)
    if (next) onOpen(next)
  }
  const present = new Set(list.map((s) => s.type))
  const addable = SECTION_TYPES.filter((ty) => MANY_SECTIONS.has(ty) || !present.has(ty))
  return (
    <div className="iv-secs">
      {list.map((s, i) => (
        <div key={s.id} className={`iv-sec ${open === s.id ? 'open' : ''} ${s.on ? '' : 'off'}`}>
          <div className="iv-sec-head">
            <button type="button" className="iv-sec-title" onClick={() => toggle(s.id)}>
              <b>{t(`iv.sec.${s.type}`)}</b>
              {s.title?.trim() && s.type !== 'hero' && <em>{s.title}</em>}
              <CaretDown size={12} weight="bold" />
            </button>
            <button type="button" className="cs-mini" onClick={() => patch((x) => { x.sections[i].on = !x.sections[i].on })} aria-label={s.on ? t('iv.hide') : t('iv.show')} title={s.on ? t('iv.hide') : t('iv.show')}>
              {s.on ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
            </button>
            <button type="button" className="cs-mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('iv.up')}>
              <ArrowUp size={13} weight="bold" />
            </button>
            <button type="button" className="cs-mini" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={t('iv.down')}>
              <ArrowDown size={13} weight="bold" />
            </button>
            {MANY_SECTIONS.has(s.type) && (
              <button type="button" className="cs-mini" onClick={() => patch((x) => { x.sections.splice(i + 1, 0, { ...structuredClone(s), id: rid() }) })} aria-label={t('iv.duplicate')} title={t('iv.duplicate')}>
                <CopySimple size={13} weight="bold" />
              </button>
            )}
            <button type="button" className="cs-mini danger" onClick={() => window.confirm(t('iv.confirmDelete')) && patch((x) => { x.sections.splice(i, 1) })} aria-label={t('iv.remove')}>
              <Trash size={13} weight="bold" />
            </button>
          </div>
          {open === s.id && (
            <div className="iv-sec-body">
              <SectionFields s={s} data={data} notify={notify} set={(p) => patch((x) => { Object.assign(x.sections[i], p) })} />
            </div>
          )}
        </div>
      ))}
      {adding ? (
        <div className="iv-add-menu">
          {addable.map((ty) => (
            <button
              key={ty}
              type="button"
              className="cs-btn"
              onClick={() => {
                const id = rid()
                patch((x) => { x.sections.push(newSection(ty, id)) })
                setAdding(false)
                setOpen(id)
                setTimeout(() => onOpen(id), 400)
              }}
            >
              <Plus size={13} weight="bold" /> {t(`iv.sec.${ty}`)}
            </button>
          ))}
          <button type="button" className="cs-btn ghost" onClick={() => setAdding(false)}>
            <X size={13} weight="bold" />
          </button>
        </div>
      ) : (
        <button type="button" className="cs-add" onClick={() => setAdding(true)}>
          <Plus size={15} weight="bold" /> {t('iv.addSection')}
        </button>
      )}
    </div>
  )
}

/* ───────────────────────── design ───────────────────────── */

function useFontsLoaded() {
  useEffect(() => {
    const id = 'iv-fonts'
    if (document.getElementById(id)) return
    const fams = Object.keys(INVITE_FONTS).map((k) => inviteFontsHref(k).split('?')[1].replace('&display=swap', '')).join('&')
    const link = Object.assign(document.createElement('link'), { id, rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${fams}&display=swap` })
    document.head.appendChild(link)
  }, [])
}

function Design({ data, patch, notify }) {
  useFontsLoaded()
  return (
    <>
      <Field label={t('iv.styles')} hint={t('iv.stylesHint')}>
        <div className="iv-styles">
          {INVITE_TEMPLATES.map((tp) => (
            <button
              key={tp.id}
              type="button"
              className="iv-style"
              title={tp.name}
              onClick={() => {
                patch((x) => {
                  x.theme = { ...tp.data.theme }
                  x.font = tp.data.font
                  x.decor = tp.data.decor
                })
                notify(t('iv.styleApplied', { name: tp.name }))
              }}
            >
              <span className="iv-style-sw" style={{ background: tp.data.theme.bg }}>
                <i style={{ background: tp.data.theme.band }} />
                <i style={{ background: tp.data.theme.accent }} />
              </span>
              <small>{tp.name}</small>
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('iv.colors')}>
        <div className="iv-colors">
          {COLOR_KEYS.map((k) => (
            <label key={k} className="iv-color">
              <input type="color" value={data.theme[k]} onChange={(e) => { const v = e.target.value; patch((x) => { x.theme[k] = v }) }} />
              <span>{t(`iv.color.${k}`)}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label={t('iv.font')}>
        <div className="iv-fonts">
          {Object.entries(INVITE_FONTS).map(([id, f]) => (
            <button key={id} type="button" className={`iv-font ${data.font === id ? 'on' : ''}`} onClick={() => patch((x) => { x.font = id })}>
              <b style={{ fontFamily: `'${f.names}', serif` }}>{inviteTitle(data) || 'Jasur & Madina'}</b>
              <small>{FONT_NAMES[id]}</small>
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('iv.decor')}>
        <Seg small value={data.decor} onChange={(v) => patch((x) => { x.decor = v })} options={{ ribbon: t('iv.decor.ribbon'), gold: t('iv.decor.gold'), none: t('iv.decor.none') }} />
      </Field>
    </>
  )
}

function Music({ data, patch, notify }) {
  const input = useRef(null)
  const [busy, upload] = useUpload(notify)
  return (
    <div className="iv-music">
      {data.music ? (
        <>
          <div className="iv-music-now">
            <MusicNotes size={18} weight="duotone" />
            <b>{data.music.name || t('iv.music.song')}</b>
          </div>
          <audio controls preload="none" src={data.music.src} />
        </>
      ) : (
        <p className="cs-hint">{t('iv.music.none')}</p>
      )}
      <div className="cs-row">
        <button type="button" className="cs-btn dark" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <CircleNotch size={15} className="spin" /> : <UploadSimple size={15} />} {data.music ? t('iv.music.replace') : t('iv.music.upload')}
        </button>
        {data.music && (
          <button type="button" className="cs-btn ghost danger" onClick={() => patch((x) => { x.music = null })}>
            <Trash size={14} /> {t('iv.remove')}
          </button>
        )}
      </div>
      <small className="cs-hint">{t('iv.music.hint')}</small>
      <input
        ref={input}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,.mp3,.m4a,.ogg"
        hidden
        onChange={async (e) => {
          const f = e.target.files[0]
          e.target.value = ''
          const url = await upload(f, 'audio')
          if (url) patch((x) => { x.music = { src: url, name: f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 120) } })
        }}
      />
    </div>
  )
}

/* ───────────────────────── publishing ───────────────────────── */

function Answers({ slug, notify }) {
  const [list, setList] = useState(null)
  useEffect(() => {
    inviteRsvps(slug).then(setList).catch((e) => (notify(e.message), setList([])))
  }, [slug, notify])
  if (!list) return <small className="cs-hint">{t('iv.loading')}</small>
  if (!list.length) return <small className="cs-hint">{t('iv.rsvp.empty')}</small>
  const csv = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [[t('iv.rsvp.name'), t('iv.rsvp.answer'), t('iv.rsvp.guests'), t('iv.rsvp.note'), t('iv.rsvp.date')], ...list.map((r) => [r.name, r.answer === 'yes' ? t('iv.rsvp.yes') : t('iv.rsvp.no'), r.guests, r.note, new Date(r.createdAt).toLocaleString()])]
    saveBlob(new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), `${slug}-mehmonlar.csv`)
  }
  return (
    <div className="iv-answers">
      {list.map((r) => (
        <div key={r.id} className={`iv-ans ${r.answer}`}>
          <span className="iv-ans-dot" />
          <div>
            <b>{r.name}</b>
            <small>
              {r.answer === 'yes' ? t('iv.rsvp.comes', { n: r.guests }) : t('iv.rsvp.no')} · {new Date(r.createdAt).toLocaleDateString()}
            </small>
            {r.note && <p>{r.note}</p>}
          </div>
          <button type="button" className="cs-mini danger" aria-label={t('iv.remove')} onClick={() => window.confirm(t('iv.rsvp.confirm')) && deleteInviteRsvp(slug, r.id).then(() => setList((l) => l.filter((x) => x.id !== r.id))).catch((e) => notify(e.message))}>
            <Trash size={12} weight="bold" />
          </button>
        </div>
      ))}
      <button type="button" className="cs-btn block" onClick={csv}>
        <DownloadSimple size={14} /> {t('iv.rsvp.csv')}
      </button>
    </div>
  )
}

function Publish({ design, data, notify }) {
  const [page, setPage] = useState(undefined) // undefined: loading · null: not published
  const [slug, setSlug] = useState('')
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    getInvitePage(design.id)
      .then((p) => {
        setPage(p)
        setSlug(p?.slug ?? suggestInviteSlug(data.names))
      })
      .catch(() => {
        setPage(null)
        setSlug(suggestInviteSlug(data.names))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!slug) return setCheck(null)
    const local = checkInviteSlug(slug)
    if (!local.ok) return setCheck({ available: false, reason: t(`iv.slug.${local.code}`) })
    timer.current = setTimeout(() => {
      checkSlugApi(slug)
        .then((r) => setCheck({ ...r, reason: r.available ? null : t(`iv.slug.${r.code ?? 'taken'}`) }))
        .catch(() => setCheck(null))
    }, 350)
    return () => clearTimeout(timer.current)
  }, [slug])

  async function publish() {
    setBusy(true)
    try {
      const p = await publishInvite(slug, design.id, normalizeInvite(data))
      setPage(p)
      notify(page ? t('iv.pub.updated') : t('iv.pub.done'))
    } catch (err) {
      notify(err.message)
    } finally {
      setBusy(false)
    }
  }

  const host = page?.url ? new URL(page.url).host : window.location.host
  const ok = check?.available
  const changedSlug = page && page.slug !== slug
  const share = page && `https://t.me/share/url?url=${encodeURIComponent(page.url)}&text=${encodeURIComponent(inviteTitle(data))}`
  return (
    <div className="bio-pub">
      <Field label={t('iv.pub.address')}>
        <div className={`bio-slug ${check ? (ok ? 'ok' : 'bad') : ''}`}>
          <span>{host}/</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))} maxLength={40} placeholder="jasur-madina" />
          {check && (ok ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />)}
        </div>
        <small className={`cs-hint ${check && !ok ? 'err' : ''}`}>{check && !ok ? check.reason : check?.mine ? t('iv.slug.mine') : t('iv.slug.rule')}</small>
      </Field>
      <button className="cs-btn dark block lg" disabled={!ok || busy} onClick={publish}>
        {busy ? <CircleNotch size={16} className="spin" /> : <Globe size={16} weight="bold" />} {page ? (changedSlug ? t('iv.pub.move') : t('iv.pub.update')) : t('iv.pub.publish')}
      </button>
      {page && <small className="cs-hint">{t('iv.pub.note')}</small>}

      {page && (
        <div className="bio-live">
          <span className="bio-live-dot">{t('iv.pub.live')}</span>
          <a href={page.url} target="_blank" rel="noreferrer">
            {page.url.replace(/^https?:\/\//, '')}
          </a>
          <div className="bio-live-actions">
            <button className="cs-btn" onClick={() => { navigator.clipboard?.writeText(page.url); notify(t('iv.pub.copied')) }}>
              <Copy size={14} /> {t('iv.pub.copy')}
            </button>
            <a className="cs-btn" href={page.url} target="_blank" rel="noreferrer">
              <ArrowSquareOut size={14} /> {t('iv.pub.open')}
            </a>
            <a className="cs-btn" href={share} target="_blank" rel="noreferrer">
              <TelegramLogo size={14} /> Telegram
            </a>
          </div>
          <div className="bio-stats">
            <span><Eye size={15} /> <b>{page.views}</b> {t('iv.pub.views')}</span>
            <span><Users size={15} /> <b>{page.rsvp?.yes ?? 0}</b> {t('iv.pub.yes')} · <b>{page.rsvp?.guests ?? 0}</b> {t('iv.pub.guests')}</span>
          </div>
          <button className="cs-btn" onClick={() => setShowAnswers((v) => !v)}>
            <ListBullets size={14} /> {t('iv.rsvp.title', { n: page.rsvp?.answers ?? 0 })}
          </button>
          {showAnswers && <Answers slug={page.slug} notify={notify} />}
          <button
            className="cs-btn ghost danger"
            onClick={async () => {
              if (!window.confirm(t('iv.pub.confirmOff'))) return
              await unpublishInvite(page.slug).catch(() => {})
              setPage(null)
              notify(t('iv.pub.off'))
            }}
          >
            {t('iv.pub.unpublish')}
          </button>
        </div>
      )}
      {page === undefined && <small className="cs-hint">{t('iv.loading')}</small>}
    </div>
  )
}

/* ───────────────────────── the studio ───────────────────────── */

/** Taklifnoma editor parts: { left, stage } — called as a hook by CreatorStudio. */
export default function useInviteStudio({ design, data: raw, setData, notify }) {
  const data = useMemo(() => normalizeInvite(raw), [raw])
  const [cover, setCover] = useState(false)
  const preview = useRef(null)
  const past = useRef([])
  const future = useRef([])
  const lastPush = useRef(0)
  const [, bump] = useState(0)

  /** Apply an edit to a copy; edits within 600 ms form one undo step. */
  const patch = useCallback(
    (fn) =>
      setData((prev) => {
        const base = normalizeInvite(prev)
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
    future.current.push(data)
    lastPush.current = 0
    setData(prev)
    bump((x) => x + 1)
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(data)
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

  const goto = useCallback((id) => {
    setCover(false)
    preview.current?.goto(id)
  }, [])

  const left = (
    <>
      <Panel title={t('iv.p.main')} icon={Heart} open>
        <div className="iv-names">
          <Field label={t('iv.f.nameA')}>
            <Input value={data.names.a} onChange={(v) => patch((x) => { x.names.a = v })} maxLength={40} placeholder="Jasur" />
          </Field>
          <Field label="&">
            <Input value={data.names.and} onChange={(v) => patch((x) => { x.names.and = v })} maxLength={6} placeholder="&" />
          </Field>
          <Field label={t('iv.f.nameB')}>
            <Input value={data.names.b} onChange={(v) => patch((x) => { x.names.b = v })} maxLength={40} placeholder={t('iv.f.optional')} />
          </Field>
        </div>
        <div className="iv-when">
          <Field label={t('iv.f.date')}>
            <input className="cs-input" type="date" value={data.date} onChange={(e) => e.target.value && patch((x) => { x.date = e.target.value })} />
          </Field>
          <Field label={t('iv.f.time')}>
            <input className="cs-input" type="time" value={data.time} onChange={(e) => e.target.value && patch((x) => { x.time = e.target.value })} />
          </Field>
          <Field label={t('iv.f.days')}>
            <select className="cs-input" value={data.days} onChange={(e) => patch((x) => { x.days = Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t('iv.f.lang')} hint={t('iv.f.langHint')}>
          <Seg small value={data.lang} onChange={(v) => patch((x) => { x.lang = v })} options={Object.fromEntries(INVITE_LANGS.map((l) => [l, LANG_NAMES[l]]))} />
        </Field>
      </Panel>

      <Panel title={t('iv.p.cover')} icon={Envelope}>
        <Toggle checked={data.cover.on} onChange={(v) => patch((x) => { x.cover.on = v })} label={t('iv.cover.on')} hint={t('iv.cover.hint')} />
        {data.cover.on && (
          <>
            <Field label={t('iv.f.top')}>
              <Input value={data.cover.top} onChange={(v) => { setCover(true); patch((x) => { x.cover.top = v }) }} maxLength={120} />
            </Field>
            <Field label={t('iv.cover.subtitle')}>
              <Input value={data.cover.subtitle} onChange={(v) => { setCover(true); patch((x) => { x.cover.subtitle = v }) }} maxLength={120} />
            </Field>
            <Field label={t('iv.cover.button')}>
              <Input value={data.cover.button} onChange={(v) => { setCover(true); patch((x) => { x.cover.button = v }) }} maxLength={40} />
            </Field>
          </>
        )}
      </Panel>

      <Panel title={t('iv.p.sections', { n: data.sections.length })} icon={ListBullets} open>
        <Sections data={data} patch={patch} notify={notify} onOpen={goto} />
      </Panel>

      <Panel title={t('iv.p.design')} icon={Palette}>
        <Design data={data} patch={patch} notify={notify} />
      </Panel>

      <Panel title={t('iv.p.music')} icon={MusicNotes}>
        <Music data={data} patch={patch} notify={notify} />
      </Panel>

      <Panel title={t('iv.p.publish')} icon={Globe} open>
        <Publish design={design} data={data} notify={notify} />
      </Panel>
    </>
  )

  const stage = (
    <div className="iv-stage">
      <div className="iv-tools">
        <button type="button" className="cs-btn" onClick={undo} disabled={!past.current.length} title={t('iv.undo')}>
          <ArrowCounterClockwise size={15} weight="bold" />
        </button>
        <button type="button" className="cs-btn" onClick={redo} disabled={!future.current.length} title={t('iv.redo')}>
          <ArrowClockwise size={15} weight="bold" />
        </button>
        {data.cover.on && (
          <button type="button" className={`cs-btn ${cover ? 'on' : ''}`} onClick={() => setCover((v) => !v)}>
            <Envelope size={15} /> {t('iv.p.cover')}
          </button>
        )}
      </div>
      <div className="iv-phone">
        <span className="iv-notch" />
        <InviteLive ref={preview} data={data} cover={cover} />
      </div>
      <p className="cs-stage-note">
        <DeviceMobile size={14} /> {t('iv.stageNote')}
      </p>
    </div>
  )

  return { left, stage }
}
