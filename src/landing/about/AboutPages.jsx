// The "Haqimizda" pages: /haqimizda, /jamoa, /yangiliklar, /yangiliklar/<slug>, /hamkorlar.
// Fixed texts: src/i18n/msg/about.js. Team, news and partners come from /api/v1/site and are edited in
// the admin panel (src/admin/Site.jsx); every block hides itself while there is nothing to show.
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, ArrowLeft, Sparkle, PaintBrush, Files, Translate, Target, ShieldCheck, Coins, Lightning,
  TelegramLogo, LinkedinLogo, InstagramLogo, GithubLogo, Globe, Clock, LinkSimple, Check, Quotes, Handshake, UsersThree, Newspaper,
} from '@phosphor-icons/react'
import { formatDate, getLang, t } from '../../i18n/index.js'
import { go, linkClick } from '../../nav.js'
import { applySeo, INDEX, SITE_URL } from '../../seo.js'
import { SIGNUP_BONUS } from '../../../shared/coins.js'
import { LANGS } from '../../../shared/i18n.js'
import { languagesOf, readingMinutes, renderBody } from '../../../shared/siteContent.js'
import { TOOL_PAGES, parentsOf, pathOf } from '../pages.js'
import { pageTexts } from '../seo-meta.js'
import { localHref } from '../ToolPages.jsx'
import { siteGet, textOf, useSite } from './site.js'
import NotFound from '../../components/NotFound.jsx'
import './about.css'

export const CONTACT_TG = 'https://t.me/omadbek_egamberdiyev'

/* ───────────────────────── shared pieces ───────────────────────── */

const Link = ({ to, children, ...rest }) => {
  const href = localHref(to)
  return <a href={href} onClick={linkClick(() => go(href))} {...rest}>{children}</a>
}

function Crumbs({ page, current }) {
  const items = [['QalamAI', '/'], ...parentsOf(page).map((p) => [pageTexts(p, t, getLang()).h1, p.path]), [current]]
  return (
    <nav className="ab-crumbs" aria-label={t('seo.crumbs')}>
      <ol>
        {items.map(([label, to], i) => (
          <li key={i}>{to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</li>
        ))}
      </ol>
    </nav>
  )
}

function Hero({ page, eyebrow, Icon, children, lead }) {
  return (
    <header className="ab-hero">
      <div className="ab-hero-bg" aria-hidden="true"><span className="ab-orb o1" /><span className="ab-orb o2" /><span className="ab-grid" /></div>
      <Crumbs page={page} current={pageTexts(page, t, getLang()).h1} />
      <span className="ab-eyebrow">{Icon && <Icon size={14} weight="bold" />} {eyebrow}</span>
      <h1 className="ab-h1">{children}</h1>
      {lead && <p className="ab-lead">{lead}</p>}
    </header>
  )
}

const SectionHead = ({ title, to, label }) => (
  <div className="ab-sec-head">
    <h2 className="ab-h2">{title}</h2>
    {to && <Link to={to} className="ab-more">{label ?? t('ab.all')} <ArrowRight size={15} weight="bold" /></Link>}
  </div>
)

const Empty = ({ Icon }) => (
  <div className="ab-empty">
    <span className="ab-empty-ic" aria-hidden="true"><Icon size={26} weight="duotone" /></span>
    <p>{t('ab.soon')}</p>
  </div>
)

const Failed = ({ onRetry }) => (
  <div className="ab-empty" role="alert">
    <p>{t('ab.error')}</p>
    <button className="lp-btn lp-btn-soft" onClick={onRetry}>{t('ab.retry')}</button>
  </div>
)

const Loading = ({ rows = 3, kind = 'card' }) => (
  <div className={`ab-skel-grid ${kind}`} aria-busy="true">
    {Array.from({ length: rows }, (_, i) => <span key={i} className="ab-skel" />)}
  </div>
)

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const date = (d) => (d ? formatDate(new Date(d), { day: 'numeric', month: 'long', year: 'numeric' }) : '')

/** "title|text|title|text" → [[title, text], …] */
const pairs = (s) => {
  const a = s.split('|')
  return Array.from({ length: a.length / 2 }, (_, i) => [a[i * 2], a[i * 2 + 1]])
}

/* ───────────────────────── cards ───────────────────────── */

function NewsCard({ item, big }) {
  const x = textOf(item)
  return (
    <Link to={`/yangiliklar/${item.slug}`} className={`ab-news-card${big ? ' big' : ''}`}>
      <span className="ab-news-cover">
        {item.cover ? <img src={item.cover} alt="" loading="lazy" decoding="async" /> : <span className="ab-news-ph" aria-hidden="true"><Newspaper size={34} weight="duotone" /></span>}
      </span>
      <span className="ab-news-body">
        <time dateTime={item.publishedAt}>{date(item.publishedAt)}</time>
        <strong>{x.title}</strong>
        {x.excerpt && <span className="ab-news-ex">{x.excerpt}</span>}
        <span className="ab-news-go">{t('ab.news.read')} <ArrowRight size={14} weight="bold" /></span>
      </span>
    </Link>
  )
}

const SOCIAL = { telegram: TelegramLogo, linkedin: LinkedinLogo, instagram: InstagramLogo, github: GithubLogo, site: Globe }

function MemberCard({ m }) {
  const x = textOf(m)
  return (
    <article className="ab-member">
      <div className="ab-member-ph">
        {m.photo ? <img src={m.photo} alt={m.name} loading="lazy" decoding="async" /> : <span className="ab-member-init" aria-hidden="true">{initials(m.name)}</span>}
        {Object.keys(m.links ?? {}).length > 0 && (
          <div className="ab-member-links">
            {Object.entries(m.links).map(([k, href]) => {
              const I = SOCIAL[k] ?? Globe
              return <a key={k} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} — ${k}`}><I size={17} weight="fill" /></a>
            })}
          </div>
        )}
      </div>
      <div className="ab-member-txt">
        <h3>{m.name}</h3>
        {x.role && <p className="ab-member-role">{x.role}</p>}
        {x.bio && <p className="ab-member-bio">{x.bio}</p>}
      </div>
    </article>
  )
}

function PartnerCard({ p }) {
  const x = textOf(p)
  const inner = (
    <>
      <span className="ab-partner-logo">{p.logo ? <img src={p.logo} alt={p.name} loading="lazy" decoding="async" /> : <b>{p.name}</b>}</span>
      <span className="ab-partner-txt">
        <strong>{p.name}</strong>
        {x.about && <span>{x.about}</span>}
        {p.url && <span className="ab-partner-go">{t('ab.partners.visit')} <ArrowUpRight size={14} weight="bold" /></span>}
      </span>
    </>
  )
  return p.url ? <a className="ab-partner" href={p.url} target="_blank" rel="noopener noreferrer">{inner}</a> : <div className="ab-partner">{inner}</div>
}

function ContactCta({ title, text, Icon }) {
  return (
    <section className="ab-contact">
      <span className="ab-contact-ic" aria-hidden="true"><Icon size={28} weight="duotone" /></span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <a className="lp-btn lp-btn-primary lg" href={CONTACT_TG} target="_blank" rel="noopener noreferrer">
        <TelegramLogo size={17} weight="fill" /> {t('ab.write')}
      </a>
    </section>
  )
}

/* ───────────────────────── /haqimizda ───────────────────────── */

const WHAT = [
  { Icon: Sparkle, to: pathOf('prod:pres') },
  { Icon: PaintBrush, to: pathOf('templates') },
  { Icon: Files, to: pathOf('tools') },
  { Icon: Translate, to: pathOf('features') },
]
const VALUES = [Target, ShieldCheck, Coins, Lightning]

export function AboutPage({ page }) {
  const { data } = useSite('/summary')
  const what = pairs(t('ab.about.what'))
  const values = pairs(t('ab.about.values'))
  const numbers = [
    [LANGS.length, t('ab.about.n.langs')],
    [TOOL_PAGES.length, t('ab.about.n.tools')],
    [SIGNUP_BONUS, t('ab.about.n.bonus')],
    [0, t('ab.about.n.sub')],
  ]
  return (
    <div className="ab">
      <Hero page={page} eyebrow={t('ab.about.eyebrow')} Icon={Sparkle} lead={t('ab.about.lead')}>
        {t('ab.about.h1a')} <em>{t('ab.about.h1em')}</em> {t('ab.about.h1b')}
      </Hero>

      <section className="ab-mission">
        <div className="ab-mission-quote">
          <Quotes size={40} weight="fill" aria-hidden="true" />
          <h2 className="ab-kicker">{t('ab.about.missionT')}</h2>
          <p>{t('ab.about.mission')}</p>
        </div>
        <p className="ab-mission-text">{t('ab.about.missionText')}</p>
      </section>

      <section className="ab-sec">
        <SectionHead title={t('ab.about.whatT')} />
        <div className="ab-bento">
          {what.map(([title, text], i) => {
            const { Icon, to } = WHAT[i] ?? WHAT[0]
            return (
              <Link key={title} to={to} className={`ab-bento-card b${i + 1}`}>
                <span className="ab-bento-ic" aria-hidden="true"><Icon size={24} weight="duotone" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="ab-bento-go" aria-hidden="true"><ArrowUpRight size={18} weight="bold" /></span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="ab-numbers" aria-label={t('ab.about.numbersT')}>
        {numbers.map(([n, label]) => (
          <div key={label} className="ab-num">
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="ab-sec">
        <SectionHead title={t('ab.about.valuesT')} />
        <div className="ab-values">
          {values.map(([title, text], i) => {
            const Icon = VALUES[i] ?? Check
            return (
              <div key={title} className="ab-value">
                <span className="ab-value-n">{String(i + 1).padStart(2, '0')}</span>
                <Icon size={24} weight="duotone" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            )
          })}
        </div>
      </section>

      {data?.team?.length > 0 && (
        <section className="ab-sec">
          <SectionHead title={t('ab.about.teamT')} to={pathOf('team')} />
          <Link to={pathOf('team')} className="ab-team-strip">
            <span className="ab-stack">
              {data.team.slice(0, 6).map((m) => (
                <span key={m.id} className="ab-stack-av">{m.photo ? <img src={m.photo} alt="" loading="lazy" /> : initials(m.name)}</span>
              ))}
            </span>
            <span className="ab-team-names">
              {data.team.slice(0, 4).map((m) => m.name).join(' · ')}
              {data.team.length > 4 && ` +${data.team.length - 4}`}
            </span>
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </section>
      )}

      {data?.news?.length > 0 && (
        <section className="ab-sec">
          <SectionHead title={t('ab.about.newsT')} to={pathOf('news')} />
          <div className="ab-news-grid">{data.news.map((n) => <NewsCard key={n.id} item={n} />)}</div>
        </section>
      )}

      {data?.partners?.length > 0 && (
        <section className="ab-sec">
          <SectionHead title={t('ab.about.partnersT')} to={pathOf('partners')} />
          <PartnerMarquee items={data.partners} />
        </section>
      )}
    </div>
  )
}

function PartnerMarquee({ items }) {
  // repeated so the strip never runs out; a short list just sits still
  const loop = items.length >= 4
  const row = loop ? [...items, ...items] : items
  return (
    <div className={`ab-marquee${loop ? ' run' : ''}`}>
      <div className="ab-marquee-track">
        {row.map((p, i) => (
          <span key={`${p.id}-${i}`} className="ab-marquee-item" aria-hidden={i >= items.length ? 'true' : undefined}>
            {p.logo ? <img src={p.logo} alt={i < items.length ? p.name : ''} loading="lazy" /> : <b>{p.name}</b>}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────── /jamoa ───────────────────────── */

export function TeamPage({ page }) {
  const { data, error, reload } = useSite('/team')
  return (
    <div className="ab">
      <Hero page={page} eyebrow={t('ab.nav.team')} Icon={UsersThree} lead={t('ab.team.lead')}>
        {t('ab.page.team.h1')}
      </Hero>
      <section className="ab-sec">
        {!data && error && <Failed onRetry={reload} />}
        {!data && !error && <Loading rows={4} kind="team" />}
        {data && (data.items.length ? <div className="ab-team-grid">{data.items.map((m) => <MemberCard key={m.id} m={m} />)}</div> : <Empty Icon={UsersThree} />)}
      </section>
      <ContactCta title={t('ab.team.joinT')} text={t('ab.team.join')} Icon={UsersThree} />
    </div>
  )
}

/* ───────────────────────── /yangiliklar ───────────────────────── */

const PER_PAGE = 12

export function NewsPage({ page }) {
  const first = useSite(`/news?page=1&limit=${PER_PAGE}`)
  const [more, setMore] = useState([])
  const [next, setNext] = useState(2)
  const [busy, setBusy] = useState(false)
  const items = [...(first.data?.items ?? []), ...more]
  const total = first.data?.total ?? 0
  const loadMore = async () => {
    setBusy(true)
    try {
      const d = await siteGet(`/news?page=${next}&limit=${PER_PAGE}`)
      setMore((m) => [...m, ...d.items])
      setNext((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }
  const [lead, ...rest] = items
  return (
    <div className="ab">
      <Hero page={page} eyebrow={t('ab.nav.news')} Icon={Newspaper} lead={t('ab.news.lead')}>
        {t('ab.page.news.h1')}
      </Hero>
      <section className="ab-sec">
        {!first.data && first.error && <Failed onRetry={first.reload} />}
        {!first.data && !first.error && <Loading rows={3} />}
        {first.data && !items.length && <Empty Icon={Newspaper} />}
        {lead && <NewsCard item={lead} big />}
        {rest.length > 0 && <div className="ab-news-grid">{rest.map((n) => <NewsCard key={n.id} item={n} />)}</div>}
        {items.length < total && (
          <div className="ab-load">
            <button className="lp-btn lp-btn-soft lg" onClick={loadMore} disabled={busy}>{t('ab.news.more')}</button>
          </div>
        )}
      </section>
    </div>
  )
}

/* ───────────────────────── /yangiliklar/<slug> ───────────────────────── */

export function NewsPostPage({ page }) {
  const { data, error, reload } = useSite(`/news/${page.slug}`)
  const [copied, setCopied] = useState(false)
  const item = data?.item
  const x = useMemo(() => (item ? textOf(item) : null), [item])

  // the post's own title, description, canonical, language versions and NewsArticle data
  useEffect(() => {
    if (!item || !x) return
    const url = `${SITE_URL}${page.path}`
    applySeo({
      title: `${x.title} | QalamAI`,
      description: (x.excerpt || '').slice(0, 200) || undefined,
      path: page.path,
      robots: INDEX,
      langs: languagesOf(item.i18n),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: x.title.slice(0, 110),
        datePublished: item.publishedAt,
        dateModified: item.updatedAt ?? item.publishedAt,
        mainEntityOfPage: url,
        ...(item.cover ? { image: [`${SITE_URL}${item.cover}`] } : {}),
        author: { '@type': 'Organization', name: 'QalamAI', url: `${SITE_URL}/` },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    })
  }, [item, x, page.path])

  if (error?.status === 404) return <NotFound />
  const share = () => {
    const url = location.href.split('#')[0]
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  const tgShare = item ? `https://t.me/share/url?url=${encodeURIComponent(location.href.split('#')[0])}&text=${encodeURIComponent(x?.title ?? '')}` : '#'

  return (
    <div className="ab ab-post">
      {!data && error && <section className="ab-sec"><Failed onRetry={reload} /></section>}
      {!data && !error && <section className="ab-sec"><Loading rows={1} kind="post" /></section>}
      {item && x && (
        <>
          <article className="ab-article">
            <Link to={pathOf('news')} className="ab-back"><ArrowLeft size={15} weight="bold" /> {t('ab.news.back')}</Link>
            <div className="ab-article-meta">
              <time dateTime={item.publishedAt}>{date(item.publishedAt)}</time>
              <span aria-hidden="true">·</span>
              <span><Clock size={14} weight="bold" aria-hidden="true" /> {t('ab.news.min', { n: readingMinutes(x.body) })}</span>
            </div>
            <h1 className="ab-article-h1">{x.title}</h1>
            {x.excerpt && <p className="ab-article-lead">{x.excerpt}</p>}
            {item.cover && <img className="ab-article-cover" src={item.cover} alt={x.title} decoding="async" />}
            {/* renderBody escapes everything first and only adds its own tags */}
            <div className="ab-prose" dangerouslySetInnerHTML={{ __html: renderBody(x.body) }} />
            <div className="ab-share">
              <span>{t('ab.news.share')}</span>
              <a href={tgShare} target="_blank" rel="noopener noreferrer" className="ab-share-btn" aria-label="Telegram"><TelegramLogo size={18} weight="fill" /></a>
              <button className="ab-share-btn" onClick={share} aria-label={t('ab.news.copy')} title={t('ab.news.copy')}>
                {copied ? <Check size={18} weight="bold" /> : <LinkSimple size={18} weight="bold" />}
              </button>
              {copied && <span className="ab-share-ok" role="status">{t('ab.news.copied')}</span>}
            </div>
          </article>
          {data.more?.length > 0 && (
            <section className="ab-sec">
              <SectionHead title={t('ab.news.also')} to={pathOf('news')} label={t('ab.news.back')} />
              <div className="ab-news-grid">{data.more.map((n) => <NewsCard key={n.id} item={n} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ───────────────────────── /hamkorlar ───────────────────────── */

export function PartnersPage({ page }) {
  const { data, error, reload } = useSite('/partners')
  return (
    <div className="ab">
      <Hero page={page} eyebrow={t('ab.nav.partners')} Icon={Handshake} lead={t('ab.partners.lead')}>
        {t('ab.page.partners.h1')}
      </Hero>
      <section className="ab-sec">
        {!data && error && <Failed onRetry={reload} />}
        {!data && !error && <Loading rows={6} kind="partner" />}
        {data && (data.items.length ? <div className="ab-partner-grid">{data.items.map((p) => <PartnerCard key={p.id} p={p} />)}</div> : <Empty Icon={Handshake} />)}
      </section>
      <ContactCta title={t('ab.partners.becomeT')} text={t('ab.partners.become')} Icon={Handshake} />
    </div>
  )
}

/** The page component for an about-menu page (or a news post). */
export function AboutSection({ page }) {
  if (page.newsPost) return <NewsPostPage page={page} />
  const P = { about: AboutPage, team: TeamPage, news: NewsPage, partners: PartnersPage }[page.id]
  return P ? <P page={page} /> : null
}

