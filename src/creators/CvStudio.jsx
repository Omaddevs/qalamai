import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Layout, IdentificationCard, Quotes, Briefcase, GraduationCap, Lightning, Translate, Certificate, Rocket, Heart, FilePdf, WarningCircle, Sparkle,
} from '@phosphor-icons/react'
import CvPage from './CvPage.jsx'
import { Scaled } from './KitThumb.jsx'
import { Area, Field, ImagePick, Input, Panel, Repeater, Seg, Swatches, Toggle } from './controls.jsx'
import { CV_ACCENTS, CV_FONTS, CV_TEMPLATES, LANG_LEVELS, LANG_NAMES, SUMMARY_IDEAS, newCv, rid } from './cv.js'

const PAGE_W = 794
const PAGE_H = 1123

/** A4 preview scaled to the column width, with page-break guides when content runs long. */
function Preview({ cv, onPages }) {
  const wrap = useRef(null)
  const page = useRef(null)
  const [k, setK] = useState(0.6)
  const [h, setH] = useState(PAGE_H)
  useLayoutEffect(() => {
    const fit = () => setK(Math.min(1, (wrap.current.clientWidth - 40) / PAGE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const measure = () => {
      const height = Math.max(PAGE_H, page.current?.scrollHeight ?? PAGE_H)
      setH(height)
      onPages(Math.ceil((height - 4) / PAGE_H))
    }
    measure()
    document.fonts.ready.then(measure)
  })
  const pages = Math.ceil((h - 4) / PAGE_H)
  return (
    <div ref={wrap} className="cv-stage">
      <div className="cv-stage-page" style={{ width: PAGE_W * k, height: pages * PAGE_H * k }}>
        <div ref={page} className="cv-stage-inner" style={{ transform: `scale(${k})` }}>
          <CvPage cv={cv} />
        </div>
        {Array.from({ length: pages - 1 }, (_, i) => (
          <span key={i} className="cv-break" style={{ top: (i + 1) * PAGE_H * k }}>
            {i + 2}-sahifa
          </span>
        ))}
      </div>
    </div>
  )
}

/** Print the resume alone as A4 — the browser's "Save as PDF" gives a vector PDF with real text. */
function printCv(name) {
  const prev = document.title
  document.title = name || 'Rezyume'
  document.body.classList.add('cv-printing')
  const done = () => {
    document.body.classList.remove('cv-printing')
    document.title = prev
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  setTimeout(() => window.print(), 50)
}

export function CvExport({ cv, notify }) {
  return (
    <>
      <button
        className="cs-btn dark"
        onClick={() => {
          notify('Çop etiş oynasida «PDF sifatida saqlaş» ni tanlang')
          printCv(cv.name)
        }}
      >
        <FilePdf size={16} weight="bold" /> PDF yuklab oliş
      </button>
      {createPortal(
        <div className="cv-print" aria-hidden="true">
          <CvPage cv={cv} />
        </div>,
        document.body,
      )}
    </>
  )
}

const MonthInput = ({ value, onChange }) => <input className="cs-input" type="month" value={/^\d{4}-\d{2}$/.test(value ?? '') ? value : ''} onChange={(e) => onChange(e.target.value)} />

/** Resume editor parts: { left, stage } — called as a hook by CreatorStudio. */
export default function useCvStudio({ data: cv, setData, notify }) {
  const [pages, setPages] = useState(1)
  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const setContact = (k, v) => setData((d) => ({ ...d, contacts: { ...d.contacts, [k]: v } }))
  useEffect(() => {
    if (pages > 1 && cv.density !== 'compact') notify('Rezyume 1 sahifadan oşdi — «Ixçam» rejimni sinab köring')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages > 1])

  const left = (
    <>
      <Panel title="Şablon va dizayn" icon={Layout} open>
        <div className="cv-tpls">
          {Object.entries(CV_TEMPLATES).map(([id, t]) => (
            <button
              key={id}
              type="button"
              className={cv.template === id ? 'on' : ''}
              onClick={() => set({ template: id, accent: cv.template === id ? cv.accent : t.accent, font: cv.template === id ? cv.font : t.font })}
            >
              <span className="cv-tpl-thumb">
                <Scaled width={PAGE_W} height={PAGE_H}>
                  <CvPage cv={{ ...newCvSample, template: id, accent: t.accent, font: t.font }} />
                </Scaled>
              </span>
              <small>{t.name}</small>
            </button>
          ))}
        </div>
        <Field label="Rang">
          <Swatches value={cv.accent} colors={CV_ACCENTS} onChange={(c) => set({ accent: c })} />
        </Field>
        <Field label="Şrift">
          <Seg value={cv.font} options={Object.fromEntries(Object.entries(CV_FONTS).map(([k, f]) => [k, f.label]))} onChange={(v) => set({ font: v })} small />
        </Field>
        <Field label="Bölim nomlari tili">
          <Seg value={cv.lang} options={LANG_NAMES} onChange={(v) => set({ lang: v })} small />
        </Field>
        <Field label="Ziçlik">
          <Seg value={cv.density} options={{ normal: 'Oddiy', compact: 'Ixçam' }} onChange={(v) => set({ density: v })} small />
        </Field>
      </Panel>

      <Panel title="Şaxsiy maʼlumotlar" icon={IdentificationCard} open>
        <Toggle label="Rasm körsatilsin" checked={cv.showPhoto} onChange={(v) => set({ showPhoto: v })} />
        {cv.showPhoto && <ImagePick value={cv.photo} onChange={(v) => set({ photo: v })} size={500} label="Rasm yuklaş" notify={notify} />}
        <Field label="Ism familiya">
          <Input value={cv.name} onChange={(v) => set({ name: v })} maxLength={60} />
        </Field>
        <Field label="Lavozim yoki yönaliş">
          <Input value={cv.role} onChange={(v) => set({ role: v })} maxLength={80} placeholder="Masalan: Buxgalter" />
        </Field>
        <div className="cs-grid2">
          {[
            ['phone', 'Telefon', '+998 90 123 45 67'],
            ['email', 'Email', 'siz@mail.uz'],
            ['city', 'Şahar', 'Toşkent'],
            ['telegram', 'Telegram', '@username'],
            ['linkedin', 'LinkedIn', 'linkedin.com/in/…'],
            ['website', 'Sayt / portfolio', 'sayt.uz'],
          ].map(([k, label, ph]) => (
            <Field key={k} label={label}>
              <Input value={cv.contacts[k]} onChange={(v) => setContact(k, v)} placeholder={ph} maxLength={80} />
            </Field>
          ))}
        </div>
      </Panel>

      <Panel title="Profil" icon={Quotes}>
        <Area value={cv.summary} onChange={(v) => set({ summary: v })} rows={5} placeholder="2–3 jumlada özingiz haqingizda" />
        <div className="cv-ideas">
          <span>
            <Sparkle size={13} weight="fill" className="gold" /> Namunalar:
          </span>
          {SUMMARY_IDEAS.map((s, i) => (
            <button key={i} type="button" onClick={() => set({ summary: s })} title={s}>
              {['Mutaxassis', 'Talaba', 'Tajribali'][i]}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={`Iş tajribasi · ${cv.experience.length}`} icon={Briefcase}>
        <Repeater
          items={cv.experience}
          onChange={(experience) => set({ experience })}
          make={() => ({ id: rid(), role: '', org: '', city: '', start: '', end: '', current: false, desc: '' })}
          addLabel="Iş joyi qöşiş"
          titleOf={(x) => [x.role, x.org].filter(Boolean).join(' — ')}
          render={(x, patch) => (
            <>
              <Field label="Lavozim">
                <Input value={x.role} onChange={(v) => patch({ role: v })} />
              </Field>
              <div className="cs-grid2">
                <Field label="Taşkilot">
                  <Input value={x.org} onChange={(v) => patch({ org: v })} />
                </Field>
                <Field label="Şahar">
                  <Input value={x.city} onChange={(v) => patch({ city: v })} />
                </Field>
                <Field label="Boşlangan">
                  <MonthInput value={x.start} onChange={(v) => patch({ start: v })} />
                </Field>
                <Field label="Tugagan">{x.current ? <span className="cs-input ghost">hozirgaça</span> : <MonthInput value={x.end} onChange={(v) => patch({ end: v })} />}</Field>
              </div>
              <Toggle label="Hozir şu yerda işlayman" checked={x.current} onChange={(v) => patch({ current: v })} />
              <Field label="Natijalar" hint="Har bir yutuq — yangi qatorda">
                <Area value={x.desc} onChange={(v) => patch({ desc: v })} rows={4} />
              </Field>
            </>
          )}
        />
      </Panel>

      <Panel title={`Taʼlim · ${cv.education.length}`} icon={GraduationCap}>
        <Repeater
          items={cv.education}
          onChange={(education) => set({ education })}
          make={() => ({ id: rid(), degree: '', org: '', start: '', end: '', desc: '' })}
          addLabel="Taʼlim qöşiş"
          titleOf={(x) => x.org || x.degree}
          render={(x, patch) => (
            <>
              <Field label="Daraja va yönaliş">
                <Input value={x.degree} onChange={(v) => patch({ degree: v })} placeholder="Bakalavr — Iqtisodiyot" />
              </Field>
              <Field label="Öquv muassasasi">
                <Input value={x.org} onChange={(v) => patch({ org: v })} />
              </Field>
              <div className="cs-grid2">
                <Field label="Boşlangan yil">
                  <Input value={x.start} onChange={(v) => patch({ start: v })} placeholder="2021" maxLength={7} />
                </Field>
                <Field label="Tugagan yil">
                  <Input value={x.end} onChange={(v) => patch({ end: v })} placeholder="2025" maxLength={7} />
                </Field>
              </div>
              <Field label="Qöşimça">
                <Area value={x.desc} onChange={(v) => patch({ desc: v })} rows={2} placeholder="GPA, fakultet, diplom işi…" />
              </Field>
            </>
          )}
        />
      </Panel>

      <Panel title={`Könikmalar · ${cv.skills.length}`} icon={Lightning}>
        <div className="cv-skill-list">
          {cv.skills.map((s) => (
            <div key={s.id} className="cv-skill-row">
              <input className="cs-input" value={s.name} onChange={(e) => set({ skills: cv.skills.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} />
              <span className="cv-dots">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button key={k} type="button" className={k <= s.level ? 'on' : ''} onClick={() => set({ skills: cv.skills.map((x) => (x.id === s.id ? { ...x, level: k } : x)) })} aria-label={`${k}-daraja`} />
                ))}
              </span>
              <button type="button" className="cs-mini danger" onClick={() => set({ skills: cv.skills.filter((x) => x.id !== s.id) })} aria-label="Öçiriş">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="cs-add" onClick={() => set({ skills: [...cv.skills, { id: rid(), name: '', level: 4 }] })}>
            + Könikma qöşiş
          </button>
        </div>
      </Panel>

      <Panel title={`Tillar · ${cv.languages.length}`} icon={Translate}>
        <div className="cv-skill-list">
          {cv.languages.map((l) => (
            <div key={l.id} className="cv-skill-row">
              <input className="cs-input" value={l.name} onChange={(e) => set({ languages: cv.languages.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)) })} />
              <select className="cs-input sm" value={l.level} onChange={(e) => set({ languages: cv.languages.map((x) => (x.id === l.id ? { ...x, level: e.target.value } : x)) })}>
                {LANG_LEVELS.map((lv) => (
                  <option key={lv}>{lv}</option>
                ))}
              </select>
              <button type="button" className="cs-mini danger" onClick={() => set({ languages: cv.languages.filter((x) => x.id !== l.id) })} aria-label="Öçiriş">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="cs-add" onClick={() => set({ languages: [...cv.languages, { id: rid(), name: '', level: 'B1' }] })}>
            + Til qöşiş
          </button>
        </div>
      </Panel>

      <Panel title={`Sertifikatlar · ${cv.certificates.length}`} icon={Certificate}>
        <Repeater
          items={cv.certificates}
          onChange={(certificates) => set({ certificates })}
          make={() => ({ id: rid(), name: '', org: '', year: '' })}
          addLabel="Sertifikat qöşiş"
          titleOf={(x) => x.name}
          render={(x, patch) => (
            <div className="cs-grid2">
              <Field label="Nomi" wide>
                <Input value={x.name} onChange={(v) => patch({ name: v })} placeholder="IELTS 7.0" />
              </Field>
              <Field label="Kim bergan">
                <Input value={x.org} onChange={(v) => patch({ org: v })} />
              </Field>
              <Field label="Yil">
                <Input value={x.year} onChange={(v) => patch({ year: v })} maxLength={4} />
              </Field>
            </div>
          )}
        />
      </Panel>

      <Panel title={`Loyihalar · ${cv.projects.length}`} icon={Rocket}>
        <Repeater
          items={cv.projects}
          onChange={(projects) => set({ projects })}
          make={() => ({ id: rid(), name: '', desc: '', link: '' })}
          addLabel="Loyiha qöşiş"
          titleOf={(x) => x.name}
          render={(x, patch) => (
            <>
              <Field label="Nomi">
                <Input value={x.name} onChange={(v) => patch({ name: v })} />
              </Field>
              <Field label="Havola">
                <Input value={x.link} onChange={(v) => patch({ link: v })} placeholder="github.com/…" />
              </Field>
              <Field label="Tavsif">
                <Area value={x.desc} onChange={(v) => patch({ desc: v })} rows={2} />
              </Field>
            </>
          )}
        />
      </Panel>

      <Panel title="Qiziqişlar" icon={Heart}>
        <Input value={cv.hobbies} onChange={(v) => set({ hobbies: v })} placeholder="Kitob, sport, sayohat" maxLength={160} />
      </Panel>
    </>
  )

  const stage = (
    <>
      {pages > 1 && (
        <div className="cv-warn">
          <WarningCircle size={16} weight="fill" /> Rezyume {pages} sahifa böldi.
          {cv.density !== 'compact' && (
            <button type="button" onClick={() => set({ density: 'compact' })}>
              Ixçam qiliş
            </button>
          )}
        </div>
      )}
      <Preview cv={cv} onPages={setPages} />
    </>
  )

  return { left, stage }
}

// template thumbnails use one shared sample so they don't change while the user types
const newCvSample = newCv('zamonaviy')
