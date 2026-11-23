// Canva-style element controls on the canvas: a small bar floating above the selection (lock,
// duplicate, delete, "…") and the "…" / right-click menu (copy, paste, duplicate, delete, layer,
// align to page, lock). Rendered in a portal with fixed positions measured from the canvas, so the
// stage's scrolling and zoom never clip them.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal,
  AlignStartVertical, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, BoxSelect, ChevronRight, ClipboardPaste,
  Copy, CopyPlus, Layers, Lock, LockOpen, MoreHorizontal, Plus, Trash2,
} from 'lucide-react'
import { t } from '../i18n/index.js'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const key = (k, shift = false) => (MAC ? `${shift ? '⇧' : ''}⌘${k}` : `Ctrl+${shift ? 'Shift+' : ''}${k}`)

/** The selection's box on screen (union of the selected elements' drawn boxes), or null. */
function selectionRect(canvas, ids) {
  if (!canvas || !ids.length) return null
  let l = Infinity
  let tp = Infinity
  let r = -Infinity
  let b = -Infinity
  for (const id of ids) {
    const n = canvas.querySelector(`[data-eid="${CSS.escape(id)}"]`)
    if (!n) continue
    const x = n.getBoundingClientRect()
    l = Math.min(l, x.left)
    tp = Math.min(tp, x.top)
    r = Math.max(r, x.right)
    b = Math.max(b, x.bottom)
  }
  return l === Infinity ? null : { left: l, top: tp, right: r, bottom: b }
}

/* ───────── the menu (from "…" or a right-click) ───────── */

function Item({ icon: Icon, label, hint, onClick, disabled, danger, children }) {
  const [open, setOpen] = useState(false)
  if (children) {
    return (
      <div className="em-item em-sub" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}>
        <button type="button" className="em-row" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
          <Icon size={16} />
          <span className="em-label">{label}</span>
          <ChevronRight size={15} className="em-chev" />
        </button>
        {open && <div className="em-menu em-submenu" role="menu">{children}</div>}
      </div>
    )
  }
  return (
    <button type="button" role="menuitem" className={`em-row ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>
      <Icon size={16} />
      <span className="em-label">{label}</span>
      {hint && <kbd className="em-kbd">{hint}</kbd>}
    </button>
  )
}

/**
 * @param {{ at: {x:number,y:number}, onElement: boolean, locked: boolean, canPaste: boolean, act: object, onClose: () => void }} p
 */
export function ElementContextMenu({ at, onElement, locked, canPaste, act, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: at.x, top: at.y })

  // keep the menu inside the window
  useLayoutEffect(() => {
    const m = ref.current?.getBoundingClientRect()
    if (!m) return
    setPos({
      left: Math.max(8, Math.min(at.x, window.innerWidth - m.width - 8)),
      top: Math.max(8, Math.min(at.y, window.innerHeight - m.height - 8)),
      flip: at.x + m.width + 200 > window.innerWidth,
    })
  }, [at.x, at.y])

  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && onClose()
    const esc = (e) => e.key === 'Escape' && onClose()
    // a delay, so the click that opened the menu doesn't close it
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', away)
      document.addEventListener('contextmenu', away)
    })
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', onClose)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('contextmenu', away)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const run = (fn) => () => {
    fn()
    onClose()
  }

  return createPortal(
    <div ref={ref} className={`em-menu em-root ${pos.flip ? 'flip' : ''}`} style={{ left: pos.left, top: pos.top }} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {onElement ? (
        <>
          <Item icon={Copy} label={t('em.copy')} hint={key('C')} onClick={run(act.copy)} />
          <Item icon={ClipboardPaste} label={t('em.paste')} hint={key('V')} onClick={run(act.paste)} disabled={!canPaste} />
          <Item icon={CopyPlus} label={t('em.duplicate')} hint={key('D')} onClick={run(act.duplicate)} />
          <Item icon={Trash2} label={t('em.delete')} hint={MAC ? '⌫' : 'Delete'} onClick={run(act.remove)} disabled={locked} danger />
          <span className="em-sep" />
          <Item icon={Layers} label={t('em.layer')}>
            <Item icon={ArrowUp} label={t('em.layer.up')} hint={key(']')} onClick={run(() => act.layer('up'))} />
            <Item icon={ArrowDown} label={t('em.layer.down')} hint={key('[')} onClick={run(() => act.layer('down'))} />
            <Item icon={ArrowUpToLine} label={t('em.layer.front')} hint={key(']', true)} onClick={run(() => act.layer('front'))} />
            <Item icon={ArrowDownToLine} label={t('em.layer.back')} hint={key('[', true)} onClick={run(() => act.layer('back'))} />
          </Item>
          <Item icon={AlignCenterHorizontal} label={t('em.align')}>
            <Item icon={AlignStartVertical} label={t('em.align.left')} onClick={run(() => act.alignPage('left'))} disabled={locked} />
            <Item icon={AlignCenterVertical} label={t('em.align.center')} onClick={run(() => act.alignPage('hcenter'))} disabled={locked} />
            <Item icon={AlignEndVertical} label={t('em.align.right')} onClick={run(() => act.alignPage('right'))} disabled={locked} />
            <Item icon={AlignStartHorizontal} label={t('em.align.top')} onClick={run(() => act.alignPage('top'))} disabled={locked} />
            <Item icon={AlignCenterHorizontal} label={t('em.align.middle')} onClick={run(() => act.alignPage('vmiddle'))} disabled={locked} />
            <Item icon={AlignEndHorizontal} label={t('em.align.bottom')} onClick={run(() => act.alignPage('bottom'))} disabled={locked} />
          </Item>
          <span className="em-sep" />
          <Item icon={locked ? LockOpen : Lock} label={t(locked ? 'em.unlock' : 'em.lock')} onClick={run(act.toggleLock)} />
        </>
      ) : (
        <>
          <Item icon={ClipboardPaste} label={t('em.paste')} hint={key('V')} onClick={run(act.paste)} disabled={!canPaste} />
          <Item icon={BoxSelect} label={t('em.selectAll')} hint={key('A')} onClick={run(act.selectAll)} />
          <span className="em-sep" />
          <Item icon={Plus} label={t('ed.page.add')} onClick={run(act.addPage)} />
        </>
      )}
    </div>,
    document.body,
  )
}

/* ───────── the bar above the selection ───────── */

/**
 * @param {{ canvasRef: {current: HTMLElement|null}, ids: string[], locked: boolean, act: object, onMore: (at:{x:number,y:number}) => void, hidden?: boolean }} p
 */
export function ElementBar({ canvasRef, ids, locked, act, onMore, hidden }) {
  const bar = useRef(null)
  const [pos, setPos] = useState(null)
  const [dragging, setDragging] = useState(false)
  const idsKey = ids.join(',')

  // measured after every render (the selection moves and resizes through state updates)
  useLayoutEffect(() => {
    const place = () => {
      const canvas = canvasRef.current
      const r = selectionRect(canvas, ids)
      const stage = canvas?.parentElement?.getBoundingClientRect()
      if (!r || !stage || !bar.current) return setPos(null)
      // out of sight (scrolled away)
      if (r.bottom < stage.top || r.top > stage.bottom) return setPos(null)
      const w = bar.current.offsetWidth
      const h = bar.current.offsetHeight
      const above = r.top - h - 14
      const top = above >= stage.top + 4 ? above : Math.min(r.bottom + 14, stage.bottom - h - 4)
      const left = Math.max(stage.left + 4, Math.min((r.left + r.right) / 2 - w / 2, stage.right - w - 4))
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }))
    }
    place()
    const stage = canvasRef.current?.parentElement
    stage?.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    return () => {
      stage?.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  })

  // hidden while an element is being dragged, resized or rotated (as in Canva)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const down = (e) => e.button === 0 && e.target.closest?.('[data-eid]') && setDragging(true)
    const up = () => setDragging(false)
    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [canvasRef, idsKey])

  if (!ids.length) return null
  return createPortal(
    <div
      ref={bar}
      className="em-bar"
      style={pos && !hidden && !dragging ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999, visibility: 'hidden' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className={`em-btn ${locked ? 'on' : ''}`} onClick={act.toggleLock} title={t(locked ? 'em.unlock' : 'em.lock')}>
        {locked ? <Lock size={17} /> : <LockOpen size={17} />}
      </button>
      <button type="button" className="em-btn" onClick={act.duplicate} title={`${t('em.duplicate')} (${key('D')})`}>
        <CopyPlus size={17} />
      </button>
      <button type="button" className="em-btn" onClick={act.remove} disabled={locked} title={t('em.delete')}>
        <Trash2 size={17} />
      </button>
      <button
        type="button"
        className="em-btn"
        title={t('em.more')}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onMore({ x: r.left, y: r.bottom + 6 })
        }}
      >
        <MoreHorizontal size={17} />
      </button>
    </div>,
    document.body,
  )
}
