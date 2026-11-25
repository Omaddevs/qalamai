// QalamAI i18n core — shared by the web app (src/i18n) and the API (server/src/i18n).
//
// A dictionary maps a key to its text in every source language, side by side:
//   'home.greeting': { uz: 'Salom, {name}!', ru: 'Привет, {name}!', en: 'Hi, {name}!', kk: …, ky: …, tg: … }
// • {name} placeholders are filled from `vars`.
// • A plural text is an object picked with Intl.PluralRules on vars.n:
//     ru: { one: '{n} слайд', few: '{n} слайда', many: '{n} слайдов' }   (missing forms fall back to `other`, then `many`)
// • Uzbek Cyrillic ('uz-cyrl') is derived from the Uzbek Latin text, so it never drifts; an entry may
//   still give its own 'uz-cyrl' text when the transliteration needs a hand (loanwords, brands).

import { convert } from './alifbo.js'

export const LANGS = [
  { id: 'uz', code: 'UZ', name: 'Özbekça', note: 'Lotin', locale: 'uz-Latn-UZ' },
  { id: 'uz-cyrl', code: 'ЎЗ', name: 'Ўзбекча', note: 'Кирилл', locale: 'uz-Cyrl-UZ' },
  { id: 'ru', code: 'RU', name: 'Русский', locale: 'ru-RU' },
  { id: 'en', code: 'EN', name: 'English', locale: 'en-US' },
  { id: 'kk', code: 'KZ', name: 'Қазақша', locale: 'kk-KZ' },
  { id: 'ky', code: 'KG', name: 'Кыргызча', locale: 'ky-KG' },
  { id: 'tg', code: 'TJ', name: 'Тоҷикӣ', locale: 'tg-TJ' },
  // The most spoken world languages. Their texts live in src/i18n/locales/<id>/*.json.
  // Digits stay Latin (-u-nu-latn) so numbers inside a sentence match the grouped ones.
  { id: 'zh', code: 'ZH', name: '中文', note: '简体', locale: 'zh-CN', world: true },
  { id: 'hi', code: 'HI', name: 'हिन्दी', locale: 'hi-IN-u-nu-latn', world: true },
  { id: 'es', code: 'ES', name: 'Español', locale: 'es-ES', world: true },
  { id: 'fr', code: 'FR', name: 'Français', locale: 'fr-FR', world: true }, // i18n-ignore
  { id: 'ar', code: 'AR', name: 'العربية', locale: 'ar-u-nu-latn', dir: 'rtl', world: true },
  { id: 'bn', code: 'BN', name: 'বাংলা', locale: 'bn-BD-u-nu-latn', world: true },
  { id: 'pt', code: 'PT', name: 'Português', locale: 'pt-BR', world: true },
  { id: 'ur', code: 'UR', name: 'اردو', locale: 'ur-PK-u-nu-latn', dir: 'rtl', world: true },
  { id: 'id', code: 'ID', name: 'Bahasa Indonesia', locale: 'id-ID', world: true },
  { id: 'de', code: 'DE', name: 'Deutsch', locale: 'de-DE', world: true },
  { id: 'ja', code: 'JA', name: '日本語', locale: 'ja-JP', world: true },
  { id: 'tr', code: 'TR', name: 'Türkçe', locale: 'tr-TR', world: true }, // i18n-ignore
  { id: 'ko', code: 'KO', name: '한국어', locale: 'ko-KR', world: true },
  { id: 'vi', code: 'VI', name: 'Tiếng Việt', locale: 'vi-VN', world: true },
  { id: 'it', code: 'IT', name: 'Italiano', locale: 'it-IT', world: true },
  { id: 'fa', code: 'FA', name: 'فارسی', locale: 'fa-IR-u-ca-gregory-nu-latn', dir: 'rtl', world: true },
  { id: 'pl', code: 'PL', name: 'Polski', locale: 'pl-PL', world: true },
  { id: 'uk', code: 'UK', name: 'Українська', locale: 'uk-UA', world: true },
]

export const DEFAULT_LANG = 'uz'
/** Languages written beside the key in src/i18n/msg/*.js (uz-cyrl is derived). */
export const SOURCE_LANGS = ['uz', 'ru', 'en', 'kk', 'ky', 'tg']
/** Languages kept in their own files, src/i18n/locales/<id>/<area>.json. */
export const WORLD_LANGS = LANGS.filter((l) => l.world).map((l) => l.id)
/** Every language a dictionary entry must carry. */
export const ALL_SOURCE_LANGS = [...SOURCE_LANGS, ...WORLD_LANGS]

const BY_ID = Object.fromEntries(LANGS.map((l) => [l.id, l]))
export const isLang = (id) => Boolean(BY_ID[id])
export const localeOf = (lang) => BY_ID[lang]?.locale ?? BY_ID[DEFAULT_LANG].locale
/** Value for <html lang>: a BCP-47 tag. */
export const htmlLangOf = (lang) => (lang === 'uz-cyrl' ? 'uz-Cyrl' : lang === 'uz' ? 'uz-Latn' : lang === 'zh' ? 'zh-Hans' : lang)
/** Writing direction: 'rtl' for Arabic, Urdu and Persian. */
export const dirOf = (lang) => BY_ID[lang]?.dir ?? 'ltr'

/**
 * Best supported language for a header such as `x-lang: ru` or `Accept-Language: kk-KZ,ru;q=0.8`.
 * Unknown → DEFAULT_LANG.
 */
export function pickLang(header) {
  if (!header) return DEFAULT_LANG
  const tags = String(header)
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 }
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of tags) {
    if (BY_ID[tag]) return tag
    if (tag === 'uz-cyrl' || tag.startsWith('uz-cyrl')) return 'uz-cyrl'
    const base = tag.split('-')[0]
    if (BY_ID[base]) return base
    if (base === 'kz') return 'kk'
    if (base === 'kg') return 'ky'
    if (base === 'ua') return 'uk'
    if (base === 'in') return 'id' // old Java/Android code for Indonesian
  }
  return DEFAULT_LANG
}

/* ───────── Uzbek Latin → Cyrillic for UI text ───────── */

// Kept in Latin script inside Cyrillic text: {placeholders}, URLs/e-mails/file names, words with two or more
// capitals (PDF, QalamAI, PowerPoint, CV), and these brand/product names.
const KEEP_LATIN = new Set(
  'Word Excel Telegram Instagram Payme Click Google Canva Markdown YouTube TikTok Facebook LinkedIn Uzum Pro Max Bio Link Gmail Apple Android Windows Chrome Safari Unicode Noto'.split(' '),
)
const PROTECT = /(\{[^{}]+\}|[\w.+-]+@[\w-]+\.[\w.]+|(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)*\.(?:uz|ai|com|org|net|io|me|app|pdf|docx|pptx|xlsx|png|jpg|txt|md|html)\b[\w/#?=&.-]*|\/[a-z][\w/-]*|#[\w-]+|\p{L}+(?:[ʼ'’ʻ]\p{L}+)*)/gu

// Russian/international loanwords that plain letter mapping spells wrong in Cyrillic.
const CYR_FIX = [
  [/тсия/g, 'ция'],
  [/ТСИЯ/g, 'ЦИЯ'],
  [/тсиз/g, 'циз'],
  [/(^|[^\p{L}])сентр/gu, '$1центр'],
  [/(^|[^\p{L}])Сентр/gu, '$1Центр'],
  [/литсенз/g, 'лиценз'],
  [/сентабр/g, 'сентябр'],
  [/октабр/g, 'октябр'],
  [/компйутер/g, 'компьютер'],
  [/компютер/g, 'компьютер'],
]

function cyrWord(word) {
  if (word.startsWith('{') || /[@./#]/.test(word) || /\d/.test(word)) return word
  if (KEEP_LATIN.has(word) || (word.match(/\p{Lu}/gu)?.length ?? 0) >= 2) return word
  return convert(word, 'new', 'cyr')
}

/** Uzbek (new Latin) UI text → Uzbek Cyrillic, leaving placeholders, brands and links alone. */
export function uzToCyr(text) {
  let out = text.replace(PROTECT, (tok) => cyrWord(tok))
  for (const [re, to] of CYR_FIX) out = out.replace(re, to)
  return out
}

/* ───────── lookup & formatting ───────── */

const pluralRules = new Map()
function pluralOf(lang, n) {
  let pr = pluralRules.get(lang)
  if (!pr) {
    try {
      pr = new Intl.PluralRules(localeOf(lang))
    } catch {
      pr = new Intl.PluralRules('en')
    }
    pluralRules.set(lang, pr)
  }
  return pr.select(n)
}

function pickPlural(forms, lang, vars) {
  const n = Number(vars?.n ?? vars?.count ?? 0)
  const cat = pluralOf(lang, n)
  return forms[cat] ?? forms.other ?? forms.many ?? forms.one ?? ''
}

/** Fill {name} placeholders. Numbers are grouped for the language (12 900 / 12,900). */
export function interpolate(text, vars, lang = DEFAULT_LANG) {
  if (!vars || !text.includes('{')) return text
  return text.replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k]
    if (v == null) return m
    if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) >= 1000) return formatNumber(v, lang)
    return String(v)
  })
}

const cyrCache = new Map()
function rawText(entry, lang) {
  if (lang === 'uz-cyrl') {
    if (entry['uz-cyrl'] != null) return entry['uz-cyrl']
    const uz = entry.uz
    if (uz == null) return undefined
    if (typeof uz === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(uz)) out[k] = uzToCyr(v)
      return out
    }
    let c = cyrCache.get(uz)
    if (c == null) cyrCache.set(uz, (c = uzToCyr(uz)))
    return c
  }
  return entry[lang]
}

/**
 * Text for `key` in `lang`. Falls back to Uzbek (English for a world language), then the other one,
 * then the key itself.
 * @param {Record<string, Record<string, string|object>>} dict
 */
export function translate(dict, key, vars, lang = DEFAULT_LANG, onMissing) {
  const entry = dict[key]
  if (!entry) {
    onMissing?.(key, lang)
    return key
  }
  let raw = rawText(entry, lang)
  let used = lang
  if (raw == null) {
    onMissing?.(key, lang)
    const order = BY_ID[lang]?.world ? ['en', DEFAULT_LANG] : [DEFAULT_LANG, 'en']
    used = order.find((l) => entry[l] != null) ?? DEFAULT_LANG
    raw = rawText(entry, used)
  }
  if (raw == null) return key
  const text = typeof raw === 'object' ? pickPlural(raw, used, vars) : raw
  return interpolate(text, vars, used)
}

export function formatNumber(n, lang = DEFAULT_LANG, opts) {
  try {
    return new Intl.NumberFormat(localeOf(lang), opts).format(n)
  } catch {
    return String(n)
  }
}

export function formatDate(date, lang = DEFAULT_LANG, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  // Several engines lack month names for uz/kk/ky/tg; fall back to our own table then.
  const named = opts.month === 'long' || opts.month === 'short'
  if (named && MONTHS[lang]) {
    const m = MONTHS[lang][d.getMonth()]
    const month = opts.month === 'short' ? m.slice(0, 3) : m
    const parts = []
    if (opts.day) parts.push(String(d.getDate()))
    parts.push(month)
    if (opts.year) parts.push(String(d.getFullYear()))
    let s = parts.join(' ')
    if (opts.hour) s += `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return s
  }
  try {
    return new Intl.DateTimeFormat(localeOf(lang), opts).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  'uz-cyrl': ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  ky: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  tg: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
}

/** Placeholders a text uses — the check script compares them across languages. */
export function placeholdersOf(value) {
  const texts = typeof value === 'object' ? Object.values(value) : [value]
  const set = new Set()
  for (const t of texts) for (const m of String(t).matchAll(/\{(\w+)\}/g)) set.add(m[1])
  return [...set].sort()
}
