// An AI presentation written by Claude on the server and shown slide by slide while it arrives.
// Shared by the AI taqdimot page and the home composer, so both pay and write the same way:
// the server charges the coins and gives them back itself if the writing fails or is cancelled.
import { useRef, useState } from 'react'
import Slide from '../editor/Slide.jsx'
import { getTemplate } from '../editor/templates.js'
import { fitDeck } from '../editor/quality.js'
import { ApiError } from '../api.js'
import { aiDeck } from '../coins.js'
import { PLAN_FIXED, PLAN_MAX } from '../blueprints.js'
import { t } from '../i18n/index.js'
import GenerateOverlay from './GenerateOverlay.jsx'

// what the AI may read of a file (the server takes up to 150 000 characters)
const SOURCE_MAX = 150_000

/** A document read in the browser → plain text with "#" headings, cut at a paragraph if it is long. */
export function docText(doc) {
  let out = ''
  for (const b of doc.blocks) {
    const line = b.kind === 'h' ? `${'#'.repeat(Math.min(3, b.level || 2))} ${b.text}` : b.text
    if (out.length + line.length + 2 > SOURCE_MAX) break
    out += `${line}\n\n`
  }
  return out.trim()
}

export function useAiDeck(notify) {
  const [gen, setGen] = useState(null)
  const stop = useRef(null)

  /**
   * Starts writing. Resolves false only when the AI is not connected (AI_OFF) — the caller then uses
   * its sample builder; true otherwise (written, failed with a message, or not paid: coin shop open).
   * @param {{ topic: string, plans: number, slides: number, lang: string, doc?: object, outline?: string[], templateId: string, kind?: string, onStart?: () => void }} o
   */
  async function run({ topic, plans, slides, lang, doc = null, outline = null, templateId, kind = 'Taqdimot', onStart }) {
    const usePlans = Math.min(PLAN_MAX, Math.max(1, plans || 1))
    const total = Math.max(slides, usePlans + PLAN_FIXED)
    const source = doc
      ? { name: (doc.name || doc.fileName || 'file').slice(0, 200), text: docText(doc), outline: (outline ?? []).slice(0, PLAN_MAX).map((x) => String(x).slice(0, 120)) }
      : null
    const title = topic || doc?.title || doc?.name || ''
    const ctl = new AbortController()
    stop.current = ctl
    let failed = false
    const patch = (fn) => setGen((g) => (g?.live ? fn(g) : g))
    try {
      const ran = await aiDeck(
        // the design's layout family steers which page types the AI favours
        { topic, plans: usePlans, slides: total, lang, source, prefer: getTemplate(templateId)?.prefer ?? [] },
        {
          signal: ctl.signal,
          onEvent: (ev) => {
            if (ev.type === 'start') {
              onStart?.()
              setGen({ live: { outline: null, written: 0, done: false }, slides: [], total, topic: title, named: Boolean(topic), lang, templateId, kind })
            } else if (ev.type === 'outline') patch((g) => ({ ...g, live: { ...g.live, outline: ev.items } }))
            else if (ev.type === 'slide')
              patch((g) => {
                const list = [...g.slides]
                const had = list[ev.index]
                list[ev.index] = { ...ev.slide, elements: [], ...(had?.image ? { image: had.image, imageCredit: had.imageCredit } : {}) }
                return { ...g, slides: list, live: { ...g.live, written: list.filter(Boolean).length } }
              })
            else if (ev.type === 'image')
              patch((g) => {
                const list = [...g.slides]
                list[ev.index] = { elements: [], ...(list[ev.index] ?? {}), image: ev.image, imageCredit: ev.credit }
                return { ...g, slides: list }
              })
            else if (ev.type === 'done') patch((g) => ({ ...g, total: g.slides.filter(Boolean).length, live: { ...g.live, done: true } }))
            else if (ev.type === 'error') {
              failed = true
              setGen(null)
              notify?.(ev.message || t('hx.createFailed'))
            }
          },
        },
      )
      if (!ran) setGen(null) // not paid: the coin shop is open
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AI_OFF') return false
      if (err.name !== 'AbortError' && !failed) {
        setGen(null)
        notify?.(err.message || t('hx.createFailed'))
      }
      return true
    } finally {
      if (stop.current === ctl) stop.current = null
    }
  }

  /** The "QalamAI is writing" screen; onCreate gets the finished deck. */
  function overlay({ kindLabel, onCreate, onClose }) {
    if (!gen?.live) return null
    const tpl = getTemplate(gen.templateId)
    return (
      <GenerateOverlay
        topic={gen.topic}
        kind={kindLabel}
        unit={t('bp.unit.slide')}
        outline={[]}
        live={gen.live}
        total={gen.total}
        renderThumb={(i) => (gen.slides[i] ? <Slide slide={gen.slides[i]} theme={tpl.theme} index={i} preview /> : null)}
        templateName={tpl.name}
        onDone={async () => {
          // from a file without a typed topic, the deck is named by its cover title, not the file name
          const name = (gen.named ? gen.topic : gen.slides[0]?.title) || gen.topic
          // pages whose text runs over get a smaller type size (quality.js) before the editor opens
          const { slides } = await fitDeck(gen.slides.filter(Boolean), tpl.theme).catch(() => ({ slides: gen.slides.filter(Boolean) }))
          onCreate({ topic: name, templateId: gen.templateId, kind: gen.kind, slides, ai: true, lang: gen.lang })
          setGen(null)
          onClose?.()
        }}
        onCancel={() => {
          // the server stops writing and gives the coins back
          stop.current?.abort()
          setGen(null)
          onClose?.()
          notify?.(t('gn.cancelled'))
        }}
      />
    )
  }

  return { gen, run, overlay }
}
