// PDF editor. Pages render with pdf.js; edits live in an overlay (in page units at
// scale 1) and are sent to the server as pdf-edit operations in PDF user space.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, ArrowUUpLeft, ArrowUUpRight, MagnifyingGlassMinus, MagnifyingGlassPlus, FloppyDisk, Cursor, CursorText, TextT, HighlighterCircle,
  Eraser, Rectangle, Circle, ArrowUpRight, LineSegment, PenNib, Image as ImageIcon, Signature, ArrowClockwise, ArrowCounterClockwise,
  Trash, TextB, TextItalic, CircleNotch, CheckCircle, DownloadSimple, NotePencil, WarningCircle, ArrowsOutLineHorizontal,
} from '@phosphor-icons/react'
import { apiUrl, downloadFile, runTool } from '../api.js'
import { t } from '../i18n/index.js'

let pdfjsPromise
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjsPromise
}

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
]
/** A tool's name without the "(R)" shortcut its label carries (shown separately as a key). */
const toolName = (tl) => tl.label.replace(/\s*\([^)]*\)\s*$/, '')
const COLORS = ['#111111', '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff']
const HL_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74']
const uid = () => Math.random().toString(36).slice(2, 10)
const DRAW_TOOLS = new Set(['highlight', 'whiteout', 'rect', 'ellipse', 'arrow', 'line', 'ink'])

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

function PageView({ pdf, src, info, zoom, plan, anns, tool, style, selected, editingId, onSelect, onCommit, onLive, onEditText, onFinishEdit, registerEditor, textRuns, loadText, placing, onPlace }) {
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
    let task
    let dead = false
    pdf.getPage(src + 1).then((page) => {
      if (dead) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = page.getViewport({ scale: zoom * dpr })
      const c = canvas.current
      c.width = Math.round(vp.width)
      c.height = Math.round(vp.height)
      task = page.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c })
      task.promise.catch(() => {})
    })
    return () => {
      dead = true
      task?.cancel()
    }
  }, [pdf, src, zoom, visible])

  useEffect(() => {
    if (visible && tool === 'edit') loadText(src)
  }, [visible, tool, src, loadText])

  const pt = (e) => {
    const r = wrap.current.getBoundingClientRect()
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]
  }

  function down(e) {
    if (e.button !== 0) return
    const [x, y] = pt(e)
    if (placing) {
      onPlace(src, x, y)
      return
    }
    if (tool === 'text') {
      onCommit(src, (list) => [...list, { id: uid(), type: 'text', x, y: y - style.size * 0.6, text: '', size: style.size, color: style.color, font: style.font, bold: style.bold, italic: style.italic, isNew: true }], { editLast: true })
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
        if (draft.points.length > 1) a = { type: 'ink', points: draft.points, color: style.color, width: style.stroke }
      } else {
        const x = Math.min(draft.x0, draft.x1)
        const y = Math.min(draft.y0, draft.y1)
        const w = Math.abs(draft.x1 - draft.x0)
        const h = Math.abs(draft.y1 - draft.y0)
        if (draft.type === 'line' || draft.type === 'arrow') {
          if (Math.hypot(w, h) > 4) a = { type: draft.type, x1: draft.x0, y1: draft.y0, x2: draft.x1, y2: draft.y1, color: style.color, width: style.stroke }
        } else if (w > 3 && h > 3) {
          a =
            draft.type === 'highlight'
              ? { type: 'highlight', x, y, w, h, color: style.hl }
              : draft.type === 'whiteout'
                ? { type: 'whiteout', x, y, w, h, color: '#ffffff' }
                : { type: draft.type, x, y, w, h, stroke: style.color, fill: style.fill ? style.color : null, width: style.stroke }
        }
      }
      setDraft(null)
      if (a) onCommit(src, (list) => [...list, { id: uid(), ...a }])
    } else if (d.kind === 'move' || d.kind === 'resize') onCommit(src, (list) => list, { snapshotFrom: d.before })
  }

  function startMove(e, a, kind = 'move') {
    if (tool !== 'select') {
      // clicking existing text with the text/edit tool re-opens it instead of adding a new box
      if ((tool === 'text' && a.type === 'text') || (tool === 'edit' && a.type === 'replace')) e.stopPropagation()
      return
    }
    e.stopPropagation()
    onSelect({ page: src, id: a.id })
    if (a.type === 'replace') return // edited PDF text stays where the original was
    e.currentTarget.closest('.pe-overlay').setPointerCapture(e.pointerId)
    drag.current = { kind, id: a.id, start: pt(e), orig: structuredClone(a), before: true }
  }

  const z = (v) => v * zoom
  const sel = (a) => selected?.page === src && selected?.id === a.id

  return (
    <div className="pe-page-wrap">
      <div ref={wrap} className={`pe-page tool-${tool} ${placing ? 'placing' : ''}`} style={{ width: z(W), height: z(H) }}>
        <canvas ref={canvas} style={{ width: z(W), height: z(H) }} />
        {plan.rotate ? <span className="pe-rot-badge">{t('pe.rotBadge', { deg: plan.rotate })}</span> : null}

        <div className="pe-overlay" onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          {/* existing text runs (edit mode) */}
          {tool === 'edit' &&
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
                    style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h), border: `${z(a.width)}px solid ${a.stroke}`, background: a.fill ?? 'transparent', borderRadius: a.type === 'ellipse' ? '50%' : 0 }}
                    {...common}
                  >
                    {sel(a) && <span className="pe-resize" onPointerDown={(e) => startMove(e, a, 'resize')} />}
                  </div>
                )
              case 'image':
                return (
                  <div key={a.id} className="pe-ann pe-img" style={{ left: z(a.x), top: z(a.y), width: z(a.w), height: z(a.h) }} {...common}>
                    <img src={a.src} alt="" draggable={false} />
                    {sel(a) && <span className="pe-resize" onPointerDown={(e) => startMove(e, a, 'resize')} />}
                  </div>
                )
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
                  <polyline key={a.id} points={a.points.map(([x, y]) => `${z(x)},${z(y)}`).join(' ')} stroke={a.color} strokeWidth={z(a.width)} className={`pe-vec ${sel(a) ? 'sel' : ''}`} onPointerDown={(e) => startMove(e, a)} />
                ) : (
                  <line key={a.id} x1={z(a.x1)} y1={z(a.y1)} x2={z(a.x2)} y2={z(a.y2)} stroke={a.color} strokeWidth={z(a.width)} markerEnd={a.type === 'arrow' ? `url(#ah-${src})` : undefined} className={`pe-vec ${sel(a) ? 'sel' : ''}`} onPointerDown={(e) => startMove(e, a)} />
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
                  style={draft.type === 'highlight' ? { fill: style.hl } : draft.type === 'whiteout' ? { fill: '#fff' } : { stroke: style.color }}
                />
              ))}
          </svg>
        </div>
      </div>
      <span className="pe-page-no">{src + 1}</span>
    </div>
  )
}

/* ───────── Thumbnail ───────── */

function PageThumb({ pdf, src }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let dead = false
    pdf.getPage(src + 1).then(async (page) => {
      const vp = page.getViewport({ scale: 140 / page.getViewport({ scale: 1 }).width })
      const c = document.createElement('canvas')
      c.width = vp.width
      c.height = vp.height
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c }).promise.catch(() => {})
      if (!dead) setUrl(c.toDataURL('image/jpeg', 0.8))
    })
    return () => {
      dead = true
    }
  }, [pdf, src])
  return url ? <img src={url} alt="" draggable={false} /> : <span className="pe-thumb-ph" />
}

/* ───────── Editor ───────── */

export default function PdfEditor({ file, notify, onClose, onReopen }) {
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState(null)
  const [infos, setInfos] = useState([])
  const [pages, setPages] = useState([])
  const [anns, setAnns] = useState({})
  const [tool, setTool] = useState('select')
  const [style, setStyle] = useState({ color: '#111111', size: 14, font: 'sans', bold: false, italic: false, stroke: 2, fill: false, hl: '#fde047' })
  const [selected, setSelected] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [texts, setTexts] = useState({})
  const [placing, setPlacing] = useState(null)
  const [signing, setSigning] = useState(false)
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)
  const [attempt, setAttempt] = useState(0) // bumps to open the PDF again after a failure
  const [current, setCurrent] = useState(0) // index in `pages` of the page in view
  const scroller = useRef(null)
  const imgInput = useRef(null)
  const dragFrom = useRef(null)
  const viewports = useRef({})
  const textLoading = useRef(new Set())
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

  const loadText = useCallback(
    async (src) => {
      if (!pdf || textLoading.current.has(src)) return
      textLoading.current.add(src)
      const page = await pdf.getPage(src + 1)
      await page.getOperatorList() // loads fonts → real names for bold/italic
      const tc = await page.getTextContent()
      const vp = viewports.current[src]
      const runs = groupText(tc.items, tc.styles, page.commonObjs).map((r) => {
        // viewport rect of the run: baseline box from slightly below baseline to the ascent
        const [x1, y1] = vp.convertToViewportPoint(r.x, r.y - r.size * 0.26)
        const [x2, y2] = vp.convertToViewportPoint(r.x + r.w, r.y + r.size * 0.96)
        return { ...r, vx: Math.min(x1, x2), vy: Math.min(y1, y2), vw: Math.abs(x2 - x1), vh: Math.abs(y2 - y1) }
      })
      setTexts((prev) => ({ ...prev, [src]: runs }))
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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault()
        commit(selected.page, (list) => list.filter((a) => a.id !== selected.id))
        setSelected(null)
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
    setPlacing(null)
    setTool(id)
  }

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
    commit(src, (list) => [...list, { id: uid(), type: 'image', x: x - w / 2, y: y - h / 2, w, h, src: placing.src }])
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
            ops.push({ type: 'text', page: src, x, y, text: a.text, size: a.size, font: a.font, bold: a.bold, italic: a.italic, color: a.color, lineHeight: 1.2 })
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
            ops.push({ type: a.type, page: src, rect: R(a.x, a.y, a.w, a.h), stroke: a.stroke, fill: a.fill, strokeWidth: a.width })
            break
          case 'line':
          case 'arrow':
            ops.push({ type: 'line', page: src, from: P(a.x1, a.y1), to: P(a.x2, a.y2), color: a.color, width: a.width, arrow: a.type === 'arrow' })
            break
          case 'ink':
            ops.push({ type: 'ink', page: src, points: a.points.map(([x, y]) => P(x, y)), color: a.color, width: a.width })
            break
          case 'image':
            ops.push({ type: 'image', page: src, rect: R(a.x, a.y, a.w, a.h), src: a.src })
            break
        }
      }
    }
    return ops
  }

  async function save() {
    const latest = finishEditing(anns) ?? anns
    const operations = toOps(latest)
    const planChanged = pages.length !== infos.length || pages.some((p, i) => p.src !== i || p.rotate)
    if (!operations.length && !planChanged) return notify(t('pe.noChanges'))
    setSaving({ progress: 0, stage: 'Yuborilmoqda' })
    try {
      const job = await runTool('pdf-edit', [file.id], { operations, ...(planChanged ? { pages: pages.map((p) => ({ src: p.src, rotate: p.rotate })) } : {}) }, { onUpdate: (j) => setSaving({ progress: j.progress, stage: j.stage }) })
      const out = job.outputs[0]
      setSaved(out)
      downloadFile(out)
    } catch (err) {
      notify(err.message)
    } finally {
      setSaving(null)
    }
  }

  const count = useMemo(() => Object.values(anns).reduce((n, l) => n + l.filter((a) => !(a.type === 'replace' && a.text === a.original)).length, 0), [anns])
  const selAnn = selected ? anns[selected.page]?.find((a) => a.id === selected.id) : null
  const textual = tool === 'text' || selAnn?.type === 'text' || selAnn?.type === 'replace'
  const drawing = ['rect', 'ellipse', 'arrow', 'line', 'ink'].includes(tool) || ['rect', 'ellipse', 'line', 'arrow', 'ink'].includes(selAnn?.type)

  return (
    <div className="pe" role="dialog" aria-modal="true" aria-label={t('pe.title')}>
      <header className="pe-top">
        <button className="fs-ibtn" onClick={() => (count && !saved ? window.confirm(t('pe.unsaved')) && onClose() : onClose())} aria-label={t('ui.close')}>
          <X size={18} />
        </button>
        <div className="pe-name">
          <NotePencil size={18} weight="duotone" />
          <b title={file.name}>{file.name}</b>
          {count > 0 && <span className="pe-count">{t('pe.changes', { n: count })}</span>}
        </div>
        <div className="pe-top-mid">
          {pages.length > 0 && (
            <>
              <span className="pe-pager" title={t('pe.pageOf', { n: current + 1, total: pages.length })}>
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
              <span className="pe-sep" />
            </>
          )}
          <button className="fs-ibtn" onClick={undo} disabled={!past.length} title={t('pe.undo')}>
            <ArrowUUpLeft size={18} />
          </button>
          <button className="fs-ibtn" onClick={redo} disabled={!future.length} title={t('pe.redo')}>
            <ArrowUUpRight size={18} />
          </button>
          <span className="pe-sep" />
          <button className="fs-ibtn" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} title={t('pe.zoomOut')}>
            <MagnifyingGlassMinus size={18} />
          </button>
          <span className="pe-zoom">{Math.round(zoom * 100)}%</span>
          <button className="fs-ibtn" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} title={t('pe.zoomIn')}>
            <MagnifyingGlassPlus size={18} />
          </button>
          <button className="fs-ibtn" onClick={fitWidth} disabled={!pdf} title={t('pe.fitWidth')}>
            <ArrowsOutLineHorizontal size={18} />
          </button>
        </div>
        <button className={`fs-btn dark pe-save ${count > 0 ? 'ready' : ''}`} onClick={save} disabled={!pdf || saving}>
          {saving ? <CircleNotch size={16} className="spin" /> : <FloppyDisk size={16} weight="bold" />} {saving ? `${saving.progress ?? 0}%` : t('pe.save')}
        </button>
      </header>

      {/* contextual style bar */}
      <div className="pe-props">
        {(() => {
          const cur = TOOLS.find((x) => x.id === (placing ? (placing.kind === 'sign' ? 'sign' : 'image') : tool)) ?? TOOLS[0]
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
            <select className="pe-select" value={style.font} onChange={(e) => setStyleProp({ font: e.target.value })}>
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
        {selAnn && (
          <>
            <span className="pe-sep" />
            <button
              className="fs-btn ghost danger"
              onClick={() => {
                commit(selected.page, (list) => list.filter((a) => a.id !== selected.id))
                setSelected(null)
              }}
            >
              <Trash size={15} /> {t('ui.delete')}
            </button>
          </>
        )}
        <span className="pe-props-hint">
          {placing
            ? t('pe.hintImage')
            : tool === 'edit'
              ? t('pe.hintEdit')
              : tool === 'text'
                ? t('pe.hintText')
                : tool === 'select'
                  ? t('pe.hintSelect')
                  : t('pe.hintDraw')}
        </span>
      </div>

      <div className="pe-body">
        <aside className="pe-thumbs">
          {pages.length > 0 && <div className="pe-thumbs-head">{t('pe.pagesCount', { n: pages.length })}</div>}
          {pages.map((p, i) => (
            <div
              key={p.key}
              className={`pe-thumb ${i === current ? 'on' : ''}`}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragFrom.current
                if (from === null || from === i) return
                pushHistory()
                setPages((ps) => {
                  const c = [...ps]
                  const [m] = c.splice(from, 1)
                  c.splice(i, 0, m)
                  return c
                })
                dragFrom.current = null
              }}
              onClick={() => document.getElementById(`pe-p-${p.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <div className="pe-thumb-img" style={{ transform: `rotate(${p.rotate}deg)` }}>
                {pdf && <PageThumb pdf={pdf} src={p.src} />}
              </div>
              <span className="pe-thumb-no">{i + 1}</span>
              <div className="pe-thumb-tools" onClick={(e) => e.stopPropagation()}>
                <button title={t('pe.rotL')} onClick={() => rotatePage(p.key, -90)}>
                  <ArrowCounterClockwise size={13} weight="bold" />
                </button>
                <button title={t('pe.rotR')} onClick={() => rotatePage(p.key, 90)}>
                  <ArrowClockwise size={13} weight="bold" />
                </button>
                <button title={t('pe.delPage')} className="danger" onClick={() => deletePage(p.key)}>
                  <Trash size={13} weight="bold" />
                </button>
              </div>
            </div>
          ))}
        </aside>

        <nav className="pe-tools" aria-label={t('pe.tools')}>
          {TOOLS.map((tl, i) => (
            <span key={tl.id} className="pe-tool-slot">
              {i > 0 && TOOLS[i - 1].group !== tl.group && <i className="pe-tools-sep" aria-hidden="true" />}
              <button className={tool === tl.id && !placing ? 'on' : ''} onClick={() => pickTool(tl.id)} aria-label={`${toolName(tl)} (${tl.key.toUpperCase()})`}>
                <tl.icon size={20} weight={tool === tl.id ? 'duotone' : 'regular'} />
                <span className="pe-tip" aria-hidden="true">
                  {toolName(tl)}
                  <kbd>{tl.key.toUpperCase()}</kbd>
                </span>
              </button>
            </span>
          ))}
        </nav>

        <main className="pe-scroll" ref={scroller} onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
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
                  pdf={pdf}
                  src={p.src}
                  info={infos[p.src]}
                  plan={p}
                  zoom={zoom}
                  anns={anns[p.src] ?? []}
                  tool={tool}
                  style={style}
                  selected={selected}
                  editingId={editingId}
                  onSelect={setSelected}
                  onCommit={onCommit}
                  onLive={onLive}
                  onEditText={onEditText}
                  onFinishEdit={onFinishEdit}
                  registerEditor={registerEditor}
                  textRuns={texts[p.src]}
                  loadText={loadText}
                  placing={placing}
                  onPlace={place}
                />
              </div>
            ))
          )}
        </main>
      </div>

      <input ref={imgInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { chooseImage(e.target.files[0]); e.target.value = '' }} />
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
      {saving && (
        <div className="pe-saving">
          <CircleNotch size={22} className="spin" /> {saving.stage ?? t('pe.saving')} · {saving.progress ?? 0}%
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
