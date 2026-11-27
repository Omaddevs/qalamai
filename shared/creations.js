// What users create, as the admin panel counts it. One key per kind of work; design kinds
// ("Taqdimot", "Link in Bio" …), document types ("Referat", "Kurs işi" …) and AI actions
// (shared/coins.js: prezentatsiya, kurs-ishi …) all land on these keys.

/** Every kind, in the order the admin panel shows them. */
export const CREATION_KINDS = [
  'prezentatsiya', 'referat', 'kurs-ishi', 'mustaqil-ish', 'diplom', 'dars-ishlanma', 'biznes-reja', 'hisobot',
  'taklifnoma', 'portfolio', 'logo', 'bio', 'rezyume', 'hujjat', 'boshqa',
]

// the old Latin letters and the new ones fold to one spelling: "Kurs işi" = "Kurs ishi" = "kurs-ishi"
const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, '')
    .replace(/ö/g, 'o')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 'sh')
    .replace(/ç/g, 'ch')
    .replace(/ñ/g, 'ng')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const ALIASES = {
  taqdimot: 'prezentatsiya',
  prezentatsiya: 'prezentatsiya',
  'prezentatsiya-fayl': 'prezentatsiya',
  'biznes-taqdimot': 'prezentatsiya',
  presentation: 'prezentatsiya',
  referat: 'referat',
  'kurs-ishi': 'kurs-ishi',
  'mustaqil-ish': 'mustaqil-ish',
  diplom: 'diplom',
  'diplom-ishi': 'diplom',
  dars: 'dars-ishlanma',
  'dars-ishlanma': 'dars-ishlanma',
  'biznes-reja': 'biznes-reja',
  hisobot: 'hisobot',
  taklifnoma: 'taklifnoma',
  portfolio: 'portfolio',
  logo: 'logo',
  'link-in-bio': 'bio',
  bio: 'bio',
  rezyume: 'rezyume',
  cv: 'rezyume',
}

/**
 * The key for a design kind or a document type. A document with no type is a plain file ("hujjat");
 * anything unknown is "boshqa".
 * @param {string|null|undefined} raw
 * @param {'design'|'document'} source
 */
export function creationKind(raw, source = 'design') {
  const k = fold(raw)
  if (!k) return source === 'document' ? 'hujjat' : 'prezentatsiya'
  return ALIASES[k] ?? 'boshqa'
}

/** AI actions (coin spends) that make a piece of work, and the kind each one makes. */
export const AI_ACTION_KIND = {
  prezentatsiya: 'prezentatsiya',
  'prezentatsiya-fayl': 'prezentatsiya',
  referat: 'referat',
  'kurs-ishi': 'kurs-ishi',
  diplom: 'diplom',
  'mustaqil-ish': 'mustaqil-ish',
  'dars-ishlanma': 'dars-ishlanma',
  'biznes-reja': 'biznes-reja',
  hisobot: 'hisobot',
  taklifnoma: 'taklifnoma',
  portfolio: 'portfolio',
}
/** AI actions that work on text instead of making a new piece (counted on their own). */
export const AI_TEXT_ACTIONS = ['qayta-yozish', 'plagiat', 'tarjima']
