// User profile — filled once, reused everywhere: titul varag'i, first slide credit,
// and (later) official documents and business proposals.
import { uzToCyr } from '../shared/i18n.js'
import { getLang, t } from './i18n/index.js'
import { markChanged } from './changes.js'

const KEY = 'qalamai.profile.v1'

export const UNIVERSITIES = [
  { id: 'tatu', short: 'TATU', name: 'Muhammad al-Xorazmiy nomidagi Toşkent axborot texnologiyalari universiteti' },
  { id: 'ozmu', short: 'ÖzMU', name: 'Mirzo Uluğbek nomidagi Özbekiston Milliy universiteti' },
  { id: 'tdiu', short: 'TDIU', name: 'Toşkent davlat iqtisodiyot universiteti' },
  { id: 'tdtu', short: 'TDTU', name: 'Islom Karimov nomidagi Toşkent davlat texnika universiteti' },
  { id: 'tdpu', short: 'TDPU', name: 'Nizomiy nomidagi Toşkent davlat pedagogika universiteti' },
  { id: 'jidu', short: 'JIDU', name: 'Jahon iqtisodiyoti va diplomatiya universiteti' },
  { id: 'tdyu', short: 'TDYU', name: 'Toşkent davlat yuridik universiteti' },
  { id: 'samdu', short: 'SamDU', name: 'Şarof Raşidov nomidagi Samarqand davlat universiteti' },
  { id: 'buxdu', short: 'BuxDU', name: 'Buxoro davlat universiteti' },
  { id: 'fardu', short: 'FarDU', name: 'Farğona davlat universiteti' },
  { id: 'other', short: '', name: '' },
]
// Names above are the Uzbek originals; other languages read the official names from src/i18n/msg/profile.js.
for (const u of UNIVERSITIES) {
  if (u.id === 'other') continue
  const uz = { short: u.short, name: u.name }
  for (const f of ['short', 'name']) {
    Object.defineProperty(u, f, {
      enumerable: true,
      get: () => {
        const lang = getLang()
        if (lang === 'uz') return uz[f]
        if (lang === 'uz-cyrl') return f === 'short' ? uz[f] : uzToCyr(uz[f])
        return t(`uni.${u.id}.${f}`)
      },
    })
  }
}

// `kind` is the stable Uzbek id stored on designs; `label` follows the interface language.
export const WORK_TYPES = [
  { id: 'referat', kind: 'Referat', templateId: 'chronicle' },
  { id: 'kurs', kind: 'Kurs işi', templateId: 'chronicle' },
  { id: 'mustaqil', kind: 'Mustaqil iş', templateId: 'chronicle' },
  { id: 'lab', kind: 'Laboratoriya işi', templateId: 'brand' },
  { id: 'bmi', kind: 'Bitiruv malakaviy işi', templateId: 'chronicle' },
].map((w) => ({ ...w, get label() { return t(`wt.${w.id}`) } }))

export const EMPTY_PROFILE = {
  workType: 'kurs',
  topic: '',
  subject: '',
  uniId: 'other',
  uniCustom: '',
  faculty: '',
  direction: '',
  course: '',
  group: '',
  fullName: '',
  supervisor: '',
  // read when a new profile is created, so a new user's city starts in their own language
  get city() {
    return t('bp.city')
  },
  year: String(new Date().getFullYear()),
  // contact
  phone: '',
  // organisation (optional — for proposals, letters, official documents)
  company: '',
  position: '',
  director: '',
  stir: '',
  address: '',
  bank: '',
  mfo: '',
  account: '',
}

/** Fields that count towards "profile completeness". */
export const PROFILE_FIELDS = ['fullName', 'phone', 'city']

export function profileProgress(p) {
  const filled = (k) => (k === 'uni' ? uniOf(p).name.trim() : String(p[k] ?? '').trim())
  const done = PROFILE_FIELDS.filter(filled).length
  return { done, total: PROFILE_FIELDS.length }
}

export const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

export function loadProfile() {
  try {
    return { ...EMPTY_PROFILE, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

/** Profile for generated documents: an untouched profile must not put a default OTM on a titul. */
export function loadDocProfile() {
  try {
    if (localStorage.getItem(KEY) !== null) return loadProfile()
  } catch {
    /* storage unavailable */
  }
  return { ...EMPTY_PROFILE, uniId: 'other', uniCustom: '', course: '' }
}

/** Forget the local profile — on sign-out, so the next person on this browser starts clean. */
export function clearProfile() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

/** Whether this browser holds a profile at all (an untouched one is never uploaded). */
export function hasProfile() {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}

/**
 * Store the profile. A user edit (touch) stamps updatedAt so the newer side wins across devices;
 * data copied in from the server or auto-filled from Telegram keeps its stamp.
 */
export function saveProfile(p, { touch = true } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify(touch ? { ...p, updatedAt: String(Date.now()) } : p))
    if (touch) markChanged('profile')
  } catch {
    /* storage unavailable */
  }
}

export const uniOf = (p) => {
  const u = UNIVERSITIES.find((x) => x.id === p.uniId) ?? UNIVERSITIES[0]
  return u.id === 'other' ? { short: p.uniCustom, name: p.uniCustom } : u
}

export const workTypeOf = (id) => WORK_TYPES.find((w) => w.id === id) ?? WORK_TYPES[1]

/** One-line author credit for the first slide of new academic designs. */
export function authorLine(p = loadProfile()) {
  if (!p.fullName.trim()) return null
  const u = uniOf(p)
  return [p.fullName.trim(), u.short, p.course && t('pf.courseN', { n: p.course }), p.group && t('tl.group', { group: p.group })].filter(Boolean).join(' · ')
}
