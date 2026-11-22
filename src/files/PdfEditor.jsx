// PDF editor. Pages render with pdf.js; edits live in an overlay (in page units at
// scale 1) and are saved as pdf-edit operations in PDF user space — applied on the device
// (src/files/store.js), with the server as the fallback.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, ArrowUUpLeft, ArrowUUpRight, MagnifyingGlassMinus, MagnifyingGlassPlus, FloppyDisk, Cursor, CursorText, TextT, HighlighterCircle,
  Eraser, Rectangle, Circle, ArrowUpRight, LineSegment, PenNib, Image as ImageIcon, Signature, ArrowClockwise, ArrowCounterClockwise,
  Trash, TextB, TextItalic, CircleNotch, CheckCircle, DownloadSimple, NotePencil, WarningCircle, ArrowsOutLineHorizontal,
  ChatCenteredText, LinkSimple, Stamp, Printer, MagnifyingGlass, Hand, CaretUp, CaretDown, Copy, Plus, FilePlus, File as FileIcon,
  SquaresFour, TextAlignLeft, TextAlignCenter, TextAlignRight, Shapes, ArrowSquareOut, ImageSquare,
} from '@phosphor-icons/react'
import { apiUrl, downloadFile, fetchFile } from '../api.js'
import { addLocalFiles, runTool } from './store.js'
import { loadPdfjs } from './pdfjs.js'
import { Dropdown } from '../components/ui.jsx'
import { formatDate, t } from '../i18n/index.js'
import { A4, STAMPS, cropCanvas, findImages, flatViewport, imageBox, imagePageSize, imageUrl, loadImage, printBlob, renderSource, stampImage } from './peKit.js'


// `group` splits the tool rail: pick/edit · text · marks · shapes · insert
const TOOLS = [
  { id: 'select', icon: Cursor, get label() { return t('pe.tool.select') }, key: 'v', group: 0 },
  { id: 'edit', icon: CursorText, get label() { return t('pe.tool.edit') }, key: 'e', group: 0 },
  { id: 'text', icon: TextT, get label() { return t('pe.tool.text') }, key: 't', group: 1 },
  { id: 'highlight', icon: HighlighterCircle, get label() { return t('pe.tool.highlight') }, key: 'h', group: 1 },
  { id: 'whiteout', icon: Eraser, get label() { return t('pe.tool.whiteout') }, key: 'w', group: 1 },
  { id: 'rect', icon: Rectangle, get label() { return t('pe.tool.rect') }, key: 'r', group: 2 },
  { id: 'ellipse', icon: Circle, get label() { return t('pe.tool.ellipse') }, key: 'o', group: 2 },
  { id: 'arrow', icon: ArrowUpRight, get label() { return t('pe.tool.arrow') }, key: 'a', group: 2 },
  { id: 'line', icon: LineSegment, get label() { return t('pe.tool.line') }, key: 'l', group: 2 },
  { id: 'ink', icon: PenNib, get label() { return t('pe.tool.ink') }, key: 'p', group: 2 },
  { id: 'image', icon: ImageIcon, get label() { return t('pe.tool.image') }, key: 'i', group: 3 },
  { id: 'sign', icon: Signature, get label() { return t('pe.tool.sign') }, key: 's', group: 3 },
  { id: 'stamp', icon: Stamp, get label() { return t('pe.tool.stamp') }, key: 'm', group: 3 },
  { id: 'link', icon: LinkSimple, get label() { return t('pe.tool.link') }, key: 'k', group: 4 },
  { id: 'note', icon: ChatCenteredText, get label() { return t('pe.tool.note') }, key: 'n', group: 4 },
  { id: 'hand', icon: Hand, get label() { return t('pe.tool.hand') }, key: 'g', group: 0 },
]
const SHAPES = ['rect', 'ellipse', 'line', 'arrow']
const tool$ = (id) => TOOLS.find((x) => x.id === id)
/** Web address as typed → one the PDF can open (adds https:// when no scheme was given). */
const normUrl = (u) => {
  const v = u.trim()
  if (!v) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`
  return `https://${v}`
}
/** A tool's name without the "(R)" shortcut its label carries (shown separately as a key). */
const toolName = (tl) => tl.label.replace(/\s*\([^)]*\)\s*$/, '')
const COLORS = ['#111111', '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff']
const HL_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74']
const NOTE_COLORS = ['#facc15', '#fb923c', '#f472b6', '#60a5fa', '#4ade80']
const uid = () => Math.random().toString(36).slice(2, 10)
const DRAW_TOOLS = new Set(['highlight', 'whiteout', 'rect', 'ellipse', 'arrow', 'line', 'ink', 'link'])

/** Merge pdf.js text items on the same baseline into editable runs. */
function groupText(items, styles, commonObjs) {
  const out = []
  for (const it of items) {
    if (!it.str?.trim() || Math.abs(it.transform[1]) > 0.01 || Math.abs(it.transform[2]) > 0.01) continue
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10
    const last = out.at(-1)
    if (last && Math.abs(last.y - it.transform[5]) < size * 0.3 && it.transform[4] - (last.x + last.w) < size * 0.6 && it.transform[4] >= last.x + last.w - size * 0.3 && Math.abs(last.size - size) < 0.6) {
      const gap = it.transform[4] - (last.x + last.w)
      last.str += (gap > size * 0.15 && !/\s$/.test(last.str) && !/^\s/.test(it.str) ? ' ' : '') + it.str
      last.w = it.transform[4] + it.width - last.x
      continue
    }
    let name = ''
    try {
      name = commonObjs.get(it.fontName)?.name ?? ''
    } catch {
      /* not loaded */
    }
    const family = styles[it.fontName]?.fontFamily ?? ''
    out.push({
      id: uid(),
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      size,
      font: family === 'serif' || /times|serif|roman|georgia|cambria/i.test(name) ? 'serif' : 'sans',
      bold: /bold|black|heavy|semibold/i.test(name),
      italic: /italic|oblique/i.test(name),
    })
  }
  return out
}

function sampleCover(canvas, rect, zoom) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const k = canvas.width / (canvas.clientWidth || 1)
    const pts = [
      [rect.x - 2, rect.y + rect.h / 2],
      [rect.x + rect.w + 2, rect.y + rect.h / 2],
      [rect.x + rect.w / 2, rect.y - 2],
      [rect.x + rect.w / 2, rect.y + rect.h + 2],
    ]
    const counts = new Map()
    for (const [x, y] of pts) {
      const [r, g, b] = ctx.getImageData(Math.max(0, Math.round(x * zoom * k)), Math.max(0, Math.round(y * zoom * k)), 1, 1).data
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  } catch {
    return '#ffffff'
  }
}

/** A PDF image that was picked up but not changed — nothing to write for it. */
const untouched = (a) => {
  const o = a.orig
  if (a.type !== 'image' || !o || a.swapped || (a.opacity ?? 1) !== 1) return false
  // orig is the cover box: 0.75 larger than the image on every side
  return Math.abs(a.x - o.x - 0.75) < 0.01 && Math.abs(a.y - o.y - 0.75) < 0.01 && Math.abs(a.w - o.w + 1.5) < 0.01 && Math.abs(a.h - o.h + 1.5) < 0.01
}

/** Apply finished in-place text to annotations (drops empty new text / unchanged new replaces). */
function applyEdit(all, src, id, text) {
  const list = all[src] ?? []
  const a = list.find((x) => x.id === id)
  if (!a) return all
  if (a.type === 'text' && !text.trim()) return { ...all, [src]: list.filter((x) => x.id !== id) }
  if (a.type === 'replace' && text === a.original && a.isNew) return { ...all, [src]: list.filter((x) => x.id !== id) }
  return { ...all, [src]: list.map((x) => (x.id === id ? { ...x, text, isNew: false } : x)) }
}

/* ───────── Signature pad ───────── */

function SignatureModal({ onDone, onClose }) {
  const [mode, setMode] = useState('draw')
  const [name, setName] = useState('')
  const [ink, setInk] = useState('#1e3a8a')
  const canvas = useRef(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [mode])

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  function trimmed(c) {
    const ctx = c.getContext('2d')
    const { width, height } = c
    const data = ctx.getImageData(0, 0, width, height).data
    let x0 = width
    let y0 = height
    let x1 = 0
    let y1 = 0
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    if (x1 <= x0) return null
    const pad = 8
    const out = document.createElement('canvas')
    out.width = x1 - x0 + pad * 2
    out.height = y1 - y0 + pad * 2
    out.getContext('2d').drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height)
    return out
  }

  function finish() {
    let src
    if (mode === 'draw') src = canvas.current
    else {
      const c = document.createElement('canvas')
      c.width = 900
      c.height = 260
      const ctx = c.getContext('2d')
      ctx.font = "700 120px 'Caveat', cursive"
      ctx.fillStyle = ink
      ctx.textBaseline = 'middle'
      ctx.fillText(name, 20, 130)
      src = c
    }
    const t = trimmed(src)
    if (!t) return
    onDone({ src: t.toDataURL('image/png'), w: t.width, h: t.height })
  }

  return (
    <div className="pe-modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pe-modal">
        <div className="pe-modal-head">
          <b>{t('pe.sign')}</b>
          <div className="fs-seg small">
            <button className={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>
              {t('pe.draw')}
            </button>
            <button className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>
              {t('pe.type')}
            </button>
          </div>
          <button className="fs-ibtn" onClick={onClose} aria-label={t('ui.close')}>
            <X size={16} />
          </button>
        </div>
        {mode === 'draw' ? (
          <canvas
            ref={canvas}
            className="pe-sign-pad"
            onPointerDown={(e) => {
              drawing.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              const ctx = canvas.current.getContext('2d')
              ctx.strokeStyle = ink
              ctx.lineWidth = 2.6
              ctx.beginPath()
              ctx.moveTo(...pos(e))
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return
              const ctx = canvas.current.getContext('2d')
              ctx.lineTo(...pos(e))
              ctx.stroke()
              setEmpty(false)
            }}
            onPointerUp={() => (drawing.current = false)}
          />
        ) : (
          <input className="pe-sign-type" autoFocus placeholder={t('pe.namePh')} value={name} onChange={(e) => setName(e.target.value)} style={{ color: ink }} />
        )}
        <div className="pe-modal-foot">
          <div className="pe-swatches">
            {['#111111', '#1e3a8a', '#1d4ed8'].map((c) => (
              <button key={c} className={`pe-swatch ${ink === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setInk(c)} aria-label={c} />
            ))}
          </div>
          {mode === 'draw' && (
            <button
              className="fs-btn ghost"
              onClick={() => {
                const c = canvas.current
                c.getContext('2d').clearRect(0, 0, c.width, c.height)
                setEmpty(true)
              }}
            >
              {t('hx.clear')}
            </button>
          )}
          <button className="fs-btn dark" disabled={mode === 'draw' ? empty : !name.trim()} onClick={finish}>
            {t('pe.placeSign')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────── One page ───────── */

function PageView({ source, src, info, zoom, plan, anns, tool, style, selected, editingId, onSelect, onCommit, onLive, onEditText, onFinishEdit, registerEditor, textRuns, pics, onTakeImage, loadText, placing, onPlace, hits }) {
  const canvas = useRef(null)
  const wrap = useRef(null)
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState(null)
  const drag = useRef(null)
  const W = info.width
  const H = info.height

  useEffect(() => {
    const el = wrap.current
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const job = renderSource(source, canvas.current, zoom * dpr, info)
    return () => job.cancel()
  }, [source, info, zoom, visible])

  useEffect(() => {
    // the PDF's own text and images are editable with the select tool as well as the edit tool
    if (visible && (tool === 'edit' || tool === 'select')) loadText(src)
  }, [visible, tool, src, loadText])

  const pt = (e) => {
    const r = wrap.current.getBoundingClientRect()
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]
  }

  function down(e) {
    if (e.button !== 0 || tool === 'hand') return
    const [x, y] = pt(e)
    if (placing) {
      onPlace(src, x, y)
      return
    }
    if (tool === 'text') {
      e.preventDefault()
      onCommit(src, (list) => [...list, { id: uid(), type: 'text', x, y: y - style.size * 0.6, text: '', size: style.size, color: style.color, font: style.font, bold: style.bold, italic: style.italic, align: style.align, opacity: style.opacity, isNew: true }], { editLast: true })
      return
    }
    if (tool === 'note') {
      // the new note's box takes focus now; without this the compatibility mousedown that
      // follows would move focus back to the page
      e.preventDefault()
      e.stopPropagation()
      onCommit(src, (list) => [...list, { id: uid(), type: 'note', x: x - 11, y: y - 11, text: '', color: style.note }], { editLast: true })
      return
    }
    if (DRAW_TOOLS.has(tool)) {
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { kind: 'draw', x0: x, y0: y }
      setDraft(tool === 'ink' ? { type: 'ink', points: [[x, y]] } : { type: tool, x0: x, y0: y, x1: x, y1: y })
      return
    }
    if (tool === 'select') onSelect(null)
  }

  function move(e) {
    if (!drag.current) return
    const [x, y] = pt(e)
    if (drag.current.kind === 'draw') {
      setDraft((d) => (d.type === 'ink' ? { ...d, points: [...d.points, [x, y]] } : { ...d, x1: x, y1: y }))
    } else if (drag.current.kind === 'move' || drag.current.kind === 'resize') {
      const { id, start, orig } = drag.current
      const dx = x - start[0]
      const dy = y - start[1]
      onLive(src, id, (a) => {
        if (drag.current.kind === 'resize') {
          const w = Math.max(8, orig.w + dx)
          const h = a.type === 'image' ? w * (orig.h / orig.w) : Math.max(6, orig.h + dy)
          return { ...a, w, h }
        }
        if (a.type === 'line' || a.type === 'arrow') return { ...a, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy }
        if (a.type === 'ink') return { ...a, points: orig.points.map(([px, py]) => [px + dx, py + dy]) }
        return { ...a, x: orig.x + dx, y: orig.y + dy }
      })
    }
  }

  function up() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.kind === 'draw' && draft) {
      let a = null
      if (draft.type === 'ink') {
        if (draft.points.length > 1) a = { type: 'ink', points: draft.points, color: style.color, width: style.stroke, opacity: style.opacity }
      } else {
        const x = Math.min(draft.x0, draft.x1)
        const y = Math.min(draft.y0, draft.y1)
        const w = Math.abs(draft.x1 - draft.x0)
        const h = Math.abs(draft.y1 - draft.y0)
        if (draft.type === 'line' || draft.type === 'arrow') {
          if (Math.hypot(w, h) > 4) a = { type: draft.type, x1: draft.x0, y1: draft.y0, x2: draft.x1, y2: draft.y1, color: style.color, width: style.stroke, opacity: style.opacity }
        } else if (w > 3 && h > 3) {
          a =
            draft.type === 'highlight'
              ? { type: 'highlight', x, y, w, h, color: style.hl }
              : draft.type === 'whiteout'
                ? { type: 'whiteout', x, y, w, h, color: '#ffffff' }
                : draft.type === 'link'
                  ? { type: 'link', x, y, w, h, url: '' }
                  : { type: draft.type, x, y, w, h, stroke: style.color, fill: style.fill ? style.color : null, width: style.stroke, opacity: style.opacity }
        }
      }
      setDraft(null)
      if (a) onCommit(src, (list) => [...list, { id: uid(), ...a }], { editLast: a.type === 'link' })
    } else if (d.kind === 'move' || d.kind === 'resize') onCommit(src, (list) => list, { snapshotFrom: d.before })
  }

  function startMove(e, a, kind = 'move') {
    if (tool !== 'select' && !(tool === 'edit' && a.type === 'image')) {
      // clicking existing text with the text/edit tool re-opens it instead of adding a new box
      if ((tool === 'text' && a.type === 'text') || (tool === 'edit' && a.type === 'replace') || a.type === 'note') e.stopPropagation()
      if (a.type === 'note' && tool !== 'hand') onSelect({ page: src, id: a.id })
      return
    }
    e.stopPropagation()
    onSelect({ page: src, id: a.id })
    if (a.type === 'replace') return // edited PDF text stays where the original was
    e.currentTarget.closest('.pe-overlay').setPointerCapture(e.pointerId)
    drag.current = { kind, id: a.id, start: pt(e), orig: structuredClone(a), before: true }
  }

  /** Press on an image of the PDF: it becomes a movable image annotation, grabbed right away. */
  function grabPic(e, pic) {
    if (e.button !== 0) return
    e.stopPropagation()
    const a = onTakeImage(src, pic, canvas.current)
    e.currentTarget.closest('.pe-overlay').setPointerCapture(e.pointerId)
    drag.current = { kind: 'move', id: a.id, start: pt(e), orig: structuredClone(a), before: true }
  }
  const editable = (tool === 'edit' || tool === 'select') && !placing

  const z = (v) => v * zoom
  const sel = (a) => selected?.page === src && selected?.id === a.id

  return (
    <div className="pe-page-wrap">
      <div ref={wrap} className={`pe-page tool-${tool} ${placing ? 'placing' : ''}`} style={{ width: z(W), height: z(H) }}>
        <canvas ref={canvas} style={{ width: z(W), height: z(H) }} />
        {plan.rotate ? <span className="pe-rot-badge">{t('pe.rotBadge', { deg: plan.rotate })}</span> : null}

        <div className="pe-overlay" onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          {/* where a PDF image was taken from: covered, as it will be in the saved file */}
          {anns.map((a) => (a.orig && !untouched(a) ? <div key={`c${a.id}`} className="pe-cover" style={{ left: z(a.orig.x), top: z(a.orig.y), width: z(a.orig.w), height: z(a.orig.h), background: a.orig.cover }} /> : null))}

          {/* images the PDF paints (select / edit): press to pick one up */}
          {editable &&
            pics?.map((p) =>
              anns.some((a) => a.imgId === p.id) ? null : (
                <div key={p.id} className="pe-pic" style={{ left: z(p.x), top: z(p.y), width: z(p.w), height: z(p.h) }} onPointerDown={(e) => grabPic(e, p)} title={t('pe.imgHint')} />
              ),
            )}

          {/* existing text runs (select / edit): click to edit in place */}
          {editable &&
            textRuns?.map((r) => {
              if (anns.some((a) => a.type === 'replace' && a.runId === r.id)) return null
              return (
                <button
                  key={r.id}
                  className="pe-run"
                  style={{ left: z(r.vx), top: z(r.vy), width: z(r.vw), height: z(r.vh) }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onEditText(src, r, canvas.current)}
                  title={t('pe.clickToEdit')}
                />
              )
            })}

          {anns.map((a) => {
            const common = { 'data-sel': sel(a) || undefined, onPointerDown: (e) => startMove(e, a) }
            switch (a.type) {
              case 'replace':
              case 'text': {
                const editing = editingId === a.id
                const st = {
                  left: z(a.type === 'replace' ? a.vx : a.x),
                  top: z(a.type === 'replace' ? a.vy : a.y),
                  fontSize: z(a.size),
                  color: a.color,
                  fontFamily: a.font === 'serif' ? "'Noto Serif', 'Times New Roman', serif" : "'Inter', 'Noto Sans', Arial, sans-serif",
                  fontWeight: a.bold ? 700 : 400,
                  fontStyle: a.italic ? 'italic' : 'normal',
                  textAlign: a.align ?? 'left',
                  opacity: a.opacity ?? 1,
                  background: a.type === 'replace' ? a.cover : undefined,
                  minWidth: a.type === 'replace' ? z(a.vw) : undefined,
                  minHeight: a.type === 'replace' ? z(a.vh) : undefined,
                }
                return (
                  <div key={a.id} className={`pe-ann pe-text ${a.type} ${editing ? 'editing' : ''}`} style={st} {...common} onDoubleClick={() => tool === 'select' && onEditText(src, a)}
                    onClick={() => !editing && ((tool === 'text' && a.type === 'text') || (tool === 'edit' && a.type === 'replace')) && onEditText(src, a)}
                  >
                    {editing ? (
                      <div
                        className="pe-text-input"
                        contentEditable
                        suppressContentEditableWarning
                        ref={(el) => {
                          if (el) registerEditor(el, src, a.id)
                          if (el && !el.dataset.init) {
                            el.dataset.init = '1'
                            el.innerText = a.text
                            el.focus()
                            const range = document.createRange()
                            range.selectNodeContents(el)
                            const s = window.getSelection()
                            s.removeAllRanges()
                            s.addRange(range)
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onBlur={onFinishEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') e.currentTarget.blur()
                          e.stopPropagation()
                        }}
                        data-placeholder={t('pe.typeText')}
                      />
                    ) : (
                      a.text || <span className="pe-ph">{t('pe.text')}</span>
                    )}
                    {sel(a) && !editing && <i className="pe-hint">{t('pe.dblEdit')}</i>}
                  </div>
                )
              }
              case 'highlight':
                return <div key={a.id} className="pe-ann pe-hl" style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h), background: a.color }} {...common} />
              case 'whiteout':
                return <div key={a.id} className="pe-ann pe-wo" style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h), background: a.color }} {...common} />
              case 'rect':
              case 'ellipse':
                return (
                  <div
                    key={a.id}
                    className="pe-ann pe-shape"
                    style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h), border: `${z(a.width)}px solid ${a.stroke}`, background: a.fill ?? 'transparent', borderRadius: a.type === 'ellipse' ? '50%' : 0, opacity: a.opacity ?? 1 }}
                    {...common}
                  >
                    {sel(a) && <span className="pe-resize" onPointerDown={(e) => startMove(e, a, 'resize')} />}
                  </div>
                )
              case 'image':
                return (
                  <div key={a.id} className="pe-ann pe-img" style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h), opacity: a.opacity ?? 1 }} {...common}>
                    <img src={a.src} alt="" draggable={false} />
                    {sel(a) && <span className="pe-resize" onPointerDown={(e) => startMove(e, a, 'resize')} />}
                  </div>
                )
              case 'link': {
                const open = sel(a) || editingId === a.id
                return (
                  <div key={a.id} className={`pe-ann pe-link ${a.url ? '' : 'empty'}`} style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h) }} {...common}>
                    <span className="pe-link-chip">
                      <LinkSimple size={11} weight="bold" /> {a.url ? a.url.replace(/^(https?:\/\/|mailto:|tel:)/i, '') : t('pe.linkEmpty')}
                    </span>
                    {sel(a) && <span className="pe-resize" onPointerDown={(e) => startMove(e, a, 'resize')} />}
                    {open && (
                      <div className="pe-pop" onPointerDown={(e) => e.stopPropagation()}>
                        <input
                          autoFocus={!a.url}
                          value={a.url}
                          placeholder={t('pe.linkPh')}
                          onChange={(e) => onLive(src, a.id, (x) => ({ ...x, url: e.target.value }))}
                          onBlur={(e) => {
                            onLive(src, a.id, (x) => ({ ...x, url: normUrl(e.target.value) }))
                            onCommit(src, (l) => l, { snapshotFrom: true })
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                          }}
                        />
                        {a.url && (
                          <a href={normUrl(a.url)} target="_blank" rel="noreferrer noopener" title={t('pe.linkOpen')}>
                            <ArrowSquareOut size={15} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              }
              case 'note': {
                const open = sel(a) || editingId === a.id
                return (
                  <div key={a.id} className={`pe-ann pe-note ${open ? 'open' : ''}`} style={{ left: z(a.x), top: z(a.y), '--note': a.color }} {...common}>
                    <span className="pe-note-ic">
                      <ChatCenteredText size={14} weight="fill" />
                    </span>
                    {open && (
                      <div className="pe-pop note" onPointerDown={(e) => e.stopPropagation()}>
                        <textarea
                          autoFocus={!a.text}
                          rows={3}
                          value={a.text}
                          placeholder={t('pe.notePh')}
                          onChange={(e) => onLive(src, a.id, (x) => ({ ...x, text: e.target.value }))}
                          onBlur={() => onCommit(src, (l) => l, { snapshotFrom: true })}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Escape') e.currentTarget.blur()
                          }}
                        />
                      </div>
                    )}
                    {!open && a.text && <span className="pe-note-peek">{a.text}</span>}
                  </div>
                )
              }
              default:
                return null
            }
          })}

          {/* vector annotations */}
          <svg className="pe-svg" width={z(W)} height={z(H)}>
            <defs>
              <marker id={`ah-${src}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
              </marker>
            </defs>
            {anns
              .filter((a) => a.type === 'line' || a.type === 'arrow' || a.type === 'ink')
              .map((a) =>
                a.type === 'ink' ? (
                  <polyline key={a.id} points={a.points.map(([x, y]) => `${z(x)},${z(y)}`).join(' ')} stroke={a.color} strokeWidth={z(a.width)} opacity={a.opacity ?? 1} className={`pe-vec ${sel(a) ? 'sel' : ''}`} onPointerDown={(e) => startMove(e, a)} />
                ) : (
                  <line key={a.id} x1={z(a.x1)} y1={z(a.y1)} x2={z(a.x2)} y2={z(a.y2)} stroke={a.color} strokeWidth={z(a.width)} opacity={a.opacity ?? 1} markerEnd={a.type === 'arrow' ? `url(#ah-${src})` : undefined} className={`pe-vec ${sel(a) ? 'sel' : ''}`} onPointerDown={(e) => startMove(e, a)} />
                ),
              )}
            {draft &&
              (draft.type === 'ink' ? (
                <polyline points={draft.points.map(([x, y]) => `${z(x)},${z(y)}`).join(' ')} stroke={style.color} strokeWidth={z(style.stroke)} className="pe-vec" />
              ) : draft.type === 'line' || draft.type === 'arrow' ? (
                <line x1={z(draft.x0)} y1={z(draft.y0)} x2={z(draft.x1)} y2={z(draft.y1)} stroke={style.color} strokeWidth={z(style.stroke)} markerEnd={draft.type === 'arrow' ? `url(#ah-${src})` : undefined} className="pe-vec" />
              ) : (
                <rect
                  x={z(Math.min(draft.x0, draft.x1))}
                  y={z(Math.min(draft.y0, draft.y1))}
                  width={z(Math.abs(draft.x1 - draft.x0))}
                  height={z(Math.abs(draft.y1 - draft.y0))}
                  rx={draft.type === 'ellipse' ? z(Math.abs(draft.x1 - draft.x0)) / 2 : 0}
                  className={`pe-draft ${draft.type}`}
                  style={draft.type === 'highlight' ? { fill: style.hl } : draft.type === 'whiteout' ? { fill: '#fff' } : draft.type === 'link' ? { stroke: '#2563eb', fill: 'rgba(37,99,235,.08)', strokeDasharray: '5 4' } : { stroke: style.color }}
                />
              ))}
          </svg>

          {/* search matches */}
          {hits?.map((h) => (
            <span key={h.i} className={`pe-hit ${h.on ? 'on' : ''}`} style={{ left: z(h.x), top: z(h.y), width: z(h.w), height: z(h.h) }} />
          ))}
        </div>
      </div>
      <span className="pe-page-no">{plan.n}</span>
    </div>
  )
}

/* ───────── Thumbnail ───────── */

function PageThumb({ source, info, width = 140 }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!source || !info) return
    let dead = false
    const c = document.createElement('canvas')
    const job = renderSource(source, c, width / info.width, info)
    job.promise.then(() => !dead && setUrl(c.toDataURL('image/jpeg', 0.8)))
    return () => {
      dead = true
      job.cancel()
    }
  }, [source, info, width])
  return url ? <img src={url} alt="" draggable={false} /> : <span className="pe-thumb-ph" style={info ? { aspectRatio: `${info.width} / ${info.height}` } : undefined} />
}

/** A labelled ribbon button: a tool (picked through onPick) or an action (onClick). */
function RibbonButton({ id, label, icon: Icon, onClick, onPick, on, disabled }) {
  return (
    <button className={`pe-rb ${on ? 'on' : ''}`} onClick={onClick ?? (() => onPick(id))} disabled={disabled} title={id ? tool$(id)?.label : label} aria-pressed={on ?? undefined}>
      <Icon size={21} weight={on ? 'duotone' : 'regular'} className={Icon === CircleNotch ? 'spin' : undefined} />
      <span>{label}</span>
    </button>
  )
}

/* ───────── Editor ───────── */

export default function PdfEditor({ file, notify, onClose, onReopen }) {
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState(null)
  const [infos, setInfos] = useState([])
  const [pages, setPages] = useState([])
  const [anns, setAnns] = useState({})
  const [tool, setTool] = useState('select')
  const [style, setStyle] = useState({ color: '#111111', size: 14, font: 'sans', bold: false, italic: false, stroke: 2, fill: false, hl: '#fde047', opacity: 1, align: 'left', note: '#facc15' })
  const [shape, setShape] = useState('rect') // the Shapes button remembers the last shape
  const [selected, setSelected] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [texts, setTexts] = useState({})
  const [pics, setPics] = useState({}) // images the PDF itself paints, per page src
  const [placing, setPlacing] = useState(null)
  const [signing, setSigning] = useState(false)
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)
  const [attempt, setAttempt] = useState(0) // bumps to open the PDF again after a failure
  const [current, setCurrent] = useState(0) // index in `pages` of the page in view
  const [managing, setManaging] = useState(false)
  const [busy, setBusy] = useState(null) // 'insert' | 'print' while a side task runs
  const [search, setSearch] = useState({ open: false, q: '', hits: [], at: 0, scanning: false })
  const [stampText, setStampText] = useState('')
  const [stampDate, setStampDate] = useState(true)
  const scroller = useRef(null)
  // page sources by src index: 0…n-1 are the document's own pages; later ones are inserted
  const sources = useRef([])
  const appended = useRef([]) // server `append` entries for src ≥ the document's page count
  const extraFiles = useRef([]) // ids of the files inserted pages come from (fileIds[1…])
  const insertAt = useRef(null)
  const insertInput = useRef(null)
  const pan = useRef(null)
  const imgInput = useRef(null)
  const swapInput = useRef(null)
  const dragFrom = useRef(null)
  const viewports = useRef({})
  const textLoading = useRef(new Map())
  const editor = useRef(null) // { el, src, id } of the in-place text being edited

  // load document
  useEffect(() => {
    let doc
    let dead = false
    ;(async () => {
      try {
        const lib = await loadPdfjs()
        doc = await lib.getDocument({ url: apiUrl(file.url), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', fontExtraProperties: true }).promise
        if (dead) return
        const list = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const vp = page.getViewport({ scale: 1 })
          viewports.current[i - 1] = vp
          list.push({ width: vp.width, height: vp.height })
        }
        sources.current = list.map((_, i) => ({ type: 'pdf', doc, n: i + 1 }))
        appended.current = []
        extraFiles.current = []
        setInfos(list)
        setPages(list.map((_, i) => ({ key: uid(), src: i, rotate: 0 })))
        setPdf(doc)
        const avail = (scroller.current?.clientWidth ?? 900) - 80
        setZoom(Math.max(0.5, Math.min(1.6, avail / Math.max(...list.map((p) => p.width)))))
      } catch (err) {
        if (dead) return
        console.error('PDF editor: open failed', err)
        setError(err?.name === 'PasswordException' ? { title: t('pe.locked'), locked: true } : { title: t('pe.openFailed'), text: t('pe.openFailedText') })
      }
    })()
    return () => {
      dead = true
      doc?.loadingTask?.destroy()
    }
  }, [file.url, attempt])

  // which page is in view (page indicator + highlighted thumbnail)
  useEffect(() => {
    const root = scroller.current
    if (!root || !pdf) return
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (best) setCurrent(Number(best.target.dataset.index))
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    )
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pdf, pages])

  const fitWidth = () => {
    const avail = (scroller.current?.clientWidth ?? 900) - 80
    const widest = Math.max(...pages.map((p) => (p.rotate % 180 ? infos[p.src]?.height : infos[p.src]?.width) ?? 600))
    setZoom(Math.max(0.4, Math.min(3, +(avail / widest).toFixed(2))))
  }
  const goTo = (i) => document.getElementById(`pe-p-${pages[i]?.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const snapshot = useCallback(() => ({ anns, pages }), [anns, pages])
  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-60), snapshot()])
    setFuture([])
  }, [snapshot])

  const commit = useCallback(
    (src, fn, opts = {}) => {
      if (!opts.snapshotFrom) pushHistory()
      setAnns((all) => {
        const next = fn(all[src] ?? [])
        if (opts.editLast) setEditingId(next.at(-1)?.id ?? null)
        return { ...all, [src]: next }
      })
    },
    [pushHistory],
  )
  const live = useCallback((src, id, fn) => setAnns((all) => ({ ...all, [src]: (all[src] ?? []).map((a) => (a.id === id ? fn(a) : a)) })), [])

  const startDragHistory = useRef(false)
  const onLive = useCallback(
    (src, id, fn) => {
      if (!startDragHistory.current) {
        startDragHistory.current = true
        pushHistory()
      }
      live(src, id, fn)
    },
    [live, pushHistory],
  )
  const onCommit = useCallback(
    (src, fn, opts) => {
      if (opts?.snapshotFrom) {
        startDragHistory.current = false
        return
      }
      commit(src, fn, opts)
    },
    [commit],
  )

  const undo = () => {
    if (!past.length) return
    setFuture((f) => [snapshot(), ...f])
    const prev = past.at(-1)
    setPast((p) => p.slice(0, -1))
    setAnns(prev.anns)
    setPages(prev.pages)
    setSelected(null)
  }
  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, snapshot()])
    const [n, ...rest] = future
    setFuture(rest)
    setAnns(n.anns)
    setPages(n.pages)
  }

  /** Text runs of a page (for "edit text" and search). Cached per page; [] for blank / image pages. */
  const loadText = useCallback(
    (src) => {
      const source = sources.current[src]
      if (!pdf || !source) return Promise.resolve([])
      if (textLoading.current.has(src)) return textLoading.current.get(src)
      const job = (async () => {
        if (source.type !== 'pdf') return []
        const lib = await loadPdfjs()
        const page = await source.doc.getPage(source.n)
        const opList = await page.getOperatorList() // also loads fonts → real names for bold/italic
        const vp = viewports.current[src]
        try {
          setPics((prev) => ({ ...prev, [src]: findImages(opList, lib.OPS, vp) }))
        } catch (err) {
          console.warn('PDF editor: images of page', src, err)
        }
        const tc = await page.getTextContent()
        const runs = groupText(tc.items, tc.styles, page.commonObjs).map((r) => {
          // viewport rect of the run: baseline box from slightly below baseline to the ascent
          const [x1, y1] = vp.convertToViewportPoint(r.x, r.y - r.size * 0.26)
          const [x2, y2] = vp.convertToViewportPoint(r.x + r.w, r.y + r.size * 0.96)
          return { ...r, vx: Math.min(x1, x2), vy: Math.min(y1, y2), vw: Math.abs(x2 - x1), vh: Math.abs(y2 - y1) }
        })
        setTexts((prev) => ({ ...prev, [src]: runs }))
        return runs
      })().catch((err) => {
        console.warn('PDF editor: text of page', src, err)
        textLoading.current.delete(src) // try again next time
        return []
      })
      textLoading.current.set(src, job)
      return job
    },
    [pdf],
  )

  const registerEditor = useCallback((el, src, id) => {
    editor.current = { el, src, id }
  }, [])

  /** Commit the in-place text being edited (on blur, tool change, save). Returns the next annotations. */
  const finishEditing = useCallback(
    (base) => {
      const cur = editor.current
      editor.current = null
      setEditingId(null)
      if (!cur) return base
      const text = cur.el.innerText.replace(/\n$/, '')
      if (base) {
        const next = applyEdit(base, cur.src, cur.id, text)
        setAnns(next)
        return next
      }
      setAnns((all) => applyEdit(all, cur.src, cur.id, text))
      return undefined
    },
    [],
  )
  const onFinishEdit = useCallback(() => finishEditing(), [finishEditing])

  /** Start editing: existing PDF text (run), or a text/replace annotation. */
  const onEditText = useCallback(
    (src, target, canvasEl) => {
      if (target.type) {
        setEditingId(target.id)
        return
      }
      // a run of original text → new replace annotation, edited in place
      const r = target
      const cover = canvasEl ? sampleCover(canvasEl, { x: r.vx, y: r.vy, w: r.vw, h: r.vh }, zoom) : '#ffffff'
      const a = { id: uid(), type: 'replace', runId: r.id, run: r, vx: r.vx, vy: r.vy, vw: r.vw, vh: r.vh, text: r.str, original: r.str, size: r.size, font: r.font, bold: r.bold, italic: r.italic, color: '#111111', cover, isNew: true }
      pushHistory()
      setAnns((all) => ({ ...all, [src]: [...(all[src] ?? []), a] }))
      setEditingId(a.id)
    },
    [zoom, pushHistory],
  )

  /**
   * An image the PDF itself paints becomes an image annotation the user can move, resize,
   * swap or delete; its old place is covered with the colour around it. Returns the annotation.
   */
  const takeImage = useCallback(
    (src, pic, canvasEl) => {
      const cover = canvasEl ? sampleCover(canvasEl, pic, zoom) : '#ffffff'
      const box = { x: pic.x, y: pic.y, w: pic.w, h: pic.h }
      // the cover reaches a little past the image, or its anti-aliased edge would stay as a hairline
      const orig = { x: pic.x - 0.75, y: pic.y - 0.75, w: pic.w + 1.5, h: pic.h + 1.5, cover }
      const a = { id: uid(), type: 'image', ...box, src: canvasEl ? cropCanvas(canvasEl, box, zoom) : '', opacity: 1, imgId: pic.id, name: pic.name, orig }
      pushHistory()
      startDragHistory.current = true // the drag that may follow belongs to this same step
      setAnns((all) => ({ ...all, [src]: [...(all[src] ?? []), a] }))
      setSelected({ page: src, id: a.id })
      // swap the screen crop for the image's own pixels (sharper, nothing drawn over it)
      pixelsOf(src, a).then((url) => url && setAnns((all) => ({ ...all, [src]: (all[src] ?? []).map((x) => (x.id === a.id && !x.swapped ? { ...x, src: url, hi: true } : x)) })))
      return a
    },
    [zoom, pushHistory],
  )

  /** Full-resolution pixels of a PDF image annotation (null when pdf.js no longer has them). */
  const pixelsOf = useCallback(async (src, a) => {
    const source = sources.current[src]
    if (source?.type !== 'pdf' || !a.name) return null
    try {
      return await imageUrl(await source.doc.getPage(source.n), a.name)
    } catch {
      return null
    }
  }, [])

  /** Before saving: PDF images that still show the screen crop get their own pixels. */
  async function sharpen(all) {
    let changed = false
    const next = { ...all }
    for (const [src, list] of Object.entries(all)) {
      next[src] = await Promise.all(
        list.map(async (a) => {
          if (a.type !== 'image' || !a.orig || a.hi || a.swapped || untouched(a)) return a
          const url = await pixelsOf(Number(src), a)
          if (!url) return a
          changed = true
          return { ...a, src: url, hi: true }
        }),
      )
    }
    if (!changed) return all
    setAnns(next)
    return next
  }

  /** Delete an annotation; a PDF image that was taken out leaves its covered place behind. */
  const removeAnn = useCallback(
    (page, id) => {
      commit(page, (list) =>
        list.flatMap((a) => {
          if (a.id !== id) return [a]
          if (a.type === 'image' && a.orig) return [{ id: uid(), type: 'whiteout', x: a.orig.x, y: a.orig.y, w: a.orig.w, h: a.orig.h, color: a.orig.cover, imgId: a.imgId }]
          return []
        }),
      )
      setSelected(null)
    },
    [commit],
  )

  /** Put another picture in the selected image's box (fitted inside it, centred). */
  function swapImage(fileObj) {
    const sel = selected
    if (!fileObj || !sel) return
    const url = URL.createObjectURL(fileObj)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 2000 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const data = c.toDataURL(/png|svg|webp|gif/.test(fileObj.type) ? 'image/png' : 'image/jpeg', 0.9)
      URL.revokeObjectURL(url)
      commit(sel.page, (list) =>
        list.map((a) => {
          if (a.id !== sel.id) return a
          const f = Math.min(a.w / c.width, a.h / c.height)
          const w = c.width * f
          const h = c.height * f
          return { ...a, src: data, swapped: true, x: a.x + (a.w - w) / 2, y: a.y + (a.h - h) / 2, w, h }
        }),
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      notify(t('pe.imgFailed'))
    }
    img.src = url
  }

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.isContentEditable || /input|textarea|select/i.test(e.target.tagName)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearch((s) => ({ ...s, open: true }))
      } else if (mod && e.key.toLowerCase() === 'd' && selected) {
        e.preventDefault()
        duplicateSelected()
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        print()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault()
        removeAnn(selected.page, selected.id)
      } else if (e.key === 'Escape') {
        setSelected(null)
        setPlacing(null)
        setTool('select')
      } else if (!mod && !e.altKey) {
        const hit = TOOLS.find((x) => x.key === e.key.toLowerCase())
        if (hit) pickTool(hit.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function pickTool(id) {
    setSelected(null)
    finishEditing()
    if (id === 'image') return imgInput.current?.click()
    if (id === 'sign') return setSigning(true)
    if (id === 'stamp') return placeStamp(STAMPS[0])
    if (SHAPES.includes(id)) setShape(id)
    setPlacing(null)
    setTool(id)
  }

  /** Pick a stamp: the next click on a page puts it there. */
  function placeStamp(preset) {
    const text = (preset ? t(`pe.stamp.${preset.id}`) : stampText.trim()).toUpperCase()
    if (!text) return
    const sub = stampDate ? formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    setPlacing({ ...stampImage(text, preset?.color ?? style.color, sub), kind: 'stamp' })
    setTool('select')
    notify(t('pe.clickStamp'))
  }

  function duplicateSelected() {
    if (!selected) return
    const a = anns[selected.page]?.find((x) => x.id === selected.id)
    if (!a || a.type === 'replace') return
    const d = 14
    const copy = structuredClone(a)
    copy.id = uid()
    delete copy.orig
    delete copy.imgId
    delete copy.name
    if ('x' in copy) {
      copy.x += d
      copy.y += d
    }
    if (copy.type === 'line' || copy.type === 'arrow') Object.assign(copy, { x1: a.x1 + d, y1: a.y1 + d, x2: a.x2 + d, y2: a.y2 + d })
    if (copy.type === 'ink') copy.points = a.points.map(([x, y]) => [x + d, y + d])
    commit(selected.page, (list) => [...list, copy])
    setSelected({ page: selected.page, id: copy.id })
  }

  /* ───── inserting pages ───── */

  /** Add page sources after the existing ones and put them into the plan at `at`. */
  function addSources(items, at) {
    if (!items.length) return
    pushHistory()
    const base = sources.current.length
    items.forEach((it, i) => {
      sources.current[base + i] = it.source
      viewports.current[base + i] = it.vp
      appended.current.push(it.append)
    })
    setInfos((prev) => {
      const next = [...prev]
      items.forEach((it, i) => (next[base + i] = it.info))
      return next
    })
    const fresh = items.map((_, i) => ({ key: uid(), src: base + i, rotate: 0 }))
    setPages((ps) => {
      const c = [...ps]
      c.splice(Math.min(at ?? c.length, c.length), 0, ...fresh)
      return c
    })
    setTimeout(() => document.getElementById(`pe-p-${fresh[0].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }

  function addBlank(at) {
    const near = pages[Math.max(0, (at ?? pages.length) - 1)]
    const size = near ? infos[near.src] : null
    const [w, h] = size ? [size.width, size.height] : A4
    addSources([{ source: { type: 'blank' }, info: { width: w, height: h }, vp: flatViewport(w, h), append: { type: 'blank', width: w, height: h } }], at)
  }

  function askFile(at) {
    insertAt.current = at
    insertInput.current?.click()
  }

  async function insertFiles(list) {
    const picked = [...list]
    if (!picked.length) return
    if (extraFiles.current.length + picked.length > 19) return notify(t('pe.tooManyFiles'))
    setBusy('insert')
    try {
      const records = await addLocalFiles(picked)
      const items = []
      for (const [k, rec] of records.entries()) {
        const fileIdx = extraFiles.current.push(rec.id) // fileIds[0] is the document itself
        if (rec.kind === 'pdf') {
          const lib = await loadPdfjs()
          const doc = await lib.getDocument({ url: apiUrl(rec.url), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' }).promise
          for (let n = 1; n <= doc.numPages; n++) {
            const vp = (await doc.getPage(n)).getViewport({ scale: 1 })
            items.push({ source: { type: 'pdf', doc, n }, info: { width: vp.width, height: vp.height }, vp, append: { type: 'file', file: fileIdx, page: n - 1 } })
          }
        } else if (rec.kind === 'image') {
          const img = await loadImage(picked[k])
          const [w, h] = imagePageSize(img.naturalWidth, img.naturalHeight)
          items.push({ source: { type: 'image', img, box: imageBox(img.naturalWidth, img.naturalHeight, w, h) }, info: { width: w, height: h }, vp: flatViewport(w, h), append: { type: 'file', file: fileIdx, page: 0 } })
        } else {
          extraFiles.current.pop()
          notify(t('pe.insertFailed'))
        }
      }
      addSources(items, insertAt.current)
      if (items.length) notify(t('pe.inserted', { n: items.length }))
    } catch (err) {
      notify(err?.name === 'PasswordException' ? t('pe.locked') : err?.message || t('pe.insertFailed'))
    } finally {
      setBusy(null)
    }
  }

  /* ───── search ───── */

  useEffect(() => {
    const q = search.q.trim().toLowerCase()
    if (!search.open || !pdf || q.length < 2) {
      setSearch((s) => (s.hits.length || s.scanning ? { ...s, hits: [], at: 0, scanning: false } : s))
      return
    }
    let dead = false
    const timer = setTimeout(async () => {
      setSearch((s) => ({ ...s, scanning: true }))
      const hits = []
      const seen = new Set()
      for (const p of pages) {
        if (seen.has(p.src)) continue
        seen.add(p.src)
        const runs = await loadText(p.src)
        for (const r of runs) {
          const low = r.str.toLowerCase()
          for (let i = low.indexOf(q); i !== -1; i = low.indexOf(q, i + q.length)) {
            hits.push({ i: hits.length, src: p.src, x: r.vx + (r.vw * i) / r.str.length, y: r.vy, w: Math.max(4, (r.vw * q.length) / r.str.length), h: r.vh })
          }
        }
      }
      if (!dead) setSearch((s) => ({ ...s, hits, at: 0, scanning: false }))
    }, 250)
    return () => {
      dead = true
      clearTimeout(timer)
    }
  }, [search.q, search.open, pdf, pages, loadText])

  const showHit = (k) => {
    const hit = search.hits[k]
    if (!hit) return
    setSearch((s) => ({ ...s, at: k }))
    const p = pages.find((x) => x.src === hit.src)
    const el = p && document.getElementById(`pe-p-${p.key}`)
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop + hit.y * zoom - scroller.current.clientHeight / 3, behavior: 'smooth' })
  }
  useEffect(() => {
    if (search.hits.length) showHit(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.hits])
  const hitsBySrc = useMemo(() => {
    const m = {}
    search.hits.forEach((h, k) => (m[h.src] ??= []).push({ ...h, on: k === search.at }))
    return m
  }, [search.hits, search.at])

  async function chooseImage(fileObj) {
    if (!fileObj) return
    const url = URL.createObjectURL(fileObj)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const png = /png|svg|webp|gif/.test(fileObj.type)
      setPlacing({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w: c.width, h: c.height })
      setTool('select')
      notify(t('pe.clickImage'))
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  function place(src, x, y) {
    const w = Math.min(220, placing.w * 0.5)
    const h = w * (placing.h / placing.w)
    commit(src, (list) => [...list, { id: uid(), type: 'image', x: x - w / 2, y: y - h / 2, w, h, src: placing.src, opacity: placing.kind === 'stamp' ? 0.92 : style.opacity }])
    setPlacing(null)
  }

  // apply style changes to the selected annotation too
  function setStyleProp(patch) {
    setStyle((s) => ({ ...s, ...patch }))
    if (!selected) return
    commit(selected.page, (list) =>
      list.map((a) => {
        if (a.id !== selected.id) return a
        const n = { ...a }
        if ('color' in patch) {
          if (a.type === 'rect' || a.type === 'ellipse') {
            n.stroke = patch.color
            if (a.fill) n.fill = patch.color
          } else if (a.type !== 'highlight' && a.type !== 'whiteout' && a.type !== 'image') n.color = patch.color
        }
        if ('hl' in patch && a.type === 'highlight') n.color = patch.hl
        if ('size' in patch && (a.type === 'text' || a.type === 'replace')) n.size = patch.size
        for (const k of ['font', 'bold', 'italic']) if (k in patch && (a.type === 'text' || a.type === 'replace')) n[k] = patch[k]
        if ('stroke' in patch && 'width' in a) n.width = patch.stroke
        if ('fill' in patch && (a.type === 'rect' || a.type === 'ellipse')) n.fill = patch.fill ? (a.stroke ?? style.color) : null
        if ('opacity' in patch && !['highlight', 'whiteout', 'link', 'note', 'replace'].includes(a.type)) n.opacity = patch.opacity
        if ('align' in patch && a.type === 'text') n.align = patch.align
        if ('note' in patch && a.type === 'note') n.color = patch.note
        return n
      }),
    )
  }

  /* pages panel */
  const rotatePage = (key, d) => {
    pushHistory()
    setPages((ps) => ps.map((p) => (p.key === key ? { ...p, rotate: (((p.rotate + d) % 360) + 360) % 360 } : p)))
  }
  const deletePage = (key) => {
    if (pages.length === 1) return notify(t('pe.lastPage'))
    pushHistory()
    setPages((ps) => ps.filter((p) => p.key !== key))
  }
  const duplicatePage = (key) => {
    pushHistory()
    setPages((ps) => {
      const i = ps.findIndex((p) => p.key === key)
      const c = [...ps]
      c.splice(i + 1, 0, { ...ps[i], key: uid() })
      return c
    })
  }
  const movePage = (from, to) => {
    if (from === null || from === to) return
    pushHistory()
    setPages((ps) => {
      const c = [...ps]
      const [m] = c.splice(from, 1)
      c.splice(to, 0, m)
      return c
    })
  }

  /* save */
  const toOps = (all) => {
    const ops = []
    for (const [srcStr, list] of Object.entries(all)) {
      const src = Number(srcStr)
      const vp = viewports.current[src]
      const P = (x, y) => vp.convertToPdfPoint(x, y)
      const R = (x, y, w, h) => {
        const [ax, ay] = P(x, y)
        const [bx, by] = P(x + w, y + h)
        return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)]
      }
      // covers for moved PDF images go first, under everything else added on the page
      for (const a of list) if (a.type === 'image' && a.orig && !untouched(a)) ops.push({ type: 'whiteout', page: src, rect: R(a.orig.x, a.orig.y, a.orig.w, a.orig.h), color: a.orig.cover })
      for (const a of list) {
        switch (a.type) {
          case 'replace': {
            if (a.text === a.original) break
            ops.push({ type: 'replace', page: src, rect: R(a.vx - 1, a.vy - 1, a.vw + 2, a.vh + 2), x: a.run.x, y: a.run.y, angle: 0, text: a.text, size: a.size, font: a.font, bold: a.bold, italic: a.italic, color: a.color, cover: a.cover })
            break
          }
          case 'text': {
            if (!a.text.trim()) break
            const [x, y] = P(a.x, a.y + a.size * 0.99)
            ops.push({ type: 'text', page: src, x, y, text: a.text, size: a.size, font: a.font, bold: a.bold, italic: a.italic, color: a.color, lineHeight: 1.2, align: a.align ?? 'left', opacity: a.opacity ?? 1 })
            break
          }
          case 'highlight':
            ops.push({ type: 'highlight', page: src, rect: R(a.x, a.y, a.w, a.h), color: a.color, opacity: 0.45 })
            break
          case 'whiteout':
            ops.push({ type: 'whiteout', page: src, rect: R(a.x, a.y, a.w, a.h), color: a.color })
            break
          case 'rect':
          case 'ellipse':
            ops.push({ type: a.type, page: src, rect: R(a.x, a.y, a.w, a.h), stroke: a.stroke, fill: a.fill, strokeWidth: a.width, opacity: a.opacity ?? 1 })
            break
          case 'line':
          case 'arrow':
            ops.push({ type: 'line', page: src, from: P(a.x1, a.y1), to: P(a.x2, a.y2), color: a.color, width: a.width, arrow: a.type === 'arrow', opacity: a.opacity ?? 1 })
            break
          case 'ink':
            ops.push({ type: 'ink', page: src, points: a.points.map(([x, y]) => P(x, y)), color: a.color, width: a.width, opacity: a.opacity ?? 1 })
            break
          case 'image':
            if (untouched(a)) break // a PDF image picked up but left as it was
            ops.push({ type: 'image', page: src, rect: R(a.x, a.y, a.w, a.h), src: a.src, opacity: a.opacity ?? 1 })
            break
          case 'link': {
            const url = normUrl(a.url ?? '')
            if (url) ops.push({ type: 'link', page: src, rect: R(a.x, a.y, a.w, a.h), url })
            break
          }
          case 'note': {
            if (!a.text.trim()) break
            const [x, y] = P(a.x, a.y)
            ops.push({ type: 'note', page: src, x, y, text: a.text, color: a.color })
            break
          }
        }
      }
    }
    return ops
  }

  /** The pdf-edit job for the current state, or null when nothing changed. */
  async function payload() {
    const latest = await sharpen(finishEditing(anns) ?? anns)
    const operations = toOps(latest)
    const own = sources.current.length - appended.current.length
    const planChanged = appended.current.length > 0 || pages.length !== own || pages.some((p, i) => p.src !== i || p.rotate)
    if (!operations.length && !planChanged) return null
    return {
      fileIds: [file.id, ...extraFiles.current],
      options: {
        operations,
        ...(appended.current.length ? { append: appended.current } : {}),
        ...(planChanged ? { pages: pages.map((p) => ({ src: p.src, rotate: p.rotate })) } : {}),
      },
    }
  }

  async function save() {
    const job = await payload()
    if (!job) return notify(t('pe.noChanges'))
    setSaving({ progress: 0, stage: t('pe.sending') })
    try {
      const done = await runTool('pdf-edit', job.fileIds, job.options, { onUpdate: (j) => setSaving({ progress: j.progress, stage: j.stage }) })
      const out = done.outputs[0]
      setSaved(out)
      downloadFile(out)
    } catch (err) {
      notify(err.message)
    } finally {
      setSaving(null)
    }
  }

  /** Print what you see: the original when nothing changed, otherwise a freshly built copy. */
  async function print() {
    if (!pdf || busy) return
    setBusy('print')
    try {
      const job = await payload()
      const target = job ? (await runTool('pdf-edit', job.fileIds, job.options)).outputs[0] : file
      printBlob(await fetchFile(target))
    } catch (err) {
      notify(err.message)
    } finally {
      setBusy(null)
    }
  }

  /* hand tool: drag the page area to scroll */
  const panDown = (e) => {
    if (tool !== 'hand' || e.button !== 0) return
    const el = scroller.current
    pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    el.setPointerCapture(e.pointerId)
    el.classList.add('panning')
  }
  const panMove = (e) => {
    const p = pan.current
    if (!p) return
    scroller.current.scrollTo({ left: p.left - (e.clientX - p.x), top: p.top - (e.clientY - p.y), behavior: 'instant' })
  }
  const panUp = () => {
    pan.current = null
    scroller.current?.classList.remove('panning')
  }

  const count = useMemo(() => Object.values(anns).reduce((n, l) => n + l.filter((a) => !(a.type === 'replace' && a.text === a.original) && !untouched(a)).length, 0), [anns]) + appended.current.length
  const selAnn = selected ? anns[selected.page]?.find((a) => a.id === selected.id) : null
  const textual = tool === 'text' || selAnn?.type === 'text' || selAnn?.type === 'replace'
  const drawing = ['rect', 'ellipse', 'arrow', 'line', 'ink'].includes(tool) || ['rect', 'ellipse', 'line', 'arrow', 'ink'].includes(selAnn?.type)
  const fadable = textual || drawing || selAnn?.type === 'image' || selAnn?.type === 'text'
  const noting = tool === 'note' || selAnn?.type === 'note'
  const activeId = placing ? (placing.kind === 'stamp' ? 'stamp' : placing.kind === 'sign' ? 'sign' : 'image') : tool

  const ShapeIcon = tool$(shape).icon
  const ADD_MENU = (at) => (close) => (
    <>
      <button className="menu-item" onClick={() => { close(); addBlank(at) }}>
        <span><FilePlus size={17} weight="duotone" /> {t('pe.addBlank')}</span>
      </button>
      <button className="menu-item" onClick={() => { close(); askFile(at) }}>
        <span><FileIcon size={17} weight="duotone" /> {t('pe.addFile')}</span>
      </button>
    </>
  )

  return (
    <div className={`pe tool-is-${tool}`} role="dialog" aria-modal="true" aria-label={t('pe.title')}>
      {/* ───── ribbon ───── */}
      <header className="pe-ribbon">
        <button className="pe-close" onClick={() => (count && !saved ? window.confirm(t('pe.unsaved')) && onClose() : onClose())} aria-label={t('ui.close')} title={t('ui.close')}>
          <X size={18} />
        </button>
        <div className="pe-rb-group">
          <RibbonButton onPick={pickTool} label={t('pe.rb.undo')} icon={ArrowUUpLeft} onClick={undo} disabled={!past.length} />
          <RibbonButton onPick={pickTool} label={t('pe.rb.redo')} icon={ArrowUUpRight} onClick={redo} disabled={!future.length} />
        </div>
        <div className="pe-rb-group">
          <RibbonButton onPick={pickTool} id="select" label={t('pe.rb.select')} icon={Cursor} on={activeId === 'select'} />
          <RibbonButton onPick={pickTool} id="hand" label={t('pe.rb.hand')} icon={Hand} on={activeId === 'hand'} />
        </div>
        <div className="pe-rb-group">
          <RibbonButton onPick={pickTool} id="text" label={t('pe.rb.text')} icon={TextT} on={activeId === 'text'} />
          <RibbonButton onPick={pickTool} id="edit" label={t('pe.rb.edit')} icon={CursorText} on={activeId === 'edit'} />
          <RibbonButton onPick={pickTool} id="highlight" label={t('pe.rb.highlight')} icon={HighlighterCircle} on={activeId === 'highlight'} />
          <RibbonButton onPick={pickTool} id="whiteout" label={t('pe.rb.whiteout')} icon={Eraser} on={activeId === 'whiteout'} />
        </div>
        <div className="pe-rb-group">
          <RibbonButton onPick={pickTool} id="ink" label={t('pe.rb.draw')} icon={PenNib} on={activeId === 'ink'} />
          <div className="pe-rb-split">
            <RibbonButton onPick={pickTool} id={shape} label={t('pe.rb.shapes')} icon={ShapeIcon} on={SHAPES.includes(activeId)} />
            <Dropdown
              className="pe-menu"
              button={({ toggle, open }) => (
                <button className={`pe-rb-caret ${open ? 'open' : ''}`} onClick={toggle} aria-label={t('pe.rb.shapes')}>
                  <CaretDown size={11} weight="bold" />
                </button>
              )}
            >
              {(close) =>
                SHAPES.map((id) => {
                  const tl = tool$(id)
                  return (
                    <button key={id} className={`menu-item ${tool === id ? 'on' : ''}`} onClick={() => { close(); pickTool(id) }}>
                      <span><tl.icon size={17} /> {toolName(tl)}</span>
                      <kbd className="pe-kbd">{tl.key.toUpperCase()}</kbd>
                    </button>
                  )
                })
              }
            </Dropdown>
          </div>
        </div>
        <div className="pe-rb-group">
          <RibbonButton onPick={pickTool} id="image" label={t('pe.rb.image')} icon={ImageIcon} on={activeId === 'image'} />
          <RibbonButton onPick={pickTool} id="sign" label={t('pe.rb.sign')} icon={Signature} on={activeId === 'sign'} />
          <Dropdown
            className="pe-menu pe-stamps"
            button={({ toggle }) => <RibbonButton onPick={pickTool} label={t('pe.rb.stamp')} icon={Stamp} on={activeId === 'stamp'} onClick={toggle} />}
          >
            {(close) => (
              <>
                <div className="pop-label">{t('pe.stamps')}</div>
                <div className="pe-stamp-grid">
                  {STAMPS.map((st) => (
                    <button key={st.id} className="pe-stamp-btn" style={{ '--c': st.color }} onClick={() => { close(); placeStamp(st) }}>
                      {t(`pe.stamp.${st.id}`)}
                    </button>
                  ))}
                </div>
                <form className="pe-stamp-own" onSubmit={(e) => { e.preventDefault(); close(); placeStamp(null) }}>
                  <input value={stampText} onChange={(e) => setStampText(e.target.value)} placeholder={t('pe.stampOwn')} maxLength={28} />
                  <button className="fs-btn dark" disabled={!stampText.trim()}>{t('pe.stampPut')}</button>
                </form>
                <label className="pe-check">
                  <input type="checkbox" checked={stampDate} onChange={(e) => setStampDate(e.target.checked)} /> {t('pe.stampDate')}
                </label>
              </>
            )}
          </Dropdown>
        </div>
        <div className="pe-rb-group">
          <RibbonButton onPick={pickTool} id="link" label={t('pe.rb.link')} icon={LinkSimple} on={activeId === 'link'} />
          <RibbonButton onPick={pickTool} id="note" label={t('pe.rb.note')} icon={ChatCenteredText} on={activeId === 'note'} />
        </div>

        <div className="pe-rb-right">
          <RibbonButton onPick={pickTool} label={t('pe.rb.pages')} icon={SquaresFour} onClick={() => setManaging(true)} disabled={!pdf} />
          <RibbonButton onPick={pickTool} label={t('pe.rb.search')} icon={MagnifyingGlass} on={search.open} onClick={() => setSearch((s) => ({ ...s, open: !s.open }))} disabled={!pdf} />
          <RibbonButton onPick={pickTool} label={t('pe.rb.print')} icon={busy === 'print' ? CircleNotch : Printer} onClick={print} disabled={!pdf || Boolean(busy)} />
          <button className={`fs-btn dark pe-save ${count > 0 ? 'ready' : ''}`} onClick={save} disabled={!pdf || saving}>
            {saving ? <CircleNotch size={16} className="spin" /> : <FloppyDisk size={16} weight="bold" />} {saving ? `${saving.progress ?? 0}%` : t('pe.save')}
          </button>
        </div>
      </header>

      {/* ───── contextual properties ───── */}
      <div className="pe-props">
        {(() => {
          const cur = tool$(activeId) ?? TOOLS[0]
          return (
            <span className="pe-current">
              <cur.icon size={15} weight="bold" /> {toolName(cur)}
            </span>
          )
        })()}
        <span className="pe-sep" />
        {tool === 'highlight' || selAnn?.type === 'highlight' ? (
          <div className="pe-swatches">
            {HL_COLORS.map((c) => (
              <button key={c} className={`pe-swatch ${style.hl === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setStyleProp({ hl: c })} aria-label={c} />
            ))}
          </div>
        ) : noting ? (
          <div className="pe-swatches">
            {NOTE_COLORS.map((c) => (
              <button key={c} className={`pe-swatch ${(selAnn?.color ?? style.note) === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setStyleProp({ note: c })} aria-label={c} />
            ))}
          </div>
        ) : (
          <div className="pe-swatches">
            {COLORS.map((c) => (
              <button key={c} className={`pe-swatch ${style.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setStyleProp({ color: c })} aria-label={c} />
            ))}
            <label className="pe-swatch custom" style={{ '--c': style.color }} title={t('fs.otherColor')}>
              <input type="color" value={style.color} onChange={(e) => setStyleProp({ color: e.target.value })} />
            </label>
          </div>
        )}
        {textual && (
          <>
            <span className="pe-sep" />
            <select className="pe-select" value={selAnn?.font ?? style.font} onChange={(e) => setStyleProp({ font: e.target.value })} aria-label={t('pe.font')}>
              <option value="sans">Sans</option>
              <option value="serif">Serif (Times)</option>
            </select>
            <input className="pe-num" type="number" min={6} max={96} value={selAnn?.size ? Math.round(selAnn.size) : style.size} onChange={(e) => setStyleProp({ size: Number(e.target.value) || 12 })} title={t('pe.fontSize')} />
            <button className={`fs-ibtn ${(selAnn?.bold ?? style.bold) ? 'on' : ''}`} onClick={() => setStyleProp({ bold: !(selAnn?.bold ?? style.bold) })} title={t('pe.bold')}>
              <TextB size={17} weight="bold" />
            </button>
            <button className={`fs-ibtn ${(selAnn?.italic ?? style.italic) ? 'on' : ''}`} onClick={() => setStyleProp({ italic: !(selAnn?.italic ?? style.italic) })} title={t('pe.italic')}>
              <TextItalic size={17} />
            </button>
            {selAnn?.type !== 'replace' && (
              <>
                <span className="pe-sep" />
                {[['left', TextAlignLeft], ['center', TextAlignCenter], ['right', TextAlignRight]].map(([al, Icon]) => (
                  <button key={al} className={`fs-ibtn ${(selAnn?.align ?? style.align) === al ? 'on' : ''}`} onClick={() => setStyleProp({ align: al })} title={t(`pe.align.${al}`)}>
                    <Icon size={17} />
                  </button>
                ))}
              </>
            )}
          </>
        )}
        {drawing && (
          <>
            <span className="pe-sep" />
            <label className="pe-stroke">
              {t('pe.stroke')}
              <input type="range" min={0.5} max={12} step={0.5} value={selAnn?.width ?? style.stroke} onChange={(e) => setStyleProp({ stroke: Number(e.target.value) })} />
            </label>
            {(tool === 'rect' || tool === 'ellipse' || selAnn?.type === 'rect' || selAnn?.type === 'ellipse') && (
              <label className="pe-check">
                <input type="checkbox" checked={selAnn ? Boolean(selAnn.fill) : style.fill} onChange={(e) => setStyleProp({ fill: e.target.checked })} /> {t('pe.fill')}
              </label>
            )}
          </>
        )}
        {fadable && (
          <>
            <span className="pe-sep" />
            <label className="pe-stroke">
              {t('pe.opacity')}
              <input type="range" min={0.1} max={1} step={0.05} value={selAnn?.opacity ?? style.opacity} onChange={(e) => setStyleProp({ opacity: Number(e.target.value) })} />
              <em>{Math.round((selAnn?.opacity ?? style.opacity) * 100)}%</em>
            </label>
          </>
        )}
        {selAnn && (
          <>
            <span className="pe-sep" />
            {selAnn.type === 'image' && (
              <button className="fs-btn ghost" onClick={() => swapInput.current?.click()} title={t('pe.swapImage')}>
                <ImageSquare size={16} /> {t('pe.swapImage')}
              </button>
            )}
            {selAnn.type !== 'replace' && (
              <button className="fs-ibtn" onClick={duplicateSelected} title={t('pe.duplicate')}>
                <Copy size={17} />
              </button>
            )}
            <button
              className="fs-btn ghost danger"
              onClick={() => removeAnn(selected.page, selected.id)}
            >
              <Trash size={15} /> {t('ui.delete')}
            </button>
          </>
        )}
        <span className="pe-props-hint">
          {placing
            ? placing.kind === 'stamp'
              ? t('pe.clickStamp')
              : t('pe.hintImage')
            : ({ edit: t('pe.hintEdit'), text: t('pe.hintText'), select: t('pe.hintSelect'), hand: t('pe.hintHand'), link: t('pe.hintLink'), note: t('pe.hintNote') }[tool] ?? t('pe.hintDraw'))}
        </span>
      </div>

      <div className="pe-body">
        {/* ───── pages ───── */}
        <aside className="pe-thumbs">
          <div className="pe-doc">
            <b title={file.name}>{file.name}</b>
            <span>
              {t('pe.pagesCount', { n: pages.length })}
              {count > 0 && <em className="pe-count">{t('pe.changes', { n: count })}</em>}
            </span>
          </div>
          <Dropdown
            className="pe-menu"
            button={({ toggle }) => (
              <button className="pe-add" onClick={toggle} disabled={!pdf || busy === 'insert'}>
                {busy === 'insert' ? <CircleNotch size={16} className="spin" /> : <Plus size={16} weight="bold" />} {busy === 'insert' ? t('pe.inserting') : t('pe.addPages')}
                <CaretDown size={12} weight="bold" />
              </button>
            )}
          >
            {ADD_MENU(pages.length)}
          </Dropdown>
          {pages.map((p, i) => (
            <div key={p.key} className="pe-thumb-slot">
              <div
                className={`pe-thumb ${i === current ? 'on' : ''}`}
                draggable
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  movePage(dragFrom.current, i)
                  dragFrom.current = null
                }}
                onClick={() => goTo(i)}
              >
                <div className="pe-thumb-img" style={{ transform: `rotate(${p.rotate}deg)` }}>
                  <PageThumb source={sources.current[p.src]} info={infos[p.src]} />
                </div>
                <span className="pe-thumb-no">{i + 1}</span>
                <div className="pe-thumb-tools" onClick={(e) => e.stopPropagation()}>
                  <button title={t('pe.rotL')} onClick={() => rotatePage(p.key, -90)}>
                    <ArrowCounterClockwise size={13} weight="bold" />
                  </button>
                  <button title={t('pe.rotR')} onClick={() => rotatePage(p.key, 90)}>
                    <ArrowClockwise size={13} weight="bold" />
                  </button>
                  <button title={t('pe.dupPage')} onClick={() => duplicatePage(p.key)}>
                    <Copy size={13} weight="bold" />
                  </button>
                  <button title={t('pe.delPage')} className="danger" onClick={() => deletePage(p.key)}>
                    <Trash size={13} weight="bold" />
                  </button>
                </div>
              </div>
              <Dropdown
                className="pe-menu"
                button={({ toggle, open }) => (
                  <button className={`pe-gap ${open ? 'open' : ''}`} onClick={toggle} title={t('pe.insertHere')} aria-label={t('pe.insertHere')}>
                    <Plus size={12} weight="bold" />
                  </button>
                )}
              >
                {ADD_MENU(i + 1)}
              </Dropdown>
            </div>
          ))}
        </aside>

        <main
          className={`pe-scroll ${tool === 'hand' ? 'hand' : ''}`}
          ref={scroller}
          onPointerDown={(e) => {
            panDown(e)
            if (e.target === e.currentTarget) setSelected(null)
          }}
          onPointerMove={panMove}
          onPointerUp={panUp}
          onPointerCancel={panUp}
        >
          {error ? (
            <div className="pe-state error">
              <span className="pe-state-ic">
                <WarningCircle size={30} weight="duotone" />
              </span>
              <b>{error.title}</b>
              {error.text && <p>{error.text}</p>}
              <div className="tw-row">
                {!error.locked && (
                  <button className="fs-btn dark" onClick={() => { setError(null); setAttempt((n) => n + 1) }}>
                    <ArrowClockwise size={15} weight="bold" /> {t('pe.retry')}
                  </button>
                )}
                <button className="fs-btn" onClick={onClose}>
                  {t('ui.close')}
                </button>
              </div>
            </div>
          ) : !pdf ? (
            <div className="pe-state">
              <CircleNotch size={32} className="spin" />
              <b>{t('pe.opening')}</b>
            </div>
          ) : (
            pages.map((p, i) => (
              <div key={p.key} id={`pe-p-${p.key}`} data-index={i}>
                <PageView
                  source={sources.current[p.src]}
                  src={p.src}
                  info={infos[p.src]}
                  plan={{ ...p, n: i + 1 }}
                  zoom={zoom}
                  anns={anns[p.src] ?? []}
                  tool={tool}
                  style={style}
                  selected={selected}
                  editingId={editingId}
                  onSelect={(v) => {
                    setSelected(v)
                    if (!v || v.id !== editingId) setEditingId((id) => (editor.current ? id : null))
                  }}
                  onCommit={onCommit}
                  onLive={onLive}
                  onEditText={onEditText}
                  onFinishEdit={onFinishEdit}
                  registerEditor={registerEditor}
                  textRuns={texts[p.src]}
                  pics={pics[p.src]}
                  onTakeImage={takeImage}
                  loadText={loadText}
                  placing={placing}
                  onPlace={place}
                  hits={hitsBySrc[p.src]}
                />
              </div>
            ))
          )}
        </main>

        {/* ───── search ───── */}
        {search.open && (
          <div className="pe-search">
            <MagnifyingGlass size={16} />
            <input
              autoFocus
              value={search.q}
              placeholder={t('pe.searchPh')}
              onChange={(e) => setSearch((s) => ({ ...s, q: e.target.value }))}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && search.hits.length) showHit((search.at + (e.shiftKey ? -1 : 1) + search.hits.length) % search.hits.length)
                if (e.key === 'Escape') setSearch((s) => ({ ...s, open: false }))
              }}
            />
            <span className="pe-search-count">
              {search.scanning ? <CircleNotch size={14} className="spin" /> : search.q.trim().length >= 2 ? (search.hits.length ? t('pe.searchCount', { n: search.at + 1, total: search.hits.length }) : t('pe.searchNone')) : ''}
            </span>
            <button className="fs-ibtn" disabled={!search.hits.length} onClick={() => showHit((search.at - 1 + search.hits.length) % search.hits.length)} title={t('pe.prev')}>
              <CaretUp size={15} weight="bold" />
            </button>
            <button className="fs-ibtn" disabled={!search.hits.length} onClick={() => showHit((search.at + 1) % search.hits.length)} title={t('pe.next')}>
              <CaretDown size={15} weight="bold" />
            </button>
            <button className="fs-ibtn" onClick={() => setSearch((s) => ({ ...s, open: false }))} aria-label={t('ui.close')}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* ───── floating page / zoom bar ───── */}
        {pdf && (
          <div className="pe-float">
            <button onClick={() => goTo(Math.max(0, current - 1))} disabled={current === 0} title={t('pe.prevPage')}>
              <CaretUp size={16} weight="bold" />
            </button>
            <span className="pe-float-page">
              <input
                type="number"
                min={1}
                max={pages.length}
                value={current + 1}
                onChange={(e) => goTo(Math.min(pages.length, Math.max(1, Number(e.target.value) || 1)) - 1)}
                aria-label={t('pe.page')}
              />
              <span>/ {pages.length}</span>
            </span>
            <button onClick={() => goTo(Math.min(pages.length - 1, current + 1))} disabled={current >= pages.length - 1} title={t('pe.nextPage')}>
              <CaretDown size={16} weight="bold" />
            </button>
            <i />
            <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} title={t('pe.zoomOut')}>
              <MagnifyingGlassMinus size={17} />
            </button>
            <span className="pe-float-zoom">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} title={t('pe.zoomIn')}>
              <MagnifyingGlassPlus size={17} />
            </button>
            <i />
            <button className={tool === 'hand' ? 'on' : ''} onClick={() => pickTool(tool === 'hand' ? 'select' : 'hand')} title={tool$('hand').label}>
              <Hand size={17} />
            </button>
            <button onClick={fitWidth} title={t('pe.fitWidth')}>
              <ArrowsOutLineHorizontal size={17} />
            </button>
          </div>
        )}
      </div>

      {/* ───── manage pages ───── */}
      {managing && (
        <div className="pe-manage">
          <header>
            <div>
              <b>{t('pe.managePages')}</b>
              <span>{t('pe.manageHint')}</span>
            </div>
            <Dropdown
              align="right"
              className="pe-menu"
              button={({ toggle }) => (
                <button className="fs-btn" onClick={toggle} disabled={busy === 'insert'}>
                  {busy === 'insert' ? <CircleNotch size={15} className="spin" /> : <Plus size={15} weight="bold" />} {t('pe.addPages')}
                </button>
              )}
            >
              {ADD_MENU(pages.length)}
            </Dropdown>
            <button className="fs-btn dark" onClick={() => setManaging(false)}>
              {t('pe.done')}
            </button>
          </header>
          <div className="pe-manage-grid">
            {pages.map((p, i) => (
              <div
                key={p.key}
                className="pe-mcard"
                draggable
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  movePage(dragFrom.current, i)
                  dragFrom.current = null
                }}
              >
                <div className="pe-mcard-img" style={{ transform: `rotate(${p.rotate}deg)` }}>
                  <PageThumb source={sources.current[p.src]} info={infos[p.src]} width={220} />
                </div>
                <div className="pe-mcard-bar">
                  <span>{i + 1}</span>
                  <button title={t('pe.rotL')} onClick={() => rotatePage(p.key, -90)}>
                    <ArrowCounterClockwise size={15} weight="bold" />
                  </button>
                  <button title={t('pe.rotR')} onClick={() => rotatePage(p.key, 90)}>
                    <ArrowClockwise size={15} weight="bold" />
                  </button>
                  <button title={t('pe.dupPage')} onClick={() => duplicatePage(p.key)}>
                    <Copy size={15} weight="bold" />
                  </button>
                  <button title={t('pe.delPage')} className="danger" onClick={() => deletePage(p.key)}>
                    <Trash size={15} weight="bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input ref={swapInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { swapImage(e.target.files[0]); e.target.value = '' }} />
      <input ref={imgInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { chooseImage(e.target.files[0]); e.target.value = '' }} />
      <input ref={insertInput} type="file" accept=".pdf,image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { insertFiles(e.target.files); e.target.value = '' }} />
      {signing && (
        <SignatureModal
          onClose={() => setSigning(false)}
          onDone={(sig) => {
            setSigning(false)
            setPlacing({ ...sig, kind: 'sign' })
            setTool('select')
            notify(t('pe.clickSign'))
          }}
        />
      )}
      {(saving || busy === 'print') && (
        <div className="pe-saving">
          <CircleNotch size={22} className="spin" /> {saving ? `${saving.stage ?? t('pe.saving')} · ${saving.progress ?? 0}%` : t('pe.printPrep')}
        </div>
      )}
      {saved && (
        <div className="pe-modal-wrap">
          <div className="pe-modal pe-done">
            <span className="tw-check">
              <CheckCircle size={34} weight="fill" />
            </span>
            <h4>{t('pe.saved')}</h4>
            <p>{t('pe.savedText')}</p>
            <div className="tw-row">
              <button className="fs-btn" onClick={() => downloadFile(saved)}>
                <DownloadSimple size={16} /> {t('pe.redownload')}
              </button>
              <button className="fs-btn dark" onClick={() => onReopen(saved)}>
                <NotePencil size={16} /> {t('pe.continue')}
              </button>
            </div>
            <button className="fs-btn ghost" onClick={onClose}>
              {t('ui.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
