// Taklifnoma (invitation website) — shared by the studio (live preview, thumbnails) and the server
// (validation, the public page at qalamai.uz/<slug>). One renderer, so what is designed is what guests see.
//
// The texts in this file are the invitation's own content and print labels (in the invitation's
// language, chosen per invitation), not interface text — scripts/i18n-check.mjs skips this file.
import { uzToCyr } from './i18n.js'

/* ───────────────────────── addresses ───────────────────────── */

/** qalamai.uz/<slug>: 3–40 characters, lower-case Latin letters, digits and single dashes. */
export const INVITE_SLUG_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/

/**
 * First path segments the site itself uses or may use. A slug equal to one of them could never be
 * reached (nginx serves the page or file first), so they are refused. server/test/invite.test.js
 * checks that every public page in src/landing/pages.js is listed here.
 */
export const INVITE_RESERVED = new Set([
  // public pages
  'imkoniyatlar', 'shablonlar', 'narxlar', 'savollar', 'vositalar', 'kirish', 'royxatdan-otish', 'haqimizda', 'jamoa',
  'yangiliklar', 'hamkorlar', 'prezentatsiya-yaratish', 'referat-yaratish', 'kurs-ishi-yaratish',
  // app, files and services
  'admin', 'api', 'app', 'assets', 'avatars', 'models', 'pdfjs', 'invite', 'docs', 'static', 'public', 'media', 'cdn',
  'index', 'robots', 'sitemap', 'favicon', 'manifest', 'site', 'og-image', 'hero-person', 'qalam-logo', '404', '500',
  // words people would expect to be QalamAI's own
  'qalam', 'qalamai', 'qalam-ai', 'taklifnoma', 'taklifnomalar', 'taqdimot', 'prezentatsiya', 'referat', 'kurs-ishi',
  'diplom', 'blog', 'news', 'help', 'yordam', 'support', 'aloqa', 'contact', 'about', 'pricing', 'login', 'logout',
  'register', 'signup', 'signin', 'auth', 'oauth', 'settings', 'sozlamalar', 'profil', 'profile', 'account', 'hisob',
  'terms', 'privacy', 'shartlar', 'maxfiylik', 'oferta', 'www', 'mail', 'email', 'root', 'test', 'demo', 'null',
  'undefined', 'payme', 'click', 'telegram', 'google',
])

export function checkInviteSlug(raw) {
  const slug = String(raw ?? '').trim().toLowerCase()
  if (!INVITE_SLUG_RE.test(slug)) return { slug, ok: false, code: 'format' }
  if (INVITE_RESERVED.has(slug)) return { slug, ok: false, code: 'reserved' }
  return { slug, ok: true }
}

/** A slug suggested from the names: "Jasur & Madina" → "jasur-madina". */
export function suggestInviteSlug(names = {}) {
  const base = [names.a, names.b]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[öô]/g, 'o')
    .replace(/[ğ]/g, 'g')
    .replace(/[ş]/g, 'sh')
    .replace(/[ç]/g, 'ch')
    .replace(/ñ/g, 'ng')
    .replace(/[ʻʼ'`’‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return base.length >= 3 ? base : ''
}

/* ───────────────────────── media ───────────────────────── */

/** Pictures and music uploaded for invitations (server/src/modules/invite). */
export const INVITE_MEDIA_RE = /^\/api\/v1\/i\/media\/(img|aud)_[A-Za-z0-9]{16}\.(webp|mp3|m4a|ogg)$/
/** Pictures that ship with the templates (public/invite). */
const BUNDLED_RE = /^\/invite\/[a-z0-9-]{1,40}\.webp$/
export const isInviteImage = (s) => typeof s === 'string' && (BUNDLED_RE.test(s) || (INVITE_MEDIA_RE.test(s) && s.includes('/img_')))
export const isInviteAudio = (s) => typeof s === 'string' && INVITE_MEDIA_RE.test(s) && s.includes('/aud_')

/* ───────────────────────── design ───────────────────────── */

/** Colour roles. bg: the page · band: the light bands · ink: text on bands · text/soft: text on the page · accent · page: around the column. */
export const COLOR_KEYS = ['bg', 'band', 'ink', 'text', 'soft', 'accent', 'page']

export const INVITE_FONTS = {
  classic: { names: 'Playfair Display', head: 'Playfair Display', body: 'Cormorant Garamond', scale: 1 },
  script: { names: 'Great Vibes', head: 'Playfair Display', body: 'Cormorant Garamond', scale: 1, big: 1.18 },
  marck: { names: 'Marck Script', head: 'Cormorant Garamond', body: 'Cormorant Garamond', scale: 1, big: 1.08 },
  lora: { names: 'Lora', head: 'Lora', body: 'Lora', scale: 0.88 },
  forum: { names: 'Forum', head: 'Forum', body: 'Cormorant Garamond', scale: 1 },
  modern: { names: 'Montserrat', head: 'Montserrat', body: 'Montserrat', scale: 0.84, light: true },
}
const GOOGLE_SPEC = {
  'Playfair Display': 'Playfair+Display:ital,wght@0,400;0,600;1,400',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400',
  'Great Vibes': 'Great+Vibes',
  'Marck Script': 'Marck+Script',
  Lora: 'Lora:ital,wght@0,400;0,600;1,400',
  Forum: 'Forum',
  Montserrat: 'Montserrat:wght@300;400;600',
}
export function inviteFontsHref(fontId) {
  const f = INVITE_FONTS[fontId] ?? INVITE_FONTS.classic
  const fams = [...new Set([f.names, f.head, f.body])].map((x) => `family=${GOOGLE_SPEC[x]}`)
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`
}

export const INVITE_LANGS = ['uz', 'uz-cyrl', 'ru', 'en']

/** Section kinds, in the order the "add a section" menu lists them. `many`: may appear more than once. */
export const SECTION_TYPES = ['hero', 'countdown', 'location', 'calendar', 'program', 'gift', 'gallery', 'rsvp', 'text', 'footer']
export const MANY_SECTIONS = new Set(['text', 'gallery', 'location'])

/* ───────────────────────── print labels ───────────────────────── */

const LABELS_UZ = {
  units: ['kun', 'soat', 'daqiqa', 'soniya'],
  weekdays: ['Du', 'Se', 'Ça', 'Pa', 'Ju', 'Şa', 'Ya'],
  months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  monthsOf: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  musicOn: 'Musiqani yoqiş',
  musicOff: 'Musiqani öçiriş',
  copy: 'Nusxalaş',
  copied: 'Nusxalandi',
  name: 'Ismingiz',
  guests: 'Necha kişi bilan?',
  note: 'Tilagingiz (ixtiyoriy)',
  sending: 'Yuborilmoqda…',
  failed: 'Yuborib bölmadi. Qayta urinib köring.',
  needName: 'Ismingizni yozing',
  close: 'Yopiş',
  made: 'QalamAI da yaratilgan',
  people: 'kişi',
}
const LABELS = {
  uz: LABELS_UZ,
  'uz-cyrl': Object.fromEntries(Object.entries(LABELS_UZ).map(([k, v]) => [k, Array.isArray(v) ? v.map(uzToCyr) : uzToCyr(v)])),
  ru: {
    units: ['дней', 'часов', 'минут', 'секунд'],
    weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthsOf: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    musicOn: 'Включить музыку',
    musicOff: 'Выключить музыку',
    copy: 'Скопировать',
    copied: 'Скопировано',
    name: 'Ваше имя',
    guests: 'Сколько вас будет?',
    note: 'Пожелание (необязательно)',
    sending: 'Отправляем…',
    failed: 'Не удалось отправить. Попробуйте ещё раз.',
    needName: 'Напишите ваше имя',
    close: 'Закрыть',
    made: 'Сделано в QalamAI',
    people: 'чел.',
  },
  en: {
    units: ['days', 'hours', 'minutes', 'seconds'],
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsOf: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    musicOn: 'Play music',
    musicOff: 'Mute music',
    copy: 'Copy',
    copied: 'Copied',
    name: 'Your name',
    guests: 'How many of you?',
    note: 'A wish (optional)',
    sending: 'Sending…',
    failed: 'Could not send. Please try again.',
    needName: 'Please write your name',
    close: 'Close',
    made: 'Made with QalamAI',
    people: 'people',
  },
}
export const inviteLabels = (lang) => LABELS[lang] ?? LABELS.uz

/* ───────────────────────── templates ───────────────────────── */

const WEDDING = {
  cover: { on: true, top: 'Bismillahir Rohmanir Rohim', subtitle: 'Nikoh töyi taklifnomasi', button: 'Taklifnomani oçiş' },
  names: { a: 'Jasur', b: 'Madina', and: '&' },
  date: '2027-05-15',
  time: '09:00',
  days: 2,
  sections: [
    {
      id: 'hero', type: 'hero', on: true,
      top: 'Bismillahir Rohmanir Rohim',
      photo: '/invite/couple.webp', shape: 'arch',
      verse: '«Va Biz sizlarni juft-juft qilib yaratdik.»',
      arabic: '﴿وَخَلَقْنَاكُمْ أَزْوَاجًا﴾',
      ref: '(Qurʼoni Karim, Naba surasi, 8-oyat)',
      text: 'Alloh taoloning marhamati, ota-onalarimizning duolari va yaqinlarimizning ezgu tilaklari ila hayotimizning eñ baxtli kunlaridan biri — nikoh töyimiz munosabati bilan Siz azizlarni samimiylik bilan taklif etamiz.',
      text2: 'Quvonçimizga şerik bölib, duolaringiz bilan bizni siylaşingizni çin dildan söraymiz.',
      dateText: '',
      times: 'ZAGS 09:00 · Bazm 14:00',
    },
    { id: 'count', type: 'countdown', on: true, title: 'Töygaça qolgan vaqt', done: 'Bugun töy kuni. Xuş kelibsiz!' },
    {
      id: 'place', type: 'location', on: true,
      title: 'Töy manzili',
      place: 'Toşkent şahri',
      addr: '«Navröz» töyxonasi, Amir Temur köçasi, 1',
      items: [{ id: 'z', label: 'ZAGS', time: '09:00' }, { id: 'b', label: 'Bazm', time: '14:00' }],
      map: '',
      mapButton: 'Xaritada köriş',
      photo: '/invite/venue.webp',
    },
    { id: 'cal', type: 'calendar', on: true, title: 'Töy taqvimi', text: 'Quvonçli kunimizni taqvimda belgilab qöying.', note: '' },
    {
      id: 'prog', type: 'program', on: false, title: 'Bayram dasturi',
      items: [
        { id: 'p1', time: '15:30', title: 'Mehmonlarni kutib oliş' },
        { id: 'p2', time: '16:00', title: 'Nikoh marosimi' },
        { id: 'p3', time: '16:30', title: 'Foto sessiya' },
        { id: 'p4', time: '17:00', title: 'Bayram dasturxoni' },
      ],
    },
    { id: 'gift', type: 'gift', on: false, title: 'Sovğa uçun karta', text: 'Istasangiz, tabrik uçun uşbu karta raqamidan foydalanişingiz mumkin', card: '8600 0000 0000 0000', holder: '' },
    {
      id: 'rsvp', type: 'rsvp', on: true,
      title: 'Kelişingizni bildiring',
      text: 'Iltimos, javobingizni oldindan yuboring — bu bizga tayyorgarlikda yordam beradi.',
      yes: 'Albatta kelaman', no: 'Afsuski, kela olmayman', button: 'Javobni yuboriş', thanks: 'Raxmat! Javobingiz bizga yetib keldi.',
      guests: true,
    },
    { id: 'foot', type: 'footer', on: true, title: '', photo: '/invite/footer.webp', text: 'Sizni intizorlik bilan kutamiz!' },
  ],
}

const SUNNAT = {
  cover: { on: true, top: 'Bismillahir Rohmanir Rohim', subtitle: 'Sunnat töyi taklifnomasi', button: 'Taklifnomani oçiş' },
  names: { a: 'Abdulloh', b: '', and: '&' },
  date: '2027-06-12',
  time: '10:00',
  days: 1,
  sections: [
    {
      id: 'hero', type: 'hero', on: true, top: 'Bismillahir Rohmanir Rohim', photo: null, shape: 'circle',
      verse: '', arabic: '', ref: '',
      text: 'Hurmatli mehmonlar! Alloh taoloning inoyati bilan öğlimiz Abdullohning sunnat töyi munosabati bilan Sizni oilangiz bilan birga dasturxonimizga taklif etamiz.',
      text2: 'Hurmat bilan, Karimovlar oilasi.',
      dateText: '', times: 'Nahor oşi 07:00 · Bazm 18:00',
    },
    { id: 'count', type: 'countdown', on: true, title: 'Töygaça qolgan vaqt', done: 'Bugun töy kuni. Xuş kelibsiz!' },
    {
      id: 'place', type: 'location', on: true, title: 'Manzil', place: 'Samarqand şahri', addr: '«Afrosiyob» töyxonasi',
      items: [{ id: 'n', label: 'Nahor oşi', time: '07:00' }, { id: 'b', label: 'Bazm', time: '18:00' }],
      map: '', mapButton: 'Xaritada köriş', photo: '/invite/venue.webp',
    },
    { id: 'cal', type: 'calendar', on: true, title: 'Töy kuni', text: 'Bu kunni taqvimingizda belgilab qöying.', note: '' },
    {
      id: 'rsvp', type: 'rsvp', on: true, title: 'Kelişingizni bildiring', text: 'Javobingizni oldindan yuborsangiz, xursand bölamiz.',
      yes: 'Albatta kelaman', no: 'Afsuski, kela olmayman', button: 'Javobni yuboriş', thanks: 'Raxmat! Javobingiz qabul qilindi.', guests: true,
    },
    { id: 'foot', type: 'footer', on: true, title: '', photo: null, text: 'Sizni intizorlik bilan kutamiz!' },
  ],
}

const BIRTHDAY = {
  cover: { on: true, top: 'Sizni taklif qilaman!', subtitle: 'Tuğilgan kun bazmi', button: 'Taklifnomani oçiş' },
  names: { a: 'Madina', b: '', and: '&' },
  date: '2027-09-18',
  time: '18:00',
  days: 1,
  sections: [
    {
      id: 'hero', type: 'hero', on: true, top: '25 yoşim töladi', photo: null, shape: 'circle',
      verse: '', arabic: '', ref: '',
      text: 'Hayotimdagi quvonçli kunni eñ yaqin insonlarim bilan nişonlamoqçiman. Sizni bayramimga taklif qilaman!',
      text2: '', dateText: '', times: 'Boşlaniş 18:00',
    },
    { id: 'count', type: 'countdown', on: true, title: 'Bayramgaça', done: 'Bugun bayram!' },
    {
      id: 'place', type: 'location', on: true, title: 'Qayerda?', place: 'Toşkent, «Bahor» restorani', addr: 'Şota Rustaveli köçasi, 12',
      items: [{ id: 'b', label: 'Boşlaniş', time: '18:00' }], map: '', mapButton: 'Xaritada köriş', photo: null,
    },
    {
      id: 'prog', type: 'program', on: true, title: 'Dastur',
      items: [
        { id: 'p1', time: '18:00', title: 'Mehmonlarni kutib oliş' },
        { id: 'p2', time: '19:00', title: 'Bayram dasturxoni' },
        { id: 'p3', time: '20:30', title: 'Tort va tilaklar' },
      ],
    },
    { id: 'dress', type: 'text', on: true, title: 'Dress-kod', text: 'Pastel ranglar — oq, puşti, lavanda.' },
    {
      id: 'rsvp', type: 'rsvp', on: true, title: 'Kelasizmi?', text: '15-sentabrgaça javob bering, iltimos.',
      yes: 'Ha, kelaman', no: 'Kela olmayman', button: 'Yuboriş', thanks: 'Raxmat! Kutib qolaman.', guests: true,
    },
    { id: 'foot', type: 'footer', on: true, title: '', photo: null, text: 'Kelişingizni intiqlik bilan kutaman!' },
  ],
}

const PALETTES = {
  lenta: { bg: '#2f3b5c', band: '#f4d8de', ink: '#2f3b5c', text: '#ffffff', soft: '#f3d8e2', accent: '#d58c9a', page: '#1f263d' },
  oltin: { bg: '#141414', band: '#efe6d2', ink: '#1d1a14', text: '#f7ecd2', soft: '#d9bf86', accent: '#c9a45c', page: '#0b0b0b' },
  zumrad: { bg: '#173d33', band: '#f3ead8', ink: '#173d33', text: '#fbf6ea', soft: '#e3cf9f', accent: '#c9a45c', page: '#0f2a23' },
  marmar: { bg: '#faf6f0', band: '#eee3d3', ink: '#3b3127', text: '#3b3127', soft: '#9a7b55', accent: '#b08d57', page: '#ece5da' },
  bordo: { bg: '#5a1f2e', band: '#f4e6dc', ink: '#5a1f2e', text: '#fff7f1', soft: '#f0cdb8', accent: '#d9a084', page: '#3e1520' },
  osmon: { bg: '#1e3a6e', band: '#e7eefb', ink: '#1e3a6e', text: '#ffffff', soft: '#cfe0ff', accent: '#d4a64a', page: '#152a52' },
  lavanda: { bg: '#4b3f72', band: '#f1e9ff', ink: '#3d325f', text: '#ffffff', soft: '#e7d8ff', accent: '#e58bb5', page: '#352b55' },
}

const tpl = (id, name, event, palette, font, decor, base, patch = {}) => ({
  id,
  name,
  event,
  data: { v: 1, lang: 'uz', theme: { ...PALETTES[palette] }, font, decor, music: null, ...structuredClone(base), ...patch },
})

/** The templates offered in the gallery. Names stay Uzbek (the product's template names). */
export const INVITE_TEMPLATES = [
  tpl('inv-lenta', 'Puşti lenta', 'wedding', 'lenta', 'classic', 'ribbon', WEDDING),
  tpl('inv-oltin', 'Oltin keça', 'wedding', 'oltin', 'script', 'gold', WEDDING),
  tpl('inv-zumrad', 'Zumrad', 'wedding', 'zumrad', 'marck', 'gold', WEDDING),
  tpl('inv-marmar', 'Oq marmar', 'wedding', 'marmar', 'forum', 'ribbon', WEDDING),
  tpl('inv-bordo', 'Bordo', 'wedding', 'bordo', 'script', 'none', WEDDING),
  tpl('inv-sunnat', 'Sunnat töyi', 'sunnat', 'osmon', 'classic', 'gold', SUNNAT),
  tpl('inv-tugilgan', 'Tuğilgan kun', 'birthday', 'lavanda', 'modern', 'none', BIRTHDAY),
]

/** Blank content for a section added in the studio. */
export function newSection(type, id) {
  const base = { id, type, on: true }
  switch (type) {
    case 'hero': return { ...base, top: '', photo: null, shape: 'arch', verse: '', arabic: '', ref: '', text: '', text2: '', dateText: '', times: '' }
    case 'countdown': return { ...base, title: 'Qolgan vaqt', done: '' }
    case 'location': return { ...base, title: 'Manzil', place: '', addr: '', items: [], map: '', mapButton: 'Xaritada köriş', photo: null }
    case 'calendar': return { ...base, title: 'Taqvim', text: '', note: '' }
    case 'program': return { ...base, title: 'Dastur', items: [] }
    case 'gift': return { ...base, title: 'Sovğa uçun karta', text: '', card: '', holder: '' }
    case 'gallery': return { ...base, title: 'Lahzalar', photos: [] }
    case 'rsvp': return { ...base, title: 'Kelişingizni bildiring', text: '', yes: 'Kelaman', no: 'Kela olmayman', button: 'Yuboriş', thanks: 'Raxmat!', guests: true }
    case 'footer': return { ...base, title: '', photo: null, text: '' }
    default: return { ...base, type: 'text', title: '', text: '' }
  }
}

/* ───────────────────────── validation ───────────────────────── */

const str = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').slice(0, max) : '')
const HEX = /^#[0-9a-fA-F]{6}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const ID = /^[A-Za-z0-9_-]{1,24}$/
const img = (v) => (isInviteImage(v) ? v : null)
const sid = (v, i) => (typeof v === 'string' && ID.test(v) ? v : `s${i}`)

/** http(s) addresses only (maps links); anything else is dropped. */
export function safeHttpUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`)
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''
  } catch {
    return ''
  }
}

function cleanSection(s, i) {
  if (!s || typeof s !== 'object' || !SECTION_TYPES.includes(s.type)) return null
  const out = { id: sid(s.id, i), type: s.type, on: s.on !== false }
  const T = (k, max = 160) => (out[k] = str(s[k], max))
  switch (s.type) {
    case 'hero':
      T('top'); T('verse', 300); T('arabic', 200); T('ref'); T('text', 1200); T('text2', 1200); T('dateText', 60); T('times', 120)
      out.photo = img(s.photo)
      out.shape = ['arch', 'circle', 'rect'].includes(s.shape) ? s.shape : 'arch'
      break
    case 'countdown':
      T('title'); T('done')
      break
    case 'location':
      T('title'); T('place', 200); T('addr', 300); T('mapButton', 60)
      out.map = safeHttpUrl(s.map)
      out.photo = img(s.photo)
      out.items = (Array.isArray(s.items) ? s.items : []).slice(0, 6).map((x, k) => ({ id: sid(x?.id, k), label: str(x?.label, 40), time: str(x?.time, 20) }))
      break
    case 'calendar':
      T('title'); T('text', 400); T('note', 160)
      break
    case 'program':
      T('title')
      out.items = (Array.isArray(s.items) ? s.items : []).slice(0, 20).map((x, k) => ({ id: sid(x?.id, k), time: str(x?.time, 20), title: str(x?.title, 120) }))
      break
    case 'gift':
      T('title'); T('text', 400); T('card', 40); T('holder', 80)
      break
    case 'gallery':
      T('title')
      out.photos = (Array.isArray(s.photos) ? s.photos : []).map(img).filter(Boolean).slice(0, 24)
      break
    case 'rsvp':
      T('title'); T('text', 400); T('yes', 60); T('no', 60); T('button', 40); T('thanks', 200)
      out.guests = s.guests !== false
      break
    case 'footer':
      T('title'); T('text', 600)
      out.photo = img(s.photo)
      break
    default:
      T('title'); T('text', 3000)
  }
  return out
}

/** Bring any stored or posted data into the shape the renderer expects; unknown values are dropped. */
export function normalizeInvite(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const base = INVITE_TEMPLATES[0].data
  const theme = {}
  for (const k of COLOR_KEYS) theme[k] = HEX.test(d.theme?.[k] ?? '') ? d.theme[k].toLowerCase() : base.theme[k]
  const cover = d.cover ?? {}
  const names = d.names ?? {}
  const seen = new Set()
  const sections = (Array.isArray(d.sections) ? d.sections : base.sections)
    .slice(0, 30)
    .map(cleanSection)
    .filter((s) => s && !seen.has(s.id) && seen.add(s.id))
  return {
    v: 1,
    lang: INVITE_LANGS.includes(d.lang) ? d.lang : 'uz',
    theme,
    font: INVITE_FONTS[d.font] ? d.font : 'classic',
    decor: ['ribbon', 'gold', 'none'].includes(d.decor) ? d.decor : 'ribbon',
    music: d.music && isInviteAudio(d.music.src) ? { src: d.music.src, name: str(d.music.name, 120) } : null,
    cover: { on: cover.on !== false, top: str(cover.top, 120), subtitle: str(cover.subtitle, 120), button: str(cover.button, 40) },
    names: { a: str(names.a, 40), b: str(names.b, 40), and: str(names.and, 6) },
    date: DATE.test(d.date ?? '') && !Number.isNaN(Date.parse(d.date)) ? d.date : base.date,
    time: TIME.test(d.time ?? '') ? d.time : '00:00',
    days: Math.min(7, Math.max(1, Math.round(Number(d.days) || 1))),
    sections,
  }
}

/** Title for the page, link previews and the design list: "Jasur & Madina". */
export function inviteTitle(d) {
  const { a, b, and } = d.names ?? {}
  return [a, b].filter((x) => x?.trim()).join(` ${and?.trim() || '&'} `)
}

/* ───────────────────────── rendering ───────────────────────── */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
const para = (s) => esc(s).replace(/\n/g, '<br>')
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
const pad = (n) => String(n).padStart(2, '0')

/** Days of the celebration: [{ y, m, d }] from the start date. */
function eventDays(d) {
  const [y, m, day] = d.date.split('-').map(Number)
  return Array.from({ length: d.days }, (_, i) => {
    const x = new Date(Date.UTC(y, m - 1, day + i))
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() }
  })
}

/** "15–16.05.2027" (or "15.05.2027" for one day). */
export function autoDateText(d) {
  const days = eventDays(d)
  const a = days[0]
  const b = days[days.length - 1]
  const tail = `${pad(a.m + 1)}.${a.y}`
  if (days.length === 1) return `${pad(a.d)}.${tail}`
  if (a.m === b.m) return `${pad(a.d)}–${pad(b.d)}.${tail}`
  return `${pad(a.d)}.${pad(a.m + 1)}–${pad(b.d)}.${pad(b.m + 1)}.${b.y}`
}

/** "2027-yil 15–16-may"-style line under the calendar, when the owner left it empty. */
function autoCalendarNote(d, L) {
  const days = eventDays(d)
  const a = days[0]
  const b = days[days.length - 1]
  const range = days.length === 1 || a.m !== b.m ? `${a.d}` : `${a.d}–${b.d}`
  if (d.lang === 'ru') return `${range} ${L.monthsOf[a.m]} ${a.y}`
  if (d.lang === 'en') return `${L.monthsOf[a.m]} ${range}, ${a.y}`
  const line = `${a.y}-yil ${range}-${LABELS_UZ.monthsOf[a.m]}`
  return d.lang === 'uz-cyrl' ? uzToCyr(line) : line
}

const deco = (d, list) =>
  d.decor !== 'ribbon'
    ? ''
    : list.map(([file, cls, delay]) => `<img class="rb ${cls}" src="/invite/${file}.webp" alt=""${delay ? ` style="animation-delay:${delay}s"` : ''}>`).join('')

const ornament = (d) => `<div class="orn"><span></span><i>${d.decor === 'gold' ? '❖' : '✦'}</i><span></span></div>`

function namesHtml(d, tag = 'h1', cls = '') {
  const { a, b, and } = d.names
  const parts = [a, b].filter((x) => x.trim())
  if (!parts.length) return ''
  const inner = parts.length === 2 ? `<span class="nm">${esc(a)}</span><span class="amp">${esc(and.trim() || '&')}</span><span class="nm">${esc(b)}</span>` : `<span class="nm">${esc(parts[0])}</span>`
  return `<${tag} class="names ${cls}">${inner}</${tag}>`
}

function monogram(d) {
  const letters = [d.names.a, d.names.b].filter((x) => x.trim()).map((x) => esc([...x.trim()][0].toUpperCase()))
  return `<div class="mono"><span>${letters.join(`<i>${esc(d.names.and.trim() || '&')}</i>`)}</span></div>`
}

function section(s, d, L, ctx) {
  const rv = ctx.static ? '' : ' rv'
  const id = `s-${s.id}`
  const h2 = (t) => (t.trim() ? `<h2>${esc(t)}</h2>` : '')
  switch (s.type) {
    case 'hero': {
      const photo = s.photo ? `<div class="ph ph-${s.shape}"><img src="${esc(s.photo)}" alt="${esc(inviteTitle(d))}"></div>` : monogram(d)
      const verse = s.verse || s.arabic || s.ref
      return `<section id="${id}" class="sec hero${rv}">${deco(d, [['ribbon-a', 'tl'], ['ribbon-b', 'tr flip']])}
${s.top ? `<p class="top">${esc(s.top)}</p>` : ''}${photo}${namesHtml(d)}
${verse ? `<blockquote>${s.verse ? `<p class="vs">${esc(s.verse)}</p>` : ''}${s.arabic ? `<p class="ar" dir="rtl" lang="ar">${esc(s.arabic)}</p>` : ''}${s.ref ? `<p class="ref">${esc(s.ref)}</p>` : ''}</blockquote>` : ''}
${s.text ? `<p class="txt">${para(s.text)}</p>` : ''}${s.text2 ? `<p class="txt">${para(s.text2)}</p>` : ''}
<p class="big-date">${esc(s.dateText.trim() || autoDateText(d))}</p>${s.times ? `<p class="times">${esc(s.times)}</p>` : ''}</section>`
    }
    case 'countdown':
      return `<section id="${id}" class="sec cd${rv}">${h2(s.title)}<div class="cd-grid" data-done="${esc(s.done)}">${L.units
        .map((u, k) => `<div class="cd-box"><b data-u="${k}">00</b><small>${esc(u)}</small></div>`)
        .join('')}</div></section>`
    case 'location':
      return `<section id="${id}" class="sec band brush-top brush-bottom${rv}">${deco(d, [['ribbon-a', 'bl'], ['ribbon-c', 'br flip']])}
${h2(s.title)}${s.place ? `<p class="place">${esc(s.place)}</p>` : ''}${s.addr ? `<p class="addr">${PIN}${esc(s.addr)}</p>` : ''}
${s.items.length ? `<div class="pills">${s.items.map((x) => `<div class="pill">${CLOCK}<span><small>${esc(x.label)}</small><b>${esc(x.time)}</b></span></div>`).join('')}</div>` : ''}
${s.map ? `<a class="btn" href="${esc(s.map)}" target="_blank" rel="noopener noreferrer">${PIN}${esc(s.mapButton || 'Map')}</a>` : ''}
${s.photo ? `<div class="venue"><img src="${esc(s.photo)}" alt="" loading="lazy"></div>` : ''}</section>`
    case 'calendar': {
      const days = eventDays(d)
      const first = days[0]
      const marked = new Set(days.filter((x) => x.m === first.m && x.y === first.y).map((x) => x.d))
      const lead = (new Date(Date.UTC(first.y, first.m, 1)).getUTCDay() + 6) % 7
      const count = new Date(Date.UTC(first.y, first.m + 1, 0)).getUTCDate()
      const cells = [...Array(lead).fill(''), ...Array.from({ length: count }, (_, i) => i + 1)]
      return `<section id="${id}" class="sec band brush-top${rv}">${deco(d, [['ribbon-c', 'cr']])}
${h2(s.title)}${s.text ? `<p class="txt">${para(s.text)}</p>` : ''}
<div class="cal"><p class="cal-m">${esc(L.months[first.m])} ${first.y}</p><div class="cal-g">${L.weekdays.map((w) => `<span class="wd">${esc(w)}</span>`).join('')}${cells
        .map((n) => `<span class="${n && marked.has(n) ? 'on' : ''}">${n}</span>`)
        .join('')}</div><p class="cal-n">${esc(s.note.trim() || autoCalendarNote(d, L))}</p></div></section>`
    }
    case 'program':
      return `<section id="${id}" class="sec prog${rv}">${h2(s.title)}<div class="tl">${s.items
        .map((x) => `<div class="tl-row"><b>${esc(x.time)}</b><span>${esc(x.title)}</span></div>`)
        .join('')}</div></section>`
    case 'gift':
      return `<section id="${id}" class="sec${rv}"><div class="gift">${h2(s.title)}${s.text ? `<p class="txt">${para(s.text)}</p>` : ''}
<div class="card-row"><b class="card-no">${esc(s.card)}</b><button type="button" class="copy" data-copy="${esc(s.card.replace(/\s+/g, ''))}" aria-label="${esc(L.copy)}">${COPY}</button></div>
${s.holder ? `<p class="holder">${esc(s.holder)}</p>` : ''}<p class="hint" data-copied="${esc(L.copied)}"></p></div></section>`
    case 'gallery':
      return `<section id="${id}" class="sec gal${rv}">${h2(s.title)}<div class="gal-g">${s.photos.map((p) => `<button type="button" class="gal-i" data-src="${esc(p)}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('')}</div></section>`
    case 'rsvp':
      return `<section id="${id}" class="sec rsvp${rv}">${h2(s.title)}${s.text ? `<p class="txt">${para(s.text)}</p>` : ''}
<form class="rs" novalidate><input name="name" maxlength="80" placeholder="${esc(L.name)}" autocomplete="name">
<div class="rs-ans"><label><input type="radio" name="answer" value="yes" checked><span>${esc(s.yes)}</span></label><label><input type="radio" name="answer" value="no"><span>${esc(s.no)}</span></label></div>
${s.guests ? `<label class="rs-g"><span>${esc(L.guests)}</span><select name="guests">${Array.from({ length: 10 }, (_, k) => `<option value="${k + 1}">${k + 1}${k === 9 ? '+' : ''}</option>`).join('')}</select></label>` : ''}
<textarea name="note" rows="2" maxlength="300" placeholder="${esc(L.note)}"></textarea>
<button type="submit" class="btn solid">${esc(s.button)}</button><p class="rs-msg" role="status"></p></form>
<p class="rs-done" hidden>${esc(s.thanks)}</p></section>`
    case 'footer':
      return `<section id="${id}" class="sec foot${rv}">${deco(d, [['ribbon-a', 'bl'], ['ribbon-b', 'br flip']])}${h2(s.title)}
${s.photo ? `<div class="foot-ph"><img src="${esc(s.photo)}" alt="" loading="lazy"></div>` : ornament(d)}${s.text ? `<p class="foot-t">${para(s.text)}</p>` : ''}${namesHtml(d, 'p', 'small')}</section>`
    default:
      return `<section id="${id}" class="sec note${rv}">${h2(s.title)}${s.text ? `<p class="txt">${para(s.text)}</p>` : ''}</section>`
  }
}

const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.6"/></svg>'
const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const COPY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16h-9V7h9v14Z"/></svg>'
const NOTE_ON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 4.5a1 1 0 0 0-1.67-.74L7.7 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3.7l3.63 3.24A1 1 0 0 0 13 19.5v-15Z"/><path d="M16.6 8.3a1 1 0 0 1 1.41 0 5.3 5.3 0 0 1 0 7.49 1 1 0 0 1-1.41-1.42 3.3 3.3 0 0 0 0-4.65 1 1 0 0 1 0-1.42Z"/><path d="M19.34 5.56a1 1 0 0 1 1.41 0 9.2 9.2 0 0 1 0 12.88 1 1 0 1 1-1.41-1.42 7.2 7.2 0 0 0 0-10.04 1 1 0 0 1 0-1.42Z"/></svg>'
const NOTE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'

function css(d) {
  const t = d.theme
  const f = INVITE_FONTS[d.font] ?? INVITE_FONTS.classic
  const q = (n) => `'${n}'`
  return `:root{--bg:${t.bg};--band:${t.band};--ink:${t.ink};--text:${t.text};--soft:${t.soft};--accent:${t.accent};--page:${t.page};
--t20:${rgba(t.text, 0.2)};--t10:${rgba(t.text, 0.08)};--s70:${rgba(t.soft, 0.7)};--i15:${rgba(t.ink, 0.15)};--i60:${rgba(t.ink, 0.62)};--a30:${rgba(t.accent, 0.3)};
--fn:${q(f.names)},serif;--fh:${q(f.head)},serif;--fb:${q(f.body)},serif;--k:${f.scale};--big:${f.big ?? 1}}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;background:var(--page);font-family:var(--fb);color:var(--text);-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}button{font:inherit;color:inherit}
.qi{position:relative;max-width:430px;min-height:100vh;margin:0 auto;background:var(--bg);overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.28)}
.sec{position:relative;padding:52px 24px;text-align:center}
h2{margin:0 0 6px;font-family:var(--fh);font-weight:400;font-size:30px;line-height:1.2;color:var(--soft)}
.band{background:var(--band);color:var(--ink)}.band h2{color:var(--ink);text-transform:uppercase;letter-spacing:.04em}
.txt{max-width:310px;margin:14px auto 0;font-size:calc(16px*var(--k));line-height:1.6;color:var(--soft)}.band .txt{color:var(--ink)}
.top{margin:0;font-family:var(--fh);font-style:italic;font-size:19px;color:var(--soft)}
.names{margin:28px 0 0;font-family:var(--fn);font-weight:400;font-size:calc(50px*var(--big));line-height:1.18;animation:glow 4s ease-in-out infinite}
.names .nm{display:block;padding-bottom:4px;background:linear-gradient(to bottom,var(--text),var(--soft));-webkit-background-clip:text;background-clip:text;color:transparent}
.names .amp{display:block;margin:2px 0;font-size:.7em;font-style:italic;line-height:1;color:var(--soft)}
.names.small{margin:26px 0 0;font-size:calc(30px*var(--big))}.names.small .nm,.names.small .amp{display:inline;margin:0 .2em}
${f.light ? '.names{font-weight:300;text-transform:uppercase;letter-spacing:.12em;font-size:40px}h2{font-weight:300;letter-spacing:.06em}' : ''}
.hero{padding-top:34px}
.ph{width:100%;max-width:280px;margin:24px auto 0;padding:8px;border:1px solid var(--t20)}
.ph img{width:100%;height:320px;object-fit:cover;object-position:top}
.ph-arch{border-radius:140px 140px 0 0}.ph-arch img{border-radius:130px 130px 0 0}
.ph-circle{max-width:260px;border-radius:50%}.ph-circle img{height:242px;border-radius:50%}
.ph-rect{border-radius:22px}.ph-rect img{border-radius:16px}
.mono{display:grid;place-items:center;width:200px;height:200px;margin:26px auto 0;border:1px solid var(--t20);border-radius:50%;box-shadow:inset 0 0 0 8px var(--t10)}
.mono span{font-family:var(--fn);font-size:calc(64px*var(--big));line-height:1;color:var(--soft)}.mono i{margin:0 6px;font-size:.55em}
blockquote{max-width:300px;margin:24px auto 0}blockquote p{margin:6px 0}
.vs{font-style:italic;font-size:calc(16px*var(--k));color:var(--soft)}.ar{font-family:var(--fh);font-size:25px;color:var(--text)}.ref{font-size:12.5px;opacity:.8;color:var(--soft)}
.big-date{margin:30px 0 0;font-family:var(--fh);font-size:38px;color:var(--text)}
.times{margin:8px 0 0;font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:var(--soft)}
.orn{display:flex;align-items:center;gap:8px;width:110px;margin:22px auto;color:var(--accent)}.orn span{flex:1;height:1px;background:linear-gradient(to right,transparent,var(--accent))}.orn span:last-child{transform:scaleX(-1)}
.cd{padding-top:8px}.cd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:22px}
.cd-box{padding:16px 4px;border:1px solid var(--t20);border-radius:18px;background:var(--t10);box-shadow:0 10px 24px rgba(0,0,0,.12)}
.cd-box b{display:block;font-family:var(--fh);font-weight:400;font-size:30px;color:var(--text)}.cd-box small{display:block;margin-top:4px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}
.cd-done{margin-top:16px;font-size:17px}
.brush-top::before,.brush-bottom::after{content:'';position:absolute;left:0;width:100%;height:28px;background:var(--bg)}
.brush-top::before{top:-1px;clip-path:polygon(0 50%,12% 70%,24% 45%,36% 78%,48% 42%,60% 66%,72% 40%,84% 63%,100% 45%,100% 0,0 0)}
.brush-bottom::after{bottom:-1px;clip-path:polygon(0 100%,0 40%,12% 62%,24% 35%,36% 58%,48% 30%,60% 54%,72% 32%,84% 52%,100% 30%,100% 100%)}
.place{margin:22px 0 0;font-family:var(--fh);font-size:26px;line-height:1.3}
.addr{display:inline-flex;align-items:center;gap:6px;margin:10px 0 0;font-size:calc(15px*var(--k));color:var(--i60)}.addr svg,.btn svg{width:16px;height:16px;flex:none}
.pills{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:22px}
.pill{display:flex;align-items:center;gap:10px;padding:10px 18px;border:1px solid var(--i15);border-radius:999px;background:rgba(255,255,255,.45);box-shadow:0 10px 24px rgba(0,0,0,.08);text-align:left}
.pill svg{width:20px;height:20px;color:var(--accent)}.pill small{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--i60)}.pill b{display:block;font-family:var(--fh);font-weight:400;font-size:23px;line-height:1.15}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;padding:12px 24px;border:0;border-radius:999px;background:var(--ink);color:var(--band);font-size:15px;text-decoration:none;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.2);transition:transform .2s}.btn:hover{transform:scale(1.03)}
.venue{width:260px;height:230px;margin:28px auto 0;padding:4px;border:1px solid var(--i15);border-radius:70px 70px 0 0;background:rgba(255,255,255,.6)}.venue img{width:100%;height:100%;object-fit:cover;border-radius:64px 64px 0 0}
.cal{max-width:320px;margin:26px auto 0;padding:16px;border:1px solid var(--i15);border-radius:24px;background:rgba(255,255,255,.38);box-shadow:0 10px 24px rgba(0,0,0,.08)}
.cal-m{margin:0;font-family:var(--fh);font-size:24px}.cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:14px}
.cal-g span{display:flex;align-items:center;justify-content:center;height:36px;border-radius:50%;font-size:15px}.cal-g .wd{height:auto;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--i60)}
.cal-g .on{border:2px solid var(--accent);background:rgba(255,255,255,.55);font-weight:700;color:var(--accent);box-shadow:0 6px 14px var(--a30)}
.cal-n{margin:14px 0 0;font-size:15px}
.tl{display:grid;gap:22px;margin-top:26px}.tl-row{display:flex;align-items:baseline;justify-content:center;gap:16px}
.tl-row b{min-width:96px;font-family:var(--fh);font-weight:400;font-size:34px;text-align:right;color:var(--soft)}.tl-row span{width:150px;font-size:calc(16px*var(--k));text-align:left}
.gift{padding:22px 18px;border:1px solid var(--s70);border-radius:26px;background:linear-gradient(135deg,var(--t10),transparent);box-shadow:0 20px 40px rgba(0,0,0,.18)}
.card-row{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;padding:12px 8px;border:1px solid var(--t20);border-radius:16px;background:var(--t10)}
.card-no{font-family:var(--fh);font-weight:400;font-size:20px;letter-spacing:.03em;white-space:nowrap}
.copy{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--s70);border-radius:10px;background:var(--t10);cursor:pointer}.copy svg{width:16px;height:16px}
.holder{margin:10px 0 0;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft)}.hint{min-height:18px;margin:8px 0 0;font-size:13px;color:var(--soft)}
.gal-g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:22px}.gal-i{padding:0;border:0;border-radius:16px;overflow:hidden;cursor:zoom-in;background:var(--t10)}.gal-i img{width:100%;aspect-ratio:3/4;object-fit:cover}
.gal-i:first-child:nth-last-child(odd){grid-column:1/-1}.gal-i:first-child:nth-last-child(odd) img{aspect-ratio:4/3}
.lb{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.88);cursor:zoom-out}.lb img{max-height:90vh;border-radius:12px}
.rs[hidden],.rs-done[hidden]{display:none!important}.rs{display:grid;gap:10px;max-width:320px;margin:22px auto 0;text-align:left}
.rs input[name=name],.rs textarea,.rs select{width:100%;padding:12px 14px;border:1px solid var(--t20);border-radius:14px;background:var(--t10);color:var(--text);font:inherit;font-size:16px;outline:none}
.rs input::placeholder,.rs textarea::placeholder{color:var(--soft);opacity:.75}.rs select option{color:#111}
.rs input:focus,.rs textarea:focus,.rs select:focus{border-color:var(--soft)}
.rs-ans{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rs-ans label{cursor:pointer}.rs-ans input{position:absolute;opacity:0;pointer-events:none}
.rs-ans span{display:flex;align-items:center;justify-content:center;min-height:48px;padding:8px;border:1px solid var(--t20);border-radius:14px;font-size:15px;text-align:center;line-height:1.25}
.rs-ans input:checked+span{border-color:var(--soft);background:var(--soft);color:var(--bg);font-weight:600}
.rs-ans input:focus-visible+span{outline:2px solid var(--soft);outline-offset:2px}
.rs-g{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:15px;color:var(--soft)}.rs-g select{width:96px}
.btn.solid{width:100%;margin-top:4px;background:var(--soft);color:var(--bg);font-weight:600}.btn:disabled{opacity:.6;cursor:default}
.rs-msg{min-height:18px;margin:0;font-size:14px;text-align:center;color:var(--soft)}
.rs-done{max-width:300px;margin:22px auto 0;padding:18px;border:1px solid var(--t20);border-radius:18px;font-size:18px;background:var(--t10)}
.foot{padding-bottom:64px}.foot-ph{max-width:320px;margin:26px auto 0;padding:8px;border:1px solid var(--t20);border-radius:18px;background:var(--t10)}.foot-ph img{width:100%;border-radius:12px}
.foot-t{margin:22px auto 0;max-width:300px;font-family:var(--fh);font-size:22px;font-style:italic;color:var(--soft)}
.made{display:block;padding:18px 0 28px;font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.08em;text-align:center;color:var(--soft);opacity:.65;text-decoration:none}
.rb{position:absolute;z-index:2;width:112px;opacity:.95;pointer-events:none;animation:float 6s ease-in-out infinite}.rb.flip{scale:-1 1}
.rb.tl{left:-30px;top:-14px}.rb.tr{right:-26px;top:-8px}.rb.bl{left:-30px;bottom:6px}.rb.br{right:-30px;bottom:6px}.rb.cr{right:-26px;top:36px;width:96px}
.cover .rb{width:128px}.cover .rb.tl{left:-18px;top:-10px}.cover .rb.tr{right:-18px;top:-6px}.cover .rb.bl{left:-22px;bottom:-8px;width:112px}.cover .rb.br{right:-22px;bottom:-8px;width:112px}
.cover{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg);background-image:radial-gradient(circle at 50% 40%,var(--t10),transparent 60%);cursor:pointer;transition:opacity .5s,visibility .5s}
.cover.gone{opacity:0;visibility:hidden}
.cover-in{position:relative;width:100%;max-width:340px;padding:44px 24px 40px;border:1px solid var(--t20);border-radius:32px;background:var(--t10);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);animation:rise .8s ease-out both}
.cover-in>p,.cover-in>span{position:relative;z-index:3}.cover .top{padding:0 34px}
.cover .names{margin-top:22px;font-size:calc(46px*var(--big))}
.cover-sub{margin:14px 0 0;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}
.cover-btn{display:inline-flex;margin-top:36px;padding:14px 34px;border:2px solid var(--soft);border-radius:999px;background:var(--bg);font-family:var(--fh);font-size:18px;color:var(--text);box-shadow:0 8px 28px rgba(0,0,0,.3);animation:pulse 2s ease-in-out infinite}
.mute{position:fixed;top:16px;right:max(16px,calc(50vw - 199px));z-index:50;display:grid;place-items:center;width:52px;height:52px;padding:0;border:3px solid var(--soft);border-radius:50%;background:var(--bg);color:var(--soft);cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.24)}
.mute svg{width:20px;height:20px}.mute[hidden]{display:none}
.js .rv{opacity:0;transform:translateY(42px);transition:opacity .95s cubic-bezier(.22,1,.36,1),transform .95s cubic-bezier(.22,1,.36,1)}.js .rv.in{opacity:1;transform:none}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes glow{0%,100%{opacity:.92}50%{opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.75}}
@keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.js .rv{opacity:1;transform:none}}
.static .rb,.static .names{animation:none}`
}

/**
 * The client script of the page: cover → music, mute button, countdown, reveal on scroll, copy,
 * picture viewer and the RSVP form. Plain DOM, no libraries; reads its settings from #qi-cfg.
 */
const SCRIPT = `(function(){var C=JSON.parse(document.getElementById('qi-cfg').textContent);var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return[].slice.call((r||document).querySelectorAll(s))};
var au=$('#qi-au'),mute=$('.mute'),cover=$('.cover'),muted=false;
function play(){if(!au||muted)return;au.volume=.6;var p=au.play();if(p&&p.then)p.then(function(){if(mute)mute.hidden=false;if(cover&&!C.editor)open()}).catch(function(){})}
function open(){if(cover){cover.classList.add('gone');setTimeout(function(){cover&&cover.remove();cover=null},600)}}
if(cover){var go=function(){play();open();if(mute&&au)mute.hidden=false};cover.addEventListener('click',go);cover.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})}
if(au&&!C.editor){play();au.addEventListener('canplaythrough',play,{once:true})}
if(mute)mute.addEventListener('click',function(){muted=!muted;au.muted=muted;mute.innerHTML=muted?C.icons.off:C.icons.on;mute.setAttribute('aria-label',muted?C.l.musicOn:C.l.musicOff);if(!muted&&au.paused)au.play().catch(function(){})});
var target=Date.parse(C.target);function tick(){var ms=Math.max(target-Date.now(),0),v=[Math.floor(ms/864e5),Math.floor(ms/36e5)%24,Math.floor(ms/6e4)%60,Math.floor(ms/1e3)%60];
$$('.cd-grid').forEach(function(g){if(!ms&&g.dataset.done){var p=document.createElement('p');p.className='cd-done';p.textContent=g.dataset.done;g.parentNode.replaceChild(p,g);return}$$('b[data-u]',g).forEach(function(b){b.textContent=String(v[b.dataset.u]).padStart(2,'0')})})}
tick();setInterval(tick,1000);
var rv=$$('.rv');if(C.instant||!('IntersectionObserver'in window))rv.forEach(function(e){e.classList.add('in')});else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.2});rv.forEach(function(e){io.observe(e)})}
$$('.copy').forEach(function(b){b.addEventListener('click',function(){var h=b.parentNode.parentNode.querySelector('.hint');function ok(){h.textContent=h.dataset.copied;setTimeout(function(){h.textContent=''},1800)}if(navigator.clipboard)navigator.clipboard.writeText(b.dataset.copy).then(ok,function(){});})});
$$('.gal-i').forEach(function(b){b.addEventListener('click',function(){var d=document.createElement('div');d.className='lb';d.setAttribute('role','dialog');d.setAttribute('aria-label',C.l.close);var i=document.createElement('img');i.src=b.dataset.src;d.appendChild(i);d.addEventListener('click',function(){d.remove()});document.body.appendChild(d)})});
$$('form.rs').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var msg=$('.rs-msg',f),btn=$('button[type=submit]',f),name=f.name.value.trim();if(!name){msg.textContent=C.l.needName;f.name.focus();return}
function done(){f.hidden=true;var t=f.parentNode.querySelector('.rs-done');t.hidden=false}if(C.editor||!C.rsvp){done();return}
btn.disabled=true;msg.textContent=C.l.sending;fetch(C.rsvp,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name,answer:(f.querySelector('input[name=answer]:checked')||{}).value||'yes',guests:f.guests?Number(f.guests.value):1,note:f.note.value.trim()})})
.then(function(r){if(!r.ok)throw 0;try{localStorage.setItem('qi-rsvp:'+C.slug,'1')}catch(_){}done()}).catch(function(){msg.textContent=C.l.failed}).then(function(){btn.disabled=false})})});
if(C.editor){addEventListener('message',function(e){var m=e.data||{};if(m.qi==='goto'){var el=document.getElementById('s-'+m.id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}if(m.qi==='cover'&&cover)cover.classList.toggle('gone',!m.on)});
var t0;addEventListener('scroll',function(){clearTimeout(t0);t0=setTimeout(function(){parent.postMessage({qi:'y',y:scrollY},'*')},120)},{passive:true});if(C.y)scrollTo(0,C.y)}
})();`

/**
 * The full page.
 * @param {object} raw  invitation data (normalized here)
 * @param {object} [o]
 *   static   — a picture of the page: no script, no cover, nothing animated (thumbnails)
 *   editor   — the studio's live preview: cover only when `cover` is true, scroll kept (`y`)
 *   nonce    — CSP nonce for the inline script (public page)
 *   slug, rsvpUrl, canonicalUrl, ogImage, credit (link back to QalamAI), noindex
 */
export function renderInvitePage(raw, o = {}) {
  const d = normalizeInvite(raw)
  const L = inviteLabels(d.lang)
  const title = inviteTitle(d) || d.cover.subtitle || 'Taklifnoma'
  const subtitle = d.cover.subtitle || ''
  const ctx = { static: Boolean(o.static) }
  const body = d.sections.filter((s) => s.on).map((s) => section(s, d, L, ctx)).join('\n')
  const showCover = !o.static && d.cover.on && (o.editor ? o.cover : true)
  const cover = !o.static && d.cover.on
    ? `<div class="cover${showCover ? '' : ' gone'}" role="button" tabindex="0" aria-label="${esc(d.cover.button || title)}"><div class="cover-in">${deco(d, [['ribbon-a', 'tl'], ['ribbon-b', 'tr flip'], ['ribbon-c', 'bl', 1.5], ['ribbon-c', 'br flip', 2]])}
${d.cover.top ? `<p class="top">${esc(d.cover.top)}</p>` : ''}${ornament(d)}${namesHtml(d, 'p')}${subtitle ? `<p class="cover-sub">${esc(subtitle)}</p>` : ''}${d.cover.button ? `<span class="cover-btn">${esc(d.cover.button)}</span>` : ''}</div></div>`
    : ''
  const music = !o.static && d.music
    ? `<audio id="qi-au" preload="${o.editor ? 'none' : 'auto'}" playsinline loop src="${esc(d.music.src)}"></audio><button type="button" class="mute" hidden aria-label="${esc(L.musicOff)}">${NOTE_ON}</button>`
    : ''
  const cfg = {
    target: `${d.date}T${d.time}:00+05:00`,
    editor: Boolean(o.editor),
    instant: Boolean(o.editor && o.y),
    y: o.editor ? Math.max(0, Math.round(o.y || 0)) : 0,
    rsvp: o.rsvpUrl || null,
    slug: o.slug || '',
    l: { musicOn: L.musicOn, musicOff: L.musicOff, close: L.close, needName: L.needName, sending: L.sending, failed: L.failed },
    icons: { on: NOTE_ON, off: NOTE_OFF },
  }
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c')
  const desc = [subtitle, autoDateText(d)].filter(Boolean).join(' · ')
  const nonce = o.nonce ? ` nonce="${esc(o.nonce)}"` : ''
  const htmlLang = d.lang === 'uz-cyrl' ? 'uz-Cyrl' : d.lang
  return `<!doctype html>
<html lang="${htmlLang}"${o.static ? ' class="static"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(subtitle ? `${title} — ${subtitle}` : title)}</title>
<meta name="description" content="${esc(desc)}">
${o.noindex ? '<meta name="robots" content="noindex, nofollow">\n' : ''}${o.canonicalUrl ? `<link rel="canonical" href="${esc(o.canonicalUrl)}">\n<meta property="og:url" content="${esc(o.canonicalUrl)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${o.ogImage ? `<meta property="og:image" content="${esc(o.ogImage)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<meta name="theme-color" content="${d.theme.bg}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(inviteFontsHref(d.font))}">
<style>${css(d)}</style>
</head>
<body>
${o.static ? '' : `<script${nonce}>document.documentElement.classList.add('js')</script>\n`}${cover}${music}
<main class="qi">
${body}
${o.credit ? `<a class="made" href="${esc(o.credit)}" target="_blank" rel="noopener">${esc(L.made)}</a>` : ''}
</main>
${o.static ? '' : `<script type="application/json" id="qi-cfg">${json}</script>\n<script${nonce}>${SCRIPT}</script>\n`}</body>
</html>`
}

/** First picture of the invitation (link previews). */
export function invitePreviewImage(raw) {
  const d = normalizeInvite(raw)
  for (const s of d.sections) {
    if (!s.on) continue
    if (s.photo) return s.photo
    if (s.photos?.length) return s.photos[0]
  }
  return null
}
