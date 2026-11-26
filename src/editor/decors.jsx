// Page backgrounds for the templates — original artwork in CSS/SVG (no stock images, no
// third-party designs). Sizes in cqw so they scale with the page. `cover` = first/last page,
// where some backgrounds show more; `index` lets a template vary page by page.
import { useId } from 'react'
import { t } from '../i18n/index.js'
import { PREMIUM_DECORS } from './premiumDecors.jsx'
import { StudioDecor } from './studioDecor.jsx'

const abs = (s) => ({ position: 'absolute', pointerEvents: 'none', ...s })

/* ───────── Gallery: dark canvas, spotlight, gilded double frame, corner flourishes ───────── */

function Flourish({ style, gold }) {
  return (
    <svg viewBox="0 0 100 100" style={abs({ width: '9cqw', height: '9cqw', ...style })} fill="none" stroke={gold} strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 94V40C6 20 20 6 40 6h54" />
      <path d="M16 94V48c0-18 14-32 32-32h46" opacity=".6" />
      <path d="M40 6c-6 10-4 20 6 24s16-2 14-10-12-8-14 0" />
      <path d="M6 40c10 6 20 4 24-6s-2-16-10-14-8 12 0 14" />
      <circle cx="16" cy="16" r="3.2" fill={gold} stroke="none" />
    </svg>
  )
}

function Gallery({ theme, cover }) {
  const gold = theme.accent
  return (
    <div style={abs({ inset: 0 })}>
      {/* canvas grain */}
      <div style={abs({ inset: 0, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.018) 0 0.2cqw, transparent 0.2cqw 0.6cqw)' })} />
      {/* spotlight from above */}
      <div style={abs({ left: '50%', top: '-30%', width: cover ? '90%' : '70%', height: '95%', transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at 50% 0%, rgba(255,226,170,.30), rgba(255,210,140,.08) 45%, transparent 70%)' })} />
      {/* vignette */}
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,.55))' })} />
      {/* gilded double frame */}
      <div style={abs({ inset: '3.2cqw', border: `0.18cqw solid ${gold}99` })} />
      <div style={abs({ inset: '3.9cqw', border: `0.08cqw solid ${gold}55` })} />
      <Flourish gold={gold} style={{ left: '2.3cqw', top: '2.3cqw' }} />
      <Flourish gold={gold} style={{ right: '2.3cqw', top: '2.3cqw', transform: 'scaleX(-1)' }} />
      <Flourish gold={gold} style={{ left: '2.3cqw', bottom: '2.3cqw', transform: 'scaleY(-1)' }} />
      <Flourish gold={gold} style={{ right: '2.3cqw', bottom: '2.3cqw', transform: 'scale(-1)' }} />
    </div>
  )
}

/* ───────── Book: an open book on a dark desk, warm candle light ───────── */

function Book({ theme }) {
  const page = theme.page ?? '#efe2c3'
  return (
    <div style={abs({ inset: 0 })}>
      {/* desk wood */}
      <div style={abs({ inset: 0, background: 'repeating-linear-gradient(178deg, rgba(0,0,0,.10) 0 0.25cqw, transparent 0.25cqw 1.6cqw)' })} />
      {/* candle glow */}
      <div style={abs({ left: '-12%', top: '-25%', width: '55%', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,190,90,.45), transparent 65%)' })} />
      {/* page stack shadow */}
      <div style={abs({ left: '5%', right: '5%', top: '6.5%', bottom: '4.5%', borderRadius: '1.2cqw', background: '#00000055', filter: 'blur(1.4cqw)' })} />
      {/* page edges (stacked sheets) */}
      {[3, 2, 1].map((k) => (
        <div key={k} style={abs({ left: `${6 - k * 0.35}%`, right: `${6 - k * 0.35}%`, top: `${7 + k * 0.5}%`, bottom: `${6 - k * 0.6}%`, background: '#d9c69c', borderRadius: '0.8cqw', boxShadow: 'inset 0 0 0 0.08cqw #b89f6c' })} />
      ))}
      {/* the two pages, with a gutter shadow down the middle */}
      <div
        style={abs({
          left: '6%',
          right: '6%',
          top: '7%',
          bottom: '7%',
          borderRadius: '0.6cqw',
          background: `linear-gradient(90deg, ${page} 0%, ${page} 44%, #c9b48a 49.6%, #b39d70 50%, #c9b48a 50.4%, ${page} 56%, ${page} 100%)`,
          boxShadow: 'inset 0 0 4cqw rgba(120,80,30,.28)',
        })}
      />
      {/* paper fibres */}
      <div style={abs({ left: '6%', right: '6%', top: '7%', bottom: '7%', background: 'repeating-linear-gradient(0deg, rgba(120,80,30,.035) 0 0.12cqw, transparent 0.12cqw 0.9cqw)' })} />
    </div>
  )
}

/* ───────── Quiz: notebook card with spiral, pastel border that changes per page, blob friends ───────── */

function Blob({ color, style, flip }) {
  return (
    <svg viewBox="0 0 120 110" style={abs({ width: '13cqw', ...style, transform: flip ? 'scaleX(-1)' : undefined })}>
      <path d="M60 4c30 0 56 18 56 50s-22 52-56 52S4 86 4 56 30 4 60 4z" fill={color} />
      <circle cx="44" cy="50" r="5" fill="#1f2937" />
      <circle cx="74" cy="50" r="5" fill="#1f2937" />
      <path d="M46 68c8 8 20 8 28 0" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="34" cy="64" rx="6" ry="3.5" fill="#fff" opacity=".45" />
    </svg>
  )
}

function Quiz({ theme, index }) {
  const cycle = theme.cycle ?? ['#f9c6d3']
  const edge = cycle[index % cycle.length]
  const blobA = cycle[(index + 2) % cycle.length]
  const blobB = cycle[(index + 1) % cycle.length]
  return (
    <div style={abs({ inset: 0, background: edge })}>
      {/* notebook card on graph paper */}
      <div
        style={abs({
          inset: '4.5cqw 3.2cqw 3.2cqw',
          borderRadius: '2cqw',
          background: '#fffdf8',
          backgroundImage: 'linear-gradient(rgba(70,90,140,.07) 0.08cqw, transparent 0.08cqw), linear-gradient(90deg, rgba(70,90,140,.07) 0.08cqw, transparent 0.08cqw)',
          backgroundSize: '2.6cqw 2.6cqw',
          boxShadow: '0 0.5cqw 0 rgba(0,0,0,.08)',
        })}
      />
      {/* spiral binding */}
      <div style={abs({ left: '18%', right: '18%', top: '2.6cqw', display: 'flex', justifyContent: 'space-between' })}>
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} style={{ width: '1.1cqw', height: '3.6cqw', borderRadius: '0.6cqw', border: '0.32cqw solid #374151', background: 'transparent' }} />
        ))}
      </div>
      {/* doodles */}
      <svg viewBox="0 0 200 60" style={abs({ right: '6%', bottom: '8%', width: '16cqw' })} fill="none" stroke={theme.accent} strokeWidth="3" strokeLinecap="round">
        <path d="M4 40c14-26 26 26 40 0s26 26 40 0 26 26 40 0 26 26 40 0" />
      </svg>
      <svg viewBox="0 0 60 60" style={abs({ right: '13%', bottom: '20%', width: '3.4cqw' })} fill="none" stroke={theme.accent2 ?? theme.accent} strokeWidth="4" strokeLinecap="round">
        <path d="M30 6v48M6 30h48M13 13l34 34M47 13 13 47" />
      </svg>
      <Blob color={blobA} style={{ left: '-2.5cqw', bottom: '-2.5cqw' }} />
      <Blob color={blobB} flip style={{ right: '-2.5cqw', top: '10%', width: '10cqw' }} />
    </div>
  )
}

/* ───────── Law: deep colour, columns of light, a slim header bar ───────── */

function ScalesMark({ color }) {
  return (
    <svg viewBox="0 0 40 40" style={{ width: '100%', height: '100%' }} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 5v29M11 34h18M8 11h24M8 11l-5 11h10L8 11zM32 11l-5 11h10l-5-11z" />
      <circle cx="20" cy="6" r="2" fill={color} stroke="none" />
    </svg>
  )
}

function Law({ theme, index }) {
  const c = theme.text
  return (
    <div style={abs({ inset: 0 })}>
      {/* light through tall windows */}
      {theme.beams !== false && [18, 38, 58].map((x) => (
        <div key={x} style={abs({ left: `${x}%`, top: '-10%', width: '9%', height: '130%', transform: 'skewX(-14deg)', background: 'linear-gradient(180deg, rgba(255,255,255,.07), transparent 75%)' })} />
      ))}
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 85% 110%, rgba(0,0,0,.45), transparent 60%)' })} />
      {/* header bar: mark + nav pills */}
      <div style={abs({ left: '5%', right: '5%', top: '4.5%', height: '3cqw', display: 'flex', alignItems: 'center', gap: '1cqw' })}>
        <span style={{ width: '2.4cqw', height: '2.4cqw' }}>
          <ScalesMark color={c} />
        </span>
        <span style={{ width: '9cqw', height: '0.5cqw', borderRadius: 9, background: c, opacity: 0.8 }} />
        <span style={{ flex: 1 }} />
        {[5, 6, 5].map((w, i) => (
          <span key={i} style={{ width: `${w}cqw`, height: '0.45cqw', borderRadius: 9, background: c, opacity: 0.45 }} />
        ))}
      </div>
      <div style={abs({ left: '5%', right: '5%', top: '9.2%', height: '0.08cqw', background: c, opacity: 0.25 })} />
      {/* big watermark mark on the cover */}
      {index === 0 && (
        <div style={abs({ right: '4%', bottom: '-6%', width: '42cqw', height: '42cqw', opacity: 0.08 })}>
          <ScalesMark color={c} />
        </div>
      )}
    </div>
  )
}

/* ───────── Pitch: product-launch look — glow orb, header, page counter ───────── */

function Pitch({ theme, index }) {
  const uid = useId().replace(/:/g, '')
  const cover = index === 0 // the big glow belongs to the cover; the closing page keeps text clear
  return (
    <div style={abs({ inset: 0 })}>
      <div
        style={abs({
          right: cover ? '-12%' : '-22%',
          bottom: cover ? '-40%' : '-60%',
          width: cover ? '62%' : '48%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 40%, #ffffffcc, ${theme.accent} 35%, ${theme.accent}00 70%)`,
          filter: 'blur(1.2cqw)',
          opacity: 0.85,
        })}
      />
      <svg style={abs({ inset: 0, width: '100%', height: '100%', opacity: 0.5 })}>
        <defs>
          <pattern id={uid} width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill={theme.muted} opacity=".35" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${uid})`} style={{ maskImage: 'linear-gradient(90deg, transparent, #000)' }} />
      </svg>
      {/* header: logo mark · line · page counter */}
      <div style={abs({ left: '6%', right: '6%', top: '5%', display: 'flex', alignItems: 'center', gap: '1cqw', color: theme.muted, fontSize: '1.1cqw', fontWeight: 600 })}>
        <span style={{ width: '1.8cqw', height: '1.8cqw', borderRadius: '0.5cqw', background: theme.accent }} />
        <span style={{ width: '7cqw', height: '0.45cqw', borderRadius: 9, background: theme.text, opacity: 0.7 }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(index + 1).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

/* ───────── Brand: warm paper, a crimson sun, meta row ───────── */

function Brand({ theme, cover }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: 'repeating-radial-gradient(circle at 20% 30%, rgba(0,0,0,.012) 0 0.15cqw, transparent 0.15cqw 0.5cqw)' })} />
      <div
        style={abs({
          right: cover ? '-9cqw' : '-14cqw',
          bottom: cover ? '-9cqw' : '-16cqw',
          width: cover ? '30cqw' : '24cqw',
          aspectRatio: '1',
          borderRadius: '50%',
          background: theme.accent,
          opacity: cover ? 1 : 0.9,
        })}
      />
      <div style={abs({ left: '6%', right: '6%', top: '5%', display: 'flex', alignItems: 'center', gap: '1.2cqw' })}>
        <span style={{ width: '1.3cqw', height: '1.3cqw', borderRadius: '50%', background: theme.accent }} />
        <span style={{ width: '6cqw', height: '0.4cqw', borderRadius: 9, background: theme.text, opacity: 0.75 }} />
        <span style={{ flex: 1, height: '0.08cqw', background: theme.text, opacity: 0.2 }} />
        <span style={{ width: '5cqw', height: '0.4cqw', borderRadius: 9, background: theme.text, opacity: 0.45 }} />
      </div>
    </div>
  )
}

/* ───────── Velvet: deep wine, soft vignette, monogram in the corner ───────── */

function Velvet({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.06), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(0,0,0,.45), transparent 60%)' })} />
      <div style={abs({ inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 0.2cqw, transparent 0.2cqw 0.8cqw)' })} />
      <div style={abs({ left: '5%', bottom: '5.5%', display: 'flex', alignItems: 'center', gap: '0.8cqw' })}>
        <span style={{ width: '2cqw', height: '2cqw' }}>
          <ScalesMark color={theme.accent} />
        </span>
        <span style={{ width: '7cqw', height: '0.35cqw', borderRadius: 9, background: theme.text, opacity: 0.55 }} />
      </div>
      <div style={abs({ right: '5%', top: '6%', fontSize: '1.1cqw', color: theme.muted, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.1em' })}>
        {String(index + 1).padStart(2, '0')}
      </div>
    </div>
  )
}

/* ───────── Agency: editorial page — slim header with mark, hairline, page tag ───────── */

function Agency({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '0.9cqw' })}>
        <span style={{ width: '1.8cqw', height: '1.8cqw' }}>
          <ScalesMark color={theme.text} />
        </span>
        <span style={{ width: '6cqw', height: '0.35cqw', borderRadius: 9, background: theme.text, opacity: 0.85 }} />
        <span style={{ flex: 1 }} />
        <span style={{ padding: '0.35cqw 1cqw', borderRadius: 9, border: `0.1cqw solid ${theme.text}55`, color: theme.text, fontSize: '0.95cqw', fontWeight: 700, letterSpacing: '0.12em' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div style={abs({ left: '5%', right: '5%', top: '10%', height: '0.08cqw', background: theme.text, opacity: 0.18 })} />
    </div>
  )
}

/* ───────── Rights: warm paper, header pills, orange asterisk ───────── */

function Asterisk({ color, style }) {
  return (
    <svg viewBox="0 0 40 40" style={abs({ width: '3cqw', ...style })} fill={color}>
      {[0, 30, 60, 90, 120, 150].map((r) => (
        <rect key={r} x="18" y="2" width="4" height="36" rx="2" transform={`rotate(${r} 20 20)`} />
      ))}
    </svg>
  )
}

function Rights({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '1cqw' })}>
        <span style={{ width: '1.6cqw', height: '1.6cqw', borderRadius: '50%', background: theme.accent2 }} />
        <span style={{ width: '8cqw', height: '0.4cqw', borderRadius: 9, background: theme.text, opacity: 0.8 }} />
        <span style={{ flex: 1 }} />
        <span style={{ width: '9cqw', height: '0.4cqw', borderRadius: 9, background: theme.text, opacity: 0.45 }} />
      </div>
      <Asterisk color={theme.accent2} style={index % 2 ? { left: '46%', top: '18%' } : { right: '8%', top: '15%' }} />
      <div style={abs({ left: 0, right: 0, bottom: 0, height: '1.2cqw', background: theme.accent })} />
    </div>
  )
}

/* ───────── Skyline: night gradient, stars, city silhouette ───────── */

function Skyline({ theme, index }) {
  const uid = useId().replace(/:/g, '')
  const towers = [[0, 22], [6, 34], [11, 26], [16, 44], [22, 30], [27, 52], [33, 36], [39, 28], [44, 48], [50, 32], [56, 40], [62, 24], [67, 56], [73, 34], [79, 42], [85, 26], [90, 38], [95, 30]]
  return (
    <div style={abs({ inset: 0 })}>
      <svg style={abs({ inset: 0, width: '100%', height: '100%', opacity: 0.6 })}>
        <defs>
          <pattern id={uid} width="90" height="70" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="18" r="1.1" fill="#fff" opacity=".55" />
            <circle cx="61" cy="44" r=".8" fill="#fff" opacity=".4" />
            <circle cx="80" cy="9" r=".6" fill="#fff" opacity=".5" />
          </pattern>
        </defs>
        <rect width="100%" height="55%" fill={`url(#${uid})`} />
      </svg>
      <div style={abs({ left: '-10%', top: '-30%', width: '60%', aspectRatio: '1', borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent}33, transparent 65%)` })} />
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={abs({ left: 0, right: 0, bottom: 0, width: '100%', height: index === 0 ? '42%' : '26%', opacity: 0.35 })}>
        {towers.map(([x, h]) => (
          <rect key={x} x={x} y={60 - h} width="5.4" height={h} fill="#06121c" />
        ))}
      </svg>
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '1cqw' })}>
        <span style={{ width: '7cqw', height: '0.4cqw', borderRadius: 9, background: theme.text, opacity: 0.8 }} />
        <span style={{ flex: 1 }} />
        <span style={{ width: '1.6cqw', height: '1.6cqw', borderRadius: '50%', border: `0.15cqw solid ${theme.accent}` }} />
      </div>
    </div>
  )
}

/* ───────── shared doodle bits (hand-drawn look, original SVG) ───────── */

const pick = (list, i) => list[((i % list.length) + list.length) % list.length]

function Scribble({ color, style, d = 'M5 40c20-30 40 30 60 0s40 30 60 0 40 30 60 0' }) {
  return (
    <svg viewBox="0 0 190 60" style={abs({ width: '14cqw', ...style })} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function Spiral({ color, style }) {
  return (
    <svg viewBox="0 0 100 100" style={abs({ width: '7cqw', ...style })} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round">
      <path d="M50 50c0-6 9-6 9 0s-9 15-17 9-6-24 8-25 26 12 22 28-26 26-40 16-14-38 4-46" />
    </svg>
  )
}

function Bulb({ color, style }) {
  return (
    <svg viewBox="0 0 60 80" style={abs({ width: '4.4cqw', ...style })} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 8c-12 0-20 9-20 20 0 9 6 13 9 20v6h22v-6c3-7 9-11 9-20 0-11-8-20-20-20z" />
      <path d="M21 62h18M23 70h14M30 0v-6M4 12-2 8M56 12l6-4" />
    </svg>
  )
}

function Star4({ color, style }) {
  return (
    <svg viewBox="0 0 40 40" style={abs({ width: '2.4cqw', ...style })} fill={color}>
      <path d="M20 0c2 12 8 18 20 20-12 2-18 8-20 20-2-12-8-18-20-20 12-2 18-8 20-20z" />
    </svg>
  )
}

/* ───────── Kids: white page, bright pen scribbles, lightbulb ───────── */

const KID_INKS = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

function Kids({ index }) {
  const a = pick(KID_INKS, index)
  const b = pick(KID_INKS, index + 2)
  const c = pick(KID_INKS, index + 4)
  return (
    <div style={abs({ inset: 0 })}>
      <Scribble color={a} style={{ left: '-2cqw', top: '4%', width: '12cqw', transform: 'rotate(-18deg)' }} />
      <Spiral color={b} style={{ right: '3%', bottom: '6%' }} />
      <Scribble color={c} style={{ right: '-2cqw', top: '10%', width: '10cqw', transform: 'rotate(24deg)' }} d="M5 10l30 40 30-40 30 40 30-40 30 40" />
      <Bulb color="#10b981" style={{ right: '9%', top: '5%' }} />
      <Scribble color={b} style={{ left: '3%', bottom: '4%', width: '9cqw', transform: 'rotate(8deg)' }} d="M5 30h170M5 45h120" />
      <Star4 color={a} style={{ left: '46%', bottom: '6%' }} />
    </div>
  )
}

/* ───────── Crayon: grid paper, sun, flowers, clouds ───────── */

function Flower({ petal, style }) {
  return (
    <svg viewBox="0 0 80 120" style={abs({ width: '6cqw', ...style })}>
      <path d="M40 60v58" stroke="#3f9b3a" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 95c-10-14-26-12-30-4 12 6 20 8 30 4zM40 85c10-14 26-12 30-4-12 6-20 8-30 4z" fill="#58b84a" />
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="40" cy="22" rx="11" ry="17" fill={petal} transform={`rotate(${r} 40 40)`} />
      ))}
      <circle cx="40" cy="40" r="11" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
    </svg>
  )
}

function Sun({ style }) {
  return (
    <svg viewBox="0 0 100 100" style={abs({ width: '10cqw', ...style })} stroke="#f59e0b" strokeWidth="5" strokeLinecap="round">
      {Array.from({ length: 12 }, (_, k) => (
        <path key={k} d="M50 8v12" transform={`rotate(${k * 30} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="22" fill="#fcd34d" />
      <path d="M42 54c4 5 12 5 16 0" fill="none" stroke="#b45309" strokeWidth="3.5" />
      <circle cx="43" cy="45" r="2.5" fill="#b45309" stroke="none" />
      <circle cx="57" cy="45" r="2.5" fill="#b45309" stroke="none" />
    </svg>
  )
}

function Cloud({ style }) {
  return (
    <svg viewBox="0 0 120 60" style={abs({ width: '10cqw', ...style })}>
      <path d="M20 50c-12 0-16-16-4-20 0-14 18-20 28-10 6-14 30-14 34 2 14-4 26 8 20 20 6 6 2 12-6 12H20z" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="3" />
    </svg>
  )
}

function Crayon({ index, cover }) {
  const petals = ['#f87171', '#fb923c', '#f472b6', '#a78bfa']
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, backgroundImage: 'linear-gradient(rgba(120,120,140,.12) 0.1cqw, transparent 0.1cqw), linear-gradient(90deg, rgba(120,120,140,.12) 0.1cqw, transparent 0.1cqw)', backgroundSize: '3.2cqw 3.2cqw' })} />
      <Sun style={{ right: '1.5%', top: '2%' }} />
      <Cloud style={{ left: cover ? '38%' : '60%', top: '3%', width: '8cqw' }} />
      <Flower petal={pick(petals, index)} style={{ left: '1.5%', bottom: '-1%' }} />
      <Flower petal={pick(petals, index + 1)} style={{ left: '6.5%', bottom: '-4%', width: '4.6cqw' }} />
      {cover && <Flower petal={pick(petals, index + 2)} style={{ right: '4%', bottom: '-2%', width: '5.4cqw' }} />}
      <Star4 color="#f472b6" style={{ right: '4%', bottom: '24%' }} />
    </div>
  )
}

/* ───────── Sketch: graph paper, pencil-sketched study objects ───────── */

function SketchBook({ style }) {
  return (
    <svg viewBox="0 0 120 80" style={abs({ width: '11cqw', ...style })} fill="none" stroke="#4b5563" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 18C46 8 24 8 8 14v56c16-6 38-6 52 4 14-10 36-10 52-4V14c-16-6-38-6-52 4zM60 18v56" />
      <path d="M16 26c12-3 26-3 36 2M16 36c12-3 26-3 36 2M16 46c12-3 26-3 36 2M68 28c10-5 24-5 36-2M68 38c10-5 24-5 36-2M68 48c10-5 24-5 36-2" opacity=".6" />
    </svg>
  )
}

function SketchPencil({ style }) {
  return (
    <svg viewBox="0 0 120 40" style={abs({ width: '11cqw', ...style })} fill="none" stroke="#4b5563" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M10 14h84l18 6-18 6H10z" />
      <path d="M94 14v12M10 14v12M22 14v12" />
      <path d="M106 18l6 2-6 2z" fill="#4b5563" />
      <path d="M30 18h60M30 22h60" opacity=".45" />
    </svg>
  )
}

function SketchGlobe({ style }) {
  return (
    <svg viewBox="0 0 80 100" style={abs({ width: '7cqw', ...style })} fill="none" stroke="#4b5563" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="40" cy="40" r="28" />
      <ellipse cx="40" cy="40" rx="12" ry="28" />
      <path d="M12 40h56M16 26h48M16 54h48" opacity=".6" />
      <path d="M8 40a32 32 0 0 0 64 0M40 72v14M24 90h32" />
    </svg>
  )
}

function Sketch({ index }) {
  const corner = index % 3
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, backgroundImage: 'linear-gradient(rgba(90,100,120,.1) 0.08cqw, transparent 0.08cqw), linear-gradient(90deg, rgba(90,100,120,.1) 0.08cqw, transparent 0.08cqw)', backgroundSize: '2.4cqw 2.4cqw' })} />
      {corner === 0 && <SketchBook style={{ right: '4%', bottom: '6%' }} />}
      {corner === 1 && <SketchGlobe style={{ right: '5%', bottom: '5%' }} />}
      {corner === 2 && <SketchPencil style={{ right: '4%', bottom: '8%', transform: 'rotate(-12deg)' }} />}
      <SketchPencil style={{ left: '-2%', top: '4%', width: '9cqw', transform: 'rotate(28deg)', opacity: 0.8 }} />
      <svg viewBox="0 0 60 40" style={abs({ right: '6%', top: '6%', width: '5cqw' })} fill="none" stroke="#f5b800" strokeWidth="5" strokeLinecap="round">
        <path d="M4 30C18 6 36 4 52 14M44 4l8 10-12 4" />
      </svg>
    </div>
  )
}

/* ───────── Chalkboard: slate board, pastel paint blobs on the edges, chalk stars ───────── */

const PASTELS = ['#f9c6d3', '#fde68a', '#c4b5fd', '#bbf7d0', '#bae6fd', '#fdba74']

function Blobby({ color, style, d = 'M50 4c26 0 46 16 46 40S78 96 52 96 4 80 6 52 24 4 50 4z' }) {
  return (
    <svg viewBox="0 0 100 100" style={abs({ width: '10cqw', ...style })}>
      <path d={d} fill={color} />
    </svg>
  )
}

function Chalkboard({ index, cover }) {
  const c = (k) => pick(PASTELS, index + k)
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,.07), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(0,0,0,.35), transparent 60%)' })} />
      <div style={abs({ inset: 0, backgroundImage: 'repeating-linear-gradient(17deg, rgba(255,255,255,.025) 0 0.25cqw, transparent 0.25cqw 1.4cqw)' })} />
      {/* edge blobs: top and bottom rows */}
      <Blobby color={c(0)} style={{ left: '-3cqw', bottom: '-4cqw', width: '13cqw' }} />
      <Blobby color={c(1)} style={{ left: '8cqw', bottom: '-6cqw', width: '11cqw' }} d="M10 40C14 14 46 2 70 12s32 40 16 60-58 26-72 6-8-24-4-38z" />
      <Blobby color={c(2)} style={{ right: '-3cqw', bottom: '-5cqw', width: '14cqw' }} />
      <Blobby color={c(3)} style={{ right: '9cqw', bottom: '-7cqw', width: '9cqw' }} d="M10 40C14 14 46 2 70 12s32 40 16 60-58 26-72 6-8-24-4-38z" />
      {cover && <Blobby color={c(4)} style={{ left: '30%', top: '-5cqw', width: '12cqw' }} />}
      {cover && <Blobby color={c(5)} style={{ right: '20%', top: '-6cqw', width: '10cqw' }} d="M10 40C14 14 46 2 70 12s32 40 16 60-58 26-72 6-8-24-4-38z" />}
      {/* chalk doodles */}
      <Star4 color="rgba(255,255,255,.75)" style={{ right: '8%', top: '10%' }} />
      <Star4 color="rgba(255,255,255,.5)" style={{ left: '6%', top: '16%', width: '1.6cqw' }} />
      <Scribble color="rgba(255,255,255,.55)" style={{ right: '5%', top: '24%', width: '7cqw' }} />
    </div>
  )
}

/* ───────── Doodle: grid paper, black ink doodles, stick-figure thinker ───────── */

function Thinker({ style }) {
  return (
    <svg viewBox="0 0 100 160" style={abs({ width: '10cqw', ...style })} fill="none" stroke="#1f2937" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="52" r="18" fill="#fff" />
      <path d="M43 50h0M57 50h0" strokeWidth="5" />
      <path d="M44 60c4 3 8 3 12 0" />
      <path d="M50 70v46M50 84l-22 14M50 84l20-10 6-18M50 116l-16 34M50 116l16 34" />
      <path d="M50 4v10M28 12l6 8M72 12l-6 8M20 32l8 4M80 32l-8 4" stroke="#f59e0b" />
    </svg>
  )
}

function Doodle({ index, cover }) {
  const flip = index % 2 === 1 // a boolean: `0 && …` would print a stray 0
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, backgroundImage: 'linear-gradient(rgba(60,70,90,.08) 0.08cqw, transparent 0.08cqw), linear-gradient(90deg, rgba(60,70,90,.08) 0.08cqw, transparent 0.08cqw)', backgroundSize: '2.2cqw 2.2cqw' })} />
      <Star4 color="#111827" style={{ left: '5%', top: '8%' }} />
      <Star4 color="#111827" style={{ left: '8%', top: '15%', width: '1.4cqw' }} />
      <Star4 color="#111827" style={{ right: '6%', bottom: '10%', width: '1.8cqw' }} />
      <svg viewBox="0 0 80 50" style={abs({ right: '7%', top: '7%', width: '6cqw' })} fill="none" stroke="#111827" strokeWidth="3.4" strokeLinecap="round">
        <path d="M4 40C10 10 40 4 50 22s-10 24-16 10S50 4 74 12M66 4l9 8-11 5" />
      </svg>
      {(cover || flip) && <Thinker style={{ right: '3%', bottom: '2%' }} />}
      <svg viewBox="0 0 60 30" style={abs({ left: '4%', bottom: '7%', width: '6cqw' })} fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round">
        <path d="M4 15c8-10 14 10 22 0s14 10 22 0 8-6 8-6" />
      </svg>
    </div>
  )
}

/* ───────── Stage 3: debate, training, workshop ───────── */

function Lectern({ color = '#1a0606', style }) {
  return (
    <svg viewBox="0 0 120 120" style={abs({ width: '16cqw', ...style })}>
      <path d="M14 30h92l-6 14H20z" fill={color} />
      <path d="M30 44h60l-6 70H36z" fill={color} />
      <rect x="44" y="60" width="32" height="18" rx="3" fill="#ffffff22" />
      <path d="M60 30V12M60 12l-8-6" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="51" cy="5" r="4" fill={color} />
    </svg>
  )
}

/* Debate stage: deep red, spotlight beams, lecterns */
function Stage({ theme, index }) {
  const cover = index === 0
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 50% 120%, rgba(255,80,60,.45), transparent 60%)' })} />
      {[-18, 18].map((r, k) => (
        <div key={r} style={abs({ left: k ? '62%' : '8%', top: '-20%', width: '30%', height: '140%', transform: `rotate(${r}deg)`, background: 'linear-gradient(180deg, rgba(255,235,220,.16), transparent 70%)', filter: 'blur(0.6cqw)' })} />
      ))}
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(0,0,0,.5))' })} />
      {cover ? (
        <>
          <Lectern style={{ left: '6%', bottom: '-2%' }} />
          <Lectern style={{ right: '6%', bottom: '-2%', transform: 'scaleX(-1)' }} />
        </>
      ) : (
        <Lectern style={{ right: '3%', bottom: '-4%', width: '11cqw', opacity: 0.55 }} />
      )}
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '1cqw' })}>
        <span style={{ padding: '0.3cqw 1cqw', borderRadius: 9, background: theme.accent, color: '#fff', fontSize: '0.9cqw', fontWeight: 800, letterSpacing: '0.1em' }}>{t('dc.debate')}</span>
        <span style={{ flex: 1, height: '0.08cqw', background: theme.text, opacity: 0.25 }} />
      </div>
    </div>
  )
}

/* Splash: white page, bright paint splashes in the corners, lime marker */
function Splash({ index }) {
  const sets = [['#a3e635', '#fb923c', '#3b82f6'], ['#3b82f6', '#a3e635', '#f43f5e'], ['#fb923c', '#8b5cf6', '#a3e635']]
  const [a, b, c] = pick(sets, index)
  const blob = 'M50 6c14-6 30 6 32 20s14 14 12 30-20 22-30 30-28 10-38 0S2 66 6 50 36 12 50 6z'
  return (
    <div style={abs({ inset: 0 })}>
      <Blobby color={a} d={blob} style={{ left: '-3cqw', bottom: '-3cqw', width: '11cqw', transform: 'rotate(20deg)' }} />
      <Blobby color={b} d={blob} style={{ left: '5cqw', bottom: '-5cqw', width: '7cqw' }} />
      <Blobby color={c} d={blob} style={{ right: '-3cqw', top: '-3cqw', width: '10cqw', transform: 'rotate(-30deg)' }} />
      <Scribble color={a} style={{ right: '8%', top: '8%', width: '8cqw' }} d="M5 40c10-30 30-30 30 0s20 30 30 0 20-30 30 0" />
      <div style={abs({ left: '5%', top: '5%', fontSize: '1cqw', fontWeight: 700, color: '#111', opacity: 0.6, letterSpacing: '0.05em' }) }>QalamAI · {String(index + 1).padStart(2, '0')}</div>
    </div>
  )
}

/* Club: cream paper, maroon rule bars, header hairline */
function Club({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '1cqw', fontSize: '0.95cqw', fontWeight: 700, color: theme.text })}>
        <span>QalamAI</span>
        <span style={{ flex: 1, height: '0.08cqw', background: theme.text, opacity: 0.3 }} />
        <span style={{ opacity: 0.6 }}>{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div style={abs({ left: '5%', right: '5%', bottom: '5%', height: '0.08cqw', background: theme.text, opacity: 0.3 })} />
      {index === 0 && <Lectern color={theme.accent2} style={{ right: '6%', bottom: '0', width: '15cqw' }} />}
    </div>
  )
}

/* Training: white page, orange edge bar, dark corner block, page number */
function Training({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ right: 0, top: '12%', width: '1.4cqw', height: '40%', background: theme.accent })} />
      <div style={abs({ left: '5%', bottom: '5%', display: 'flex', flexDirection: 'column', gap: '0.3cqw' })}>
        <span style={{ fontSize: '1cqw', fontWeight: 800, color: theme.accent, letterSpacing: '0.06em' }}>QALAMAI</span>
        <span style={{ fontSize: '0.8cqw', color: theme.muted }}>{t('dc.training')}</span>
      </div>
      <div style={abs({ right: '4%', bottom: '4%', fontSize: '3cqw', fontWeight: 800, color: theme.text, opacity: 0.08 })}>{String(index + 1).padStart(2, '0')}</div>
      <div style={abs({ right: '5%', top: '5%', width: '9cqw', height: '0.35cqw', background: theme.text, opacity: 0.6 })} />
    </div>
  )
}

/* Roadmap: cream page, dashed winding road, orange sparkles */
function Roadmap({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, backgroundImage: `radial-gradient(${theme.accent}22 0.12cqw, transparent 0.13cqw)`, backgroundSize: '2.4cqw 2.4cqw' })} />
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={abs({ left: 0, right: 0, bottom: 0, width: '100%', height: index === 0 ? '34%' : '16%' })}>
        <path d="M-10 110C80 110 90 40 190 50s130 50 220 0" fill="none" stroke="#1f2937" strokeWidth="16" strokeLinecap="round" opacity=".9" />
        <path d="M-10 110C80 110 90 40 190 50s130 50 220 0" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="10 10" />
      </svg>
      <Star4 color={theme.accent2} style={{ right: '7%', top: '9%' }} />
      <Star4 color={theme.accent2} style={{ right: '11%', top: '15%', width: '1.4cqw' }} />
      <div style={abs({ left: '5%', top: '5%', padding: '0.3cqw 1cqw', borderRadius: 9, background: theme.accent2, color: '#fff', fontSize: '0.9cqw', fontWeight: 700 })}>{String(index + 1).padStart(2, '0')}</div>
    </div>
  )
}

/* Workshop: clean white, ink line people, header with page counter */
function People({ style }) {
  return (
    <svg viewBox="0 0 160 120" style={abs({ width: '18cqw', ...style })} fill="none" stroke="#111" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="40" cy="30" r="12" fill="#fff" />
      <path d="M40 42v36M40 52l-16 18M40 52l22 6 10-14M40 78l-12 34M40 78l12 34" />
      <circle cx="112" cy="34" r="12" fill="#111" />
      <path d="M112 46v32M112 56l-18-4-6-14M112 56l16 16M112 78l-10 34M112 78l12 34" />
      <rect x="66" y="16" width="26" height="20" rx="2" fill="#fff" />
      <path d="M70 22h18M70 28h12" />
    </svg>
  )
}

function Workshop({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '1cqw', fontSize: '0.95cqw', fontWeight: 700, color: theme.text })}>
        <span>QALAMAI · WORKSHOP</span>
        <span style={{ flex: 1 }} />
        <span>{String(index + 1).padStart(2, '0')} / KIT</span>
      </div>
      <div style={abs({ left: '5%', right: '5%', top: '8.5%', height: '0.1cqw', background: theme.text })} />
      {index % 2 === 0 && <People style={{ right: '4%', bottom: '5%', width: index === 0 ? '26cqw' : '16cqw' }} />}
    </div>
  )
}

/* Strategy: soft grey, faint arcs, kicker line */
function Strategy({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ right: '-12cqw', bottom: '-20cqw', width: '46cqw', aspectRatio: '1', borderRadius: '50%', border: '4cqw solid rgba(0,0,0,.035)' })} />
      <div style={abs({ right: '-4cqw', bottom: '-12cqw', width: '30cqw', aspectRatio: '1', borderRadius: '50%', border: '2.4cqw solid rgba(0,0,0,.03)' })} />
      <div style={abs({ left: '5%', top: '5%', fontSize: '0.95cqw', color: theme.muted, fontWeight: 600 })}>{t('dc.partners')}</div>
      <div style={abs({ right: '5%', top: '5%', fontSize: '0.95cqw', color: theme.muted, fontVariantNumeric: 'tabular-nums' })}>{String(index + 1).padStart(2, '0')}</div>
    </div>
  )
}

/* ───────── Stage 4: pitch decks ───────── */

function Sunburst({ color, style }) {
  return (
    <svg viewBox="0 0 100 100" style={abs({ width: '18cqw', ...style })} fill={color}>
      {Array.from({ length: 8 }, (_, k) => (
        <rect key={k} x="44" y="4" width="12" height="30" rx="6" transform={`rotate(${k * 45} 50 50)`} />
      ))}
    </svg>
  )
}

/* Sunrise: peach-to-white glow, orange sunburst mark, header with site link */
function Sunrise({ theme, index }) {
  const cover = index === 0
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: `radial-gradient(ellipse at ${index % 2 ? '0% 100%' : '100% 0%'}, ${theme.accent}55, transparent 60%), radial-gradient(ellipse at ${index % 2 ? '100% 0%' : '0% 100%'}, #ffd9a855, transparent 55%)` })} />
      {cover && <Sunburst color={theme.accent} style={{ right: '10%', top: '26%' }} />}
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '0.8cqw', fontSize: '0.95cqw', fontWeight: 600, color: theme.text })}>
        <Sunburst color={theme.accent} style={{ position: 'static', width: '1.8cqw' }} />
        <span>QALAMAI</span>
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.6 }}>www.qalam.ai</span>
      </div>
    </div>
  )
}

/* Flame: clean white page, warm orange-yellow blobs bleeding off the corners */
function Flame({ theme, index }) {
  const grad = `radial-gradient(circle at 30% 30%, #ffd166, ${theme.accent} 55%, #c2410c)`
  const cover = index === 0
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ right: cover ? '-8cqw' : '-12cqw', top: cover ? '-10cqw' : '-14cqw', width: cover ? '34cqw' : '22cqw', aspectRatio: '1', borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%', background: grad, filter: 'blur(0.2cqw)' })} />
      <div style={abs({ left: cover ? '-6cqw' : '-10cqw', bottom: cover ? '-12cqw' : '-15cqw', width: cover ? '26cqw' : '18cqw', aspectRatio: '1', borderRadius: '58% 42% 37% 63% / 44% 41% 59% 56%', background: grad, opacity: 0.85 })} />
      <div style={abs({ left: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '0.6cqw' })}>
        <span style={{ display: 'grid', placeItems: 'center', width: '2cqw', height: '2cqw', borderRadius: '0.5cqw', background: theme.accent, color: '#fff', fontWeight: 800, fontSize: '1.1cqw' }}>Q</span>
        <span style={{ fontSize: '0.9cqw', fontWeight: 700, color: theme.text, lineHeight: 1.1 }}>QalamAI</span>
      </div>
    </div>
  )
}

/* SaaS: pale sky gradient, frosted header bar with pill button */
function Saas({ theme, index }) {
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 100% 0%, #c7dcff, transparent 55%), radial-gradient(ellipse at 0% 100%, #e3ecff, transparent 60%)' })} />
      <div style={abs({ left: '4%', right: '4%', top: '4%', height: '3.6cqw', padding: '0 1.4cqw', display: 'flex', alignItems: 'center', gap: '1cqw', borderRadius: '1.2cqw', background: 'rgba(255,255,255,.65)', boxShadow: '0 0 0 0.08cqw rgba(30,64,175,.08)' })}>
        <span style={{ fontWeight: 800, fontSize: '1.2cqw', color: theme.accent }}>A·</span>
        <span style={{ fontSize: '0.9cqw', color: theme.muted }}>qalam.ai</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.9cqw', color: theme.muted }}>+998 90 000 00 00</span>
        <span style={{ display: 'grid', placeItems: 'center', width: '2cqw', height: '2cqw', borderRadius: '50%', background: theme.text, color: '#fff', fontSize: '0.9cqw' }}>{index + 1}</span>
      </div>
    </div>
  )
}

const DECORS = { ...PREMIUM_DECORS, studio: StudioDecor, sunrise: Sunrise, flame: Flame, saas: Saas,  stage: Stage, splash: Splash, club: Club, training: Training, roadmap: Roadmap, workshop: Workshop, strategy: Strategy,  gallery: Gallery, book: Book, quiz: Quiz, law: Law, pitch: Pitch, brand: Brand, velvet: Velvet, agency: Agency, rights: Rights, skyline: Skyline, kids: Kids, crayon: Crayon, sketch: Sketch, chalkboard: Chalkboard, doodle: Doodle }

export function NewDecor({ kind, cover, theme, index }) {
  const D = DECORS[kind]
  return D ? <D theme={theme} cover={cover} index={index} /> : null
}
