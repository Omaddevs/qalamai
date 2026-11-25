// AI for the other document types. The app builds each document's academic structure itself (title
// page, contents, chapters, tables — src/blueprints.js) and marks what is still to be written: the
// grey "✎" hints, empty table cells, sample lists. Claude writes exactly those pieces, one JSON line
// per piece, and the browser puts each one in its place as it arrives.
//   doc   — tasks [{ id, t: 'p' | 'list' | 'inline' | 'cell', h, hint, items?, row?, col? }]
//   cards — slides [{ title, subtitle?, bullets? }] rewritten for the topic (report, portfolio, invitation)
import { LANG_NAMES, mapTexts } from './deck.js'

export const KIND_NAMES = {
  Referat: 'a school/university essay (referat)',
  'Kurs işi': 'a university course paper (kurs ishi) with chapters',
  'Mustaqil iş': 'a university independent study paper (mustaqil ish)',
  'Dars işlanma': 'a lesson plan for a teacher (dars ishlanma)',
  'Biznes reja': 'a business plan for a small business in Uzbekistan',
  Hisobot: 'a work report presentation',
  Portfolio: 'a personal portfolio presentation',
  Taklifnoma: 'an invitation card',
}

export const FILL_SYSTEM = `You write the text of documents for QalamAI, an app used mostly by students, teachers and small businesses in Uzbekistan and Central Asia. The app already built the document's structure (title page, contents, chapters, tables); you only write the missing pieces it lists, as data.

OUTPUT FORMAT
JSON Lines: one JSON object per line, nothing else — no markdown, no code fences, no commentary. One line per piece, in the given order, with its id:
- piece type "p":      {"id": N, "p": ["paragraph", "paragraph", ...]}
- piece type "list":   {"id": N, "items": ["item", "item", ...]}
- piece type "inline": {"id": N, "text": "a phrase or one or two sentences"}
- piece type "cell":   {"id": N, "text": "short table cell text"}
For a slide rewrite: {"i": N, "title": "...", "subtitle": "...", "bullets": ["...", ...]} — keep the fields the slide has.

RULES
- Write in the requested language, as a careful native writer: clear, concrete, academic where the document is academic. No emoji, no markdown symbols (*, #, **), no headings inside the text — the headings already exist.
- Each piece answers its hint (what to write there) under its heading. Do not repeat what other pieces say.
- Length: follow the word budget given for each "p" piece. A paragraph is 60–140 words.
- Facts: write only what you are sure is true — real laws, dates, names, numbers. Never invent statistics, quotes or studies. Where a number would be needed and you don't know it, describe the trend in words.
- References lists: only real, well-known works you are certain exist (laws, decrees, textbooks, classic books), formatted "Author. Title. — City: Publisher, Year." Never invent authors, titles or URLs. Fewer real items is better than more invented ones.
- Business plans: figures are clearly realistic estimates for Uzbekistan in so'm; keep them consistent between tables.
- Lesson plans: fit the grade and the lesson length.
- Things only the user knows (their name, a date, an address, a phone) stay as they are or as "____".`

const per = (n) => Math.max(60, Math.round(n))

/**
 * The user message for a document.
 * @param {{ kind: string, topic: string, lang: string, pages: number, tasks: object[], extra?: string }} o
 */
export function docPrompt({ kind, topic, lang, pages, tasks, extra }) {
  // ~260 words a page; the title page, contents and references don't count
  const blocks = tasks.filter((x) => x.t === 'p')
  const words = Math.max(300, (Math.max(1, pages) - 3) * 260)
  // hints that name a volume ("~3 bet") get more of the budget
  const weight = (x) => {
    const m = /(\d+)\s*(?:–|-)?\s*(\d+)?\s*(bet|бет|стр|page|сах|саҳ)/i.exec(x.hint ?? '')
    return m ? Number(m[2] ?? m[1]) : 1
  }
  const sum = blocks.reduce((a, x) => a + weight(x), 0) || 1
  const lines = tasks.map((x) => {
    const where = x.h ? ` under "${x.h}"` : ''
    if (x.t === 'p') return `${x.id}. p${where} (~${per((words * weight(x)) / sum)} words): ${x.hint}`
    if (x.t === 'list') return `${x.id}. list${where}: ${x.hint}${x.items?.length ? ` — replaces these examples: ${x.items.join(' | ')}` : ''}`
    if (x.t === 'cell') return `${x.id}. cell${where}: row "${x.row ?? ''}", column "${x.col ?? ''}"${x.hint ? ` — ${x.hint}` : ''}`
    return `${x.id}. inline${where}: ${x.lead ? `after "${x.lead}" — ` : ''}${x.hint}`
  })
  const uz = lang === 'uz' ? `\nWrite Uzbek in the standard Latin alphabet (oʻ, gʻ, sh, ch).` : ''
  return `Document: ${KIND_NAMES[kind] ?? kind}
Topic: ${topic}
Language: ${LANG_NAMES[lang] ?? 'English'}${uz}
Length: about ${pages} A4 pages in total${extra ? `\n${extra}` : ''}

Pieces to write (${tasks.length}):
${lines.join('\n')}`
}

/** The user message for rewriting a small slide document (report, portfolio, invitation). */
export function cardsPrompt({ kind, topic, lang, slides, extra }) {
  const uz = lang === 'uz' ? `\nWrite Uzbek in the standard Latin alphabet (oʻ, gʻ, sh, ch).` : ''
  const list = slides.map((s, i) => `${i}. ${JSON.stringify(s)}`).join('\n')
  return `Document: ${KIND_NAMES[kind] ?? kind}
Topic: ${topic}
Language: ${LANG_NAMES[lang] ?? 'English'}${uz}${extra ? `\n${extra}` : ''}

Rewrite every slide below for this topic: same number of slides, same fields, same number of bullets (±1). Keep the role of each slide (its sample text shows what belongs there). Keep "____" and phone numbers as they are; details only the user knows stay as "____".
${list}`
}

/* ───────── checking a line ───────── */

const clean = (v, max) => {
  if (typeof v !== 'string' && typeof v !== 'number') return ''
  let s = String(v).replace(/<[^>]*>/g, '').replace(/[*#`]+/g, '').replace(/\s+/g, ' ').trim()
  if (s.length > max) s = `${s.slice(0, max).replace(/\s+\S*$/, '')}…`
  return s
}
const arr = (v, n, max) => (Array.isArray(v) ? v.map((x) => clean(x, max)).filter(Boolean).slice(0, n) : [])

/** A model line for a document piece → what the browser puts in, or null. */
export function cleanPiece(json, tasks) {
  const task = tasks.get(Number(json?.id))
  if (!task) return null
  if (task.t === 'p') {
    const p = arr(json.p ?? (json.text ? [json.text] : null), 14, 2400)
    return p.length ? { id: task.id, p } : null
  }
  if (task.t === 'list') {
    const items = arr(json.items, 24, 420)
    return items.length ? { id: task.id, items } : null
  }
  const text = clean(json.text ?? json.p?.[0], task.t === 'cell' ? 300 : 700)
  return text ? { id: task.id, text } : null
}

/** A model line for a slide rewrite → { i, title, subtitle?, bullets? } or null. */
export function cleanCard(json, count) {
  const i = Number(json?.i)
  if (!Number.isInteger(i) || i < 0 || i >= count) return null
  const out = { i }
  if (json.title != null) out.title = clean(json.title, 90)
  if (json.subtitle != null) out.subtitle = clean(json.subtitle, 160)
  if (Array.isArray(json.bullets)) out.bullets = arr(json.bullets, 8, 220)
  return out.title || out.bullets?.length || out.subtitle ? out : null
}

export { mapTexts }
