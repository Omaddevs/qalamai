// Context toolbar above the canvas — Canva style: what you can do with the current selection.
import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, CaseUpper, Minus, Plus, Copy, Trash2, Lock, LockOpen,
  Blend, Sparkles, Layers, BringToFront, SendToBack, ArrowUp, ArrowDown, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  ImagePlus, Type, Square, Image as ImageIcon, Play, LetterText,
} from 'lucide-react'
import FontPicker from './FontPicker.jsx'
import ElementTools, { kindLabel } from './elements/tools.jsx'
import { t } from '../i18n/index.js'

/* ───── helpers ───── */

/** Any CSS colour → #rrggbb for <input type=color>. */
export function toHex(c) {
  if (!c) return '#000000'
  if (/^#[0-9a-f]{6}$/i.test(c)) return c
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c.slice(1).replace(/./g, (x) => x + x)}`
  const m = /rgba?\(([^)]+)\)/.exec(c)
  if (!m) return '#000000'
  const [r, g, b] = m[1].split(',').map((v) => Math.round(parseFloat(v)))
  return `#${[r, g, b].map((v) => (v || 0).toString(16).padStart(2, '0')).join('')}`
}
const familyName = (css) => (css ?? '').split(',')[0].replace(/['"]/g, '').trim() || 'Şrift'

function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return
    const h = (e) => !ref.current?.contains(e.target) && close()
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open, close, ref])
}

export function Pop({ button, title, children, wide, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, open, () => setOpen(false))
  return (
    <span className="tb-pop" ref={ref}>
      <button type="button" className={`tb-btn ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} title={title}>
        {button}
      </button>
      {open && <div className={`tb-panel ${wide ? 'wide' : ''} ${align}`}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>}
    </span>
  )
}

const PALETTE = ['#000000', '#ffffff', '#545454', '#a6a6a6', '#ff3131', '#ff914d', '#ffde59', '#7ed957', '#00bf63', '#0cc0df', '#5271ff', '#8c52ff', '#cb6ce6', '#ff66c4', '#14b8a6', '#0b1220']

export function ColorPop({ value, onChange, title, children, theme }) {
  const doc = [theme?.accent, theme?.accent2, theme?.text, theme?.muted].filter((c) => c && /^#/.test(c))
  return (
    <Pop title={title} button={children}>
      <div className="tb-color">
        <label className="tb-color-custom" style={{ background: value }}>
          <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
        </label>
        <span className="tb-label">Hujjat ranglari</span>
        <div className="tb-swatches">
          {[...new Set(doc)].map((c) => (
            <button key={c} type="button" style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
          ))}
        </div>
        <span className="tb-label">Standart ranglar</span>
        <div className="tb-swatches">
          {PALETTE.map((c) => (
            <button key={c} type="button" style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
          ))}
        </div>
        <button type="button" className="tb-link" onClick={() => onChange('transparent')}>
          Şaffof
        </button>
      </div>
    </Pop>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <label className="tb-slider">
      <span>
        {label} <b>{Math.round(value * 100) / 100}{unit}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

const ANIMS = [
  ['fade', 'Paydo böliş'], ['rise', 'Kötariliş'], ['drop', 'Tuşiş'], ['pan', 'Siljiş'], ['zoom', 'Kattalaşiş'],
  ['pop', 'Sakraş'], ['blur', 'Xiralik'], ['wipe', 'Oçiliş'], ['spin', 'Aylaniş'], ['breathe', 'Nafas'],
]
const LEGACY_SHAPES = new Set(['box', 'rect', 'circle', 'triangle', 'star', 'hexagon', 'line', 'arrow'])
const KIND_LABEL = { text: 'Matn', box: 'Şakl', image: 'Rasm', rect: 'Töğri törtburçak', circle: 'Doira', triangle: 'Uçburçak', star: 'Yulduz', hexagon: 'Olti burçak', line: 'Çiziq', arrow: 'Strelka' }

/**
 * @param {{ sel: object[], all: object[], theme: object, act: object }} p
 *   act: patch(patch|fn) · duplicate() · remove() · layer(dir) · alignPage(where) · alignSel(where) · distribute(axis)
 *        replaceImage(file) · select(ids) · animateAll(type) · play()
 */
export default function Toolbar({ sel, all, theme, act }) {
  const first = sel[0]
  const kinds = new Set(sel.map((e) => e.kind))
  const onlyText = kinds.size === 1 && kinds.has('text')
  const onlyImage = kinds.size === 1 && kinds.has('image')
  const shapey = [...kinds].every((k) => LEGACY_SHAPES.has(k))
  const file = useRef(null)
  const locked = sel.every((e) => e.locked)
  const set = (patch) => act.patch(patch)

  return (
    <div className="tb">
      {onlyText && (
        <>
          <Pop
            title="Şrift"
            wide
            button={
              <span className="tb-font" style={{ fontFamily: first.font ?? theme.bodyFont }}>
                {familyName(first.font ?? theme.bodyFont)}
              </span>
            }
          >
            {(close) => (
              <FontPicker
                value={first.font ?? ((first.weight ?? 400) >= 600 ? theme.titleFont : theme.bodyFont)}
                theme={theme}
                onPick={(css) => {
                  set({ font: css })
                  close()
                }}
              />
            )}
          </Pop>
          <span className="tb-size">
            <button type="button" onClick={() => act.patch((e) => ({ size: Math.max(0.5, Math.round((e.size - 0.2) * 10) / 10) }))} aria-label="Kiçikroq">
              <Minus size={14} />
            </button>
            <input
              value={Math.round((first.size ?? 2.4) * 10)}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v > 0) set({ size: v / 10 })
              }}
              title="Şrift ölçami"
            />
            <button type="button" onClick={() => act.patch((e) => ({ size: Math.round((e.size + 0.2) * 10) / 10 }))} aria-label="Kattaroq">
              <Plus size={14} />
            </button>
          </span>
          <ColorPop value={first.color} onChange={(c) => set({ color: c, fill: undefined })} title="Matn rangi" theme={theme}>
            <span className="tb-a" style={{ '--c': first.fill ? '#7c3aed' : first.color ?? theme.text }}>A</span>
          </ColorPop>
          <button type="button" className={`tb-btn ${(first.weight ?? 400) >= 600 ? 'on' : ''}`} onClick={() => set({ weight: (first.weight ?? 400) >= 600 ? 400 : 700 })} title="Qalin (⌘B)">
            <Bold size={16} />
          </button>
          <button type="button" className={`tb-btn ${first.italic ? 'on' : ''}`} onClick={() => set({ italic: !first.italic })} title="Kursiv (⌘I)">
            <Italic size={16} />
          </button>
          <button type="button" className={`tb-btn ${first.underline ? 'on' : ''}`} onClick={() => set({ underline: !first.underline })} title="Tagiga çiziş (⌘U)">
            <Underline size={16} />
          </button>
          <button type="button" className={`tb-btn ${first.upper ? 'on' : ''}`} onClick={() => set({ upper: !first.upper })} title="KATTA HARFLAR">
            <CaseUpper size={17} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => set({ align: { left: 'center', center: 'right', right: 'justify', justify: 'left' }[first.align ?? 'left'] })}
            title="Tekislaş"
          >
            {{ left: <AlignLeft size={16} />, center: <AlignCenter size={16} />, right: <AlignRight size={16} />, justify: <AlignJustify size={16} /> }[first.align ?? 'left']}
          </button>
          <Pop title="Oraliq" button={<LetterText size={16} />}>
            <div className="tb-col">
              <Slider label="Harflar orasi" value={first.ls ?? 0} min={-0.1} max={0.6} step={0.01} onChange={(v) => set({ ls: v })} unit="em" />
              <Slider label="Qatorlar orasi" value={first.lh ?? 1.2} min={0.7} max={2.5} step={0.05} onChange={(v) => set({ lh: v })} />
            </div>
          </Pop>
          <ColorPop value={first.bgc ?? 'transparent'} onChange={(c) => set({ bgc: c === 'transparent' ? undefined : c, bgi: undefined, pad: first.pad ?? '0.4cqw 1cqw' })} title="Matn foni" theme={theme}>
            <span className="tb-bgicon" style={{ background: first.bgc ?? 'repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/8px 8px' }}>
              <Type size={12} />
            </span>
          </ColorPop>
          <span className="tb-sep" />
        </>
      )}

      {shapey && sel.length > 0 && (
        <>
          <ColorPop
            value={first.bgc ?? first.color ?? theme.accent}
            // a box's gradient fill gives way to the colour; a repeating texture (graph paper) stays on top
            onChange={(c) => act.patch((e) => (e.kind === 'box' ? { bgc: c, ...(e.bgs ? {} : { bgi: undefined }) } : { color: c }))}
            title="Rang"
            theme={theme}
          >
            <span className="tb-fill" style={{ background: (first.bgs ? null : first.bgi) ?? first.bgc ?? first.color ?? theme.accent }} />
          </ColorPop>
          <Pop title="Çegara va burçaklar" button={<Square size={16} />}>
            <div className="tb-col">
              <Slider
                label="Burçak radiusi"
                value={parseFloat(first.radius) || 0}
                min={0}
                max={20}
                step={0.2}
                onChange={(v) => set({ radius: `${v}cqw` })}
                unit=""
              />
              <Slider
                label="Çegara qalinligi"
                value={parseFloat(first.border) || 0}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => set({ border: v ? `${v}cqw solid ${toHex(/solid (.+)$/.exec(first.border ?? '')?.[1] ?? theme.text)}` : undefined })}
              />
              <label className="tb-inline">
                Çegara rangi
                <input type="color" value={toHex(/solid (.+)$/.exec(first.border ?? '')?.[1] ?? theme.text)} onChange={(e) => set({ border: `${parseFloat(first.border) || 0.2}cqw solid ${e.target.value}` })} />
              </label>
            </div>
          </Pop>
          <span className="tb-sep" />
        </>
      )}

      {onlyImage && (
        <>
          <button type="button" className="tb-btn wide" onClick={() => file.current?.click()}>
            <ImagePlus size={16} /> {first.src ? 'Almaştiriş' : 'Rasm qöşiş'}
          </button>
          {first.src && (
            <button type="button" className="tb-btn wide" onClick={() => set({ src: null })}>
              Rasmni olib taşlaş
            </button>
          )}
          <Pop title="Burçaklar" button={<Square size={16} />}>
            <div className="tb-col">
              <Slider label="Burçak radiusi" value={parseFloat(first.radius) || 0} min={0} max={30} step={0.2} onChange={(v) => set({ radius: `${v}cqw` })} />
              <label className="tb-inline">
                <input type="checkbox" checked={first.fit === 'contain'} onChange={(e) => set({ fit: e.target.checked ? 'contain' : 'cover' })} /> Rasmni to‘liq körsatiş
              </label>
            </div>
          </Pop>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { e.target.files[0] && act.replaceImage(e.target.files[0]); e.target.value = '' }} />
          <span className="tb-sep" />
        </>
      )}

      <ElementTools sel={sel} theme={theme} act={act} />

      {sel.length > 1 && (
        <>
          <Pop title="Tanlanganlarni tekislaş" button={<AlignCenterHorizontal size={16} />}>
            <div className="tb-grid">
              {[
                ['left', AlignStartVertical, 'Chapga'], ['hcenter', AlignCenterVertical, 'Örtaga'], ['right', AlignEndVertical, 'Öngga'],
                ['top', AlignStartHorizontal, 'Tepaga'], ['vmiddle', AlignCenterHorizontal, 'Örtaga'], ['bottom', AlignEndHorizontal, 'Pastga'],
              ].map(([w, Icon, l]) => (
                <button key={w} type="button" onClick={() => act.alignSel(w)}>
                  <Icon size={16} /> {l}
                </button>
              ))}
              <button type="button" onClick={() => act.distribute('x')}>
                <AlignHorizontalDistributeCenter size={16} /> Teng (gorizontal)
              </button>
              <button type="button" onClick={() => act.distribute('y')}>
                <AlignVerticalDistributeCenter size={16} /> Teng (vertikal)
              </button>
            </div>
          </Pop>
          <span className="tb-count">{sel.length} ta element</span>
          <span className="tb-sep" />
        </>
      )}

      <Pop title="Animatsiya" button={<span className="tb-wide"><Sparkles size={15} /> Animatsiya</span>} align="right">
        {(close) => (
          <div className="tb-anim">
            <div className="tb-anim-grid">
              <button type="button" className={!first.anim ? 'on' : ''} onClick={() => set({ anim: undefined })}>
                Yöq
              </button>
              {ANIMS.map(([id, l]) => (
                <button key={id} type="button" className={first.anim?.type === id ? 'on' : ''} onClick={() => { set({ anim: { type: id, delay: first.anim?.delay ?? 0, dur: first.anim?.dur ?? 0.7 } }); act.play() }}>
                  <span className={`tb-anim-demo d-${id}`} />
                  {l}
                </button>
              ))}
            </div>
            {first.anim && (
              <>
                <Slider label="Kutiş" value={first.anim.delay ?? 0} min={0} max={4} step={0.1} onChange={(v) => set({ anim: { ...first.anim, delay: v } })} unit="s" />
                <Slider label="Davomiyligi" value={first.anim.dur ?? 0.7} min={0.2} max={3} step={0.1} onChange={(v) => set({ anim: { ...first.anim, dur: v } })} unit="s" />
              </>
            )}
            <div className="tb-row">
              <button type="button" className="tb-btn wide" onClick={() => { act.animateAll(first.anim?.type ?? 'rise'); close() }}>
                Butun sahifaga qöllaş
              </button>
              <button type="button" className="tb-btn wide" onClick={act.play}>
                <Play size={14} /> Körish
              </button>
            </div>
          </div>
        )}
      </Pop>

      <Pop title="Joylaşuv" button={<span className="tb-wide"><Layers size={15} /> Joylaşuv</span>} wide align="right">
        <div className="tb-pos">
          <span className="tb-label">Tartib</span>
          <div className="tb-grid">
            <button type="button" onClick={() => act.layer('up')}><ArrowUp size={15} /> Oldinga</button>
            <button type="button" onClick={() => act.layer('down')}><ArrowDown size={15} /> Orqaga</button>
            <button type="button" onClick={() => act.layer('front')}><BringToFront size={15} /> Eng oldinga</button>
            <button type="button" onClick={() => act.layer('back')}><SendToBack size={15} /> Eng orqaga</button>
          </div>
          <span className="tb-label">Sahifaga tekislaş</span>
          <div className="tb-grid three">
            {[
              ['left', AlignStartVertical, 'Chap'], ['hcenter', AlignCenterVertical, 'Örta'], ['right', AlignEndVertical, 'Öng'],
              ['top', AlignStartHorizontal, 'Tepa'], ['vmiddle', AlignCenterHorizontal, 'Örta'], ['bottom', AlignEndHorizontal, 'Past'],
            ].map(([w, Icon, l]) => (
              <button key={w} type="button" onClick={() => act.alignPage(w)}>
                <Icon size={15} /> {l}
              </button>
            ))}
          </div>
          {sel.length === 1 && (
            <>
              <span className="tb-label">Ölçam va joy (%)</span>
              <div className="tb-nums">
                {[['x', 'X'], ['y', 'Y'], ['w', 'Kenglik'], ['rotate', 'Burilish°']].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input type="number" step="0.5" value={Math.round((first[k] ?? 0) * 10) / 10} onChange={(e) => set({ [k]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
            </>
          )}
          <span className="tb-label">Qatlamlar</span>
          <div className="tb-layers">
            {[...all].reverse().map((e) => (
              <button key={e.id} type="button" className={sel.some((s) => s.id === e.id) ? 'on' : ''} onClick={(ev) => act.select(ev.shiftKey ? [...sel.map((s) => s.id), e.id] : [e.id])}>
                <span className="tb-layer-ic">{e.kind === 'text' ? <Type size={13} /> : e.kind === 'image' ? <ImageIcon size={13} /> : <Square size={13} />}</span>
                <span className="tb-layer-name">{e.kind === 'text' ? e.text.slice(0, 40) : e.bg ? t('el.kind.bg') : kindLabel(e.kind) ?? KIND_LABEL[e.kind] ?? e.kind}</span>
                {e.locked && <Lock size={12} />}
              </button>
            ))}
          </div>
        </div>
      </Pop>

      <Pop title="Şaffoflik" button={<Blend size={16} />} align="right">
        <div className="tb-col">
          <Slider label="Şaffoflik" value={Math.round((first.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} unit="%" />
        </div>
      </Pop>
      <button type="button" className={`tb-btn ${locked ? 'on' : ''}`} onClick={() => set({ locked: !locked })} title={locked ? 'Qulfdan oçiş' : 'Qulflaş'}>
        {locked ? <Lock size={16} /> : <LockOpen size={16} />}
      </button>
      <button type="button" className="tb-btn" onClick={act.duplicate} title="Nusxa (⌘D)">
        <Copy size={16} />
      </button>
      <button type="button" className="tb-btn danger" onClick={act.remove} title="Öçiriş (Delete)">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
