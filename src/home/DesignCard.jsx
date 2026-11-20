import { useEffect, useMemo, useRef, useState } from 'react'
import { DotsThree, ArrowSquareOut, Copy, PencilSimple, Trash } from '@phosphor-icons/react'
import { Dropdown } from '../components/ui.jsx'
import Slide from '../editor/Slide.jsx'
import { deckTheme } from '../editor/templates.js'
import { timeAgo } from '../store.js'
import { KIND_COLOR } from './create.jsx'
import KitThumb from '../creators/KitThumb.jsx'
import { isKit } from '../creators/kitTypes.js'
import { t } from '../i18n/index.js'
import { kindLabel } from '../i18n/kinds.js'

/** Thumbnail for any design: slide decks show a slide, kits (logo, bio, CV) their own preview. */
export function DesignThumb({ d, idx = 0, theme }) {
  if (isKit(d)) return <KitThumb type={d.type} data={d.data} />
  return <Slide slide={d.slides[idx] ?? d.slides[0]} theme={theme ?? deckTheme(d)} index={idx} preview />
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Cycles through a design's slides while hovered — a live mini preview. */
export function useHoverPreview(count) {
  const [idx, setIdx] = useState(0)
  const timer = useRef(null)
  const start = () => {
    if (count < 2 || reducedMotion()) return
    clearInterval(timer.current)
    timer.current = setInterval(() => setIdx((i) => (i + 1) % Math.min(count, 6)), 900)
  }
  const stop = () => {
    clearInterval(timer.current)
    setIdx(0)
  }
  useEffect(() => () => clearInterval(timer.current), [])
  return { idx, start, stop }
}

export function DesignMenu({ d, onOpen, onDuplicate, onDelete, onRename, className = 'dz-menu-btn' }) {
  return (
    <Dropdown
      align="right"
      button={({ toggle }) => (
        <button className={className} onClick={(e) => { e.stopPropagation(); toggle() }} aria-label={t('dz.actions')}>
          <DotsThree size={20} weight="bold" />
        </button>
      )}
    >
      {(close) => (
        <>
          <button className="menu-item" onClick={() => { close(); onOpen(d.id) }}>
            {t('dz.open')} <ArrowSquareOut size={15} />
          </button>
          {onRename && (
            <button className="menu-item" onClick={() => { close(); onRename() }}>
              {t('dz.rename')} <PencilSimple size={15} />
            </button>
          )}
          <button className="menu-item" onClick={() => { close(); onDuplicate(d.id) }}>
            {t('dz.duplicate')} <Copy size={15} />
          </button>
          <div className="menu-sep" />
          <button className="menu-item danger" onClick={() => { close(); onDelete(d.id) }}>
            {t('ui.delete')} <Trash size={15} />
          </button>
        </>
      )}
    </Dropdown>
  )
}

/** Inline name editor shared by card + row. */
export function NameField({ value, onDone }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const commit = () => onDone(ref.current.value.trim() || value)
  return (
    <input
      ref={ref}
      className="dz-rename"
      defaultValue={value}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onDone(value)
      }}
      aria-label={t('dz.name')}
    />
  )
}

export default function DesignCard({ d, onOpen, onDuplicate, onDelete, onRename }) {
  const theme = useMemo(() => deckTheme(d), [d])
  const { idx, start, stop } = useHoverPreview(d.slides.length)
  const [renaming, setRenaming] = useState(false)

  return (
    <div className="dz-card" onPointerEnter={start} onPointerLeave={stop}>
      <button className="dz-thumb" onClick={() => onOpen(d.id)} aria-label={t('dz.openName', { name: d.name })}>
        <div className={`dz-frame ${isKit(d) ? 'kit' : ''}`} key={idx}>
          <DesignThumb d={d} idx={idx} theme={theme} />
        </div>
        {d.slides.length > 1 && (
          <span className="dz-count">
            {idx > 0 ? `${idx + 1} / ${d.slides.length}` : t('dz.slides', { n: d.slides.length })}
          </span>
        )}
        {d.slides.length > 1 && (
          <span className="dz-progress" aria-hidden="true">
            {d.slides.slice(0, 6).map((s, i) => (
              <i key={s.id} className={i === idx ? 'on' : ''} />
            ))}
          </span>
        )}
      </button>
      <div className="dz-menu">
        <DesignMenu d={d} onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} onRename={onRename && (() => setRenaming(true))} />
      </div>
      <div className="dz-meta">
        {renaming ? (
          <NameField
            value={d.name}
            onDone={(name) => {
              setRenaming(false)
              if (name !== d.name) onRename(d.id, name)
            }}
          />
        ) : (
          <div className="dz-name" title={d.name} onDoubleClick={() => onRename && setRenaming(true)}>
            {d.name}
          </div>
        )}
        <div className="dz-sub">
          <span className="dz-dot" style={{ background: KIND_COLOR[d.kind] ?? '#8b919a' }} />
          {kindLabel(d.kind)} · {timeAgo(d.updatedAt)}
        </div>
      </div>
    </div>
  )
}
