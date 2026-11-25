// Shared "what can be created" list + its tile.
import {
  PresentationChart, FileText, GraduationCap, ChalkboardTeacher, Briefcase, ChartLineUp, Confetti, Palette, NotePencil,
} from '@phosphor-icons/react'
import { COLORS } from '../data.js'
import { t } from '../i18n/index.js'
import { kindLabel } from '../i18n/kinds.js'

// templateId/alt: the type's own slide templates. Only presentations have them so far; the other
// types get theirs later (until then AI results use DEFAULT_TEMPLATE, and no template is listed).
export const CREATE = [
  { id: 'Prezentatsiya', icon: PresentationChart, color: 'purple', templateId: 'pitch', alt: 'brand', kind: 'Taqdimot' },
  { id: 'Referat', icon: FileText, color: 'sky', templateId: null, alt: null, kind: 'Referat' },
  { id: 'Mustaqil iş', icon: NotePencil, color: 'blue', templateId: null, alt: null, kind: 'Mustaqil iş' }, // i18n-ignore (type id)
  { id: 'Kurs işi', icon: GraduationCap, color: 'indigo', templateId: null, alt: null, kind: 'Kurs işi' },
  { id: 'Dars işlanma', icon: ChalkboardTeacher, color: 'emerald', templateId: null, alt: null, kind: 'Dars' },
  { id: 'Biznes reja', icon: Briefcase, color: 'teal', templateId: null, alt: null, kind: 'Biznes reja' },
  { id: 'Hisobot', icon: ChartLineUp, color: 'orange', templateId: null, alt: null, kind: 'Hisobot' },
  { id: 'Taklifnoma', icon: Confetti, color: 'pink', templateId: null, alt: null, kind: 'Taklifnoma' },
  { id: 'Portfolio', icon: Palette, color: 'red', templateId: null, alt: null, kind: 'Portfolio' },
  // `id` is the stable type id (ACTION_BY_TYPE, blueprints); `label` follows the interface language.
].map((c) => ({ ...c, get label() { return kindLabel(c.id) } }))

export const KIND_COLOR = {
  Taqdimot: '#9a6af5', Referat: '#3d9ff0', 'Kurs işi': '#6474ec', 'Mustaqil iş': '#3b82f6', Dars: '#2bb069', 'Biznes reja': '#12b398',
  'Biznes taqdimot': '#12b398', Hisobot: '#f26b4b', Taklifnoma: '#e8456f', Portfolio: '#e5484d',
  Logo: '#f59e0b', 'Link in Bio': '#14b8a6', Rezyume: '#2563eb',
}

export function CatTile({ icon: Icon, color }) {
  const c = COLORS[color]
  return (
    <span className="hm-cat-tile" style={{ background: c.to }}>
      <Icon size={28} weight="duotone" color="#fff" />
    </span>
  )
}

/** Dropdown body listing every creatable type. */
export function CreateMenu({ onCreate, close }) {
  return (
    <>
      <div className="pop-label">{t('design.newDesign')}</div>
      {CREATE.map((c) => (
        <button key={c.id} className="menu-item hm-create-item" onClick={() => { close(); onCreate({ templateId: c.templateId, kind: c.kind, blank: true }) }}>
          <span className="hm-create-row">
            <CatTile icon={c.icon} color={c.color} />
            {c.label}
          </span>
        </button>
      ))}
    </>
  )
}
