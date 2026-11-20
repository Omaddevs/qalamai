// Designs persisted in localStorage (per browser). Seeded with examples on first run.
import { convert } from './lib/alifbo.js'
import { generateSlides, getTemplate, newId, templatePages } from './editor/templates.js'
import { authorLine } from './profile.js'
import { formatDate, t } from './i18n/index.js'
import { markChanged } from './changes.js'

const KEY = 'qalamai.designs.v1'

export const KIND_BY_CAT = {
  talim: 'Taqdimot',
  biznes: 'Biznes taqdimot',
  ijod: 'Portfolio',
  taklifnoma: 'Taklifnoma',
}

export function newDeck({ topic, templateId = 'pitch', count = 6, kind, slides: outline }) {
  const tpl = getTemplate(templateId)
  const name = topic?.trim() || t('design.untitled')
  // A type blueprint (src/blueprints.js) may hand over its own structure.
  const custom = outline?.length > 0
  // Profile: credit the author on the first slide automatically.
  const credit = topic?.trim() ? authorLine() : null
  let slides
  if (custom) {
    slides = outline.map(({ bullets, ...s }) => ({ ...s, ...(bullets ? { bullets: [...bullets] } : {}), id: newId('s'), elements: [] }))
  } else if (tpl.pages) {
    // structured template: all of its pages, the topic on the cover
    slides = templatePages(tpl, { title: topic?.trim() || undefined, ...(credit ? { subtitle: credit } : {}) })
  } else {
    slides = generateSlides(name, count)
    if (!topic?.trim()) {
      slides[0].title = tpl.sample.title
      slides[0].subtitle = tpl.sample.subtitle
    } else if (credit) slides[0].subtitle = credit
  }
  return {
    id: newId('d'),
    name: topic?.trim() ? name : tpl.sample.title,
    kind: kind ?? KIND_BY_CAT[tpl.cat] ?? 'Taqdimot',
    templateId: tpl.id,
    accent: null,
    slides,
    updatedAt: Date.now(),
  }
}

const MIN = 60_000 // used by timeAgo()

// Designs saved before the switch to the new Uzbek Latin alphabet keep their old system
// «kind» labels (e.g. "Kurs ishi") — bring them in line so colours and filters still match.
// User-written names and slide text are left exactly as the user typed them.
const OLD_SCRIPT = /[ʻ‘]|sh|ch/i
// Example decks that older versions put into every new browser (flag `seed`) are not the
// user's work: drop the ones never edited (an edit removes the flag), so lists and stats are real.
const migrate = (list) => list.filter((d) => !d.seed).map((d) => (d.kind && OLD_SCRIPT.test(d.kind) ? { ...d, kind: convert(d.kind, 'old', 'new') } : d))

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    /* storage unavailable or corrupted */
  }
  return [] // a new browser starts empty — no demo designs
}

function write(list) {
  try {
    // Uploaded images are blob: URLs that die with the tab — don't persist them.
    const clean = list.map((d) => ({
      ...d,
      slides: d.slides.map((s) => ({ ...s, elements: s.elements.filter((e) => !(e.kind === 'image' && e.src?.startsWith('blob:'))) })),
    }))
    localStorage.setItem(KEY, JSON.stringify(clean))
  } catch {
    /* quota or private mode — keep working in memory */
  }
}

export const loadDesigns = () => read().sort((a, b) => b.updatedAt - a.updatedAt)

/** For the sync layer: the stored list as is, and a write that doesn't count as a local edit. */
export const readDesignsRaw = () => read()
export const writeDesignsRaw = (list) => write(list)

export const getDesign = (id) => read().find((d) => d.id === id)

export function saveDesign(deck) {
  const list = read()
  const { seed: _seed, ...own } = deck // never store the old example flag
  const i = list.findIndex((d) => d.id === deck.id)
  if (i === -1) list.push(own)
  else list[i] = own
  write(list)
  markChanged('designs')
}

export function deleteDesign(id) {
  write(read().filter((d) => d.id !== id))
  markChanged('designs')
}

export function duplicateDesign(id) {
  const d = getDesign(id)
  if (!d) return null
  const copy = { ...structuredClone(d), id: newId('d'), name: t('design.copyName', { name: d.name }), updatedAt: Date.now() }
  saveDesign(copy)
  return copy
}

export function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / MIN)
  if (m < 1) return t('ago.now')
  if (m < 60) return t('ago.min', { n: m })
  const h = Math.round(m / 60)
  if (h < 24) return t('ago.hour', { n: h })
  const d = Math.round(h / 24)
  if (d < 30) return t('ago.day', { n: d })
  return formatDate(ts, { day: 'numeric', month: 'short', year: 'numeric' })
}
