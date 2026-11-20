// One A4 resume page (794 × 1123 px at 96 dpi). Five layouts share the same blocks.
import { Phone, Envelope, MapPin, TelegramLogo, LinkedinLogo, Globe } from '@phosphor-icons/react'
import { CV_FONTS, CV_TEMPLATES, LABELS, NATIVE, period } from './cv.js'

const CONTACTS = [
  ['phone', Phone],
  ['email', Envelope],
  ['city', MapPin],
  ['telegram', TelegramLogo],
  ['linkedin', LinkedinLogo],
  ['website', Globe],
]

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

const lines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-•·]\s*/, '').trim())
    .filter(Boolean)

function Photo({ cv, className = '' }) {
  if (!cv.showPhoto) return null
  return cv.photo ? <img className={`cv-photo ${className}`} src={cv.photo} alt="" /> : <span className={`cv-photo ph ${className}`}>{initials(cv.name) || 'CV'}</span>
}

function Contacts({ cv, vertical }) {
  const items = CONTACTS.filter(([k]) => cv.contacts?.[k]?.trim())
  if (!items.length) return null
  return (
    <ul className={`cv-contacts ${vertical ? 'v' : ''}`}>
      {items.map(([k, Icon]) => (
        <li key={k}>
          <Icon size={vertical ? 13 : 12} weight="bold" />
          <span>{cv.contacts[k]}</span>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children, show = true }) {
  if (!show) return null
  return (
    <section className="cv-sec">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Entries({ items, lang, kind }) {
  return (
    <div className="cv-entries">
      {items.map((it) => (
        <article key={it.id} className="cv-entry">
          <div className="cv-entry-head">
            <b>{kind === 'edu' ? it.degree : it.role}</b>
            <span className="cv-date">{period(it, lang)}</span>
          </div>
          <div className="cv-org">
            {it.org}
            {it.city ? ` · ${it.city}` : ''}
          </div>
          {lines(it.desc).length > 0 &&
            (lines(it.desc).length > 1 ? (
              <ul className="cv-bullets">
                {lines(it.desc).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="cv-desc">{lines(it.desc)[0]}</p>
            ))}
        </article>
      ))}
    </div>
  )
}

function Skills({ cv, style }) {
  if (style === 'chips')
    return (
      <div className="cv-chips">
        {cv.skills.map((s) => (
          <span key={s.id}>{s.name}</span>
        ))}
      </div>
    )
  if (style === 'inline') return <p className="cv-inline">{cv.skills.map((s) => s.name).join(' · ')}</p>
  return (
    <ul className="cv-bars">
      {cv.skills.map((s) => (
        <li key={s.id}>
          <span>{s.name}</span>
          <i>
            {[1, 2, 3, 4, 5].map((k) => (
              <b key={k} className={k <= s.level ? 'on' : ''} />
            ))}
          </i>
        </li>
      ))}
    </ul>
  )
}

function Languages({ cv }) {
  return (
    <ul className="cv-langs">
      {cv.languages.map((l) => (
        <li key={l.id}>
          <span>{l.name}</span>
          <em>{l.level === 'Ona tili' ? NATIVE[cv.lang] : l.level}</em>
        </li>
      ))}
    </ul>
  )
}

function Certificates({ cv }) {
  return (
    <ul className="cv-certs">
      {cv.certificates.map((c) => (
        <li key={c.id}>
          <b>{c.name}</b>
          <span>{[c.org, c.year].filter(Boolean).join(' · ')}</span>
        </li>
      ))}
    </ul>
  )
}

function Projects({ cv }) {
  return (
    <div className="cv-entries">
      {cv.projects.map((p) => (
        <article key={p.id} className="cv-entry">
          <div className="cv-entry-head">
            <b>{p.name}</b>
            {p.link && <span className="cv-date">{p.link}</span>}
          </div>
          {p.desc && <p className="cv-desc">{p.desc}</p>}
        </article>
      ))}
    </div>
  )
}

export default function CvPage({ cv }) {
  const L = LABELS[cv.lang] ?? LABELS.uz
  const layout = CV_TEMPLATES[cv.template]?.layout ?? 'sidebar'
  const font = CV_FONTS[cv.font] ?? CV_FONTS.inter
  const has = (k) => (Array.isArray(cv[k]) ? cv[k].length > 0 : Boolean(cv[k]?.trim?.()))
  const style = { '--accent': cv.accent, '--head': font.head, '--body': font.body }

  const profile = (
    <Section title={L.profile} show={has('summary')}>
      <p className="cv-summary">{cv.summary}</p>
    </Section>
  )
  const experience = (
    <Section title={L.experience} show={has('experience')}>
      <Entries items={cv.experience} lang={cv.lang} />
    </Section>
  )
  const education = (
    <Section title={L.education} show={has('education')}>
      <Entries items={cv.education} lang={cv.lang} kind="edu" />
    </Section>
  )
  const projects = (
    <Section title={L.projects} show={has('projects')}>
      <Projects cv={cv} />
    </Section>
  )
  const certificates = (
    <Section title={L.certificates} show={has('certificates')}>
      <Certificates cv={cv} />
    </Section>
  )
  const languages = (
    <Section title={L.languages} show={has('languages')}>
      <Languages cv={cv} />
    </Section>
  )
  const hobbies = (
    <Section title={L.hobbies} show={has('hobbies')}>
      <p className="cv-inline">{cv.hobbies}</p>
    </Section>
  )
  const skills = (s) => (
    <Section title={L.skills} show={has('skills')}>
      <Skills cv={cv} style={s} />
    </Section>
  )
  const head = (
    <div className="cv-name">
      <h1>{cv.name}</h1>
      {cv.role && <h2>{cv.role}</h2>}
    </div>
  )

  let body
  switch (layout) {
    case 'classic':
      body = (
        <>
          <header className="cv-head">
            {head}
            <Contacts cv={cv} />
          </header>
          {profile}
          {experience}
          {education}
          {projects}
          {skills('inline')}
          <div className="cv-two">
            {languages}
            {certificates}
          </div>
          {hobbies}
        </>
      )
      break
    case 'minimal':
      body = (
        <>
          <header className="cv-head">
            {head}
            <Contacts cv={cv} vertical />
          </header>
          {profile}
          {experience}
          {education}
          {projects}
          {skills('bars')}
          {languages}
          {certificates}
          {hobbies}
        </>
      )
      break
    case 'creative':
      body = (
        <>
          <header className="cv-band">
            {head}
            <Photo cv={cv} />
          </header>
          <div className="cv-cols">
            <div className="cv-main">
              {profile}
              {experience}
              {projects}
            </div>
            <aside className="cv-aside">
              <Section title={L.contact}>
                <Contacts cv={cv} vertical />
              </Section>
              {skills('chips')}
              {languages}
              {education}
              {certificates}
              {hobbies}
            </aside>
          </div>
        </>
      )
      break
    case 'student':
      body = (
        <>
          <header className="cv-head">
            <Photo cv={cv} />
            <div>
              {head}
              <Contacts cv={cv} />
            </div>
          </header>
          {profile}
          {education}
          {projects}
          {experience}
          <div className="cv-two">
            {skills('chips')}
            {languages}
          </div>
          {certificates}
          {hobbies}
        </>
      )
      break
    default:
      body = (
        <div className="cv-cols">
          <aside className="cv-side">
            <Photo cv={cv} />
            <Section title={L.contact}>
              <Contacts cv={cv} vertical />
            </Section>
            {skills('bars')}
            {languages}
            {certificates}
          </aside>
          <div className="cv-main">
            {head}
            {profile}
            {experience}
            {education}
            {projects}
            {hobbies}
          </div>
        </div>
      )
  }

  return (
    <div className={`cv-page cv-${layout} ${cv.density === 'compact' ? 'compact' : ''}`} style={style}>
      {body}
    </div>
  )
}
