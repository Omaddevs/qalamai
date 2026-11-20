// Web-app i18n. `t(key, vars)` works anywhere (components, module data via getters);
// switching language remounts the app (see main.jsx), so every screen re-renders in the new language.
import { createElement, useSyncExternalStore } from 'react'
import {
  DEFAULT_LANG,
  LANGS,
  formatDate as fmtDate,
  formatNumber as fmtNumber,
  htmlLangOf,
  isLang,
  localeOf,
  pickLang,
  translate,
} from '../../shared/i18n.js'
import MESSAGES from './messages.js'

export { LANGS, DEFAULT_LANG, localeOf }

const KEY = 'qalam.lang'

/** `?lang=ru` in the address: the language version a link (or a search result) points to. */
const urlLang = () => {
  if (typeof location === 'undefined') return null
  const id = new URLSearchParams(location.search).get('lang')
  return id && isLang(id) ? id : null
}

function initial() {
  const fromUrl = urlLang()
  if (fromUrl) {
    try {
      localStorage.setItem(KEY, fromUrl)
    } catch {
      /* the choice just isn't remembered */
    }
    return fromUrl
  }
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && isLang(saved)) return saved
  } catch {
    /* storage unavailable */
  }
  // First visit: follow the browser if it speaks one of our languages.
  return typeof navigator !== 'undefined' ? pickLang((navigator.languages ?? [navigator.language]).join(',')) : DEFAULT_LANG
}

let lang = initial()
const subs = new Set()
if (typeof document !== 'undefined') document.documentElement.lang = htmlLangOf(lang)

export const getLang = () => lang

export function setLang(id) {
  if (!isLang(id) || id === lang) return
  lang = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* the choice just isn't remembered */
  }
  document.documentElement.lang = htmlLangOf(id)
  // Keep a language link in the address in step, so a reload doesn't switch back.
  if (urlLang()) {
    const url = new URL(location.href)
    url.searchParams.set('lang', id)
    history.replaceState(history.state, '', url)
  }
  subs.forEach((fn) => fn())
}

export function onLang(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

/** Current language; re-renders the caller when it changes. */
export const useLang = () => useSyncExternalStore(onLang, getLang, getLang)

const warned = new Set()
const missing = import.meta.env?.DEV
  ? (key, l) => {
      const id = `${l}:${key}`
      if (warned.has(id)) return
      warned.add(id)
      console.warn(`[i18n] missing ${l} text for "${key}"`)
    }
  : undefined

/** Text for `key` in the current language. */
export const t = (key, vars) => translate(MESSAGES, key, vars, lang, missing)

/** True when the dictionary has `key` (for optional texts such as server error codes). */
export const has = (key) => Boolean(MESSAGES[key])

export const formatNumber = (n, opts) => fmtNumber(n, lang, opts)
export const formatDate = (d, opts) => fmtDate(d, lang, opts)

/**
 * Give module-level data translated fields: `localize(obj, 'apps.referat', ['name', 'desc'])`
 * replaces obj.name with a getter for t('apps.referat.name'), so it follows the language.
 */
export function localize(obj, prefix, fields) {
  for (const f of fields) {
    Object.defineProperty(obj, f, { get: () => t(`${prefix}.${f}`), enumerable: true, configurable: true })
  }
  return obj
}

const RICH = /<(b|strong|em|i|br)\s*\/?>(?:([\s\S]*?)<\/\1>)?/g

/**
 * Like t(), but turns <b>, <strong>, <em>, <i> and <br/> in the text into React elements
 * (never HTML), so a translation can bold a word wherever its grammar puts it.
 */
export function tr(key, vars) {
  const text = t(key, vars)
  const out = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(RICH)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(m[1] === 'br' ? createElement('br', { key: i++ }) : createElement(m[1], { key: i++ }, m[2] ?? ''))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length === 1 ? out[0] : out
}

/** Weekday name for a date in the interface language (Sunday first, like Date#getDay). */
export const weekday = (d, short = false) => t(short ? 'date.weekdaysShort' : 'date.weekdays').split('|')[new Date(d).getDay()]
