// "Kits": non-slide creations (logo, link in bio, resume) stored next to slide designs.
// A kit design is { id, type, kind, name, templateId, data, slides: [], updatedAt }.
import { newId } from '../editor/templates.js'
import { BIO_TEMPLATES } from './bioTemplates.js'
import { LOGO_DEFAULT } from './logo.js'
import { CV_TEMPLATES, newCv, rid } from './cv.js'
import { getLang, has, t } from '../i18n/index.js'

// `kind` is the stable id stored on designs; label and blurb follow the interface language.
export const KIT_TYPES = Object.fromEntries(
  [
    ['logo', 'Logo'],
    ['bio', 'Link in Bio'],
    ['cv', 'Rezyume'],
  ].map(([type, kind]) => [
    type,
    {
      kind,
      get label() {
        return t(`kit.${type}.label`)
      },
      get blurb() {
        return t(`kit.${type}.blurb`)
      },
    },
  ]),
)


export const KIT_TEMPLATES = [
  /* ───── logos ───── */
  { id: 'logo-ustoz', type: 'logo', name: 'Ustoz', data: { ...LOGO_DEFAULT, name: 'Ustoz Akademiyasi', tagline: 'Öquv markazi', industry: 'talim', icon: 'GraduationCap', layout: 'left', shape: 'squircle', font: 'grotesk', palette: 'royal' } },
  { id: 'logo-choy', type: 'logo', name: 'Çoyxona', data: { ...LOGO_DEFAULT, name: 'Çoyxona', tagline: 'Toşkent · 1998', industry: 'ovqat', icon: 'Coffee', layout: 'emblem', shape: 'circle', font: 'grotesk', palette: 'sunset', upper: true, spacing: 2 } },
  { id: 'logo-bloom', type: 'logo', name: 'Bloom', data: { ...LOGO_DEFAULT, name: 'Bloom', tagline: 'Gözallik saloni', industry: 'gozallik', icon: 'FlowerLotus', layout: 'wordmark', shape: 'none', font: 'pacifico', palette: 'berry' } },
  { id: 'logo-techno', type: 'logo', name: 'Techno Lab', data: { ...LOGO_DEFAULT, name: 'Techno Lab', tagline: 'IT kompaniya', industry: 'texno', icon: 'Cpu', layout: 'monogram', shape: 'squircle', font: 'unbounded', palette: 'night' } },
  { id: 'logo-safar', type: 'logo', name: 'Safar', data: { ...LOGO_DEFAULT, name: 'Safar Travel', tagline: 'Sayohat agentligi', industry: 'sayohat', icon: 'Airplane', layout: 'stack', shape: 'circle', font: 'playfair', palette: 'ocean' } },
  { id: 'logo-alpomish', type: 'logo', name: 'Alpomiş', data: { ...LOGO_DEFAULT, name: 'Alpomiş', tagline: 'Sport klubi', industry: 'sport', icon: 'Barbell', layout: 'left', shape: 'hexagon', font: 'bebas', palette: 'ink', iconWeight: 'bold', upper: true, spacing: 2 } },

  /* ───── link in bio (element-by-element designs, src/creators/bioTemplates.js) ───── */
  ...BIO_TEMPLATES.map((x) => ({ id: x.id, type: 'bio', name: x.name, data: x.data })),

  /* ───── resumes ───── */
  ...Object.keys(CV_TEMPLATES).map((id) => ({ id: `cv-${id}`, type: 'cv', get name() { return CV_TEMPLATES[id].name }, cvTemplate: id })),
]

// Sample texts (taglines, bios, link titles, word-names) follow the interface language;
// person and brand names stay as they are.
function localizeKit(id, type, base) {
  if (type === 'logo') return { ...base, tagline: t(`kit.tag.${id}`), ...(has(`kit.logoName.${id}`) ? { name: t(`kit.logoName.${id}`) } : {}) }
  // templates without translated samples keep their own (Uzbek) texts
  if (!has(`kit.bio.${id}`)) return base
  const [bio, ...titles] = t(`kit.bio.${id}`).split('|')
  return {
    ...base,
    bio,
    ...(has(`kit.bioName.${id}`) ? { name: t(`kit.bioName.${id}`) } : {}),
    links: base.links.map((l, i) => ({ ...l, title: titles[i] ?? l.title })),
  }
}
for (const tpl of KIT_TEMPLATES) {
  if (has(`kit.tpl.${tpl.id}`)) Object.defineProperty(tpl, 'name', { get: () => t(`kit.tpl.${tpl.id}`), enumerable: true })
  if (tpl.type === 'cv') continue
  const base = tpl.data
  const byLang = new Map()
  Object.defineProperty(tpl, 'data', {
    enumerable: true,
    get: () => {
      const lang = getLang()
      if (!byLang.has(lang)) byLang.set(lang, localizeKit(tpl.id, tpl.type, base))
      return byLang.get(lang)
    },
  })
}

export const kitTemplate = (id) => KIT_TEMPLATES.find((x) => x.id === id)

/** Cached sample data for template thumbnails. */
const sampleCache = new Map()
export function templateData(tpl) {
  const key = `${getLang()}:${tpl.id}`
  if (!sampleCache.has(key)) sampleCache.set(key, tpl.type === 'cv' ? newCv(tpl.cvTemplate) : tpl.data)
  return sampleCache.get(key)
}

export function kitName(type, data) {
  if (type === 'logo') return data.name || 'Logo'
  if (type === 'bio') return data.name ? t('kit.nameBio', { name: data.name }) : 'Link in Bio'
  return data.name ? t('kit.nameCv', { name: data.name }) : t('kind.resume')
}

export function newKit(type, templateId) {
  const tpl = kitTemplate(templateId) ?? KIT_TEMPLATES.find((x) => x.type === type)
  const data = tpl.type === 'cv' ? newCv(tpl.cvTemplate) : structuredClone(tpl.data)
  if (tpl.type === 'bio') data.links = data.links.map((l) => ({ ...l, id: rid() }))
  return {
    id: newId('d'),
    type: tpl.type,
    kind: KIT_TYPES[tpl.type].kind,
    name: kitName(tpl.type, data),
    templateId: tpl.id,
    accent: null,
    data,
    slides: [],
    updatedAt: Date.now(),
  }
}

export const isKit = (d) => Boolean(d?.type && KIT_TYPES[d.type])
