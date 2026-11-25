// AI presentation: Claude writes the deck one slide per line (JSON Lines), so the page can show each
// slide as soon as it is written. Every line is checked and trimmed to what our layouts can draw
// (src/editor/layouts.jsx); a line that doesn't fit becomes a plain bullet slide instead of breaking
// the deck. Pictures are looked up from Claude's English search phrase (images.js).
import { LANGS } from '../../../../shared/i18n.js'
import { convert } from '../../../../shared/alifbo.js'

/** Fixed slides around the plan: cover, agenda, conclusion, thanks (same as src/blueprints.js). */
export const PLAN_FIXED = 4
export const PLAN_MAX = 15

/** Content slides per plan item, e.g. 4 plan items in 10 slides → [2, 2, 1, 1] (as in src/blueprints.js). */
export function planSplit(plans, slides) {
  const content = Math.max(plans, slides - PLAN_FIXED)
  return Array.from({ length: plans }, (_, i) => Math.floor(content / plans) + (i < content % plans ? 1 : 0))
}

/** The language a deck is written in, named in English for the model. */
export const LANG_NAMES = {
  uz: 'Uzbek (Latin script)',
  'uz-cyrl': 'Uzbek (Cyrillic script)',
  ru: 'Russian',
  en: 'English',
  kk: 'Kazakh (Cyrillic script)',
  ky: 'Kyrgyz',
  tg: 'Tajik (Cyrillic script)',
  zh: 'Simplified Chinese',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
  bn: 'Bengali',
  pt: 'Portuguese (Brazil)',
  ur: 'Urdu',
  id: 'Indonesian',
  de: 'German',
  ja: 'Japanese',
  tr: 'Turkish',
  ko: 'Korean',
  vi: 'Vietnamese',
  it: 'Italian',
  fa: 'Persian',
  pl: 'Polish',
  uk: 'Ukrainian',
}
export const DECK_LANGS = LANGS.map((l) => l.id)

/* ───────── prompt ───────── */

export const SYSTEM = `You write the content of presentation slides for QalamAI, an app used mostly by students and teachers in Uzbekistan and Central Asia. The app draws the design; you only supply the content as data.

OUTPUT FORMAT
Write JSON Lines: one JSON object per line, nothing else — no markdown, no code fences, no commentary, no blank lines.
Line 1 is the plan: {"outline": ["plan item 1", "plan item 2", ...]}
Every following line is one slide, in order.

SLIDE TYPES (exact field names; keep every text within its limit)
{"type":"title","title":"≤70 chars","subtitle":"≤110 chars","image":IMG}
{"type":"agenda","title":"≤40","items":["plan item", ...]}
{"type":"content","title":"≤70","bullets":["≤120", 3–5 items]}
{"type":"media","title":"≤70","text":"2–3 sentences, ≤320","bullets":["≤90", 0–3 items],"image":IMG}
{"type":"cards","title":"≤70","cards":[{"title":"≤40","text":"≤130"}, 3–4 items]}
{"type":"stats","title":"≤70","stats":[{"value":"≤10, e.g. 1370, 35%, 8 mln","label":"≤70"}, 3–4 items],"text":"one sentence ≤160"}
{"type":"process","title":"≤70","steps":[{"title":"≤35","text":"≤110"}, 3–5 items]}
{"type":"compare","title":"≤70","left":{"title":"≤35","items":["≤90", 3–4]},"right":{"title":"≤35","items":["≤90", 3–4]}}
{"type":"quote","quote":"≤220","author":"≤60"}
{"type":"end","title":"≤40","subtitle":"≤80"}

IMG is {"q":"English image search phrase, 2–5 words","alt":"a second, different English phrase for the same subject","kind":"real"|"generic"}.
- Both phrases must name the slide's own subject precisely, with the word that tells it apart from similar things: "judo throw competition", never just "martial arts" or "combat sport" (that finds boxing); "Registan Samarkand", never "old mosque".
- "real": a specific real person, place, building, artwork, animal, plant, object or event. Search phrases that find photos: for historical people use their statue, monument or portrait ("Amir Timur statue Tashkent"); for places the name and city ("Registan Samarkand").
- The title slide's image shows the topic itself, as recognisably as possible: the person's statue or portrait, the building, the object — never a street, square, park or company merely named after it.
- "generic": a general idea shown by an everyday photo ("students working on laptops", "wheat field harvest").
- Never ask for text, charts, diagrams or logos in images.

RULES
- Write every slide text in the requested language. Image search phrases are always English.
- Be correct. Use only facts you are sure of. A "stats" slide only with well-known real figures; a "quote" slide only with a real quote whose author you know — otherwise choose another type.
- Write for an audience: short, clear, concrete sentences with real names, dates and examples. No filler, no repetition between slides, no emoji, no markdown symbols (*, #, **).
- Vary the layout: never the same type on two slides in a row (except "content" for the conclusion).
- Follow the requested slide plan exactly: the slide count, which slides belong to which plan item, and the fixed slides.`

/** Longest document text sent to the model (~40k tokens); longer files are cut at a paragraph. */
export const SOURCE_MAX = 150_000

/**
 * The user message: topic, language, and the exact slide plan. With `source` (a document read in the
 * browser) the deck retells that document and its sections become the plan.
 * @param {{ topic: string, plans: number, slides: number, lang: string, source?: { name: string, text: string, outline?: string[] } }} o
 */
export function deckPrompt({ topic, plans, slides, lang, source = null }) {
  const split = planSplit(plans, slides)
  const total = split.reduce((a, b) => a + b, 0) + PLAN_FIXED
  const lines = [
    `1. "title": the presentation title (the topic, well phrased) and a one-line subtitle; with an image.`,
    `2. "agenda": the ${plans} plan items, exactly as in the outline line.`,
  ]
  let n = 3
  split.forEach((count, i) => {
    const range = count === 1 ? `${n}` : `${n}–${n + count - 1}`
    lines.push(`${range}. plan item ${i + 1} (${count} slide${count > 1 ? 's' : ''}); the first of them is titled "${i + 1}. <plan item ${i + 1}>"; choose the best type for each.`)
    n += count
  })
  const content = split.reduce((a, b) => a + b, 0)
  const media = Math.min(content, Math.max(1, Math.ceil(content * 0.6)))
  lines.push(`Pictures: at least ${media} of the ${content} plan-item slides are type "media" (each with an image), spread over the deck.`)
  lines.push(`${n}. "content": the conclusion — title the word for "Conclusion" in the deck language, 3–5 key takeaways.`)
  lines.push(`${n + 1}. "end": "Thank you for your attention!" and "Questions?" in the deck language.`)
  const uz = lang === 'uz' ? `\nWrite Uzbek in the standard Latin alphabet (oʻ, gʻ, sh, ch).` : ''
  const doc = source
    ? `<document name="${source.name.replace(/"/g, "'")}">
${source.text}
</document>

Make the presentation from the document above. Use its content: its facts, names, numbers, examples and order. Do not add facts that are not in the document, except common knowledge needed to explain it. If the document is in another language, translate into the deck language.
${source.outline?.length ? `The plan items are the document's sections, in this order (phrase them in the deck language, short): ${source.outline.map((x) => `"${x}"`).join('; ')}.\n` : ''}${topic ? '' : 'Take the presentation title from the document.\n'}
`
    : ''
  return `${doc}Topic: ${topic || '(take it from the document)'}
Deck language: ${LANG_NAMES[lang] ?? 'English'}${uz}
Plan items: ${plans}
Slides: exactly ${total}, in this order:
${lines.join('\n')}`
}

/* ───────── checking a slide ───────── */

const str = (v, max) => {
  if (typeof v !== 'string' && typeof v !== 'number') return ''
  let s = String(v).replace(/[*#`]+/g, '').replace(/\s+/g, ' ').trim()
  if (s.length > max) {
    const cut = s.slice(0, max)
    s = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.7)).replace(/[,;:–—-]\s*$/, '')}…`
  }
  return s
}
const list = (v, min, max, len) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []).filter((_, i, a) => a.length >= min)
const objs = (v, min, max, shape) => {
  const out = (Array.isArray(v) ? v : [])
    .map((x) => (x && typeof x === 'object' ? shape(x) : null))
    .filter((x) => x && Object.values(x).every(Boolean))
    .slice(0, max)
  return out.length >= min ? out : null
}
const img = (v) => {
  if (!v || typeof v !== 'object') return null
  const q = str(v.q, 100)
  const alt = str(v.alt, 100)
  return q ? { q, ...(alt && alt !== q ? { alt } : {}), kind: v.kind === 'real' ? 'real' : 'generic' } : null
}

/** A fallback bullet slide from whatever texts a broken slide had. */
function asContent(raw) {
  const texts = []
  const walk = (v) => {
    if (typeof v === 'string') texts.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'type' && k !== 'title' && k !== 'image' && walk(x))
  }
  walk(raw)
  return { type: 'content', title: str(raw?.title, 70), bullets: texts.map((x) => str(x, 120)).filter(Boolean).slice(0, 5) }
}

/**
 * A model line → a slide our layouts can draw (plus `_img`, the picture to look up), or null.
 */
export function cleanSlide(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = str(raw.title, 70)
  switch (raw.type) {
    case 'title':
      return { type: 'title', title: title || '…', subtitle: str(raw.subtitle, 110), image: null, _img: img(raw.image) }
    case 'agenda': {
      const items = list(raw.items, 1, PLAN_MAX, 80)
      return items.length ? { type: 'agenda', title: str(raw.title, 40), items } : null
    }
    case 'media': {
      const text = str(raw.text, 320)
      if (!text && !raw.bullets?.length) break
      const bullets = list(raw.bullets, 1, 3, 90)
      return { type: 'media', title, text, ...(bullets.length ? { bullets } : {}), image: null, side: 'right', _img: img(raw.image) }
    }
    case 'cards': {
      const cards = objs(raw.cards, 2, 4, (c) => ({ title: str(c.title, 40), text: str(c.text, 130) }))
      if (cards) return { type: 'cards', title, cards }
      break
    }
    case 'stats': {
      const stats = objs(raw.stats, 2, 4, (s) => ({ value: str(s.value, 12), label: str(s.label, 70) }))
      if (stats) return { type: 'stats', title, stats, text: str(raw.text, 160) }
      break
    }
    case 'process': {
      const steps = objs(raw.steps, 2, 5, (s) => ({ title: str(s.title, 35), text: str(s.text, 110) }))
      if (steps) return { type: 'process', title, steps }
      break
    }
    case 'compare': {
      const side = (s) => (s && typeof s === 'object' ? { title: str(s.title, 35), items: list(s.items, 1, 4, 90) } : null)
      const left = side(raw.left)
      const right = side(raw.right)
      if (left?.title && left.items.length && right?.title && right.items.length) return { type: 'compare', title, left, right }
      break
    }
    case 'quote': {
      const quote = str(raw.quote, 220)
      if (quote) return { type: 'quote', quote, author: str(raw.author, 60) }
      break
    }
    case 'end':
      return { type: 'end', title: title || '…', subtitle: str(raw.subtitle, 80) }
    case 'content': {
      const bullets = list(raw.bullets, 1, 6, 120)
      if (bullets.length) return { type: 'content', title, bullets }
      break
    }
  }
  const c = asContent(raw)
  return c.bullets.length || c.title ? c : null
}

/** Every text in a slide through fn (for the Uzbek alphabet). */
export function mapTexts(v, fn) {
  if (typeof v === 'string') return fn(v)
  if (Array.isArray(v)) return v.map((x) => mapTexts(x, fn))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'type' || k === 'side' || k === '_img' || k === 'image' ? x : mapTexts(x, fn)]))
  return v
}

/** The deck's texts in the alphabet the app uses (Uzbek: the new Latin letters Ö Ğ Ş Ç). */
export const localize = (lang) => (lang === 'uz' ? (v) => mapTexts(v, (s) => convert(s.replace(/[‘’ʼ`]/g, 'ʻ'), 'old', 'new')) : (v) => v)

/* ───────── reading the stream ───────── */

/** Splits streamed text into complete lines; the last partial line waits for more text. */
export function lineReader(onLine) {
  let buf = ''
  return {
    push(text) {
      buf += text
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (line) onLine(line)
      }
    },
    end() {
      const line = buf.trim()
      buf = ''
      if (line) onLine(line)
    },
  }
}

/** One model line → parsed JSON or null (tolerates a stray code fence or trailing comma). */
export function parseLine(line) {
  const s = line.replace(/^```(?:json)?/, '').replace(/```$/, '').trim().replace(/,$/, '')
  if (!s.startsWith('{')) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
