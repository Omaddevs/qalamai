// Formatting for the admin panel (Uzbek, new alphabet). Times are shown in Tashkent time.
const TZ = 'Asia/Tashkent'
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek']
export const WEEKDAYS = ['Du', 'Se', 'Ça', 'Pa', 'Ju', 'Şa', 'Ya']

const nf = new Intl.NumberFormat('ru-RU')
export const fmt = (n) => nf.format(Math.round(n ?? 0)).replace(/ /g, ' ')
export const pct = (x, digits = 1) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? digits : x >= 1 ? 0 : digits).replace('.', ',')}%`
export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : fmt(n))

/** Parts of a date in Tashkent time. */
function parts(d) {
  const x = new Date(d)
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(x)
      .map((q) => [q.type, q.value]),
  )
  return { y: +p.year, m: +p.month - 1, d: +p.day, hh: p.hour, mm: p.minute }
}

/** "7-noy" from "2026-11-07" */
export const dayLabel = (iso) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}-${MONTHS[m - 1]}`
}
export const dateTime = (d) => {
  if (!d) return '—'
  const p = parts(d)
  return `${p.d}-${MONTHS[p.m]} ${p.y}, ${p.hh}:${p.mm}`
}
export const dateOnly = (d) => {
  if (!d) return '—'
  const p = parts(d)
  return `${p.d}-${MONTHS[p.m]} ${p.y}`
}
export const timeOnly = (d) => {
  if (!d) return ''
  const p = parts(d)
  return `${p.hh}:${p.mm}`
}

/** "3 daqiqa oldin", "kecha", … */
export function ago(d) {
  if (!d) return '—'
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'hozirgina'
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`
  if (s < 172800) return 'keça'
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} kun oldin`
  return dateOnly(d)
}

/* ───────── countries ───────── */

// Intl gives Uzbek names in the old Latin script; the project uses the new one.
const toNew = (s) =>
  s
    .replace(/O[ʻ'‘`]/g, 'Ö')
    .replace(/o[ʻ'‘`]/g, 'ö')
    .replace(/G[ʻ'‘`]/g, 'Ğ')
    .replace(/g[ʻ'‘`]/g, 'ğ')
    .replace(/Sh/g, 'Ş')
    .replace(/sh/g, 'ş')
    .replace(/Ch/g, 'Ç')
    .replace(/ch/g, 'ç')

// Browsers often have no Uzbek region names, so the usual ones are spelled out here.
const UZ_NAMES = {
  UZ: 'Özbekiston', KZ: 'Qozoğiston', KG: 'Qirğiziston', TJ: 'Tojikiston', TM: 'Turkmaniston', AF: 'Afğoniston',
  RU: 'Rossiya', UA: 'Ukraina', BY: 'Belarus', AZ: 'Ozarbayjon', GE: 'Gruziya', AM: 'Armaniston', MD: 'Moldova',
  TR: 'Turkiya', AE: 'BAA', SA: 'Saudiya Arabistoni', QA: 'Qatar', KW: 'Quvayt', IR: 'Eron', IQ: 'Iroq', IL: 'Isroil', PK: 'Pokiston',
  IN: 'Hindiston', CN: 'Xitoy', HK: 'Gonkong', TW: 'Tayvan', JP: 'Yaponiya', KR: 'Janubiy Koreya', MN: 'Möğuliston', ID: 'Indoneziya',
  MY: 'Malayziya', SG: 'Singapur', TH: 'Tailand', VN: 'Vyetnam', PH: 'Filippin', BD: 'Bangladeş',
  US: 'AQŞ', CA: 'Kanada', MX: 'Meksika', BR: 'Braziliya', AR: 'Argentina',
  GB: 'Buyuk Britaniya', IE: 'Irlandiya', DE: 'Germaniya', FR: 'Fransiya', NL: 'Niderlandiya', BE: 'Belgiya', CH: 'Şveytsariya',
  AT: 'Avstriya', IT: 'Italiya', ES: 'Ispaniya', PT: 'Portugaliya', SE: 'Şvetsiya', NO: 'Norvegiya', DK: 'Daniya', FI: 'Finlandiya',
  PL: 'Polşa', CZ: 'Çexiya', HU: 'Vengriya', RO: 'Ruminiya', BG: 'Bolgariya', GR: 'Gretsiya', LV: 'Latviya', LT: 'Litva', EE: 'Estoniya',
  EG: 'Misr', MA: 'Marokash', ZA: 'Janubiy Afrika', NG: 'Nigeriya', AU: 'Avstraliya', NZ: 'Yangi Zelandiya',
}

let names = null
export function countryName(cc) {
  if (!cc || cc === '??') return 'Nomaʼlum'
  if (UZ_NAMES[cc]) return UZ_NAMES[cc]
  try {
    names ??= new Intl.DisplayNames(['uz-Latn', 'uz', 'en'], { type: 'region' })
    return toNew(names.of(cc) ?? cc)
  } catch {
    return cc
  }
}
export const flag = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐')

const UZ_LANGS = { uz: 'Özbek', ru: 'Rus', en: 'Ingliz', kk: 'Qozoq', ky: 'Qirğiz', tg: 'Tojik', tr: 'Turk', de: 'Nemis', fr: 'Fransuz', ar: 'Arab', zh: 'Xitoy', ko: 'Koreys', ja: 'Yapon', es: 'Ispan', it: 'Italyan', uk: 'Ukrain', az: 'Ozarbayjon', fa: 'Fors', hi: 'Hind', bn: 'Bengal', pt: 'Portugal', ur: 'Urdu', id: 'Indonez', vi: 'Vyetnam', pl: 'Polyak' }

let langNames = null
export function langName(code) {
  if (UZ_LANGS[code]) return UZ_LANGS[code]
  try {
    langNames ??= new Intl.DisplayNames(['uz-Latn', 'uz', 'en'], { type: 'language' })
    const n = langNames.of(code)
    return n ? toNew(n[0].toUpperCase() + n.slice(1)) : code
  } catch {
    return code
  }
}

/* ───────── labels ───────── */

export const SOURCE = { direct: 'Töğridan-töğri', search: 'Qidiruv tizimlari', social: 'Ijtimoiy tarmoqlar', referral: 'Boşqa saytlar' }
export const DEVICE = { desktop: 'Kompyuter', mobile: 'Telefon', tablet: 'Planşet' }
export const METHOD = { password: 'Email / telefon', google: 'Google', telegram: 'Telegram' }
export const REASON = { signup: 'Sovğa (röyxatdan ötiş)', purchase: 'Sotib oldi', spend: 'Sarfladi', refund: 'Qaytarildi', grant: 'Admin berdi', reversal: 'Tölov öçirildi (qaytarib olindi)', promo: 'Juma sovğasi', referral: 'Döst taklifi' }

const PAGE = {
  '/': 'Bosh sahifa (landing)',
  '/app': 'Ilova — asosiy',
  '/auth': 'Röyxatdan ötiş',
  '/auth/login': 'Kiriş',
  '/editor': 'Taqdimot muharriri',
  '/app/templates': 'Şablonlar',
  '/app/projects': 'Loyihalar',
  '/app/files': 'Fayl studiyasi',
  '/app/media': 'Media',
  '/app/alifbo': 'Alifbo',
  '/app/profile': 'Profil',
}
export const pageLabel = (p) => PAGE[p] ?? p
