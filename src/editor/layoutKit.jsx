// Shared pieces of the page layouts (layouts.jsx, layoutsPro.jsx, charts.jsx): editable text and image
// slots bound to a field path, bullet lists, and concrete theme colours for SVG drawings.
// SVG drawings get real colour strings, not CSS variables: when a page is detached onto the canvas an
// <svg> becomes a standalone vector image, where var(--acc) would no longer resolve.
import AssetImg from '../components/AssetImg.jsx'
import { storeImage } from '../assets.js'
import { useRef } from 'react'
import { ImageSquare } from '@phosphor-icons/react'
import { t } from '../i18n/index.js'
import { Text } from './Text.jsx'

/* ───────── nested field paths: "cards.1.title" ───────── */

export const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

function setDeep(node, keys, value) {
  const [k, ...rest] = keys
  const copy = Array.isArray(node) ? [...node] : { ...(node ?? {}) }
  copy[k] = rest.length ? setDeep(copy[k], rest, value) : value
  return copy
}

/** Patch for the slide's top-level field that contains `path`. */
export function patchAt(slide, path, value) {
  const [head, ...rest] = path.split('.')
  return { [head]: rest.length ? setDeep(slide[head], rest, value) : value }
}

/* ───────── images: picked once, kept on this device; the deck holds an `asset:` reference ───────── */

export const downscale = (file, max = 1280) => storeImage(file, max)

export function ImageSlot({ ctx, path, className = '', frame }) {
  const input = useRef(null)
  const src = get(ctx.slide, path)
  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f?.type.startsWith('image/')) ctx.set(path, await downscale(f))
  }
  return (
    <div
      className={`ly-img f-${frame ?? ctx.theme.frame ?? 'round'} ${src ? '' : 'empty'} ${className}`}
      data-path={path}
      onClick={ctx.editable ? () => input.current?.click() : undefined}
      role={ctx.editable ? 'button' : undefined}
      title={ctx.editable ? t('ly.addImage') : undefined}
    >
      <div className="ly-img-in">
        {src ? (
          <AssetImg src={src} draggable={false} />
        ) : (
          <span className="ly-img-ph">
            <ImageSquare weight="duotone" />
            {ctx.editable && <small>{t('ly.addImage')}</small>}
          </span>
        )}
      </div>
      {ctx.editable && <input ref={input} type="file" accept="image/*" hidden onChange={pick} />}
    </div>
  )
}

/* ───────── editable text bound to a path ───────── */

export function T({ ctx, path, as = 'div', className, style }) {
  return <Text as={as} className={className} style={style} path={path} value={get(ctx.slide, path) ?? ''} editable={ctx.editable} onCommit={(v) => ctx.set(path, v)} />
}

export const Heading = ({ ctx, path = 'title' }) => <T ctx={ctx} path={path} className="ly-h" />

export function Bullets({ ctx, path = 'bullets', className = '' }) {
  const list = get(ctx.slide, path) ?? []
  return (
    <ul className={`ly-bullets ${className}`}>
      {list.map((_, i) => (
        <li key={i}>
          <span className="ly-dot" />
          <T ctx={ctx} path={`${path}.${i}`} as="span" />
        </li>
      ))}
    </ul>
  )
}

/** Two-digit ordinal: 1 → "01". */
export const num2 = (i) => String(i + 1).padStart(2, '0')

/**
 * Text-length class for a block: pages adapt the type size to how much they carry, so a long
 * paragraph never runs off the page and a short one does not float in empty space.
 * @returns {'' | 'long' | 'xlong'}
 */
export function density(texts, long, xlong) {
  const n = texts.reduce((a, s) => a + (typeof s === 'string' ? s.length : 0), 0)
  return n > xlong ? 'xlong' : n > long ? 'long' : ''
}

/* ───────── colours ───────── */

/** '#abc' · '#aabbcc' · 'rgb(…)' · 'rgba(…)' → [r, g, b, a], or null for anything else (gradients). */
export function parseColor(c) {
  if (typeof c !== 'string') return null
  const s = c.trim()
  let m = /^#([0-9a-f]{3,8})$/i.exec(s)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('')
    const n = (i) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s)
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2], Number.isFinite(p[3]) ? p[3] : 1]
  }
  return null
}

const rgba = ([r, g, b, a]) => (a >= 1 ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`)

/** `a` mixed with `w` of `b` (0 → a, 1 → b). Unknown colours give `a` unchanged. */
export function mix(a, b, w) {
  const x = parseColor(a)
  const y = parseColor(b)
  if (!x) return a
  if (!y) return rgba(x)
  return rgba(x.map((v, i) => v + (y[i] - v) * w))
}

/** The colour with opacity `alpha`. */
export function fade(c, alpha) {
  const x = parseColor(c)
  return x ? rgba([x[0], x[1], x[2], x[3] * alpha]) : c
}

/** Relative luminance (0 black … 1 white), for picking text on a coloured fill. */
export function luminance(c) {
  const x = parseColor(c)
  if (!x) return 0.5
  const ch = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(x[0]) + 0.7152 * ch(x[1]) + 0.0722 * ch(x[2])
}

/**
 * The series colours of a theme: its two accents first, then tints between them and the text
 * colour, so a chart reads as part of the design and its slices stay told apart.
 */
export function palette(theme, n = 6) {
  if (Array.isArray(theme.palette) && theme.palette.length) return Array.from({ length: n }, (_, i) => theme.palette[i % theme.palette.length])
  const a = theme.accent
  const b = theme.accent2 && theme.accent2 !== theme.accent ? theme.accent2 : mix(theme.accent, theme.text, 0.55)
  const tx = theme.text
  const all = [a, b, mix(a, tx, 0.5), mix(b, a, 0.5), mix(a, tx, 0.78), mix(b, tx, 0.4), mix(a, b, 0.25), fade(tx, 0.45)]
  // a series colour that melts into the page (an accent equal to the background) is left out
  const bg = solidOf(theme.bg)
  const base = bg ? all.filter((c, i) => i === 0 || contrast(c, bg) >= 1.35) : all
  return Array.from({ length: n }, (_, i) => base[i % base.length])
}

/** The page colour when it is one plain colour (or a gradient's first stop), else null. */
export function solidOf(bg) {
  if (parseColor(bg)) return bg
  const m = /(#[0-9a-f]{3,8}|rgba?\([^)]+\))/i.exec(String(bg ?? ''))
  return m ? m[1] : null
}

/** WCAG contrast ratio of two colours (1 … 21). */
export function contrast(a, b) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** A number in a value string: "1 370", "35%", "8,5 mln", "$12k" → 1370, 35, 8.5, 12. NaN when none. */
export function valueOf(v) {
  if (typeof v === 'number') return v
  const m = /-?\d[\d\s  ]*(?:[.,]\d+)*/.exec(String(v ?? ''))
  if (!m) return NaN
  let s = m[0].replace(/[\s  ]/g, '')
  // "1,370,000" / "1.370.000": thousands separators; "8,5": a decimal comma
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s) && !/^-?0[.,]/.test(s)) s = s.replace(/[.,]/g, '')
  return Number(s.replace(',', '.'))
}
