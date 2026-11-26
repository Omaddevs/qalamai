// Search landing pages of the main products (/prezentatsiya-yaratish, /referat-yaratish, /kurs-ishi-yaratish).
// Same look as the tool pages (tool-pages.css). Every sentence comes from src/i18n/msg/products.js via
// productContent(), the same source the prerendered HTML uses, so crawlers and people read the same page.
import { ArrowRight, CheckCircle, PresentationChart, FileText, GraduationCap, Coins } from '@phosphor-icons/react'
import { COLORS } from '../data.js'
import { getLang, t } from '../i18n/index.js'
import { PRODUCT_PAGES, pathOf } from './pages.js'
import { pageTexts, productContent } from './seo-meta.js'
import { localHref } from './ToolPages.jsx'
import { go, linkClick } from '../nav.js'
import './tool-pages.css'

const LOOK = {
  pres: { Icon: PresentationChart, color: 'purple' },
  ref: { Icon: FileText, color: 'sky' },
  kurs: { Icon: GraduationCap, color: 'indigo' },
}

const Link = ({ to, children, ...rest }) => {
  const href = localHref(to)
  return <a href={href} onClick={linkClick(() => go(href))} {...rest}>{children}</a>
}

export function ProductLanding({ page, onStart }) {
  const lang = getLang()
  const { h1, lead } = pageTexts(page, t, lang)
  const c = productContent(page, t, lang)
  const { Icon, color } = LOOK[page.product]
  const col = COLORS[color] ?? {}
  // the other products, the tools and the prices: where to go next
  const more = [
    ...PRODUCT_PAGES.filter((p) => p !== page).map((p) => [p.path, pageTexts(p, t, lang).h1, LOOK[p.product].Icon]),
    [pathOf('tools'), t('seo.page.tools.h1'), FileText],
    [pathOf('pricing'), t('lp.page.pricing.h1'), Coins],
  ]
  return (
    <section className="tp">
      <nav className="tp-crumbs" aria-label={t('seo.crumbs')}>
        <ol>
          <li><Link to="/">QalamAI</Link></li>
          <li><span aria-current="page">{h1}</span></li>
        </ol>
      </nav>

      <header className="tp-hero" style={{ '--tint': col.band, '--tone': col.to }}>
        <span className="tp-hero-ic" aria-hidden="true"><Icon size={34} weight="duotone" /></span>
        <h1 className="tp-h1">{h1}</h1>
        <p className="tp-lead">{lead}</p>
        <button className="lp-btn lp-btn-primary lg" onClick={onStart}>
          {c.label('cta')} <ArrowRight size={16} weight="bold" />
        </button>
        <p className="tp-price">{c.price}</p>
      </header>

      <div className="tp-group">
        <h2 className="tp-h2">{c.label('how')}</h2>
        <ol className="tp-steps">
          {c.steps.map((s, i) => (
            <li key={i}><span className="tp-step-n" aria-hidden="true">{i + 1}</span><p>{s}</p></li>
          ))}
        </ol>
      </div>

      <div className="tp-group">
        <h2 className="tp-h2">{c.label('incl')}</h2>
        <ul className="tp-incl">
          {c.incl.map((x) => (
            <li key={x}><CheckCircle size={20} weight="fill" aria-hidden="true" /><span>{x}</span></li>
          ))}
        </ul>
      </div>

      <div className="tp-group">
        <h2 className="tp-h2">{c.label('faq')}</h2>
        <div className="tp-faq">
          {c.faq.map(([q, a]) => (
            <div className="tp-fact" key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="tp-group">
        <h2 className="tp-h2">{c.label('more')}</h2>
        <div className="tp-grid">
          {more.map(([to, label, I]) => (
            <Link key={to} to={to} className="tp-card">
              <span className="tp-card-ic" aria-hidden="true"><I size={22} weight="duotone" /></span>
              <span className="tp-card-txt"><strong>{label}</strong></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
