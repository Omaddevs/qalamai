import { useCallback, useEffect, useRef, useState } from 'react'
import ProBadge from '../components/ProBadge.jsx'
// Icons: Phosphor (rounded duotone set) — https://phosphoricons.com
import {
  TextAa, FilePdf, Translate, FileMagnifyingGlass, SquaresFour,
  HouseSimple, FolderSimple, Layout, Images, FileText, Bell, CaretLeft, CaretRight, SignOut, SignIn,
} from '@phosphor-icons/react'
import { CoinChip } from '../components/Coins.jsx'
import { som } from '../coins.js'
import { APPS, COLORS } from '../data.js'
import { Dropdown, QalamNib, Wordmark } from '../components/ui.jsx'
import { TemplateCard } from '../editor/panels.jsx'
import { TEMPLATES } from '../editor/templates.js'
import Hero from './Hero.jsx'
import DesignCard from './DesignCard.jsx'
import ProjectsView from './ProjectsView.jsx'
import TemplatesView from './TemplatesView.jsx'
import ProfileView from './ProfileView.jsx'
import MediaView from './MediaView.jsx'
import FilesStudio from '../files/FilesStudio.jsx'
import { initials, loadProfile } from '../profile.js'
import { onSynced } from '../changes.js'
import { apiUrl, currentUser, onUser } from '../api.js'
import { signOut } from '../account.js'
import SyncBadge from '../components/SyncBadge.jsx'
import { blankDoc, loadDocs, saveDocs } from '../docs.js'
import AlifboView from './AlifboView.jsx'
import { CREATE, CatTile } from './create.jsx'
import '../editor/editor.css'
import './home.css'
import { t } from '../i18n/index.js'
import { kindLabel } from '../i18n/kinds.js'
import LangSwitch from '../landing/LangSwitch.jsx'

const RAIL_KEY = 'qalamai.rail.open'
const TAB_KEY = 'qalamai.tab'
const readRailOpen = () => {
  if (window.innerWidth <= 640) return false // on phones the open rail covers the page
  try {
    const saved = localStorage.getItem(RAIL_KEY)
    if (saved !== null) return saved === '1'
  } catch {
    /* storage unavailable */
  }
  return window.innerWidth > 640
}

const TOOLS = [
  { icon: TextAa, app: 'alifbo', color: 'teal' },
  { icon: FilePdf, app: 'pdf', color: 'red' },
  { icon: Translate, app: 'tarjima', color: 'green' },
  { icon: FileMagnifyingGlass, app: 'plagiat', color: 'amber' },
].map((x) => ({ ...x, get label() { return t(`hm.tools.${x.app}`) } }))

/** Soft tinted tile for utility tools (distinct from the gradient "create" tiles). */
function ToolTile({ icon: Icon, color }) {
  const c = COLORS[color]
  return (
    <span className="hm-cat-tile soft" style={{ background: c.band, color: c.to }}>
      <Icon size={27} weight="duotone" />
    </span>
  )
}

function Section({ title, action, onAction, children }) {
  return (
    <section className="hm-section">
      <div className="hm-section-head">
        <h2>{title}</h2>
        {action && (
          <button className="hm-link" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

export default function HomePage({
  designs, onCreate, onOpenDesign, onDuplicateDesign, onDeleteDesign, onRenameDesign, onOpenApp, onOpenPricing, onCreateKit, notify,
}) {
  // remember the section, so coming back from an editor lands where the user was
  const [tab, setTab] = useState(() => sessionStorage.getItem(TAB_KEY) || 'home')
  useEffect(() => {
    sessionStorage.setItem(TAB_KEY, tab)
  }, [tab])
  const [railOpen, setRailOpen] = useState(readRailOpen)
  const [me, setMe] = useState(currentUser)
  useEffect(() => onUser(setMe), [])
  const [profile, setProfile] = useState(loadProfile)
  const onProfile = useCallback((p) => setProfile(p), [])
  useEffect(() => onSynced((got) => got.profile && setProfile(loadProfile())), [])
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, railOpen ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [railOpen])
  const [mode, setMode] = useState('ai')
  const [q, setQ] = useState('')
  const [heroType, setHeroType] = useState('Prezentatsiya')
  // The composer always needs a type, but the tile row lights up only once the user has chosen one.
  const [typeChosen, setTypeChosen] = useState(false)
  const chooseType = (label) => {
    setHeroType(label)
    setTypeChosen(true)
  }
  const [filesTab, setFilesTab] = useState('tools')

  // Category tiles pick the type in the composer, then the cursor waits for a topic.
  const pickType = (label) => {
    chooseType(label)
    setMode('ai')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => input.current?.focus({ preventScroll: true }), 380)
  }

  // Document types (referat, kurs ishi…) open as an A4 file in the file editor.
  const createDoc = ({ name, html, kind }) => {
    if (!saveDocs([blankDoc(name, html), ...loadDocs()])) {
      notify(t('hm.saveFailed'))
      return
    }
    setQ('')
    setFilesTab('docs')
    setTab('files')
    window.scrollTo({ top: 0 })
    notify(t('hm.docReady', { kind }))
  }
  const input = useRef(null)

  const query = mode === 'search' ? q.trim().toLowerCase() : ''
  const foundDesigns = query ? designs.filter((d) => `${d.name} ${d.kind} ${kindLabel(d.kind)}`.toLowerCase().includes(query)) : []
  const foundTemplates = query
    ? TEMPLATES.filter((tpl) => `${tpl.name} ${tpl.sample.title} ${tpl.sample.subtitle}`.toLowerCase().includes(query))
    : []

  const designGrid = (list) => (
    <div className="dz-grid">
      {list.map((d) => (
        <DesignCard key={d.id} d={d} onOpen={onOpenDesign} onDuplicate={onDuplicateDesign} onDelete={onDeleteDesign} onRename={onRenameDesign} />
      ))}
    </div>
  )

  const templateGrid = (list) => (
    <div className="hm-tpl-grid">
      {list.map((tpl) => (
        <figure key={tpl.id} className="hm-tpl">
          <TemplateCard tpl={tpl} onClick={() => onCreate({ templateId: tpl.id })} />
          <figcaption>
            {tpl.name}
            {tpl.pro && <ProBadge size="xs" />}
          </figcaption>
        </figure>
      ))}
    </div>
  )

  // Alifbo and PDF tools have their own pages; other apps still open as a modal.
  const openApp = (id) => {
    if (id === 'alifbo' || id === 'pdf') {
      setTab(id === 'pdf' ? 'files' : 'alifbo')
      setFilesTab('tools')
      setQ('')
      window.scrollTo({ top: 0 })
    } else onOpenApp(id)
  }

  const RAIL = [
    { id: 'home', label: t('hm.rail.home'), icon: HouseSimple, onClick: () => { setTab('home'); setQ('') } },
    { id: 'projects', label: t('hm.rail.projects'), icon: FolderSimple, onClick: () => { setTab('projects'); setQ('') } },
    { id: 'templates', label: t('hm.rail.templates'), icon: Layout, onClick: () => { setTab('templates'); setQ('') } },
    { id: 'media', label: t('hm.rail.media'), icon: Images, onClick: () => { setTab('media'); setQ('') } },
    { id: 'files', label: t('hm.rail.files'), icon: FileText, onClick: () => { setTab('files'); setQ('') } },
    { id: 'alifbo', label: t('hm.rail.alifbo'), icon: TextAa, onClick: () => { setTab('alifbo'); setQ('') } },
  ]

  return (
    <div className={`hm ${railOpen ? 'rail-open' : ''}`}>
      {/* ───── Rail ───── */}
      <div className="hm-side">
      <nav className="hm-rail">
        <div className="hm-brand">
          {railOpen ? (
            <button className="hm-brand-logo" onClick={() => { setTab('home'); setQ('') }} aria-label={t('hm.rail.home')}>
              <Wordmark size={22} />
            </button>
          ) : (
            <button className="hm-brand-logo" onClick={() => setRailOpen(true)} aria-label={t('hm.openPanel')} title={t('hm.openPanel')}>
              <QalamNib height={34} />
            </button>
          )}
        </div>

        {RAIL.map(({ id, label, icon: Icon, pro, onClick }) => {
          const active = id === tab || (id === 'home' && tab === 'home')
          return (
            <button key={id} className={`ed-rail-item ${active ? 'on' : ''}`} onClick={onClick} title={railOpen ? undefined : label}>
              <span className="ed-rail-icon">
                <Icon size={22} weight={active ? 'duotone' : 'regular'} />
                {pro && (
                  <ProBadge size="xs" label={false} className="ed-rail-pro" />
                )}
              </span>
              <span className="ed-rail-label">{label}</span>
            </button>
          )
        })}

        <div className="hm-rail-bottom">
          <button className="ed-ibtn hm-bell" onClick={() => notify(t('hm.noNotifs'))} aria-label={t('hm.notifs')}>
            <Bell size={20} />
            <span className="hm-bell-dot" />
          </button>
          <div className="hm-me-row">
          <button className={`hm-me ${tab === 'profile' ? 'on' : ''}`} onClick={() => { setTab('profile'); setQ('') }} aria-label={t('hm.profile')} title={railOpen ? undefined : t('hm.profile')}>
            <span className="hm-avatar">
              {me?.avatarUrl ? <img src={apiUrl(me.avatarUrl)} alt="" /> : initials(profile.fullName) || 'Q'}
            </span>
            <span className="hm-me-text">
              <b>{profile.fullName.trim().split(/\s+/).slice(0, 2).join(' ') || t('hm.fillProfile')}</b>
              <small>{me?.isGuest ? t('hm.guest') : me?.tier ? t('hm.tier', { tier: me.tier }) : t('hm.freePlan')}</small>
            </span>
          </button>
          {me?.isGuest && (
            <a className="hm-login" href="#/auth/login" title={t('hm.signIn')}>
              <SignIn size={16} weight="bold" /> <span>{t('hm.signIn')}</span>
            </a>
          )}
          {me && !me.isGuest && (
            <button className="ed-ibtn hm-signout" onClick={signOut} aria-label={t('hm.signOut')} title={t('hm.signOut')}>
              <SignOut size={18} />
            </button>
          )}
          </div>
        </div>
      </nav>
        <button
          className="hm-rail-toggle"
          onClick={() => setRailOpen((v) => !v)}
          aria-label={railOpen ? t('hm.closePanel') : t('hm.openPanel')}
          title={railOpen ? t('hm.closePanel') : t('hm.openPanel')}
        >
          {railOpen ? <CaretLeft size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
        </button>
      </div>

      {/* ───── Main ───── */}
      <main className="hm-main">
        <header className="hm-top">
          <span />
          <div className="hm-top-right">
            {me && <SyncBadge />}
            <LangSwitch />
            <CoinChip onClick={onOpenPricing} />
          </div>
        </header>

        {tab === 'projects' ? (
          <ProjectsView
            designs={designs}
            onTab={(next) => { setTab(next); setQ('') }}
            onCreate={onCreate}
            onOpen={onOpenDesign}
            onDuplicate={onDuplicateDesign}
            onDelete={onDeleteDesign}
            onRename={onRenameDesign}
          />
        ) : tab === 'alifbo' ? (
          <AlifboView onTab={(next) => { setTab(next); setQ('') }} onOpenPricing={onOpenPricing} />
        ) : tab === 'templates' ? (
          <TemplatesView onTab={(next) => { setTab(next); setQ('') }} onCreate={onCreate} onCreateKit={onCreateKit} />
        ) : tab === 'files' ? (
          <FilesStudio key={filesTab} initialTab={filesTab} notify={notify} onOpenPricing={onOpenPricing} />
        ) : tab === 'media' ? (
          <MediaView notify={notify} />
        ) : tab === 'profile' ? (
          <ProfileView profile={profile} onProfile={onProfile} notify={notify} />
        ) : (
          <>
          <Hero
            mode={mode}
            onMode={setMode}
            q={q}
            onQ={setQ}
            inputRef={input}
            typeLabel={heroType}
            onType={chooseType}
            onCreate={onCreate}
            onCreateDoc={createDoc}
            notify={notify}
            onTab={(next) => { setTab(next); setQ(''); window.scrollTo({ top: 0 }) }}
          />

          {/* ───── Search results ───── */}
          {query ? (
            <>
              <Section title={t('hm.foundDesigns', { n: foundDesigns.length })}>
                {foundDesigns.length ? designGrid(foundDesigns) : <p className="hm-empty">{t('hm.noDesignMatch')}</p>}
              </Section>
              <Section title={t('hm.foundTemplates', { n: foundTemplates.length })}>
                {foundTemplates.length ? templateGrid(foundTemplates) : <p className="hm-empty">{t('hm.noTemplateMatch')}</p>}
              </Section>
            </>
          ) : tab === 'home' ? (
            <>
              <div className="hm-cats">
                {CREATE.map((c) => (
                  <button key={c.id} className={`hm-cat ${typeChosen && heroType === c.id ? 'on' : ''}`} onClick={() => pickType(c.id)}>
                    <CatTile icon={c.icon} color={c.color} />
                    <span>{c.label}</span>
                  </button>
                ))}
                <span className="hm-cats-div" />
                {TOOLS.map((tool) => (
                  <button key={tool.app} className="hm-cat tool" onClick={() => openApp(tool.app)}>
                    <ToolTile icon={tool.icon} color={tool.color} />
                    <span>{tool.label}</span>
                  </button>
                ))}
                <Dropdown
                  align="right"
                  button={({ toggle }) => (
                    <button className="hm-cat tool" onClick={toggle}>
                      <span className="hm-cat-tile soft neutral">
                        <SquaresFour size={27} weight="duotone" />
                      </span>
                      <span>{t('hm.more')}</span>
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <div className="pop-label">{t('hm.allApps')}</div>
                      {APPS.filter((a) => a.id !== 'muharrir').map((a) => (
                        <button key={a.id} className="menu-item" onClick={() => { close(); openApp(a.id) }}>
                          {a.name}
                          <span className="menu-hint">{a.soon ? t('ui.soon') : ''}</span>
                        </button>
                      ))}
                    </>
                  )}
                </Dropdown>
              </div>

              <Section title={t('hm.recent')} action={t('hm.all')} onAction={() => setTab('projects')}>
                {designs.length ? designGrid(designs.slice(0, 8)) : <p className="hm-empty">{t('hm.noDesigns')}</p>}
              </Section>

              <Section title={t('hm.forYou')} action={t('hm.all')} onAction={() => setTab('templates')}>
                {templateGrid(TEMPLATES.slice(0, 6))}
              </Section>
            </>
          ) : null}
          </>
        )}
      </main>
    </div>
  )
}
