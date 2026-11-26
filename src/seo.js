// Keeps <head> in step with the page on screen when the app moves between pages without a reload
// (landing sections, tool pages, sign-in, 404, a shared presentation). The prerendered HTML of each
// public page already carries the same tags (vite.config.js); this only matters for in-app moves,
// link previews of a pushed address and crawlers that render JavaScript.
import { DEFAULT_LANG, isLang } from '../shared/i18n.js'
import { alternatesOf, ogLocaleOf, pageUrl } from './landing/seo-meta.js'
import { getLang } from './i18n/index.js'

/* global __SITE_URL__ */
export const SITE_URL = typeof __SITE_URL__ === 'string' ? __SITE_URL__ : location.origin
export const INDEX = 'index, follow, max-image-preview:large'
export const NOINDEX = 'noindex, follow'

const head = () => document.head

function meta(attr, name, content) {
  let el = head().querySelector(`meta[${attr}="${name}"]`)
  if (content == null) return el?.remove()
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    head().appendChild(el)
  }
  el.setAttribute('content', content)
}

function link(rel, href) {
  let el = head().querySelector(`link[rel="${rel}"]:not([hreflang])`)
  if (href == null) return el?.remove()
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    head().appendChild(el)
  }
  el.href = href
}

/** The language version the address names (?lang=ru); the bare address is Uzbek. */
const addressLang = () => {
  const l = new URLSearchParams(location.search).get('lang')
  return l && isLang(l) ? l : DEFAULT_LANG
}

/**
 * @param {{ title: string, description?: string, path?: string|null, robots?: string, jsonLd?: object|null, langs?: string[] }} o
 *   langs — the languages the page exists in (default: all); another ?lang= points canonical at the bare address.
 *   path — the page's public address ("/narxlar"); null for pages without one (404, private screens):
 *   no canonical, no alternates, no og:url.
 */
export function applySeo({ title, description, path = null, robots = INDEX, jsonLd = null, langs }) {
  if (typeof document === 'undefined') return
  document.title = title
  meta('name', 'robots', robots)
  if (description != null) {
    meta('name', 'description', description)
    meta('property', 'og:description', description)
    meta('name', 'twitter:description', description)
  }
  meta('property', 'og:title', title)
  meta('name', 'twitter:title', title)
  meta('property', 'og:locale', ogLocaleOf(getLang()))

  const indexable = path != null && !robots.startsWith('noindex')
  const lang = addressLang()
  const url = path != null ? pageUrl(SITE_URL, path, !langs || langs.includes(lang) ? lang : DEFAULT_LANG) : null
  link('canonical', indexable ? url : null)
  meta('property', 'og:url', url)

  head().querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
  if (indexable) {
    for (const a of alternatesOf(SITE_URL, path, langs)) {
      const el = document.createElement('link')
      el.rel = 'alternate'
      el.hreflang = a.hreflang
      el.href = a.href
      head().appendChild(el)
    }
  }

  head().querySelector('script#seo-page-ld')?.remove()
  if (jsonLd) {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = 'seo-page-ld'
    el.textContent = JSON.stringify(jsonLd)
    head().appendChild(el)
  }
}
