// «AI taqdimotchi»: the spoken script of a presentation, slide by slide, with drawing cues.
//
// The browser sends what is on every slide as numbered "anchors" (a text block, a picture, a chart),
// read from the rendered page, so any layout works. The model answers one JSON line per slide:
//   {"slide":0,"say":[{"text":"…","do":"underline","on":2},{"text":"…"}]}
// `do` is drawn on anchor `on` when that sentence starts. The player speaks each `text` in turn.
import { LANG_NAMES } from './deck.js'

export const DRAWS = ['underline', 'circle', 'highlight', 'box', 'arrow', 'spot', 'point']
/** Cues that only make sense on text (they follow the lines of the text). */
const TEXT_ONLY = new Set(['underline', 'highlight'])
export const TONES = ['lesson', 'pitch', 'talk']
export const LENGTHS = { short: [25, 45], normal: [50, 85], long: [90, 140] }
export const NARRATE_MAX_SLIDES = 40
export const ANCHORS_MAX = 24

export const NARRATE_SYSTEM = `You are a live presenter for QalamAI. You present a finished slide deck to an audience, speaking over each slide while a pen draws on it. You write only what you SAY and where the pen draws. The app speaks your words with a voice and animates the pen.

INPUT
Each slide lists what is on it as numbered anchors:
  [2] text: "Causes of global warming"
  [3] image: "factory chimneys"
  [4] chart: "CO2 emissions, 1990–2020"

OUTPUT FORMAT
One JSON object per line, one line per slide, in slide order, nothing else (no markdown, no commentary):
{"slide":0,"say":[{"text":"…","do":"circle","on":2},{"text":"…"}]}
- "say": 2–6 short spoken parts, together about {MIN}–{MAX} words for a normal slide (a cover, a section divider or a closing slide may be shorter).
- A part may carry ONE pen cue: "do" and "on" (the anchor number). The pen draws when that part starts, so the words of that part must be about that anchor.
- Pen cues: "underline" (a key phrase, text only), "highlight" (a marker over text, text only), "circle" (a number, a word, a picture), "box" (a block, a table, a chart), "arrow" (points at something), "spot" (dims everything except one anchor — use for the single most important point), "point" (the presenter's laser pointer).
- Use 1–3 cues per slide, on the anchors that matter most. Never invent an anchor number. Not every part needs a cue.

HOW TO PRESENT
- Speak like an experienced, warm presenter in front of real people: natural spoken sentences, not written text. Explain, connect ideas, give a short example or why it matters. Do NOT just read the bullets word for word, and never say "on this slide", "bullet point" or "anchor".
- Slide 0: greet the audience briefly and introduce the topic. The last slide: wrap up in one or two sentences and thank the audience.
- Carry the talk from slide to slide with short spoken transitions in the deck language (like "now", "at the same time", "so").
- Keep each part one or two sentences, easy to say aloud. Write numbers so they read naturally; spell out short abbreviations the first time.
- Plain text only in "text": no emoji, no markdown, no quotes around the whole part, no stage directions.
- Write everything in the requested language and script.`

const TONE_TEXT = {
  lesson: 'Tone: a friendly, clear teacher explaining a lesson to students; check understanding with an occasional rhetorical question.',
  pitch: 'Tone: a confident professional presenting to colleagues, investors or a jury; crisp, persuasive, focused on results.',
  talk: 'Tone: a relaxed, engaging speaker; conversational, with a light touch of humour where it fits.',
}

/**
 * @param {{ lang: string, title?: string, tone: string, length: string,
 *           slides: { items: { k: 'text'|'image'|'chart', t: string }[] }[] }} o
 */
export function narratePrompt({ lang, title = '', tone = 'lesson', length = 'normal', slides }) {
  const uz = lang === 'uz' ? '\nWrite Uzbek in the Latin script with oʻ, gʻ, sh, ch (the app converts it to the new alphabet itself).' : ''
  const body = slides
    .map((s, i) => {
      const items = s.items.length ? s.items.map((it, j) => `  [${j}] ${it.k}: ${JSON.stringify(it.t || (it.k === 'text' ? '' : '(no caption)'))}`).join('\n') : '  (empty slide)'
      return `Slide ${i}${i === 0 ? ' (cover)' : i === slides.length - 1 ? ' (last)' : ''}:\n${items}`
    })
    .join('\n\n')
  return `Language: ${LANG_NAMES[lang] ?? 'English'}${uz}
${TONE_TEXT[tone] ?? TONE_TEXT.lesson}
Presentation: ${JSON.stringify(title || 'untitled')}
Slides: ${slides.length} — answer exactly ${slides.length} lines, slide 0 to ${slides.length - 1}.

${body}`
}

export const narrateSystem = (length = 'normal') => {
  const [min, max] = LENGTHS[length] ?? LENGTHS.normal
  return NARRATE_SYSTEM.replace('{MIN}', min).replace('{MAX}', max)
}

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
// the model sometimes wraps a part in quotes or adds markdown
const tidy = (s) => clip(s, 700).replace(/^["«“]+|["»”]+$/g, '').replace(/[*_#`]+/g, '').trim()

/**
 * One slide of the script, or null. `items` are the anchors that slide was sent with: a cue that
 * names a missing anchor, or a text-only cue on a picture, is turned into a pointer or dropped.
 */
export function cleanNarration(raw, slides) {
  if (!raw || typeof raw !== 'object') return null
  const index = Number(raw.slide)
  if (!Number.isInteger(index) || index < 0 || index >= slides.length) return null
  const items = slides[index].items
  const say = []
  for (const part of Array.isArray(raw.say) ? raw.say.slice(0, 8) : []) {
    const text = tidy(typeof part === 'string' ? part : part?.text)
    if (text.length < 2) continue
    const out = { text }
    const on = Number(part?.on)
    let draw = DRAWS.includes(part?.do) ? part.do : null
    if (draw && Number.isInteger(on) && items[on]) {
      if (TEXT_ONLY.has(draw) && items[on].k !== 'text') draw = 'circle'
      out.do = draw
      out.on = on
    }
    say.push(out)
  }
  return say.length ? { slide: index, say } : null
}
