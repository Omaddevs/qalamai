import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import ProBadge from '../components/ProBadge.jsx'
// Icons: Phosphor (rounded duotone set) — https://phosphoricons.com
import {
  TextAa, FilePdf, Translate, FileMagnifyingGlass, SquaresFour,
  HouseSimple, FolderSimple, Layout, Images, FileText, Bell, CaretLeft, CaretRight, SignOut, SignIn, Plus, MagicWand,
} from '@phosphor-icons/react'
import { blueprintOf } from '../blueprints.js'
import { CoinChip } from '../components/Coins.jsx'
import { som } from '../coins.js'
import { APPS, COLORS } from '../data.js'
import { Dropdown, QalamNib, Wordmark } from '../components/ui.jsx'
import { TemplateCard } from '../editor/panels.jsx'
import { TEMPLATES } from '../editor/templates.js'
import Hero from './Hero.jsx'
import DesignCard from './DesignCard.jsx'
import { initials, loadProfile } from '../profile.js'
import { onSynced } from '../changes.js'
import { apiUrl, currentUser, onUser } from '../api.js'
import { signOut } from '../account.js'
import SyncBadge from '../components/SyncBadge.jsx'
import { blankDoc, loadDocs, saveDocs } from '../docs.js'
import { CREATE, CatTile } from './create.jsx'
import '../editor/editor.css'
import './home.css'
import { t } from '../i18n/index.js'
import { kindLabel } from '../i18n/kinds.js'
import LangSwitch from '../landing/LangSwitch.jsx'
import { trackView } from '../track.js'
import { onUnread, watchUnread } from '../notifications.js'

// Tabs other than the start screen load their code when first opened.
const ProjectsView = lazy(() => import('./ProjectsView.jsx'))
const TemplatesView = lazy(() => import('./TemplatesView.jsx'))
const ProfileView = lazy(() => import('./ProfileView.jsx'))
const MediaView = lazy(() => import('./MediaView.jsx'))
const FilesStudio = lazy(() => import('../files/FilesStudio.jsx'))
const AlifboView = lazy(() => import('./AlifboView.jsx'))
const CreateSheet = lazy(() => import('./CreateSheet.jsx'))
const NotificationsView = lazy(() => import('./NotificationsView.jsx'))
const AiDeckView = lazy(() => import('./AiDeckView.jsx'))
const TabLoading = () => <div className="page-loading" role="status" aria-busy="true" />

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)
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

/**
 * The row of type and tool tiles: scrolls sideways when it doesn't fit, with arrows and faded
 * edges; centred when it does. `after` stays outside the scroller, so its menu isn't clipped.
 */
function CatsCarousel({ children, after }) {
  const ref = useRef(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])
  const go = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.75, behavior: 'smooth' })
  return (
    <div className={`hm-cats-wrap ${edge.l ? 'can-l' : ''} ${edge.r ? 'can-r' : ''}`}>
      <div className="hm-cats-view">
        <button type="button" className="hm-cats-arrow prev" onClick={() => go(-1)} aria-label={t('hm.scrollPrev')} tabIndex={edge.l ? 0 : -1}>
          <CaretLeft size={16} weight="bold" />
        </button>
        <div className="hm-cats" ref={ref}>
          {children}
        </div>
        <button type="button" className="hm-cats-arrow next" onClick={() => go(1)} aria-label={t('hm.scrollNext')} tabIndex={edge.r ? 0 : -1}>
          <CaretRight size={16} weight="bold" />
        </button>
      </div>
      {after && <div className="hm-cats-after">{after}</div>}
    </div>
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
    trackView(tab === 'home' ? '/app' : `/app/${tab}`)
  }, [tab])
  const [railOpen, setRailOpen] = useState(readRailOpen)
  const [me, setMe] = useState(currentUser)
  useEffect(() => onUser(setMe), [])
  const [unread, setUnread] = useState(0)
  useEffect(() => onUnread(setUnread), [])
  const meId = me?.id
  useEffect(() => (meId ? watchUnread() : undefined), [meId])
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
  // a topic handed over to the AI taqdimot page (from the "+ Yaratiş" sheet)
  const [deckTopic, setDeckTopic] = useState(() => {
    const v = sessionStorage.getItem('qalamai.deckTopic') ?? ''
    sessionStorage.removeItem('qalamai.deckTopic')
    return v
  })
  // the Prezentatsiya app (App.jsx) sends its topic here: the AI taqdimot page writes the deck
  useEffect(() => {
    const go = (e) => {
      sessionStorage.removeItem('qalamai.deckTopic')
      setDeckTopic(e.detail?.topic ?? '')
      setTab('aideck')
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('qalam:ai-deck', go)
    return () => window.removeEventListener('qalam:ai-deck', go)
  }, [])
  // the Referat / Kurs işi apps (App.jsx): the composer with that type and topic
  useEffect(() => {
    const go = ({ type, topic }) => {
      sessionStorage.removeItem('qalamai.aiType')
      setTab('home')
      pickType(type)
      setQ(topic ?? '')
      window.scrollTo({ top: 0 })
    }
    const saved = sessionStorage.getItem('qalamai.aiType')
    if (saved) {
      try {
        go(JSON.parse(saved))
      } catch {
        sessionStorage.removeItem('qalamai.aiType')
      }
    }
    const on = (e) => go(e.detail ?? {})
    window.addEventListener('qalam:ai-type', on)
    return () => window.removeEventListener('qalam:ai-type', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [creating, setCreating] = useState(false)
  const openCreate = useCallback(() => setCreating(true), [])
  // Ctrl/⌘+K opens the "+ Yaratiş" sheet from anywhere on the home screens
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCreating((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Category tiles pick the type in the composer, then the cursor waits for a topic.
  const pickType = (label) => {
    chooseType(label)
    setMode('ai')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => input.current?.focus({ preventScroll: true }), 380)
  }

  // Document types (referat, kurs ishi…) open as an A4 file in the file editor.
  const createDoc = ({ name, html, kind, ai = false }) => {
    if (!saveDocs([blankDoc(name, html), ...loadDocs()])) {
      notify(t('hm.saveFailed'))
      return
    }
    setQ('')
    setFilesTab('docs')
    setTab('files')
    window.scrollTo({ top: 0 })
    notify(t(ai ? 'hm.docAiReady' : 'hm.docReady', { kind }))
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
    { id: 'aideck', label: t('ad.rail'), icon: MagicWand, onClick: () => { setDeckTopic(''); setTab('aideck'); setQ('') } },
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

        <button className={`hm-new ${creating ? 'on' : ''}`} onClick={() => setCreating(true)} title={railOpen ? undefined : `${t('cs.new')} · ${IS_MAC ? '⌘K' : 'Ctrl+K'}`}>
          <span className="hm-new-icon">
            <Plus size={22} weight="bold" />
          </span>
          <span className="hm-new-label">{t('cs.new')}</span>
          <kbd className="hm-new-kbd">{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
        </button>

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
          <button
            className={`ed-ibtn hm-bell ${tab === 'notifications' ? 'on' : ''}`}
            onClick={() => { setTab('notifications'); setQ('') }}
            aria-label={unread ? `${t('hm.notifs')} (${unread})` : t('hm.notifs')}
            title={t('hm.notifs')}
          >
            <Bell size={20} weight={tab === 'notifications' ? 'duotone' : 'regular'} />
            {unread > 0 && <span className="hm-bell-dot">{unread > 9 ? '9+' : unread}</span>}
            <span className="hm-bell-label">{t('hm.notifs')}</span>
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

      {creating && (
        <Suspense fallback={null}>
          <CreateSheet
            onClose={() => setCreating(false)}
            onAi={(id, topic) => {
              if (id === 'Prezentatsiya') {
                setDeckTopic(topic ?? '')
                setTab('aideck')
                window.scrollTo({ top: 0 })
                return
              }
              setTab('home')
              pickType(id)
              setQ(topic)
            }}
            onBlank={(c) => {
              if (blueprintOf(c.id).format === 'doc') createDoc({ name: c.label, kind: c.label })
              else onCreate({ templateId: c.templateId, kind: c.kind, blank: true })
            }}
            onKit={(type) => onCreateKit(type)}
            onTool={openApp}
          />
        </Suspense>
      )}

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

        {tab === 'aideck' ? (
          <Suspense fallback={<TabLoading />}>
          <AiDeckView key={deckTopic} initialTopic={deckTopic} onCreate={onCreate} notify={notify} />
          </Suspense>
        ) : tab === 'projects' ? (
          <Suspense fallback={<TabLoading />}>
          <ProjectsView
            designs={designs}
            onTab={(next) => { setTab(next); setQ('') }}
            onCreate={onCreate}
            onOpen={onOpenDesign}
            onDuplicate={onDuplicateDesign}
            onDelete={onDeleteDesign}
            onRename={onRenameDesign}
          />
          </Suspense>
        ) : tab === 'alifbo' ? (
          <Suspense fallback={<TabLoading />}>
          <AlifboView onTab={(next) => { setTab(next); setQ('') }} onOpenPricing={onOpenPricing} />
          </Suspense>
        ) : tab === 'templates' ? (
          <Suspense fallback={<TabLoading />}>
          <TemplatesView onTab={(next) => { setTab(next); setQ('') }} onCreate={onCreate} onCreateKit={onCreateKit} />
          </Suspense>
        ) : tab === 'files' ? (
          <Suspense fallback={<TabLoading />}>
          <FilesStudio key={filesTab} initialTab={filesTab} notify={notify} onOpenPricing={onOpenPricing} />
          </Suspense>
        ) : tab === 'media' ? (
          <Suspense fallback={<TabLoading />}>
          <MediaView notify={notify} />
          </Suspense>
        ) : tab === 'notifications' ? (
          <Suspense fallback={<TabLoading />}>
          <NotificationsView onCreate={openCreate} onOpenPricing={onOpenPricing} />
          </Suspense>
        ) : tab === 'profile' ? (
          <Suspense fallback={<TabLoading />}>
          <ProfileView profile={profile} onProfile={onProfile} notify={notify} />
          </Suspense>
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
              <CatsCarousel
                after={
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
                }
              >
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
              </CatsCarousel>

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
