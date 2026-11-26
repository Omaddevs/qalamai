// What a public page tells search engines: title, description, canonical address, hreflang
// alternates and its own JSON-LD. Pure functions — vite.config.js uses them to prerender one HTML
// file per page and language, and src/seo.js uses the same ones to update <head> when the app
// moves between pages without a reload, so both always agree.
import { LANGS, DEFAULT_LANG, formatNumber } from '../../shared/i18n.js'
import { convert } from '../../shared/alifbo.js'
import { COIN_COSTS, SIGNUP_BONUS, priceFor } from '../../shared/coins.js'
import { PLAN_LIMITS } from '../../server/src/modules/plans/plans.js'

export const SITE_NAME = 'QalamAI'
export const FAQ_COUNT = 8

/** hreflang value of a language id ("uz-cyrl" → "uz-Cyrl"). */
export const hreflangOf = (lang) => (lang === 'uz-cyrl' ? 'uz-Cyrl' : lang === 'zh' ? 'zh-Hans' : lang)
const OG_LOCALE = {
  uz: 'uz_UZ', 'uz-cyrl': 'uz_UZ', ru: 'ru_RU', en: 'en_US', kk: 'kk_KZ', ky: 'ky_KG', tg: 'tg_TJ',
  zh: 'zh_CN', hi: 'hi_IN', es: 'es_ES', fr: 'fr_FR', ar: 'ar_AR', bn: 'bn_IN', pt: 'pt_BR', ur: 'ur_PK', id: 'id_ID',
  de: 'de_DE', ja: 'ja_JP', tr: 'tr_TR', ko: 'ko_KR', vi: 'vi_VN', it: 'it_IT', fa: 'fa_IR', pl: 'pl_PL', uk: 'uk_UA',
}
export const ogLocaleOf = (lang) => OG_LOCALE[lang] ?? OG_LOCALE[DEFAULT_LANG]

/**
 * The address of one language version. Uzbek (the default) is the bare address, every other
 * language adds ?lang=… — "/narxlar?lang=uz" is the same page as "/narxlar" and points there.
 */
export const pageUrl = (site, path, lang = DEFAULT_LANG) => `${site}${path}${lang && lang !== DEFAULT_LANG ? `?lang=${lang}` : ''}`

/** The languages a page exists in (product pages: the regional ones; everything else: all). */
export const langsOf = (page) => page?.langs ?? LANGS.map((l) => l.id)

/** [{ hreflang, href }] for every language of the page plus x-default. */
export const alternatesOf = (site, path, langs = LANGS.map((l) => l.id)) => [
  ...langs.map((id) => ({ hreflang: hreflangOf(id), href: pageUrl(site, path, id) })),
  { hreflang: 'x-default', href: pageUrl(site, path) },
]

/**
 * The Uzbek Latin text of a search landing page in the spelling people type into Google:
 * the site writes the new alphabet ("kurs işi yaratiş"), searches use the current one
 * ("kurs ishi yaratish"), and a search engine doesn't treat ş as sh. Other languages unchanged.
 */
export const searchSpelling = (text, lang) =>
  lang === DEFAULT_LANG && typeof text === 'string'
    ? text
        // only words that have a new letter: the converter would also lower-case "QalamAI", "PDF" …
        .replace(/[\p{L}ʼ]+/gu, (w) => (/[öğşçÖĞŞÇ]/.test(w) ? convert(w, 'new', 'old') : w))
        .replace(/[ʻʼ‘’]/g, "'")
    : text

/** Placeholders of a product page: its price in coins and in söm, the sign-up bonus, the file-deck price. */
export const productVars = (page, lang) => {
  const cost = COIN_COSTS[page.coins].cost
  const fileCost = COIN_COSTS['prezentatsiya-fayl'].cost
  return { cost, som: formatNumber(priceFor(Math.max(cost, 10)) ?? cost * 100, lang), bonus: SIGNUP_BONUS, fileCost }
}

/** Everything a product page says, in one language: steps, what is included, its own FAQ. */
export function productContent(page, tr, lang) {
  const v = productVars(page, lang)
  const say = (key, vars) => searchSpelling(tr(`pp.${page.product}.${key}`, vars), lang)
  return {
    steps: say('steps').split('|'),
    incl: say('incl').split('|'),
    faq: [1, 2, 3, 4].map((n) => [say(`q${n}`), say(`a${n}`, v)]),
    price: searchSpelling(tr('pp.price', v), lang),
    label: (key) => searchSpelling(tr(`pp.${key}`), lang),
  }
}

const toolText = (tr, page) => {
  const [name = '', description = ''] = tr(`fs.tool.${page.tool}`).split('|')
  return { name, description }
}

/**
 * Texts of a page in one language. `tr(key, vars)` is the translator (t() in the app,
 * translate(dict, key, vars, lang) at build time); page null = home.
 */
export function pageTexts(page, tr, lang) {
  if (!page) return { title: tr('lp.title'), desc: tr('lp.sub'), h1: tr('lp.title') }
  if (page.productPage) {
    const say = (key) => searchSpelling(tr(`pp.${page.product}.${key}`), lang)
    return { title: say('title'), desc: say('desc'), h1: say('h1'), lead: say('lead') }
  }
  if (page.toolPage) {
    const { name, description } = toolText(tr, page)
    return { title: tr('seo.tool.title', { tool: name }), desc: tr('seo.tool.desc', { desc: description }), h1: name, lead: description, name }
  }
  const h1 = page.auth ? tr(page.title).split(' — ')[0] : tr(`${page.id === 'tools' ? 'seo' : 'lp'}.page.${page.id}.h1`)
  return { title: tr(page.title), desc: tr(page.desc), h1 }
}

/** Questions shown on the FAQ block, as [question, answer]. */
export const faqOf = (tr) => Array.from({ length: FAQ_COUNT }, (_, i) => [tr(`lp.faq.q${i + 1}`), tr(`lp.faq.a${i + 1}`, { bonus: SIGNUP_BONUS, p: COIN_COSTS.prezentatsiya.cost, r: COIN_COSTS.referat.cost })])

/** Limits of a free account, quoted on tool pages (the single source is the server's plan table). */
export const FREE_LIMITS = { runs: PLAN_LIMITS.free.dailyToolRuns, mb: PLAN_LIMITS.free.maxFileMb }

/**
 * JSON-LD for one page (the site-wide Organization / WebSite / WebApplication graph is in index.html).
 * FAQPage on /savollar and on each product page (the questions it shows).
 */
export function pageJsonLd({ site, page, lang, tr, parents = [] }) {
  if (!page || page.noindex) return null
  const url = pageUrl(site, page.path, lang)
  const { title, desc, h1, name } = pageTexts(page, tr, lang)
  const crumbs = [{ name: SITE_NAME, url: pageUrl(site, '/', lang) }, ...parents.map((p) => ({ name: pageTexts(p, tr, lang).h1, url: pageUrl(site, p.path, lang) })), { name: h1, url }]
  const graph = [
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    },
    {
      '@type': page.id === 'faq' ? 'FAQPage' : page.id === 'tools' ? 'CollectionPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description: desc,
      inLanguage: lang === 'uz' ? 'uz-Latn' : hreflangOf(lang),
      isPartOf: { '@id': `${site}/#website` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      ...(page.id === 'faq'
        ? { mainEntity: faqOf(tr).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
        : {}),
      ...(page.toolPage ? { mainEntity: { '@id': `${url}#app` } } : {}),
      ...(page.productPage ? { hasPart: { '@id': `${url}#faq` } } : {}),
    },
  ]
  if (page.productPage) {
    // the questions shown on the page itself
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: lang === 'uz' ? 'uz-Latn' : hreflangOf(lang),
      mainEntity: productContent(page, tr, lang).faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    })
  }
  if (page.toolPage) {
    graph.push({
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name,
      url,
      description: toolText(tr, page).description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'UZS' },
      publisher: { '@id': `${site}/#organization` },
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}
