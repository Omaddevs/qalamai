// Kinds of work in the admin panel: label, icon, colour — and the small per-kind count chips.
import {
  BookOpen, Briefcase, Contact, File, FileText, GraduationCap, Link2, NotebookPen, Palette, PartyPopper, PenTool,
  Presentation, ScrollText, Shapes, TrendingUp,
} from 'lucide-react'

export const KINDS = {
  prezentatsiya: { label: 'Taqdimot', icon: Presentation, color: '#8b5cf6' },
  referat: { label: 'Referat', icon: FileText, color: '#3b82f6' },
  'kurs-ishi': { label: 'Kurs işi', icon: GraduationCap, color: '#6366f1' },
  'mustaqil-ish': { label: 'Mustaqil iş', icon: NotebookPen, color: '#0ea5e9' },
  diplom: { label: 'Diplom işi', icon: ScrollText, color: '#4f46e5' },
  'dars-ishlanma': { label: 'Dars işlanma', icon: BookOpen, color: '#22c55e' },
  'biznes-reja': { label: 'Biznes reja', icon: Briefcase, color: '#14b8a6' },
  hisobot: { label: 'Hisobot', icon: TrendingUp, color: '#f97316' },
  taklifnoma: { label: 'Taklifnoma', icon: PartyPopper, color: '#e11d48' },
  portfolio: { label: 'Portfolio', icon: Palette, color: '#ef4444' },
  logo: { label: 'Logo', icon: PenTool, color: '#f59e0b' },
  bio: { label: 'Link in Bio', icon: Link2, color: '#10b981' },
  rezyume: { label: 'Rezyume', icon: Contact, color: '#2563eb' },
  hujjat: { label: 'Oddiy hujjat', icon: File, color: '#64748b' },
  boshqa: { label: 'Boşqa', icon: Shapes, color: '#94a3b8' },
}

/** Small coloured counts: "Taqdimot 4 · Referat 2 (AI 1)". */
export function KindChips({ kinds }) {
  const list = Object.entries(kinds ?? {})
    .map(([key, c]) => ({ key, ...c }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
  if (!list.length) return <span className="ad-muted">—</span>
  return (
    <div className="ad-kchips">
      {list.map((c) => {
        const meta = KINDS[c.key] ?? KINDS.boshqa
        const Icon = meta.icon
        return (
          <span key={c.key} className="ad-kchip" style={{ '--kc': meta.color }} title={`${meta.label}: ${c.total}${c.ai ? ` (AI: ${c.ai})` : ''}`}>
            <Icon size={12} /> {meta.label} <b>{c.total}</b>
            {c.ai > 0 && <em>AI {c.ai}</em>}
          </span>
        )
      })}
    </div>
  )
}
