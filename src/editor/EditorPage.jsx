import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutTemplate, Shapes, Type, Briefcase, CloudUpload, CaseSensitive, Folder, LayoutGrid,
  Undo2, Redo2, Download, Share2, Plus, Minus, Trash2, Copy, ChevronLeft, Crown, BringToFront,
  MousePointerClick, Play, Presentation,
} from 'lucide-react'
import { Dropdown, QalamNib, Wordmark } from '../components/ui.jsx'
import { AppModal } from '../components/Modals.jsx'
import { CoinChip } from '../components/Coins.jsx'
import { openCoinShop, spendCoins, useWallet } from '../coins.js'
import { APPS } from '../data.js'
import { convert, detectScript } from '../lib/alifbo.js'
import Slide from './Slide.jsx'
import { BRAND_COLORS, generateSlides, getTemplate, newId, templatePages } from './templates.js'
import { downscale, patchAt, samplePage } from './layouts.jsx'
import Toolbar from './Toolbar.jsx'
import { detachPage } from './detach.js'
import { Present, PrintDeck } from './Present.jsx'
import ProBadge from '../components/ProBadge.jsx'
import LayoutPicker from './LayoutPicker.jsx'
import {
  AiPanel, AlifboPanel, AppsPanel, BrandPanel, ElementsPanel, ProjectsPanel, TemplatesPanel,
  TextPanel, UploadsPanel,
} from './panels.jsx'
import './editor.css'

const RAIL = [
  { id: 'ai', label: 'Qalam AI', icon: 'nib' },
  { id: 'templates', label: 'Şablonlar', icon: LayoutTemplate },
  { id: 'elements', label: 'Elementlar', icon: Shapes },
  { id: 'text', label: 'Matn', icon: Type },
  { id: 'brand', label: 'Brend', icon: Briefcase, pro: true },
  { id: 'uploads', label: 'Yuklaş', icon: CloudUpload },
  { id: 'alifbo', label: 'Alifbo', icon: CaseSensitive },
  { id: 'projects', label: 'Loyihalar', icon: Folder },
  { id: 'apps', label: 'Ilovalar', icon: LayoutGrid, divider: true },
]

const PANEL_TITLES = {
  ai: 'Qalam AI',
  elements: 'Elementlar',
  text: 'Matn',
  brand: 'Brend',
  uploads: 'Yuklaş',
  alifbo: 'Alifbo konvertori',
  projects: 'Loyihalar',
  apps: 'Ilovalar',
}

/* Undo/redo history. `transient` updates (drag frames) skip the stack. */
function useHistory(initial) {
  const [h, setH] = useState(() => ({ past: [], present: initial, future: [] }))
  const set = useCallback(
    (updater, transient = false) =>
      setH((s) => {
        const next = typeof updater === 'function' ? updater(s.present) : updater
        if (next === s.present) return s
        return transient ? { ...s, present: next } : { past: [...s.past.slice(-80), s.present], present: next, future: [] }
      }),
    [],
  )
  const checkpoint = useCallback(() => setH((s) => ({ past: [...s.past.slice(-80), s.present], present: s.present, future: [] })), [])
  const undo = useCallback(() => setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past.at(-1), future: [s.present, ...s.future] } : s)), [])
  const redo = useCallback(() => setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)), [])
  return { state: h.present, set, checkpoint, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 }
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5]

/** First template picked for a blank design: its pages, keeping what the user put on each blank page. */
function fillBlank(slides, tpl) {
  const pages = tpl.pages ? templatePages(tpl) : generateSlides('', 6)
  const extra = slides.slice(pages.length).map((s) => ({ ...s, themeIndex: undefined }))
  return [...pages.map((p, i) => ({ ...p, elements: slides[i]?.elements ?? [] })), ...extra]
}

// Every user-visible string on a page (any layout), not ids, image data or layout settings.
const NOT_TEXT = new Set(['id', 'type', 'image', 'src', 'side', 'answer', 'num', 'elements'])
function convertTexts(node, c) {
  if (typeof node === 'string') return c(node)
  if (Array.isArray(node)) return node.map((x) => convertTexts(x, c))
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, NOT_TEXT.has(k) ? v : convertTexts(v, c)]))
  return node
}

export default function EditorPage({ initialDeck, initialPanel, onHome, onSave, onOpenDesign, notify }) {
  const [openAppId, setOpenAppId] = useState(null)
  const { premium, coins } = useWallet()
  const openApp = APPS.find((a) => a.id === openAppId)
  const history = useHistory(initialDeck)
  const { state: deck, set, checkpoint, undo, redo, canUndo, canRedo } = history

  /* ───── autosave (debounced; flushed on leave) ───── */
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const latest = useRef(deck)
  latest.current = deck
  useEffect(() => {
    if (deck === initialDeck) return
    pending.current = true
    setSaving(true)
    const t = setTimeout(() => {
      onSave({ ...deck, updatedAt: Date.now() })
      pending.current = false
      setSaving(false)
    }, 500)
    return () => clearTimeout(t)
  }, [deck, initialDeck, onSave])
  useEffect(
    () => () => {
      if (pending.current) onSave({ ...latest.current, updatedAt: Date.now() })
    },
    [onSave],
  )

  const [panel, setPanel] = useState(initialPanel ?? 'templates')
  const [panelOpen, setPanelOpen] = useState(true)
  const [current, setCurrent] = useState(0)
  const [sel, setSel] = useState([]) // selected element ids (Shift adds)
  const selectedId = sel.length === 1 ? sel[0] : null
  const setSelectedId = useCallback((id) => setSel(id ? [id] : []), [])
  const [playKey, setPlayKey] = useState(0) // >0: the canvas page plays its animations
  const [presenting, setPresenting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [proAsk, setProAsk] = useState(null) // 'open' | 'download' — the Pro template notice
  const clip = useRef(null) // copied elements (⌘C / ⌘V)
  const canvasRef = useRef(null)
  const imgInput = useRef(null)
  const imgTarget = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [recent, setRecent] = useState(['pitch', 'brand'])
  const [picker, setPicker] = useState(null) // the "+" button while the layout menu is open
  const [uploads, setUploads] = useState([])

  const tpl = getTemplate(deck.templateId)
  const theme = useMemo(() => ({ ...tpl.theme, accent: deck.accent ?? tpl.theme.accent }), [tpl, deck.accent])
  const slideIdx = Math.min(current, deck.slides.length - 1)
  const slide = deck.slides[slideIdx]
  const selectedEls = slide.elements.filter((e) => sel.includes(e.id))
  const selectedEl = selectedEls[0]

  /* ───── deck mutations ───── */
  const updateSlide = useCallback(
    (patch, transient) =>
      set((d) => ({ ...d, slides: d.slides.map((s, i) => (i === slideIdx ? { ...s, ...patch } : s)) }), transient),
    [set, slideIdx],
  )

  const updateEl = useCallback(
    (id, patch, transient = false) =>
      set(
        (d) => ({
          ...d,
          slides: d.slides.map((s, i) =>
            i === slideIdx ? { ...s, elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : s,
          ),
        }),
        transient,
      ),
    [set, slideIdx],
  )

  const addEl = (el) => {
    const id = newId('el')
    const offset = (slide.elements.length % 5) * 3
    updateSlide({ elements: [...slide.elements, { x: 40 + offset, y: 34 + offset, w: 20, h: 20, ...el, id }] })
    setSelectedId(id)
  }

  const removeEl = useCallback(
    (id) => {
      set((d) => ({
        ...d,
        slides: d.slides.map((s, i) => (i === slideIdx ? { ...s, elements: s.elements.filter((e) => e.id !== id) } : s)),
      }))
      setSelectedId(null)
    },
    [set, slideIdx],
  )

  const duplicateEl = (el) => {
    const id = newId('el')
    updateSlide({ elements: [...slide.elements, { ...el, id, x: el.x + 3, y: el.y + 3 }] })
    setSelectedId(id)
  }

  const bringFront = (el) => updateSlide({ elements: [...slide.elements.filter((e) => e.id !== el.id), el] })

  /* ───── Canva-style element actions (selection = sel) ───── */
  const changeMany = useCallback(
    (map, transient = false) =>
      set((d) => ({ ...d, slides: d.slides.map((s, i) => (i === slideIdx ? { ...s, elements: s.elements.map((e) => (map[e.id] ? { ...e, ...map[e.id] } : e)) } : s)) }), transient),
    [set, slideIdx],
  )
  const patchSel = (patch) => {
    const map = {}
    for (const e of selectedEls) map[e.id] = typeof patch === 'function' ? patch(e) : patch
    changeMany(map)
  }
  const removeSel = () => {
    const ids = selectedEls.filter((e) => !e.locked).map((e) => e.id)
    if (!ids.length) return
    updateSlide({ elements: slide.elements.filter((e) => !ids.includes(e.id)) })
    setSel([])
  }
  const pasteEls = (els, offset = 2) => {
    const copies = els.map((e) => ({ ...structuredClone(e), id: newId('el'), x: e.x + offset, y: e.y + offset, locked: false, path: undefined, fromLayout: undefined }))
    updateSlide({ elements: [...slide.elements, ...copies] })
    setSel(copies.map((c) => c.id))
  }
  const duplicateSel = () => selectedEls.length && pasteEls(selectedEls)
  const layer = (dir) => {
    const ids = new Set(sel)
    const els = [...slide.elements]
    let next = els
    if (dir === 'front') next = [...els.filter((e) => !ids.has(e.id)), ...els.filter((e) => ids.has(e.id))]
    else if (dir === 'back') next = [...els.filter((e) => ids.has(e.id)), ...els.filter((e) => !ids.has(e.id))]
    else {
      next = [...els]
      const order = dir === 'up' ? [...next.keys()].reverse() : [...next.keys()]
      for (const i of order) {
        if (!ids.has(next[i].id)) continue
        const j = dir === 'up' ? i + 1 : i - 1
        if (j < 0 || j >= next.length || ids.has(next[j].id)) continue
        ;[next[i], next[j]] = [next[j], next[i]]
      }
    }
    updateSlide({ elements: next })
  }
  // visual box of an element on the canvas, in % of the page
  const boxOf = (id) => {
    const root = canvasRef.current?.querySelector('.slide')
    const n = root?.querySelector(`[data-eid="${CSS.escape(id)}"]`)
    if (!n) return null
    const r = root.getBoundingClientRect()
    const b = n.getBoundingClientRect()
    return { x: ((b.left - r.left) / r.width) * 100, y: ((b.top - r.top) / r.height) * 100, w: (b.width / r.width) * 100, h: (b.height / r.height) * 100 }
  }
  const alignTo = (ref, where) => {
    const map = {}
    for (const e of selectedEls) {
      const b = boxOf(e.id)
      if (!b || e.locked) continue
      let dx = 0
      let dy = 0
      if (where === 'left') dx = ref.x - b.x
      if (where === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2)
      if (where === 'right') dx = ref.x + ref.w - (b.x + b.w)
      if (where === 'top') dy = ref.y - b.y
      if (where === 'vmiddle') dy = ref.y + ref.h / 2 - (b.y + b.h / 2)
      if (where === 'bottom') dy = ref.y + ref.h - (b.y + b.h)
      map[e.id] = { x: e.x + dx, y: e.y + dy }
    }
    changeMany(map)
  }
  const unionBox = () => {
    const bs = selectedEls.map((e) => boxOf(e.id)).filter(Boolean)
    const x = Math.min(...bs.map((b) => b.x))
    const y = Math.min(...bs.map((b) => b.y))
    return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y }
  }
  const distribute = (axis) => {
    const items = selectedEls.map((e) => ({ e, b: boxOf(e.id) })).filter((x) => x.b)
    if (items.length < 3) return notify('Teng taqsimlaş uçun kamida 3 ta element tanlang')
    const c = (b) => (axis === 'x' ? b.x + b.w / 2 : b.y + b.h / 2)
    items.sort((a, b) => c(a.b) - c(b.b))
    const first = c(items[0].b)
    const step = (c(items[items.length - 1].b) - first) / (items.length - 1)
    const map = {}
    items.forEach(({ e, b }, i) => {
      const d = first + step * i - c(b)
      map[e.id] = axis === 'x' ? { x: e.x + d } : { y: e.y + d }
    })
    changeMany(map)
  }
  // a text edited on the canvas also updates the page's own data (kept when the template changes)
  const commitText = (el, v) => {
    if (!v.trim() && !el.path) {
      updateSlide({ elements: slide.elements.filter((e) => e.id !== el.id) })
      setSel([])
      return
    }
    updateSlide({ elements: slide.elements.map((e) => (e.id === el.id ? { ...e, text: v } : e)), ...(el.path ? patchAt(slide, el.path, v) : {}) })
  }
  const setImage = async (el, file) => {
    if (!file?.type?.startsWith('image/')) return notify('Rasm faylini tanlang')
    const src = await downscale(file)
    updateSlide({ elements: slide.elements.map((e) => (e.id === el.id ? { ...e, src } : e)), ...(el.path ? patchAt(slide, el.path, src) : {}) })
  }
  const play = () => setPlayKey((k) => k + 1)
  const animateAll = (type) => {
    const order = [...slide.elements].map((e) => ({ e, b: boxOf(e.id) })).sort((a, b) => (a.b?.y ?? 0) - (b.b?.y ?? 0) || (a.b?.x ?? 0) - (b.b?.x ?? 0))
    const map = {}
    order.forEach(({ e }, i) => (map[e.id] = { anim: { type, delay: Math.round(i * 0.12 * 100) / 100, dur: 0.7 } }))
    changeMany(map)
    play()
  }
  const toolbarAct = {
    patch: patchSel,
    duplicate: duplicateSel,
    remove: removeSel,
    layer,
    alignPage: (w) => alignTo({ x: 0, y: 0, w: 100, h: 100 }, w),
    alignSel: (w) => alignTo(unionBox(), w),
    distribute,
    replaceImage: (file) => selectedEl && setImage(selectedEl, file),
    select: setSel,
    animateAll,
    play,
  }

  /* ───── a template page becomes free elements once it is on the canvas (Canva model) ───── */
  useEffect(() => {
    if (slide.free) return
    let alive = true
    ;(async () => {
      // let the page lay out and its fonts load (timers, not rAF: rAF stalls in background tabs)
      await new Promise((r) => setTimeout(r, 30))
      await document.fonts?.ready
      await new Promise((r) => setTimeout(r, 30))
      const el = alive && canvasRef.current?.querySelector('.slide')
      if (!el) return
      const parts = detachPage(el)
      if (!parts || !alive) return
      set(
        (d) => ({
          ...d,
          slides: d.slides.map((s) => (s.id === slide.id && !s.free ? { ...s, free: true, themeIndex: slideIdx, elements: [...parts, ...s.elements] } : s)),
        }),
        true,
      )
    })()
    return () => {
      alive = false
    }
  }, [slide.id, slide.free, slideIdx, set, tpl.id])

  const applyTemplate = (id) => {
    // pages go back to the template's layout in the new look; texts were kept in the page data,
    // elements the user added stay
    set((d) => ({
      ...d,
      templateId: id,
      // a blank design (no template yet) gets the template's own pages; what the user added stays
      slides: d.templateId === 'blank' ? fillBlank(d.slides, getTemplate(id)) : d.slides.map((s) => {
        if (!s.free) return s
        const { free: _f, themeIndex: _t, ...rest } = s
        return { ...rest, elements: s.elements.filter((e) => !e.fromLayout) }
      }),
    }))
    setSel([])
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 2))
    if (getTemplate(id).pro && !deck.proPaid) setProAsk('open')
  }

  /* ───── Pro templates: free to edit, paid once per design on download ───── */
  const PRO_COST = 30
  useEffect(() => {
    if (tpl.pro && !deck.proPaid && deck.proSeen !== tpl.id) setProAsk('open')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl.id])
  const closeProNotice = () => {
    set((d) => ({ ...d, proSeen: tpl.id }), true)
    setProAsk(null)
  }
  const download = () => {
    if (tpl.pro && !deck.proPaid) return setProAsk('download')
    setPrinting(true)
  }
  const payPro = async () => {
    let paid = null
    try {
      paid = await spendCoins('pro-shablon', { ref: `pro-${deck.id}` })
    } catch (err) {
      notify(err.message)
      return
    }
    if (!paid) return setProAsk(null) // not enough coins: the coin shop is open
    set((d) => ({ ...d, proPaid: true, proSeen: tpl.id }), true)
    setProAsk(null)
    notify(`${paid.cost} coin yeçildi — bu dizaynni endi xohlagança yuklab olasiz`)
    setPrinting(true)
  }
  const donePrinting = useCallback(() => setPrinting(false), [])
  const closePresent = useCallback(() => setPresenting(false), [])

  // a new page of the chosen layout, with sample text to overwrite, right after the current one
  const addSlide = (type = 'content') => {
    const s = { ...samplePage(type), id: newId('s'), elements: [] }
    set((d) => ({ ...d, slides: [...d.slides.slice(0, slideIdx + 1), s, ...d.slides.slice(slideIdx + 1)] }))
    setCurrent(slideIdx + 1)
    setPicker(null)
  }

  const duplicateSlide = (i) => {
    set((d) => {
      const copy = { ...d.slides[i], id: newId('s'), elements: d.slides[i].elements.map((e) => ({ ...e, id: newId('el') })) }
      return { ...d, slides: [...d.slides.slice(0, i + 1), copy, ...d.slides.slice(i + 1)] }
    })
    setCurrent(i + 1)
  }

  const deleteSlide = (i) => {
    if (deck.slides.length === 1) return notify('Taqdimotda kamida bitta slayd bölişi kerak')
    set((d) => ({ ...d, slides: d.slides.filter((_, j) => j !== i) }))
    setCurrent((c) => Math.max(0, c > i ? c - 1 : Math.min(c, deck.slides.length - 2)))
  }

  const generate = async (topic, count) => {
    try {
      if (!(await spendCoins('prezentatsiya', { topic }))) return
    } catch (err) {
      notify(err.message)
      return
    }
    // structured templates build their own pages; the classic ones get title + sections
    set((d) => {
      const tpl = getTemplate(d.templateId)
      return { ...d, name: topic, slides: tpl.pages ? templatePages(tpl, { title: topic }) : generateSlides(topic, count) }
    })
    setCurrent(0)
    setSelectedId(null)
    notify(`«${topic}» böyiça ${count} ta slayd yaratildi (demo)`)
  }

  const convertDeck = (to) => {
    const c = (t) => (t ? convert(t, detectScript(t), to) : t)
    set((d) => ({
      ...d,
      name: c(d.name),
      slides: d.slides.map((s) => ({
        ...convertTexts(s, c),
        elements: s.elements.map((e) => (e.kind === 'text' ? { ...e, text: c(e.text) } : e)),
      })),
    }))
    notify('Taqdimot matnlari boşqa alifboga ötkazildi')
  }


  /* ───── keyboard ───── */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const typing = t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        redo()
        return
      }
      if (typing) return
      const k = e.key.toLowerCase()
      if (mod && k === 'd' && sel.length) return e.preventDefault(), duplicateSel()
      if (mod && k === 'c' && sel.length) return (clip.current = structuredClone(selectedEls))
      if (mod && k === 'x' && sel.length) return (clip.current = structuredClone(selectedEls)), removeSel()
      if (mod && k === 'v' && clip.current?.length) return e.preventDefault(), pasteEls(clip.current, 3)
      if (mod && k === 'a') return e.preventDefault(), setSel(slide.elements.map((x) => x.id))
      if (mod && (e.key === ']' || e.key === '[') && sel.length) return e.preventDefault(), layer(e.key === ']' ? (e.shiftKey ? 'front' : 'up') : e.shiftKey ? 'back' : 'down')
      if (mod && selectedEl?.kind === 'text' && ['b', 'i', 'u'].includes(k)) {
        e.preventDefault()
        if (k === 'b') patchSel((x) => ({ weight: (x.weight ?? 400) >= 600 ? 400 : 700 }))
        if (k === 'i') patchSel((x) => ({ italic: !x.italic }))
        if (k === 'u') patchSel((x) => ({ underline: !x.underline }))
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) return e.preventDefault(), removeSel()
      if (e.key === 'Escape') return setSel([])
      if (sel.length && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 2 : 0.3
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
        changeMany(Object.fromEntries(selectedEls.filter((x) => !x.locked).map((x) => [x.id, { x: x.x + d[0], y: x.y + d[1] }])))
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, deck.slides.length - 1))
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const selKey = sel.join(',')
  useEffect(() => {
    setEditingId(null)
  }, [selKey, slideIdx])
  useEffect(() => {
    setSel([])
    setPlayKey(0)
  }, [slideIdx])

  const pickRail = (id) => {
    if (id === panel && panelOpen) setPanelOpen(false)
    else {
      setPanel(id)
      setPanelOpen(true)
    }
  }

  /* ───── panel content ───── */
  const panelBody = {
    templates: <TemplatesPanel currentId={deck.templateId} recent={recent} onApply={applyTemplate} />,
    ai: <AiPanel onGenerate={generate} />,
    elements: <ElementsPanel accent={theme.accent} onAdd={(s) => addEl({ kind: s.kind, w: s.w, h: s.h, radius: s.radius })} />,
    text: <TextPanel onAdd={(t) => addEl({ kind: 'text', w: 40, h: 10, x: 30, y: 40, ...t })} />,
    brand: <BrandPanel accent={deck.accent} defaultAccent={tpl.theme.accent} onAccent={(c) => set((d) => ({ ...d, accent: c }))} />,
    uploads: (
      <UploadsPanel
        uploads={uploads}
        onUpload={async (f) => {
          const src = await downscale(f) // kept with the design (and synced), unlike a blob: URL
          setUploads((u) => [{ id: newId('u'), name: f.name, src }, ...u])
        }}
        onAdd={(u) => addEl({ kind: 'image', src: u.src, w: 30, h: 40, x: 35, y: 30 })}
      />
    ),
    alifbo: <AlifboPanel onConvert={convertDeck} />,
    projects: <ProjectsPanel currentId={deck.id} onOpen={onOpenDesign} />,
    apps: <AppsPanel onOpenApp={setOpenAppId} />,
  }[panel]

  const swatches = [theme.accent, '#111111', '#ffffff', ...BRAND_COLORS.filter((c) => c !== theme.accent).slice(0, 5)]

  return (
    <div className="ed">
      {/* ───── Top bar ───── */}
      <header className="ed-top">
        <button className="ed-brand" onClick={onHome} title="Boş sahifa">
          <ChevronLeft size={17} className="ed-back" />
          <Wordmark size={19} />
        </button>
        <span className="ed-sep" />
        <button className="ed-ibtn" onClick={undo} disabled={!canUndo} title="Bekor qiliş (⌘Z)">
          <Undo2 size={17} />
        </button>
        <button className="ed-ibtn" onClick={redo} disabled={!canRedo} title="Qaytariş (⇧⌘Z)">
          <Redo2 size={17} />
        </button>
        <input
          className="ed-name"
          value={deck.name}
          onChange={(e) => set((d) => ({ ...d, name: e.target.value }), true)}
          onFocus={checkpoint}
          aria-label="Loyiha nomi"
        />
        <span className="ed-saved">{saving ? 'Saqlanmoqda…' : 'Saqlandi'}</span>

        <div className="ed-top-right">
          <div className="ed-zoom">
            <button onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])} aria-label="Kiçiklaştiriş">
              <Minus size={14} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])} aria-label="Kattalaştiriş">
              <Plus size={14} />
            </button>
          </div>
          <CoinChip className="light" onClick={() => openCoinShop()} />
          {tpl.pro && !deck.proPaid && (
            <button className="ed-pro-chip" onClick={() => setProAsk('open')} title="Pro şablon">
              <ProBadge size="sm" /> <span>yuklab olişda {PRO_COST} coin</span>
            </button>
          )}
          <button className="btn ed-share" onClick={() => setPresenting(true)} title="Taqdimot qiliş (to‘liq ekran)">
            <Presentation size={15} /> <span>Taqdimot</span>
          </button>
          <button className="btn ed-share" onClick={() => notify('Ulaşiş havolasi nusxalandi (demo)')}>
            <Share2 size={15} /> <span>Ulaşiş</span>
          </button>
          <Dropdown
            align="right"
            button={({ toggle }) => (
              <button className="btn primary" onClick={toggle}>
                <Download size={15} /> <span>Yuklab oliş</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="pop-label">Format</div>
                <button
                  className="menu-item"
                  onClick={() => {
                    close()
                    download()
                  }}
                >
                  <span className="col-inline">
                    PDF
                    <span className="menu-hint">Barça sahifalar · çop etiş va ulaşiş uçun</span>
                  </span>
                </button>
                {[
                  ['PPTX', 'PowerPoint taqdimoti'],
                  ['PNG', 'Har bir sahifa rasm'],
                ].map(([f, hint]) => (
                  <button key={f} className="menu-item" disabled title="Tez kunda">
                    <span className="col-inline">
                      {f} <em className="menu-soon">tez kunda</em>
                      <span className="menu-hint">{hint}</span>
                    </span>
                  </button>
                ))}
                {!premium && (
                  <>
                    <div className="menu-sep" />
                    <button className="menu-item ed-wm-note" onClick={() => { close(); openCoinShop() }}>
                      <span>
                        <Crown size={13} /> Coin olsangiz — watermarksiz
                      </span>
                    </button>
                  </>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </header>

      <div className="ed-body">
        {/* ───── Rail ───── */}
        <nav className="ed-rail">
          {RAIL.map(({ id, label, icon: Icon, pro, divider }) => (
            <div key={id} className="ed-rail-wrap">
              {divider && <span className="ed-rail-div" />}
              <button className={`ed-rail-item ${panel === id && panelOpen ? 'on' : ''}`} onClick={() => pickRail(id)}>
                <span className="ed-rail-icon">
                  {Icon === 'nib' ? <QalamNib height={20} /> : <Icon size={21} strokeWidth={1.7} />}
                  {pro && (
                    <span className="ed-rail-pro">
                      <Crown size={8} strokeWidth={2.6} />
                    </span>
                  )}
                </span>
                <span className="ed-rail-label">{label}</span>
              </button>
            </div>
          ))}
        </nav>

        {/* ───── Panel ───── */}
        {panelOpen && (
          <aside className="ed-panel">
            {panel !== 'templates' && <h2 className="pn-title">{PANEL_TITLES[panel]}</h2>}
            {panelBody}
          </aside>
        )}
        <button
          className={`ed-collapse ${panelOpen ? '' : 'closed'}`}
          onClick={() => setPanelOpen((o) => !o)}
          aria-label={panelOpen ? 'Panelni yopiş' : 'Panelni oçiş'}
        >
          <ChevronLeft size={15} />
        </button>

        {/* ───── Workspace ───── */}
        <main className="ed-work" onPointerDown={(e) => e.target === e.currentTarget && setSelectedId(null)}>
          <div className="ed-context">
            {selectedEls.length ? (
              <Toolbar sel={selectedEls} all={slide.elements} theme={theme} act={toolbarAct} />
            ) : (
              <span className="ed-hint">
                <MousePointerClick size={15} /> Bosing — tanlaş · ikki marta — matnni tahrirlaş · Shift yoki ramka — bir neçtasini tanlaş
                <span className="ed-sep" />
                <button className="ed-ibtn wide" onClick={play} title="Sahifa animatsiyasini körish">
                  <Play size={15} /> Körish
                </button>
              </span>
            )}
          </div>

          <div className="ed-stage" onPointerDown={(e) => e.target === e.currentTarget && setSelectedId(null)}>
            <div className="ed-canvas" style={{ '--z': zoom }} ref={canvasRef}>
              <Slide
                key={`${slide.id}-${playKey}`}
                slide={slide}
                theme={theme}
                index={slideIdx}
                editable
                selectedIds={sel}
                editingId={editingId}
                onSelect={setSel}
                onEditEl={setEditingId}
                onChange={updateSlide}
                onElChange={updateEl}
                onElsChange={changeMany}
                onElCommitStart={checkpoint}
                onTextCommit={commitText}
                onPickImage={(el) => {
                  imgTarget.current = el
                  imgInput.current?.click()
                }}
                playing={playKey > 0}
              />
            </div>
            <input
              ref={imgInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files[0]
                e.target.value = ''
                if (f && imgTarget.current) setImage(imgTarget.current, f)
              }}
            />
          </div>

          {/* ───── Page strip ───── */}
          <div className="ed-strip">
            {deck.slides.map((s, i) => (
              <div key={s.id} className={`ed-thumb ${i === slideIdx ? 'on' : ''}`}>
                <button className="ed-thumb-btn" onClick={() => { setCurrent(i); setSelectedId(null) }}>
                  <Slide slide={s} theme={theme} index={i} />
                </button>
                <span className="ed-thumb-num">{i + 1}</span>
                <span className="ed-thumb-actions">
                  <button onClick={() => duplicateSlide(i)} title="Nusxa">
                    <Copy size={12} />
                  </button>
                  <button onClick={() => deleteSlide(i)} title="Öçiriş">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))}
            <button
              className={`ed-add ${picker ? 'on' : ''}`}
              onClick={(e) => setPicker(picker ? null : e.currentTarget)}
              title="Slayd qöşiş"
              aria-haspopup="menu"
              aria-expanded={Boolean(picker)}
            >
              <Plus size={20} />
            </button>
            {picker && <LayoutPicker anchor={picker} theme={theme} onPick={addSlide} onClose={() => setPicker(null)} />}
          </div>
        </main>
      </div>

      {presenting && <Present slides={deck.slides} theme={theme} start={slideIdx} onClose={closePresent} />}
      {printing && <PrintDeck slides={deck.slides} theme={theme} watermark={!premium} onDone={donePrinting} />}
      {proAsk && (
        <div className="pro-modal" role="dialog" aria-modal="true" onPointerDown={(e) => e.target === e.currentTarget && (proAsk === 'open' ? closeProNotice() : setProAsk(null))}>
          <div className="pro-modal-box">
            <ProBadge size="lg" />
            <h3>{proAsk === 'open' ? `«${tpl.name}» — Pro şablon` : 'Pro şablonni yuklab oliş'}</h3>
            {proAsk === 'open' ? (
              <p>
                Bu şablon bilan <b>bemalol işlang va tahrirlang — bepul</b>. Dizaynni yuklab olganingizda bir marta <b>{PRO_COST} coin</b> yeçiladi; şundan keyin uni xohlagança yuklab olasiz.
              </p>
            ) : (
              <p>
                Bu dizayn Pro şablon asosida. Yuklab oliş uçun bir marta <b>{PRO_COST} coin</b> yeçiladi — keyingi yuklab olişlar bepul.
              </p>
            )}
            <div className="pro-modal-bal">
              Sizda: <b>{coins} coin</b>
              {coins < PRO_COST && <span> · yetmaydi, coin sotib oliş mumkin</span>}
            </div>
            <div className="pro-modal-actions">
              {proAsk === 'open' ? (
                <>
                  <button className="btn" onClick={() => { closeProNotice(); setPanel('templates'); setPanelOpen(true) }}>
                    Boşqa şablon tanlaş
                  </button>
                  <button className="btn primary" onClick={closeProNotice}>
                    Tuşundim, davom etaman
                  </button>
                </>
              ) : (
                <>
                  <button className="btn" onClick={() => setProAsk(null)}>
                    Bekor qiliş
                  </button>
                  <button className="btn primary" onClick={payPro}>
                    {PRO_COST} coin bilan yuklab oliş
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {openApp && (
        <AppModal
          key={openApp.id}
          app={openApp}
          onClose={() => setOpenAppId(null)}
          onCreate={(app, topic) => {
            setOpenAppId(null)
            if (app.id === 'prezentatsiya') generate(topic, 10)
            else notify(`«${topic}» — ${app.name.toLowerCase()} tayyorlanmoqda… (demo, backend hali ulanmagan)`)
          }}
          onOpenPricing={() => {
            setOpenAppId(null)
            openCoinShop()
          }}
        />
      )}
    </div>
  )
}
