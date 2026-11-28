// «AI taqdimotçi» in the editor: pick who presents (a character or your own photo), the voice and
// the style, let the AI write what to say on every page, adjust any sentence or pen cue by hand,
// then start the self-running presentation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, Microphone, PencilSimpleLine, Play, Plus, Sparkle, SpeakerHigh, Trash, Warning } from '@phosphor-icons/react'
import { Modal } from '../../components/ui.jsx'
import { aiNarrate, costOf } from '../../coins.js'
import { ApiError } from '../../api.js'
import { storeImage } from '../../assets.js'
import { inLang, t } from '../../i18n/index.js'
import { DeckLangPicker, deckLangs } from '../../home/DeckLang.jsx'
import Slide from '../Slide.jsx'
import { sigOf } from './anchors.js'
import { Character, PRESENTERS, PhotoPresenter, presenterById } from './characters.jsx'
import { AnchorProbe, DRAW_IDS, LENGTHS, NARRATE_MAX_SLIDES, TONES, scriptPart, staleSlides } from './narration.jsx'
import { createVoice, pickBrowserVoice, speaksLang, voiceInfo } from './voice.js'
import './presenter.css'
import './narrate-dialog.css'

const anchorLabel = (a, j) => `${j + 1}. ${a.k === 'text' ? `«${a.t.slice(0, 38)}${a.t.length > 38 ? '…' : ''}»` : t(`pr.anchor.${a.k}`)}`

/** A textarea that grows with its text. */
function Grow({ value, onChange, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="nd-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * @param {{ deck: object, theme: object, narration: object, onChange: (n: object) => void,
 *           onStart: () => void, onClose: () => void, notify: (msg: string) => void }} props
 */
export default function NarrateDialog({ deck, theme, narration: n, onChange, onStart, onClose, notify }) {
  const [anchors, setAnchors] = useState(null) // Map<slideId, anchors>
  const [busy, setBusy] = useState(null) // { done, total } while the AI writes
  const [hearing, setHearing] = useState(false)
  const abort = useRef(null)
  const photoInput = useRef(null)
  const latest = useRef(n)
  latest.current = n
  const set = useCallback((patch) => onChange({ ...latest.current, ...patch }), [onChange])
  const setSlide = useCallback((id, v) => onChange({ ...latest.current, slides: { ...latest.current.slides, [id]: v } }), [onChange])

  const slides = deck.slides.slice(0, NARRATE_MAX_SLIDES)
  const cost = costOf('taqdimotchi', Math.ceil(slides.length / 10))
  const langs = useMemo(() => deckLangs(), [])
  const stale = useMemo(() => (anchors ? staleSlides(deck, anchors) : new Set()), [deck, anchors])
  const written = slides.filter((s) => n.slides[s.id]?.say?.length).length
  const who = n.presenter

  useEffect(() => () => abort.current?.abort(), [])

  // no server voice and no voice of this language on this device: tell where a clear one is
  const [weakVoice, setWeakVoice] = useState(false)
  // the server speaks this language, but not in a man's voice yet (Aisha has one built-in woman's voice)
  const [noMale, setNoMale] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const srv = await voiceInfo()
      const onServer = srv.on && srv.langs.includes(n.lang)
      const weak = !onServer && !speaksLang(await pickBrowserVoice(n.lang, n.voice.g), n.lang)
      if (!alive) return
      setWeakVoice(weak)
      setNoMale(onServer && n.voice.g === 'm' && !(srv.genders?.[n.lang] ?? ['f', 'm']).includes('m'))
    })()
    return () => {
      alive = false
    }
  }, [n.lang, n.voice.g])

  const pickPresenter = (id) => set({ presenter: { id }, voice: { ...n.voice, g: presenterById(id).gender } })
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const ref = await storeImage(file, 512)
      set({ presenter: { photo: ref, id: who.id } })
    } catch {
      notify(t('pr.photoFailed'))
    }
  }

  const hear = async () => {
    if (hearing) return
    setHearing(true)
    const v = createVoice({ lang: n.lang, gender: n.voice.g, rate: n.voice.rate })
    v.unlock()
    try {
      const text = await inLang(n.lang, () => t('pr.sample'))
      await v.speak(text).done
    } finally {
      v.dispose()
      setHearing(false)
    }
  }

  const write = async () => {
    if (busy || !anchors) return
    const ctl = new AbortController()
    abort.current = ctl
    setBusy({ done: 0, total: slides.length })
    let done = 0
    try {
      const ran = await aiNarrate(
        {
          lang: n.lang,
          title: (deck.name ?? '').slice(0, 300),
          tone: n.tone,
          length: n.length,
          slides: slides.map((s) => ({ items: (anchors.get(s.id) ?? []).map((a) => ({ k: a.k, t: a.t.slice(0, 240) })) })),
        },
        {
          signal: ctl.signal,
          onEvent: (ev) => {
            if (ev.type === 'narration') {
              const s = slides[ev.slide]
              if (!s) return
              const a = anchors.get(s.id) ?? []
              setSlide(s.id, { sig: sigOf(a), say: scriptPart(ev.say, a) })
              done += 1
              setBusy({ done, total: slides.length })
            } else if (ev.type === 'done') notify(t('pr.written', { n: done }))
            else if (ev.type === 'error') notify(ev.message)
          },
        },
      )
      if (ran === null) return
    } catch (err) {
      if (err.name === 'AbortError') return
      notify(err instanceof ApiError && err.code === 'AI_OFF' ? t('pr.aiOff') : err.message)
    } finally {
      setBusy(null)
      abort.current = null
    }
  }

  const editPart = (id, k, patch) => {
    const cur = n.slides[id]
    const say = cur.say.map((p, j) => {
      if (j !== k) return p
      const next = { ...p, ...patch }
      if (!next.do) {
        delete next.do
        delete next.on
        delete next.ref
      } else if (patch.on != null || patch.do) {
        const a = anchors?.get(id)?.[next.on ?? 0]
        next.on = a ? (next.on ?? 0) : 0
        next.ref = a?.t
      }
      return next
    })
    setSlide(id, { ...cur, say })
  }
  const addPart = (id) => {
    const cur = n.slides[id] ?? { sig: anchors?.get(id) ? sigOf(anchors.get(id)) : undefined, say: [] }
    setSlide(id, { ...cur, say: [...cur.say, { text: '' }] })
  }
  const removePart = (id, k) => {
    const cur = n.slides[id]
    setSlide(id, { ...cur, say: cur.say.filter((_, j) => j !== k) })
  }

  const drawOptions = [{ id: '', label: t('pr.draw.none') }, ...DRAW_IDS.map((id) => ({ id, label: t(`pr.draw.${id}`) }))]

  return (
    <Modal
      className="nd"
      wide
      onClose={onClose}
      header={
        <div className="nd-head">
          <span className="nd-badge">
            <Sparkle weight="fill" size={16} />
          </span>
          <div>
            <h3>{t('pr.title')}</h3>
            <p>{t('pr.sub')}</p>
          </div>
        </div>
      }
    >
      <AnchorProbe slides={slides} theme={theme} onDone={setAnchors} />
      <div className="nd-grid">
        {/* ───── settings ───── */}
        <section className="nd-side">
          <h4>{t('pr.who')}</h4>
          <div className="nd-people">
            {PRESENTERS.map((p) => {
              const on = !who.photo && who.id === p.id
              return (
                <button key={p.id} type="button" className={`nd-person ${on ? 'on' : ''}`} onClick={() => pickPresenter(p.id)} aria-pressed={on} title={`${t(`pr.name.${p.id}`)} · ${t(`pr.role.${p.role}`)}`}>
                  <Character presenter={p} level={null} />
                  <span>{t(`pr.name.${p.id}`)}</span>
                  {on && <span className="nd-tick"><Check weight="bold" size={12} /></span>}
                </button>
              )
            })}
            <button type="button" className={`nd-person nd-own ${who.photo ? 'on' : ''}`} onClick={() => photoInput.current?.click()} aria-pressed={Boolean(who.photo)}>
              {who.photo ? <PhotoPresenter src={who.photo} level={null} /> : <span className="nd-cam"><Camera size={22} /></span>}
              <span>{t('pr.ownPhoto')}</span>
              {who.photo && <span className="nd-tick"><Check weight="bold" size={12} /></span>}
            </button>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
          </div>
          {who.photo && <p className="nd-note">{t('pr.photoNote')}</p>}

          <div className="nd-row">
            <label>{t('pr.side')}</label>
            <Segmented label={t('pr.side')} value={n.side} onChange={(side) => set({ side })} options={[{ id: 'left', label: t('pr.sideLeft') }, { id: 'right', label: t('pr.sideRight') }]} />
          </div>

          <h4>{t('pr.voice')}</h4>
          <div className="nd-row">
            <Segmented label={t('pr.voice')} value={n.voice.g} onChange={(g) => set({ voice: { ...n.voice, g } })} options={[{ id: 'f', label: t('pr.voiceF') }, { id: 'm', label: t('pr.voiceM') }]} />
            <button type="button" className="btn nd-hear" onClick={hear} disabled={hearing}>
              <SpeakerHigh size={16} weight={hearing ? 'fill' : 'regular'} /> {hearing ? t('pr.hearing') : t('pr.hear')}
            </button>
          </div>
          {weakVoice && <p className="nd-note">{t('pr.edgeTip')}</p>}
          {noMale && <p className="nd-note">{t('pr.maleSoon')}</p>}
          <div className="nd-row">
            <label htmlFor="nd-rate">{t('pr.rate')}</label>
            <input id="nd-rate" type="range" min="0.8" max="1.25" step="0.05" value={n.voice.rate} onChange={(e) => set({ voice: { ...n.voice, rate: Number(e.target.value) } })} />
            <output>{n.voice.rate.toFixed(2)}×</output>
          </div>

          <h4>{t('pr.speech')}</h4>
          <div className="nd-field">
            <label>{t('pr.lang')}</label>
            <DeckLangPicker langs={langs} value={n.lang} onChange={(lang) => set({ lang })} />
          </div>
          <div className="nd-field">
            <label>{t('pr.tone')}</label>
            <Segmented label={t('pr.tone')} value={n.tone} onChange={(tone) => set({ tone })} options={TONES.map((id) => ({ id, label: t(`pr.tone.${id}`) }))} />
          </div>
          <div className="nd-field">
            <label>{t('pr.length')}</label>
            <Segmented label={t('pr.length')} value={n.length} onChange={(length) => set({ length })} options={LENGTHS.map((id) => ({ id, label: t(`pr.length.${id}`) }))} />
          </div>
          <div className="nd-field nd-check">
            <label>
              <input type="checkbox" checked={n.captions} onChange={(e) => set({ captions: e.target.checked })} /> {t('pr.captionsOn')}
            </label>
          </div>

          <button type="button" className="btn primary nd-write" onClick={write} disabled={Boolean(busy) || !anchors}>
            <PencilSimpleLine size={17} weight="bold" />
            {busy ? t('pr.writing', { done: busy.done, total: busy.total }) : written ? t('pr.rewrite') : t('pr.write')}
            {!busy && <em>{t('pr.cost', { n: cost })}</em>}
          </button>
          {deck.slides.length > NARRATE_MAX_SLIDES && <p className="nd-note">{t('pr.tooMany', { n: NARRATE_MAX_SLIDES })}</p>}
        </section>

        {/* ───── the script ───── */}
        <section className="nd-script" aria-busy={Boolean(busy)}>
          <div className="nd-script-head">
            <h4>{t('pr.script')}</h4>
            <span>{t('pr.scriptCount', { n: written, total: slides.length })}</span>
          </div>
          {!written && !busy ? (
            <div className="nd-empty">
              <Microphone size={34} weight="duotone" />
              <b>{t('pr.emptyTitle')}</b>
              <p>{t('pr.emptyText')}</p>
            </div>
          ) : (
            <ol className="nd-pages">
              {slides.map((s, i) => {
                const sc = n.slides[s.id]
                const list = anchors?.get(s.id) ?? []
                return (
                  <li key={s.id} className={`nd-page ${busy && !sc ? 'wait' : ''}`}>
                    <div className="nd-thumb">
                      <Slide slide={s} theme={theme} index={i} />
                      <span>{i + 1}</span>
                    </div>
                    <div className="nd-parts">
                      {stale.has(s.id) && (
                        <p className="nd-stale">
                          <Warning size={14} weight="fill" /> {t('pr.stale')}
                        </p>
                      )}
                      {sc?.say.map((p, k) => (
                        <div key={k} className="nd-part">
                          <Grow value={p.text} onChange={(text) => editPart(s.id, k, { text })} aria-label={t('pr.partN', { n: k + 1 })} placeholder={t('pr.partPh')} />
                          <div className="nd-cue">
                            <select value={p.do ?? ''} onChange={(e) => editPart(s.id, k, { do: e.target.value || undefined })} aria-label={t('pr.drawLabel')}>
                              {drawOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            {p.do && (
                              <select value={p.on ?? 0} onChange={(e) => editPart(s.id, k, { on: Number(e.target.value) })} aria-label={t('pr.drawOn')}>
                                {list.map((a, j) => (
                                  <option key={j} value={j}>
                                    {anchorLabel(a, j)}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button type="button" className="icon-btn" onClick={() => removePart(s.id, k)} aria-label={t('pr.removePart')} title={t('pr.removePart')}>
                              <Trash size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {busy && !sc ? <div className="nd-skel" /> : (
                        <button type="button" className="nd-add" onClick={() => addPart(s.id)}>
                          <Plus size={13} weight="bold" /> {t('pr.addPart')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      <div className="modal-foot nd-foot">
        <span>{t('pr.footNote')}</span>
        <button type="button" className="btn primary nd-start" onClick={onStart} disabled={!written || Boolean(busy)}>
          <Play size={16} weight="fill" /> {t('pr.startShow')}
        </button>
      </div>
    </Modal>
  )
}
