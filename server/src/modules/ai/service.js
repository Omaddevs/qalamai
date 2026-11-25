// Claude for QalamAI. One call writes a whole presentation and streams it slide by slide; the
// pictures are found while the next slides are still being written.
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM, cleanSlide, deckPrompt, lineReader, localize, parseLine, planSplit, PLAN_FIXED } from './deck.js'
import { findImage } from './images.js'

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
  const client = new Anthropic({ apiKey: cfg.key, maxRetries: 2, timeout: 5 * 60_000 })

  /**
   * Writes a presentation. Calls `emit` with
   *   { type: 'outline', items } · { type: 'slide', index, slide } · { type: 'image', index, image, credit }
   * and resolves with { slides, usage } when every slide and picture is in.
   */
  async function deck({ topic, plans, slides, lang }, { emit, signal }) {
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
      messages: [{ role: 'user', content: deckPrompt({ topic, plans, slides, lang }) }],
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

  return { deck, model: cfg.model }
}
