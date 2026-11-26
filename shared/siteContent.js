// Site content edited in the admin panel (news, partners, team) — helpers shared by the API
// (server/src/modules/site) and the web app (src/landing/about/).
//
// Texts are stored per language: { uz: {...}, ru: {...}, en: {...} }. Uzbek is required; Cyrillic Uzbek
// is derived from it; a missing language falls back like the UI does (world languages → English first).
import { DEFAULT_LANG, LANGS, uzToCyr } from './i18n.js'
import { convert } from './alifbo.js'

/** Languages the admin writes content in (others are derived or fall back). */
export const CONTENT_LANGS = ['uz', 'ru', 'en']
const WORLD = new Set(LANGS.filter((l) => l.world).map((l) => l.id))

/**
 * The fields of `i18n` in `lang`, each falling back on its own: a post translated to Russian except
 * its excerpt still shows a whole excerpt. Returns { ...fields, lang } where lang is the one of the title/name.
 */
export function pickText(i18n, lang) {
  const src = i18n && typeof i18n === 'object' ? i18n : {}
  const order = lang === 'uz-cyrl' ? ['uz-cyrl'] : [lang]
  order.push(...(WORLD.has(lang) ? ['en', 'uz', 'ru'] : ['uz', 'en', 'ru']))
  const get = (l, f) => {
    if (l === 'uz-cyrl') {
      const v = src.uz?.[f]
      return typeof v === 'string' && v.trim() ? uzToCyr(v) : null
    }
    const v = src[l]?.[f]
    return typeof v === 'string' && v.trim() ? v : null
  }
  const fields = new Set(Object.values(src).flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))
  const out = {}
  for (const f of fields) {
    for (const l of order) {
      const v = get(l, f)
      if (v != null) {
        out[f] = v
        break
      }
    }
  }
  return out
}

/** Languages a post has its own title in (uz implies uz-cyrl): the language versions worth indexing. */
export function languagesOf(i18n) {
  const has = (l) => typeof i18n?.[l]?.title === 'string' && i18n[l].title.trim()
  const out = []
  if (has('uz')) out.push('uz', 'uz-cyrl')
  for (const l of ['ru', 'en']) if (has(l)) out.push(l)
  return out.length ? out : [DEFAULT_LANG]
}

/** "Yangi şablonlar: 10 ta!" → "yangi-shablonlar-10-ta". Latin a–z, digits and hyphens, at most 80 chars. */
export function slugify(text) {
  const latin = convert(String(text ?? ''), /[Ѐ-ӿ]/.test(text ?? '') ? 'cyr' : 'new', 'old')
  return latin
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ‘’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** **bold**, *italic*, [text](https://…) — on already escaped text. */
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
}

/**
 * Light markdown of a news body → safe HTML (everything is escaped first; only the tags below appear):
 * blank line = new paragraph, "## " / "### " headings, "- " or "1. " lists, "> " quote, **bold**, *italic*, [link](https://…).
 */
export function renderBody(md) {
  const blocks = String(md ?? '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/)
  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trimEnd())
      const first = lines[0]
      if (/^###\s+/.test(first) && lines.length === 1) return `<h3>${inline(esc(first.replace(/^###\s+/, '')))}</h3>`
      if (/^##\s+/.test(first) && lines.length === 1) return `<h2>${inline(esc(first.replace(/^##\s+/, '')))}</h2>`
      if (lines.every((l) => /^[-•*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(esc(l.replace(/^[-•*]\s+/, '')))}</li>`).join('')}</ul>`
      if (lines.every((l) => /^\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(esc(l.replace(/^\d+[.)]\s+/, '')))}</li>`).join('')}</ol>`
      if (lines.every((l) => /^>\s?/.test(l))) return `<blockquote>${lines.map((l) => inline(esc(l.replace(/^>\s?/, '')))).join('<br>')}</blockquote>`
      return `<p>${lines.map((l) => inline(esc(l))).join('<br>')}</p>`
    })
    .join('\n')
}

/** Plain text of a body (for descriptions and reading time). */
export const plainText = (md) =>
  String(md ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Reading time in minutes (about 180 words a minute), at least 1. */
export const readingMinutes = (md) => Math.max(1, Math.round(plainText(md).split(' ').filter(Boolean).length / 180))

/**
 * A team member's showcase from their texts:
 *   tracks: "Mobil ilovalar: Flutter, React Native, iOS" per line → [{ name, skills: [...] }] (up to 6)
 *   stats:  "20+ | Tayyor loyiha" per line                     → [{ value, label }] (up to 3)
 */
export function teamProfile(text) {
  const lines = (s) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const tracks = lines(text?.tracks)
    .map((l) => {
      const i = l.indexOf(':')
      const name = (i === -1 ? l : l.slice(0, i)).trim()
      const skills = i === -1 ? [] : l.slice(i + 1).split(/[,;·]/).map((x) => x.trim()).filter(Boolean).slice(0, 8)
      return { name, skills }
    })
    .filter((t) => t.name)
    .slice(0, 6)
  const stats = lines(text?.stats)
    .map((l) => {
      const [value, ...rest] = l.split('|')
      return { value: value.trim(), label: rest.join('|').trim() }
    })
    .filter((s) => s.value)
    .slice(0, 3)
  return { tracks, stats }
}
