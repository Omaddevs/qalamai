// Claude for QalamAI. One call writes a whole presentation and streams it slide by slide; the
// pictures are found while the next slides are still being written.
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM, cleanSlide, deckPrompt, lineReader, localize, parseLine, planSplit, PLAN_FIXED } from './deck.js'
import { findImage } from './images.js'
import { FILL_SYSTEM, cardsPrompt, cleanCard, cleanPiece, docPrompt } from './fill.js'

// models that can hand a declined request to another model inside the same call
const FALLBACK_MODELS = /^claude-(opus-5-5|sonnet-5-5|fable-5-[12]|opus-5)$/

export class AiError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/** @param {{ key: string, model: string, effort: string }} cfg */
export function createAi(cfg, { log } = {}) {
  const client = new Anthropic({ apiKey: cfg.key, maxRetries: 2, timeout: 20 * 60_000 })

  /**
   * Writes a presentation. Calls `emit` with
   *   { type: 'outline', items } · { type: 'slide', index, slide } · { type: 'image', index, image, credit }
   * and resolves with { slides, usage } when every slide and picture is in.
   */
  async function deck({ topic, plans, slides, lang, source = null }, { emit, signal }) {
    const total = planSplit(plans, slides).reduce((a, b) => a + b, 0) + PLAN_FIXED
    const local = localize(lang)
    const out = []
    const pictures = []
    let outline = null

    const reader = lineReader((line) => {
      const json = parseLine(line)
      if (!json) return log?.warn({ line: line.slice(0, 200) }, 'ai deck: unreadable line')
      if (Array.isArray(json.outline) && !outline) {
        outline = local(json.outline.map((x) => String(x).slice(0, 80)).slice(0, plans))
        return emit({ type: 'outline', items: outline })
      }
      if (out.length >= total) return
      const cleaned = cleanSlide(json)
      if (!cleaned) return log?.warn({ line: line.slice(0, 200) }, 'ai deck: slide dropped')
      const { _img, ...slide } = local(cleaned)
      const index = out.length
      out.push(slide)
      emit({ type: 'slide', index, slide })
      if (_img) {
        pictures.push(
          findImage(_img.q, _img.kind, { log }).then((found) => {
            if (!found || signal?.aborted) return
            out[index] = { ...out[index], image: found.url, imageCredit: found.credit }
            emit({ type: 'image', index, image: found.url, credit: found.credit })
          }),
        )
      }
    })

    const params = {
      model: cfg.model,
      max_tokens: 32000,
      system: SYSTEM,
      output_config: { effort: cfg.effort },
      messages: [{ role: 'user', content: deckPrompt({ topic, plans, slides, lang, source }) }],
    }
    const withFallback = FALLBACK_MODELS.test(cfg.model)
    const stream = withFallback
      ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
      : client.messages.stream(params, { signal })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') reader.push(event.delta.text)
    }
    reader.end()
    const final = await stream.finalMessage()
    await Promise.all(pictures)

    if (final.stop_reason === 'refusal') throw new AiError('AI_REFUSED', 'Bu mavzuda taqdimot yozib bölmadi — boşqa mavzu tanlang.')
    if (out.length < Math.min(3, total)) throw new AiError('AI_EMPTY', 'AI javobi töliq kelmadi — qaytadan urinib köring.')
    log?.info({ model: final.model, slides: out.length, stop: final.stop_reason, usage: final.usage }, 'ai deck done')
    return { slides: out, outline, usage: final.usage, model: final.model }
  }

  /** One streamed call; every complete output line goes to onLine. Resolves with the final message. */
  async function streamCall({ system, user, maxTokens }, onLine, signal) {
    const reader = lineReader(onLine)
    const params = { model: cfg.model, max_tokens: maxTokens, system, output_config: { effort: cfg.effort }, messages: [{ role: 'user', content: user }] }
    const stream = FALLBACK_MODELS.test(cfg.model)
      ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal })
      : client.messages.stream(params, { signal })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') reader.push(event.delta.text)
    }
    reader.end()
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw new AiError('AI_REFUSED', 'Bu mavzuda yozib bölmadi — boşqa mavzu tanlang.')
    return final
  }

  /**
   * Writes the missing pieces of a document. Emits { type: 'fill', id, p | items | text } per piece.
   * @param {{ kind: string, topic: string, lang: string, pages: number, tasks: object[], extra?: string }} o
   */
  async function doc(o, { emit, signal }) {
    const local = localize(o.lang)
    const tasks = new Map(o.tasks.map((x) => [x.id, x]))
    const done = new Set()
    // ~2.5 tokens per word for Uzbek/Russian, plus room for thinking
    const maxTokens = Math.min(120_000, 8000 + Math.round(o.pages * 260 * 3.2))
    const final = await streamCall({ system: FILL_SYSTEM, user: docPrompt(o), maxTokens }, (line) => {
      const piece = cleanPiece(parseLine(line), tasks)
      if (!piece || done.has(piece.id)) return
      done.add(piece.id)
      emit({ type: 'fill', ...local(piece) })
    }, signal)
    if (done.size < Math.max(1, Math.ceil(tasks.size * 0.3))) throw new AiError('AI_EMPTY', 'AI javobi töliq kelmadi — qaytadan urinib köring.')
    log?.info({ model: final.model, kind: o.kind, pieces: done.size, of: tasks.size, stop: final.stop_reason, usage: final.usage }, 'ai doc done')
    return { filled: done.size }
  }

  /** Rewrites a small slide document for the topic. Emits { type: 'card', i, title?, subtitle?, bullets? }. */
  async function cards(o, { emit, signal }) {
    const local = localize(o.lang)
    const done = new Set()
    const final = await streamCall({ system: FILL_SYSTEM, user: cardsPrompt(o), maxTokens: 16000 }, (line) => {
      const card = cleanCard(parseLine(line), o.slides.length)
      if (!card || done.has(card.i)) return
      done.add(card.i)
      emit({ type: 'card', ...local(card) })
    }, signal)
    if (!done.size) throw new AiError('AI_EMPTY', 'AI javobi töliq kelmadi — qaytadan urinib köring.')
    log?.info({ model: final.model, kind: o.kind, cards: done.size, usage: final.usage }, 'ai cards done')
    return { filled: done.size }
  }

  return { deck, doc, cards, model: cfg.model }
}
