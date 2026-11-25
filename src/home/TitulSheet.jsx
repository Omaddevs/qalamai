// "Titul" — the title-page details of referat / kurs işi, with the page drawn live next to the form.
// Saved into the profile, so every academic document after this one is filled in already.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Buildings, Student, MapPin, X, Check, IdentificationCard } from '@phosphor-icons/react'
import { UNIVERSITIES, loadDocProfile, saveProfile, uniOf } from '../profile.js'
import { titulPage } from '../blueprints.js'
import { t } from '../i18n/index.js'
import { buildIn } from './DeckLang.jsx'
import './titulsheet.css'

/** What a complete title page needs; direction and subject are optional lines. */
const NEEDED = ['uni', 'faculty', 'course', 'group', 'fullName', 'supervisor', 'city', 'year']
const COURSES = ['1', '2', '3', '4', '5', '6']

export function titulProgress(p) {
  const filled = (k) => (k === 'uni' ? uniOf(p).name.trim() : String(p[k] ?? '').trim())
  return { done: NEEDED.filter(filled).length, total: NEEDED.length }
}

/** Composer pill: "Titul · 5/8" with a ring that fills up. */
export function TitulPill({ profile, onClick }) {
  const { done, total } = titulProgress(profile)
  const full = done === total
  return (
    <button type="button" className={`ts-pill ${full ? 'full' : ''}`} onClick={onClick} title={t('ts.title')}>
      <span className="ts-ring" style={{ '--p': done / total }}>
        {full ? <Check size={11} weight="bold" /> : <IdentificationCard size={12} weight="bold" />}
      </span>
      {t('ts.pill')}
      <b>
        {done}/{total}
      </b>
    </button>
  )
}

function Field({ label, optional, wide, children }) {
  return (
    <label className={`ts-field ${wide ? 'wide' : ''}`}>
      <span className="ts-label">
        {label}
        {optional && <i>{t('ts.optional')}</i>}
      </span>
      {children}
    </label>
  )
}

export default function TitulSheet({ kindId, topic, lang, langName, onClose, onSaved }) {
  const [p, setP] = useState(loadDocProfile)
  const [html, setHtml] = useState('')
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }))
  const { done, total } = titulProgress(p)

  // the title page, in the document's language, redrawn on every keystroke
  useEffect(() => {
    let live = true
    buildIn(lang, () => titulPage(kindId, topic || t('ts.noTopic'), p)).then((h) => live && setHtml(h))
    return () => {
      live = false
    }
  }, [kindId, topic, lang, p])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const save = (e) => {
    e.preventDefault()
    saveProfile(p)
    onSaved?.(p)
    onClose()
  }

  const unis = useMemo(() => UNIVERSITIES.filter((u) => u.id !== 'other'), [])

  return createPortal(
    <div className="ts" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="ts-card" role="dialog" aria-modal="true" aria-label={t('ts.title')} onSubmit={save}>
        <header className="ts-head">
          <span className="ts-head-ic">
            <IdentificationCard size={20} weight="duotone" />
          </span>
          <div>
            <h2>{t('ts.title')}</h2>
            <p>{t('ts.sub')}</p>
          </div>
          <button type="button" className="ts-x" onClick={onClose} aria-label={t('ui.close')}>
            <X size={17} weight="bold" />
          </button>
        </header>

        <div className="ts-body">
          <div className="ts-form">
            <fieldset>
              <legend>
                <Buildings size={15} weight="duotone" /> {t('ts.g.uni')}
              </legend>
              <Field label={t('tl.uni')} wide>
                <select value={p.uniId} onChange={set('uniId')}>
                  {unis.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.short} — {u.name}
                    </option>
                  ))}
                  <option value="other">{t('ts.uniOther')}</option>
                </select>
              </Field>
              {p.uniId === 'other' && (
                <Field label={t('ts.uniOther')} wide>
                  <input value={p.uniCustom} onChange={set('uniCustom')} placeholder={t('ts.uniPh')} autoFocus />
                </Field>
              )}
              <Field label={t('tl.need.faculty')}>
                <input value={p.faculty} onChange={set('faculty')} placeholder={t('ts.facultyPh')} />
              </Field>
              <Field label={t('ts.direction')} optional>
                <input value={p.direction} onChange={set('direction')} />
              </Field>
              <Field label={t('tl.subject')} optional wide>
                <input value={p.subject} onChange={set('subject')} placeholder={t('tl.subjectPh')} />
              </Field>
            </fieldset>

            <fieldset>
              <legend>
                <Student size={15} weight="duotone" /> {t('ts.g.student')}
              </legend>
              <Field label={t('tl.need.fullName')} wide>
                <input value={p.fullName} onChange={set('fullName')} placeholder={t('ts.fullNamePh')} autoComplete="name" />
              </Field>
              <Field label={t('ts.course')}>
                <div className="ts-seg" role="radiogroup" aria-label={t('ts.course')}>
                  {COURSES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={String(p.course) === c}
                      className={String(p.course) === c ? 'on' : ''}
                      onClick={() => setP((x) => ({ ...x, course: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('tl.need.group')}>
                <input value={p.group} onChange={set('group')} placeholder="211-21" />
              </Field>
              <Field label={t('tl.need.supervisor')} wide>
                <input value={p.supervisor} onChange={set('supervisor')} placeholder={t('ts.supervisorPh')} />
              </Field>
            </fieldset>

            <fieldset>
              <legend>
                <MapPin size={15} weight="duotone" /> {t('ts.g.place')}
              </legend>
              <Field label={t('ts.city')}>
                <input value={p.city} onChange={set('city')} />
              </Field>
              <Field label={t('tl.year')}>
                <input value={p.year} onChange={set('year')} inputMode="numeric" maxLength={4} />
              </Field>
            </fieldset>
          </div>

          <aside className="ts-side">
            <div className="ts-side-head">
              <b>{t('ts.preview')}</b>
              <small>{langName ? t('ts.lang', { lang: langName }) : t('ts.livePreview')}</small>
            </div>
            <div className="ts-page">
              <div className="mp" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </aside>
        </div>

        <footer className="ts-foot">
          <span className="ts-progress">
            <span className="ts-bar">
              <span style={{ width: `${(done / total) * 100}%` }} />
            </span>
            {t('ts.done', { n: done, total })}
          </span>
          <button type="button" className="ts-btn" onClick={onClose}>
            {t('ui.cancel')}
          </button>
          <button type="submit" className="ts-btn primary">
            <Check size={15} weight="bold" /> {t('ui.save')}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
