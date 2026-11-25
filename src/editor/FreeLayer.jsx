// Free elements of a page — the Canva layer. Renders every element (text, box, image, shapes) and,
// in the editor, handles selection, moving with snapping guides, resizing from 8 handles,
// rotating, marquee selection and double-click editing.
import AssetImg from '../components/AssetImg.jsx'
import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Text } from './Text.jsx'
import { FramedImage, Loop, renderElement } from './elements/render.jsx'

const CLIP = {
  triangle: 'polygon(50% 0,100% 100%,0 100%)',
  star: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
  hexagon: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
}

const paintStyle = (el) => ({
  ...(el.bgc ? { backgroundColor: el.bgc } : {}),
  ...(el.bgi ? { backgroundImage: el.bgi } : {}),
  ...(el.border ? { border: el.border } : {}),
  ...(el.radius != null ? { borderRadius: typeof el.radius === 'number' ? `${el.radius}cqw` : el.radius } : {}),
  ...(el.shadow ? { boxShadow: el.shadow } : {}),
  ...(el.clip ? { clipPath: el.clip } : {}),
  ...(el.backdrop ? { backdropFilter: el.backdrop, WebkitBackdropFilter: el.backdrop } : {}),
  ...(el.bgi && el.bgs ? { backgroundSize: el.bgs } : {}),
  ...(el.bgi && el.bgp ? { backgroundPosition: el.bgp } : {}),
  ...(el.bgi && el.bgr ? { backgroundRepeat: el.bgr } : {}),
  ...(el.borders ? { borderTop: el.borders[0], borderRight: el.borders[1], borderBottom: el.borders[2], borderLeft: el.borders[3] } : {}),
  ...(el.filter && el.kind !== 'image' ? { filter: el.filter } : {}),
  ...(el.blend ? { mixBlendMode: el.blend } : {}),
  ...(el.mask ? { maskImage: el.mask, WebkitMaskImage: el.mask } : {}),
})

/** A vector drawing (from a template's artwork) with its colours swapped as the user chose. */
export function vectorSrc(el) {
  let svg = el.svg ?? ''
  const to = el.recolor ?? []
  ;(el.colors ?? []).forEach((c, i) => {
    if (!to[i] || to[i] === c) return
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // through a placeholder, so a colour swapped to another original colour isn't swapped twice
    svg = svg.replace(new RegExp(`(["':;\\s])${esc}(?=["';\\s)]|$)`, 'g'), `$1\u0000${i}\u0000`)
  })
  svg = svg.replace(/\u0000(\d+)\u0000/g, (_, i) => to[i])
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function textStyle(el, theme) {
  return {
    fontSize: `${el.size ?? 2.4}cqw`,
    fontFamily: el.font ?? ((el.weight ?? 400) >= 600 ? theme.titleFont : theme.bodyFont),
    fontWeight: el.weight ?? 400,
    fontStyle: el.italic ? 'italic' : 'normal',
    textDecoration: el.underline ? 'underline' : 'none',
    color: el.color ?? theme.text,
    textAlign: el.align ?? 'left',
    lineHeight: el.lh ?? 1.2,
    letterSpacing: `${el.ls ?? 0}em`,
    textTransform: el.upper ? 'uppercase' : 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    ...paintStyle(el),
    ...(el.pad ? { padding: el.pad } : {}),
    ...(el.tshadow ? { textShadow: el.tshadow } : {}),
    ...(el.stroke ? { WebkitTextStroke: el.stroke } : {}),
    ...(el.fill ? { backgroundImage: el.fill, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}),
    ...(el.h != null ? { height: '100%' } : {}),
    ...(el.vcenter ? { display: 'flex', flexDirection: 'column', justifyContent: 'center' } : {}),
  }
}

/** The look of one element (no positioning). */
export function ElementContent({ el, theme, editing, editable, onCommitText, onPatch }) {
  const color = el.color ?? theme.accent
  switch (el.kind) {
    case 'text':
      return <Text value={el.text} editable={editing} autoFocus onCommit={(v) => onCommitText?.(el, v)} style={{ ...textStyle(el, theme), outline: 'none', cursor: editing ? 'text' : undefined }} />
    case 'vector':
      return <img className="fx-vector" src={vectorSrc(el)} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', ...(el.filter ? { filter: el.filter } : {}) }} />
    case 'box':
      return <div style={{ width: '100%', height: '100%', ...(el.color && !el.bgc && !el.bgi ? { background: el.color } : {}), ...paintStyle(el) }} />
    case 'image':
      if (el.mask || el.frame) return <FramedImage el={el} editable={editable} />
      return (
        <div className="fx-img" style={{ ...paintStyle(el), borderRadius: el.radius ?? (el.src ? '0.6cqw' : '1cqw') }}>
          {el.src ? (
            <AssetImg src={el.src} draggable={false} style={{ objectFit: el.fit ?? 'cover', ...(el.filter ? { filter: el.filter } : {}) }} />
          ) : (
            <span className="fx-img-ph">
              <ImagePlus />
              {editable && <small>Rasm qöşiş</small>}
            </span>
          )}
        </div>
      )
    case 'rect':
      return <div style={{ width: '100%', height: '100%', background: color, borderRadius: el.radius ?? '0.6cqw', ...(el.border ? { border: el.border } : {}) }} />
    case 'circle':
      return <div style={{ width: '100%', height: '100%', background: color, borderRadius: '50%', ...(el.border ? { border: el.border } : {}) }} />
    case 'triangle':
    case 'star':
    case 'hexagon':
      return <div style={{ width: '100%', height: '100%', background: color, clipPath: CLIP[el.kind] }} />
    case 'line':
      return <div style={{ width: '100%', height: `${el.thick ?? 0.35}cqw`, marginTop: `calc(50% - ${(el.thick ?? 0.35) / 2}cqw)`, background: color, borderRadius: 9 }} />
    case 'arrow':
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h88M74 6l18 14-18 14" />
        </svg>
      )
    default:
      return renderElement(el, theme, { editing, onPatch })
  }
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const SNAP_PX = 6

/**
 * @param {{ elements: object[], theme: object, editable?: boolean, selected?: string[], editingId?: string|null,
 *   rootRef: {current: HTMLElement}, onSelect?: (ids: string[]) => void, onEdit?: (id: string) => void,
 *   onChange?: (id, patch, transient) => void, onChangeMany?: (map, transient) => void, onCommitStart?: () => void,
 *   onCommitText?: (el, text) => void, onPickImage?: (el) => void }} p
 */
export default function FreeLayer({
  elements, theme, editable = false, selected = [], editingId = null, rootRef,
  onSelect, onEdit, onChange, onChangeMany, onCommitStart, onCommitText, onPickImage, autoAnim = false,
}) {
  const layer = useRef(null)
  const [guides, setGuides] = useState([])
  const [marquee, setMarquee] = useState(null)

  const pageRect = () => rootRef.current.getBoundingClientRect()
  // visual box of an element, in % of the page
  const boxOf = (id, r = pageRect()) => {
    const n = layer.current?.querySelector(`[data-eid="${CSS.escape(id)}"]`)
    if (!n) return null
    const b = n.getBoundingClientRect()
    return { x: ((b.left - r.left) / r.width) * 100, y: ((b.top - r.top) / r.height) * 100, w: (b.width / r.width) * 100, h: (b.height / r.height) * 100 }
  }
  const heightOf = (id, r = pageRect()) => {
    const n = layer.current?.querySelector(`[data-eid="${CSS.escape(id)}"]`)
    return n ? (n.offsetHeight / (rootRef.current.offsetHeight || r.height)) * 100 : 10
  }

  /* ───── move (with snapping) ───── */
  const startMove = (e, ids, clickedId, wasOnlySelected) => {
    const r = pageRect()
    const movers = ids.filter((id) => !elements.find((x) => x.id === id)?.locked)
    const start = Object.fromEntries(movers.map((id) => {
      const el = elements.find((x) => x.id === id)
      return [id, { x: el.x, y: el.y }]
    }))
    const boxes = movers.map((id) => boxOf(id, r)).filter(Boolean)
    const u = boxes.length
      ? { l: Math.min(...boxes.map((b) => b.x)), t: Math.min(...boxes.map((b) => b.y)), r: Math.max(...boxes.map((b) => b.x + b.w)), b: Math.max(...boxes.map((b) => b.y + b.h)) }
      : null
    // what we can snap to: the page and every other element
    const others = elements.filter((x) => !ids.includes(x.id)).map((x) => boxOf(x.id, r)).filter(Boolean)
    const tx = [0, 50, 100, ...others.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w])]
    const ty = [0, 50, 100, ...others.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h])]
    const thx = (SNAP_PX / r.width) * 100
    const thy = (SNAP_PX / r.height) * 100
    const sx = e.clientX
    const sy = e.clientY
    let moved = false

    const snap = (vals, targets, th) => {
      let best = null
      for (const v of vals) for (const t of targets) {
        const d = t - v
        if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }
      }
      return best
    }

    const move = (ev) => {
      const dxp = ev.clientX - sx
      const dyp = ev.clientY - sy
      if (!moved && Math.hypot(dxp, dyp) < 3) return
      if (!moved) {
        moved = true
        onCommitStart?.()
      }
      let dx = (dxp / r.width) * 100
      let dy = (dyp / r.height) * 100
      const g = []
      if (u && !ev.altKey) {
        const w = u.r - u.l
        const h = u.b - u.t
        const sxr = snap([u.l + dx, u.l + dx + w / 2, u.l + dx + w], tx, thx)
        if (sxr) {
          dx += sxr.d
          g.push({ axis: 'x', at: sxr.at })
        }
        const syr = snap([u.t + dy, u.t + dy + h / 2, u.t + dy + h], ty, thy)
        if (syr) {
          dy += syr.d
          g.push({ axis: 'y', at: syr.at })
        }
      }
      setGuides(g)
      onChangeMany?.(Object.fromEntries(movers.map((id) => [id, { x: start[id].x + dx, y: start[id].y + dy }])), true)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setGuides([])
      if (!moved && wasOnlySelected) {
        const el = elements.find((x) => x.id === clickedId)
        if (el?.kind === 'text' || el?.kind === 'table') onEdit?.(el.id)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onElDown = (e, el) => {
    if (!editable || e.button !== 0 || editingId === el.id) return
    e.stopPropagation()
    e.preventDefault()
    const isSel = selected.includes(el.id)
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      onSelect?.(isSel ? selected.filter((x) => x !== el.id) : [...selected, el.id])
      return
    }
    const ids = isSel ? selected : [el.id]
    if (!isSel) onSelect?.(ids)
    startMove(e, ids, el.id, isSel && selected.length === 1)
  }

  /* ───── resize ───── */
  const startResize = (e, el, dir) => {
    e.stopPropagation()
    e.preventDefault()
    const r = pageRect()
    const s = { x: el.x, y: el.y, w: el.w, h: el.h ?? heightOf(el.id, r), size: el.size }
    const th = ((el.rotate ?? 0) * Math.PI) / 180
    const cos = Math.cos(th)
    const sin = Math.sin(th)
    const corner = dir.length === 2
    const keepRatio = corner && ['text', 'image', 'icon', 'graphic', 'mockup'].includes(el.kind)
    const sx = e.clientX
    const sy = e.clientY
    let started = false
    const move = (ev) => {
      if (!started) {
        started = true
        onCommitStart?.()
      }
      const dxp = ev.clientX - sx
      const dyp = ev.clientY - sy
      const lx = ((dxp * cos + dyp * sin) / r.width) * 100
      const ly = ((-dxp * sin + dyp * cos) / r.height) * 100
      let w = s.w
      let h = s.h
      if (dir.includes('e')) w = s.w + lx
      if (dir.includes('w')) w = s.w - lx
      if (dir.includes('s')) h = s.h + ly
      if (dir.includes('n')) h = s.h - ly
      if (keepRatio || (corner && ev.shiftKey)) {
        const k = Math.max(w / s.w, h / s.h)
        w = s.w * k
        h = s.h * k
      }
      w = Math.max(1.5, w)
      h = Math.max(1.5, h)
      const x = dir.includes('w') ? s.x + (s.w - w) : s.x
      const y = dir.includes('n') ? s.y + (s.h - h) : s.y
      const patch = { x, w }
      if (el.kind === 'text') {
        if (corner) {
          patch.size = Math.max(0.6, Math.round(s.size * (w / s.w) * 100) / 100)
          patch.y = y
          if (el.h != null) patch.h = h
        }
        // sides change only the width; the text re-wraps
      } else {
        Object.assign(patch, { y, h })
      }
      onChange?.(el.id, patch, true)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ───── rotate ───── */
  const startRotate = (e, el) => {
    e.stopPropagation()
    e.preventDefault()
    const n = layer.current.querySelector(`[data-eid="${CSS.escape(el.id)}"]`)
    const b = n.getBoundingClientRect()
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    const a0 = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
    const r0 = el.rotate ?? 0
    let started = false
    const move = (ev) => {
      if (!started) {
        started = true
        onCommitStart?.()
      }
      let a = r0 + (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI - a0
      a = ((((a + 180) % 360) + 360) % 360) - 180
      if (ev.shiftKey) a = Math.round(a / 15) * 15
      else {
        const near = Math.round(a / 45) * 45
        if (Math.abs(a - near) < 4) a = near
      }
      onChange?.(el.id, { rotate: Math.round(a * 10) / 10 }, true)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ───── marquee (drag on empty page) ───── */
  const onBgDown = (e) => {
    if (!editable || e.button !== 0) return
    if (e.target.closest('[data-eid]')) return
    const r = pageRect()
    const x0 = ((e.clientX - r.left) / r.width) * 100
    const y0 = ((e.clientY - r.top) / r.height) * 100
    // background layers aren't caught by the marquee (they'd come along with everything)
    const boxes = elements.filter((x) => !x.bg).map((x) => [x.id, boxOf(x.id, r)])
    let m = null
    const move = (ev) => {
      const x1 = ((ev.clientX - r.left) / r.width) * 100
      const y1 = ((ev.clientY - r.top) / r.height) * 100
      m = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
      setMarquee(m)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setMarquee(null)
      if (!m || m.w + m.h < 1) return onSelect?.([])
      onSelect?.(boxes.filter(([, b]) => b && b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y).map(([id]) => id))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // double-click on an empty spot: the topmost background layer under the pointer
  const onBgDouble = (e) => {
    if (!editable || e.target.closest('[data-eid]')) return
    const r = pageRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    const hit = [...elements].reverse().find((el) => {
      if (!el.bg) return false
      const b = boxOf(el.id, r)
      return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    })
    if (hit) onSelect?.([hit.id])
  }

  const onDouble = (el) => {
    if (el.kind === 'text' || el.kind === 'table') onEdit?.(el.id)
    else if (el.kind === 'image' || el.kind === 'mockup') onPickImage?.(el)
    else if (el.kind === 'chart') window.dispatchEvent(new CustomEvent('qalam:chart-data', { detail: el.id }))
  }

  const single = editable && selected.length === 1 ? elements.find((x) => x.id === selected[0]) : null
  // «Körish» on a page without animations: everything rises in, top to bottom
  const sample = autoAnim
    ? new Map([...elements].sort((a, b) => a.y - b.y || a.x - b.x).map((e, i) => [e.id, { type: 'rise', delay: Math.min(i * 0.1, 1.5), dur: 0.7 }]))
    : null

  return (
    <div ref={layer} className={`fx-layer ${editable ? 'editable' : ''}`} onPointerDown={editable ? onBgDown : undefined} onDoubleClick={editable ? onBgDouble : undefined}>
      {elements.map((el) => {
        const isSel = editable && selected.includes(el.id)
        const editing = editingId === el.id
        const a = el.anim?.type ? el.anim : sample?.get(el.id)
        const anim = a?.type
        return (
          <div
            key={el.id}
            data-eid={el.id}
            className={`fx-el k-${el.kind} ${isSel ? 'sel' : ''} ${editing ? 'editing' : ''} ${el.locked ? 'locked' : ''} ${el.bg ? 'bg' : ''}`}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.w}%`,
              height: el.kind === 'text' && el.h == null ? 'auto' : `${el.h}%`,
              ...(el.rotate ? { transform: `rotate(${el.rotate}deg)` } : {}),
              ...(el.opacity != null && el.opacity < 1 ? { opacity: el.opacity } : {}),
              // a locked background layer lets clicks through (unlocked, it is an ordinary element)
              ...(el.bg && el.locked && !isSel ? { pointerEvents: 'none' } : {}),
            }}
            onPointerDown={editable ? (e) => onElDown(e, el) : undefined}
            onDoubleClick={editable ? () => onDouble(el) : undefined}
          >
            <div className="fx-anim" data-anim={anim || undefined} style={anim ? { '--ad': `${a.delay ?? 0}s`, '--adur': `${a.dur ?? 0.7}s` } : undefined}>
              <Loop type={el.loop}>
                {el.tf ? (
                  <div className="fx-tf" style={{ width: '100%', height: '100%', transform: el.tf }}>
                    <ElementContent el={el} theme={theme} editing={editing} editable={editable} onCommitText={onCommitText} onPatch={(p) => onChange?.(el.id, p)} />
                  </div>
                ) : (
                  <ElementContent el={el} theme={theme} editing={editing} editable={editable} onCommitText={onCommitText} onPatch={(p) => onChange?.(el.id, p)} />
                )}
              </Loop>
            </div>
            {single?.id === el.id && !editing && !el.locked && (
              <>
                {HANDLES.filter((d) => el.kind !== 'text' || el.h != null || d.length === 2 || d === 'e' || d === 'w').map((d) => (
                  <span key={d} className={`fx-h ${d}`} onPointerDown={(e) => startResize(e, el, d)} />
                ))}
                <span className="fx-rot" onPointerDown={(e) => startRotate(e, el)} title="Aylantiriş (Shift — 15°)" />
              </>
            )}
            {isSel && el.locked && <span className="fx-lock">🔒</span>}
          </div>
        )
      })}
      {guides.map((g, i) => (
        <span key={i} className={`snap-guide ${g.axis}`} style={g.axis === 'x' ? { left: `${g.at}%` } : { top: `${g.at}%` }} />
      ))}
      {marquee && <span className="fx-marquee" style={{ left: `${marquee.x}%`, top: `${marquee.y}%`, width: `${marquee.w}%`, height: `${marquee.h}%` }} />}
    </div>
  )
}
