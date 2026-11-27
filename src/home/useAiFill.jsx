// The other document types written by the AI, shown while they are written:
//   doc   (referat, kurs işi, mustaqil iş, dars işlanma, biznes reja) — the app's structure with the
//         "✎" hints, empty cells and sample lists filled piece by piece (aiDoc.js);
//   cards (hisobot, portfolio, taklifnoma) — the sample slides rewritten for the topic.
// The server charges and gives the coins back itself if the writing fails or is cancelled.
import { useRef, useState } from 'react'
import Slide from '../editor/Slide.jsx'
import { getTemplate } from '../editor/templates.js'
import { ApiError } from '../api.js'
import { aiFill } from '../coins.js'
import { docHtml } from '../blueprints.js'
import { t } from '../i18n/index.js'
import GenerateOverlay from './GenerateOverlay.jsx'
import { cleanPages, docHeadings, fillPiece, prepareDoc } from './aiDoc.js'

export function useAiFill(notify) {
  const [gen, setGen] = useState(null)
  const stop = useRef(null)

  /**
   * @param {{ kind: string, label: string, topic: string, lang: string, out: object, format: 'doc' | 'slides' | 'card',
   *   pages?: number, extra?: string, templateId?: string, deckKind?: string, onStart?: () => void }} o
   * Resolves false only when the AI is not connected (AI_OFF): the caller then keeps its sample.
   */
  async function run(o) {
    const isDoc = o.format === 'doc'
    const prepared = isDoc ? prepareDoc(o.out.pages) : null
    const tasks = prepared?.tasks ?? []
    const slides = isDoc ? [] : o.out.slides.map((s) => ({ ...s, elements: s.elements ?? [] }))
    if (isDoc && !tasks.length) return false // nothing to write: keep the sample as it is
    const body = isDoc
      ? { kind: o.kind, topic: o.topic, lang: o.lang, pages: Math.max(1, Math.min(120, Math.round(o.pages ?? o.out.estPages ?? 10))), tasks: tasks.map(({ page, ...x }) => x), ...(o.extra ? { extra: o.extra.slice(0, 300) } : {}) }
      : {
          kind: o.kind,
          topic: o.topic,
          lang: o.lang,
          slides: slides.map((s) => ({
            ...(s.title != null ? { title: String(s.title).slice(0, 200) } : {}),
            ...(s.subtitle != null ? { subtitle: String(s.subtitle).slice(0, 300) } : {}),
            ...(Array.isArray(s.bullets) ? { bullets: s.bullets.slice(0, 10).map((b) => String(b).slice(0, 400)) } : {}),
          })),
          ...(o.extra ? { extra: o.extra.slice(0, 300) } : {}),
        }
    const total = isDoc ? tasks.length : slides.length
    const ctl = new AbortController()
    stop.current = ctl
    let failed = false
    const patch = (fn) => setGen((g) => (g?.live ? fn(g) : g))
    try {
      const ran = await aiFill(body, {
        signal: ctl.signal,
        onEvent: (ev) => {
          if (ev.type === 'start') {
            o.onStart?.()
            setGen({
              // a document's pages are all there from the start (the structure); the text fills in
              live: { outline: isDoc ? docHeadings(o.out.pages).slice(0, 12) : slides.map((s) => s.title).filter(Boolean).slice(0, 12), written: isDoc ? o.out.pages.length : 0, progress: 0, done: false },
              isDoc,
              pages: prepared?.pages ?? null,
              slides,
              done: 0,
              total,
              o,
            })
          } else if (ev.type === 'fill' && isDoc) {
            const task = tasks[ev.id]
            if (!task) return
            patch((g) => {
              const done = g.done + 1
              // the pages are all there from the start; the bar shows how much of the text is written
              return { ...g, pages: fillPiece(g.pages, task, ev), done, live: { ...g.live, written: g.pages.length, progress: done / total } }
            })
          } else if (ev.type === 'card' && !isDoc) {
            patch((g) => {
              const list = [...g.slides]
              const { type, i, ...texts } = ev
              if (!list[i]) return g
              list[i] = { ...list[i], ...texts }
              const done = g.done + 1
              return { ...g, slides: list, done, live: { ...g.live, written: done, progress: done / total } }
            })
          } else if (ev.type === 'done') {
            patch((g) => ({ ...g, live: { ...g.live, written: isDoc ? g.pages.length : g.slides.length, done: true } }))
          } else if (ev.type === 'error') {
            failed = true
            setGen(null)
            notify?.(ev.message || t('hx.createFailed'))
          }
        },
      })
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

  /** The "QalamAI is writing" screen; finished documents go to onCreateDoc, slides to onCreate. */
  function overlay({ onCreate, onCreateDoc, onClose }) {
    if (!gen?.live) return null
    const { o, isDoc } = gen
    const tpl = getTemplate(o.templateId)
    return (
      <GenerateOverlay
        topic={o.topic}
        kind={o.label}
        unit={t(isDoc ? 'bp.unit.page' : 'bp.unit.slide')}
        format={isDoc ? 'doc' : o.format}
        outline={[]}
        live={gen.live}
        total={isDoc ? gen.pages.length : gen.slides.length}
        renderThumb={(i) =>
          isDoc ? (
            <div className="gn-doc">
              <div className="mp" dangerouslySetInnerHTML={{ __html: gen.pages[i] }} />
            </div>
          ) : (
            <Slide slide={gen.slides[i]} theme={tpl.theme} index={i} preview />
          )
        }
        templateName={isDoc ? 'A4' : tpl.name}
        onDone={() => {
          if (isDoc) onCreateDoc({ name: o.out.name, html: docHtml(cleanPages(gen.pages)), kind: o.label, type: o.kind, ai: true })
          else onCreate({ topic: o.topic, templateId: o.templateId, kind: o.deckKind, slides: gen.slides, ai: true, lang: o.lang })
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
