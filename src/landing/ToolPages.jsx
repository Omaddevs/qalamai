// Public landing pages of the file tools: the hub (/vositalar) and one page per tool
// (/vositalar/pdf-dan-word …). Every text comes from the tool catalog's own translations, so a page
// describes exactly what the tool does; the button leads to sign-up, where the tool opens.
import { ArrowRight, ShieldCheck, Gift, Translate } from '@phosphor-icons/react'
import { COLORS } from '../data.js'
import { t } from '../i18n/index.js'
import { TOOL_UI } from '../files/toolMeta.js'
import { go, linkClick } from '../nav.js'
import { TOOL_PAGES, pathOf, relatedTools } from './pages.js'
import { FREE_LIMITS, pageTexts } from './seo-meta.js'
import './tool-pages.css'

const CATS = ['pdf', 'edit', 'image', 'document']

/** Keeps a language link (?lang=ru) on in-site links, so a crawler stays in one language version. */
export function localHref(path) {
  const l = new URLSearchParams(location.search).get('lang')
  return l ? `${path}?lang=${encodeURIComponent(l)}` : path
}
const Link = ({ to, children, ...rest }) => {
  const href = localHref(to)
  return <a href={href} onClick={linkClick(() => go(href))} {...rest}>{children}</a>
}

function ToolCard({ page }) {
  const ui = TOOL_UI[page.tool] ?? {}
  const Icon = ui.icon
  const c = COLORS[ui.color ?? 'teal'] ?? {}
  const { name, lead } = pageTexts(page, t)
  return (
    <Link to={page.path} className="tp-card" style={{ '--tint': c.band, '--tone': c.to }}>
      <span className="tp-card-ic" aria-hidden="true">{Icon && <Icon size={22} weight="duotone" />}</span>
      <span className="tp-card-txt">
        <strong>{name}</strong>
        <small>{lead}</small>
      </span>
    </Link>
  )
}

const Crumbs = ({ items }) => (
  <nav className="tp-crumbs" aria-label={t('seo.crumbs')}>
    <ol>
      {items.map(([label, to], i) => (
        <li key={i}>{to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</li>
      ))}
    </ol>
  </nav>
)

export function ToolsHub() {
  return (
    <section className="tp">
      <Crumbs items={[['QalamAI', '/'], [t('seo.page.tools.h1')]]} />
      <header className="tp-hero">
        <h1 className="tp-h1">{t('seo.page.tools.h1')}</h1>
        <p className="tp-lead">{t('seo.tools.desc')}</p>
      </header>
      {CATS.map((cat) => {
        const list = TOOL_PAGES.filter((p) => p.category === cat)
        if (!list.length) return null
        return (
          <div className="tp-group" key={cat}>
            <h2 className="tp-h2">{t(`fs.cat.${cat}`)}</h2>
            <div className="tp-grid">{list.map((p) => <ToolCard key={p.id} page={p} />)}</div>
          </div>
        )
      })}
    </section>
  )
}

export function ToolLanding({ page, onStart }) {
  const ui = TOOL_UI[page.tool] ?? {}
  const Icon = ui.icon
  const c = COLORS[ui.color ?? 'teal'] ?? {}
  const { name, lead } = pageTexts(page, t)
  const steps = [1, 2, 3].map((n) => t(`seo.tool.step${n}`))
  const facts = [
    { Icon: ShieldCheck, title: t('seo.tool.f1t'), text: t('seo.tool.f1') },
    { Icon: Gift, title: t('seo.tool.f2t'), text: t('seo.tool.f2', FREE_LIMITS) },
    { Icon: Translate, title: t('seo.tool.f3t'), text: t('seo.tool.f3') },
  ]
  return (
    <section className="tp">
      <Crumbs items={[['QalamAI', '/'], [t('seo.page.tools.h1'), pathOf('tools')], [name]]} />
      <header className="tp-hero tp-hero-tool" style={{ '--tint': c.band, '--tone': c.to }}>
        <span className="tp-hero-ic" aria-hidden="true">{Icon && <Icon size={34} weight="duotone" />}</span>
        <h1 className="tp-h1">{name}</h1>
        <p className="tp-lead">{lead}</p>
        {ui.from && (
          <p className="tp-formats" aria-label={t('seo.tool.formats')}>
            <span>{ui.from}</span> <ArrowRight size={14} weight="bold" aria-hidden="true" /> <span>{ui.to}</span>
          </p>
        )}
        <button className="lp-btn lp-btn-primary lg" onClick={onStart}>
          {t('seo.tool.cta')} <ArrowRight size={16} weight="bold" />
        </button>
      </header>

      <div className="tp-group">
        <h2 className="tp-h2">{t('seo.tool.how')}</h2>
        <ol className="tp-steps">
          {steps.map((s, i) => (
            <li key={i}><span className="tp-step-n" aria-hidden="true">{i + 1}</span><p>{s}</p></li>
          ))}
        </ol>
      </div>

      <div className="tp-group">
        <h2 className="tp-h2">{t('seo.tool.why')}</h2>
        <div className="tp-facts">
          {facts.map((f) => (
            <div className="tp-fact" key={f.title}>
              <f.Icon size={22} weight="duotone" aria-hidden="true" />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="tp-group">
        <h2 className="tp-h2">{t('seo.tool.related')}</h2>
        <div className="tp-grid">{relatedTools(page).map((p) => <ToolCard key={p.id} page={p} />)}</div>
        <p className="tp-all"><Link to={pathOf('tools')}>{t('seo.tools.all')} <ArrowRight size={14} weight="bold" aria-hidden="true" /></Link></p>
      </div>
    </section>
  )
}
