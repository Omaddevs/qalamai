// Backgrounds of the design-system collection (studio.js): one renderer, a library of motifs.
// A design lists its motifs in `theme.motifs` as [name, options] pairs, so forty looks share one
// tested set of drawings instead of forty copies. Everything is sized in cqw (thumbnail = canvas),
// carries only brand and page-number text (no translation needed), and stays clear of the
// content area unless it is a faint texture. `cover` = first or last page, `index` = page number.

const abs = (s) => ({ position: 'absolute', pointerEvents: 'none', ...s })
const num = (i) => String(i + 1).padStart(2, '0')

/** 'acc' | 'acc2' | 'tx' | 'mu' | 'card' → the theme's colour; anything else is a colour already. */
const col = (theme, c) => ({ acc: theme.accent, acc2: theme.accent2 ?? theme.accent, tx: theme.text, mu: theme.muted, card: theme.card })[c] ?? c

/** Corner placement: 'tl' 'tr' 'bl' 'br' → absolute offsets. */
const at = (where, dx = '0%', dy = '0%') => ({
  ...(where.includes('t') ? { top: dy } : { bottom: dy }),
  ...(where.includes('l') ? { left: dx } : { right: dx }),
})

const M = {
  /* brand line at the top: QALAMAI · page number */
  header({ theme, index }, o = {}) {
    const c = col(theme, o.color ?? 'tx')
    const font = o.mono ? "'IBM Plex Mono', ui-monospace, monospace" : undefined
    return (
      <div style={abs({ left: o.x ?? '6%', right: o.x ?? '6%', top: o.y ?? '5%', display: 'flex', alignItems: 'center', gap: '0.8cqw', fontFamily: font, fontSize: '0.9cqw', fontWeight: 700, letterSpacing: o.mono ? '0.06em' : '0.18em', color: c, opacity: 0.85 })}>
        {o.mark === 'dot' && <span style={{ width: '0.8cqw', height: '0.8cqw', borderRadius: '50%', background: col(theme, 'acc') }} />}
        {o.mark === 'square' && <span style={{ width: '0.8cqw', height: '0.8cqw', background: col(theme, 'acc') }} />}
        {o.mark === 'bar' && <span style={{ width: '2.4cqw', height: '0.25cqw', background: col(theme, 'acc') }} />}
        <span>{o.mono ? 'qalam.ai' : 'QALAMAI'}</span>
        <span style={{ flex: 1, height: o.rule ? '0.06cqw' : 0, background: c, opacity: 0.4, margin: '0 1cqw' }} />
        {!o.noNum && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{o.mono ? `[${num(index)}]` : num(index)}</span>}
      </div>
    )
  },

  /* page number at the bottom */
  footer({ theme, index }, o = {}) {
    const align = o.align ?? 'right'
    const text = o.style === 'dash' ? `— ${num(index)} —` : o.style === 'roman' ? toRoman(index + 1) : num(index)
    return (
      <div style={abs({ left: '6%', right: '6%', bottom: o.y ?? '4.6%', textAlign: align, fontSize: '0.9cqw', fontWeight: 600, letterSpacing: '0.2em', color: col(theme, o.color ?? 'mu'), fontVariantNumeric: 'tabular-nums' })}>
        {o.rule && <div style={{ height: '0.06cqw', background: col(theme, 'mu'), opacity: 0.45, marginBottom: '0.8cqw' }} />}
        {text}
      </div>
    )
  },

  /* hairline columns of a layout grid */
  columns({ theme }, o = {}) {
    const n = o.n ?? 12
    return (
      <div style={abs({ inset: '0 6%', display: 'flex', justifyContent: 'space-between', opacity: o.opacity ?? 0.07 })}>
        {Array.from({ length: n + 1 }, (_, i) => <span key={i} style={{ width: '0.06cqw', background: col(theme, 'tx') }} />)}
      </div>
    )
  },

  /* square grid (graph paper) */
  grid({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'tx')
    const s = o.size ?? 2.4
    const mask = o.fade ? 'radial-gradient(ellipse at 70% 30%, #000 10%, transparent 70%)' : undefined
    return <div style={abs({ inset: 0, opacity: o.opacity ?? 0.08, backgroundImage: `linear-gradient(${c} 0.06cqw, transparent 0.06cqw), linear-gradient(90deg, ${c} 0.06cqw, transparent 0.06cqw)`, backgroundSize: `${s}cqw ${s}cqw`, maskImage: mask, WebkitMaskImage: mask })} />
  },

  /* dot field in a corner or across the page */
  dots({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const full = o.where === 'full'
    const mask = full ? 'radial-gradient(ellipse at 50% 50%, #000 20%, transparent 75%)' : undefined
    return (
      <div
        style={abs({
          ...(full ? { inset: 0 } : { ...at(o.where ?? 'br', '4%', '6%'), width: o.w ?? '14cqw', height: o.h ?? '9cqw' }),
          opacity: o.opacity ?? 0.5,
          backgroundImage: `radial-gradient(${c} 0.12cqw, transparent 0.14cqw)`,
          backgroundSize: `${o.gap ?? 1.4}cqw ${o.gap ?? 1.4}cqw`,
          maskImage: mask,
          WebkitMaskImage: mask,
        })}
      />
    )
  },

  /* a solid band along one side; `when`: 'cover' | 'inner' | 'all' */
  band({ theme, cover }, o = {}) {
    if ((o.when === 'cover' && !cover) || (o.when === 'inner' && cover)) return null
    const side = o.side ?? 'left'
    const size = o.size ?? '2%'
    const pos = { left: { left: 0, top: 0, bottom: 0, width: size }, right: { right: 0, top: 0, bottom: 0, width: size }, top: { left: 0, right: 0, top: 0, height: size }, bottom: { left: 0, right: 0, bottom: 0, height: size } }[side]
    return <div style={abs({ ...pos, background: o.gradient ? `linear-gradient(${side === 'left' || side === 'right' ? 180 : 90}deg, ${col(theme, 'acc')}, ${col(theme, 'acc2')})` : col(theme, o.color ?? 'acc'), opacity: o.opacity ?? 1 })} />
  },

  /* thin multi-colour stripe at the top (or bottom) */
  stripe({ theme }, o = {}) {
    const colors = (o.colors ?? ['acc', 'acc2']).map((c) => col(theme, c))
    return (
      <div style={abs({ left: 0, right: 0, [o.bottom ? 'bottom' : 'top']: 0, height: o.h ?? '1.2%', display: 'flex' })}>
        {colors.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
      </div>
    )
  },

  /* soft colour clouds */
  blobs({ theme, index, cover }, o = {}) {
    const colors = (o.colors ?? ['acc', 'acc2']).map((c) => col(theme, c))
    const spots = [[['-10%', '-25%'], ['62%', '45%']], [['65%', '-30%'], ['-12%', '50%']], [['30%', '-35%'], ['70%', '55%']]][index % 3]
    return (
      <div style={abs({ inset: 0, overflow: 'hidden' })}>
        {spots.map(([l, t], i) => (
          <div key={i} style={abs({ left: l, top: t, width: cover ? '50cqw' : '38cqw', aspectRatio: '1', borderRadius: '50%', background: colors[i % colors.length], opacity: (o.opacity ?? 0.35) * (cover ? 1.2 : 1), filter: `blur(${o.blur ?? 8}cqw)` })} />
        ))}
      </div>
    )
  },

  /* one radial glow */
  glow({ theme }, o = {}) {
    return <div style={abs({ inset: 0, background: `radial-gradient(ellipse 60% 55% at ${o.x ?? '50%'} ${o.y ?? '0%'}, ${col(theme, o.color ?? 'acc')}, transparent 70%)`, opacity: o.opacity ?? 0.22 })} />
  },

  /* inset frame, single or double */
  frame({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const i = o.inset ?? 3
    return (
      <>
        <div style={abs({ inset: `${i}%`, border: `${o.w ?? 0.08}cqw solid ${c}`, opacity: o.opacity ?? 0.6 })} />
        {o.double && <div style={abs({ inset: `${i + 0.9}%`, border: `0.05cqw solid ${c}`, opacity: (o.opacity ?? 0.6) * 0.5 })} />}
      </>
    )
  },

  /* corner brackets */
  corners({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const s = o.size ?? 2.6
    const off = o.inset ?? '3%'
    const L = (where, tf) => (
      <svg key={where} viewBox="0 0 20 20" style={abs({ ...at(where, off, off), width: `${s}cqw`, height: `${s}cqw`, transform: tf, opacity: o.opacity ?? 0.8 })} fill="none" stroke={c} strokeWidth={o.weight ?? 1.4}>
        <path d="M1 19V1h18" />
        {o.ornament && <circle cx="5" cy="5" r="1.6" fill={c} stroke="none" />}
      </svg>
    )
    return <>{[L('tl'), L('tr', 'scaleX(-1)'), L('bl', 'scaleY(-1)'), L('br', 'scale(-1)')]}</>
  },

  /* the page number, huge, as a graphic */
  bignum({ theme, index }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    return (
      <div
        style={abs({
          ...at(o.where ?? 'br', o.dx ?? '4%', o.dy ?? '2%'),
          fontFamily: theme.titleFont,
          fontWeight: 800,
          fontSize: `${o.size ?? 22}cqw`,
          lineHeight: 0.8,
          letterSpacing: '-0.05em',
          color: o.outline ? 'transparent' : c,
          WebkitTextStroke: o.outline ? `0.12cqw ${c}` : undefined,
          opacity: o.opacity ?? 0.12,
        })}
      >
        {num(index)}
      </div>
    )
  },

  /* concentric rings in a corner */
  rings({ theme, cover }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const n = o.n ?? 4
    return (
      <div style={abs({ ...at(o.where ?? 'tr', o.dx ?? '-8%', o.dy ?? '-18%'), width: `${(o.size ?? 34) * (cover ? 1.25 : 1)}cqw`, aspectRatio: '1' })}>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} style={abs({ inset: `${i * (40 / n)}%`, borderRadius: '50%', border: `0.08cqw solid ${c}`, opacity: (o.opacity ?? 0.35) * (1 - i / (n + 1)) })} />
        ))}
      </div>
    )
  },

  /* tilted elliptic orbits with a particle each */
  orbits({ theme, index, cover }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const c2 = col(theme, 'acc2')
    // inner pages: a smaller, fainter atom tucked into the corner, clear of the text
    const size = (o.size ?? 40) * (cover ? 1 : 0.55)
    return (
      <svg viewBox="0 0 200 200" style={abs({ ...at(o.where ?? 'tr', cover ? o.dx ?? '-6%' : '-4%', cover ? o.dy ?? '-14%' : '-8%'), width: `${size}cqw`, height: `${size}cqw`, opacity: (o.opacity ?? 0.55) * (cover ? 1 : 0.6), transform: `rotate(${(index % 3) * 20}deg)` })} fill="none">
        {[0, 60, 120].map((r, i) => (
          <g key={r} transform={`rotate(${r} 100 100)`}>
            <ellipse cx="100" cy="100" rx="92" ry="34" stroke={i === 1 ? c2 : c} strokeWidth="0.7" />
            <circle cx={100 + 92 * Math.cos(i + 0.6)} cy={100 + 34 * Math.sin(i + 0.6)} r="2.6" fill={i === 1 ? c2 : c} />
          </g>
        ))}
        <circle cx="100" cy="100" r="5" fill={c} />
      </svg>
    )
  },

  /* a small neural network of nodes and links */
  net({ theme, index, cover }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const c2 = col(theme, 'acc2')
    const layers = [3, 5, 4, 2]
    const pts = layers.flatMap((n, li) => Array.from({ length: n }, (_, k) => [20 + li * 55, 100 - ((n - 1) * 34) / 2 + k * 34]))
    const start = (li) => layers.slice(0, li).reduce((a, b) => a + b, 0)
    const links = []
    layers.forEach((n, li) => {
      if (li === layers.length - 1) return
      for (let a = 0; a < n; a++) for (let b = 0; b < layers[li + 1]; b++) links.push([start(li) + a, start(li + 1) + b])
    })
    return (
      <svg viewBox="0 0 200 200" style={abs({ ...at(o.where ?? 'br', cover ? '2%' : '1%', cover ? '4%' : '1%'), width: `${cover ? 40 : 13}cqw`, height: `${cover ? 40 : 13}cqw`, opacity: (o.opacity ?? 0.45) * (cover ? 1 : 0.6), transform: index % 2 ? 'scaleX(-1)' : undefined })}>
        {links.map(([a, b], i) => <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={c} strokeWidth="0.5" opacity="0.5" />)}
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 3.2 : 4.4} fill={i % 4 ? c : c2} />)}
      </svg>
    )
  },

  /* hexagon lattice */
  hex({ theme }, o = {}) {
    const c = encodeURIComponent(col(theme, o.color ?? 'acc'))
    const svg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='48' viewBox='0 0 28 48'%3E%3Cpath d='M14 0l14 8v16l-14 8L0 24V8zM14 32v16' fill='none' stroke='${c}' stroke-width='0.8'/%3E%3C/svg%3E")`
    const mask = 'radial-gradient(ellipse at 80% 20%, #000 5%, transparent 60%)'
    return <div style={abs({ inset: 0, opacity: o.opacity ?? 0.35, backgroundImage: svg, backgroundSize: '3cqw 5.14cqw', maskImage: mask, WebkitMaskImage: mask })} />
  },

  /* printed-circuit traces from a corner */
  circuit({ theme, index, cover }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    return (
      <svg viewBox="0 0 200 120" style={abs({ ...at(o.where ?? 'br', '0%', '0%'), width: cover ? '30cqw' : '20cqw', height: cover ? '18cqw' : '12cqw', opacity: (o.opacity ?? 0.5) * (cover ? 1 : 0.55), transform: index % 2 ? 'scaleX(-1)' : undefined })} fill="none" stroke={c} strokeWidth="1.1">
        <path d="M200 20H140l-20 20H60" />
        <path d="M200 50h-40l-15 15H90l-12 12H30" />
        <path d="M200 80h-30l-20 20h-60" />
        <path d="M200 105h-70" />
        {[[60, 40], [30, 77], [90, 100], [130, 105], [90, 65]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill={theme.bg?.startsWith?.('#') ? theme.bg : 'none'} />)}
      </svg>
    )
  },

  /* waves along the bottom */
  wave({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const c2 = col(theme, o.color2 ?? 'acc2')
    return (
      <svg viewBox="0 0 1600 200" preserveAspectRatio="none" style={abs({ left: 0, right: 0, bottom: 0, width: '100%', height: o.h ?? '16%', opacity: o.opacity ?? 0.9 })}>
        <path d="M0 120C220 60 420 60 640 110S1080 180 1300 120 1600 70 1600 70V200H0Z" fill={c2} opacity="0.35" />
        <path d="M0 150C260 100 520 110 780 150S1300 190 1600 130V200H0Z" fill={c} opacity="0.55" />
      </svg>
    )
  },

  /* arch outlines (architecture, estates) */
  arches({ theme, cover }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    return (
      <div style={abs({ ...at(o.where ?? 'br', '5%', '0%'), display: 'flex', alignItems: 'flex-end', gap: '1.2cqw', opacity: o.opacity ?? 0.5 })}>
        {[1, 1.35, 1].map((k, i) => (
          <span key={i} style={{ width: `${(cover ? 7 : 4.5) * (i === 1 ? 1.2 : 1)}cqw`, height: `${(cover ? 14 : 9) * k}cqw`, border: `0.1cqw solid ${c}`, borderBottom: 0, borderRadius: '99cqw 99cqw 0 0' }} />
        ))}
      </div>
    )
  },

  /* printer's registration marks */
  crosshair({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'tx')
    const X = (where) => (
      <svg key={where} viewBox="0 0 20 20" style={abs({ ...at(where, '2%', '3%'), width: '2cqw', height: '2cqw', opacity: 0.7 })} fill="none" stroke={c} strokeWidth="1.2">
        <circle cx="10" cy="10" r="5" />
        <path d="M10 0v20M0 10h20" />
      </svg>
    )
    return <>{['tl', 'tr', 'bl', 'br'].map(X)}</>
  },

  /* cinema letterbox */
  letterbox({ theme }, o = {}) {
    const h = o.h ?? '6%'
    return (
      <>
        <div style={abs({ left: 0, right: 0, top: 0, height: h, background: '#000' })} />
        <div style={abs({ left: 0, right: 0, bottom: 0, height: h, background: '#000' })} />
        <div style={abs({ inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,.55) 100%)' })} />
      </>
    )
  },

  /* horizontal scan lines */
  scan({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'tx')
    return <div style={abs({ inset: 0, opacity: o.opacity ?? 0.05, backgroundImage: `repeating-linear-gradient(0deg, ${c} 0 0.06cqw, transparent 0.06cqw 0.5cqw)` })} />
  },

  /* playful stickers: circle, star, pill */
  stickers({ theme, index, cover }, o = {}) {
    const a = col(theme, 'acc')
    const b = col(theme, 'acc2')
    const k = cover ? 1.4 : 1
    const flip = index % 2
    // inner pages carry content near the top: just a small star in the corner and the pill below
    if (!cover)
      return (
        <>
          <svg viewBox="0 0 24 24" style={abs({ right: '3.4%', top: '3.4%', width: '2.4cqw', height: '2.4cqw', transform: 'rotate(14deg)', opacity: o.opacity ?? 0.9 })}>
            <path d="M12 1l3 7.5 8 .7-6 5.3 1.8 7.9L12 18.3 5.2 22.4 7 14.5 1 9.2l8-.7z" fill={b} />
          </svg>
          <div style={abs({ right: '4%', bottom: '4%', width: '5cqw', height: '1.6cqw', borderRadius: '9cqw', background: a, transform: 'rotate(-12deg)', opacity: (o.opacity ?? 0.9) * 0.8 })} />
        </>
      )
    return (
      <>
        <div style={abs({ [flip ? 'left' : 'right']: '5%', top: '9%', width: `${5 * k}cqw`, aspectRatio: '1', borderRadius: '50%', background: a, transform: 'rotate(-8deg)', opacity: o.opacity ?? 0.9 })} />
        <svg viewBox="0 0 24 24" style={abs({ [flip ? 'left' : 'right']: '11%', top: '17%', width: `${3.4 * k}cqw`, height: `${3.4 * k}cqw`, transform: 'rotate(14deg)', opacity: o.opacity ?? 0.9 })}>
          <path d="M12 1l3 7.5 8 .7-6 5.3 1.8 7.9L12 18.3 5.2 22.4 7 14.5 1 9.2l8-.7z" fill={b} />
        </svg>
        <div style={abs({ [flip ? 'right' : 'left']: '4%', bottom: '7%', width: `${7 * k}cqw`, height: `${2.4 * k}cqw`, borderRadius: '9cqw', background: b, transform: 'rotate(-12deg)', opacity: (o.opacity ?? 0.9) * 0.8 })} />
      </>
    )
  },

  /* halftone dots fading out of a corner */
  halftone({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const where = o.where ?? 'tr'
    const mask = `radial-gradient(circle at ${where.includes('r') ? '100%' : '0%'} ${where.includes('t') ? '0%' : '100%'}, #000 0%, transparent 60%)`
    return <div style={abs({ inset: 0, opacity: o.opacity ?? 0.5, backgroundImage: `radial-gradient(${c} 0.32cqw, transparent 0.34cqw)`, backgroundSize: '1.2cqw 1.2cqw', maskImage: mask, WebkitMaskImage: mask })} />
  },

  /* faint rising bars (growth, data) */
  bars({ theme, cover }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    const hs = [28, 40, 34, 55, 48, 70, 86]
    return (
      <div style={abs({ ...at(o.where ?? 'br', '5%', '0%'), display: 'flex', alignItems: 'flex-end', gap: '0.7cqw', height: cover ? '40%' : '24%', opacity: o.opacity ?? 0.14 })}>
        {hs.map((h, i) => <span key={i} style={{ width: cover ? '2.4cqw' : '1.6cqw', height: `${h}%`, background: c, borderRadius: '0.3cqw 0.3cqw 0 0' }} />)}
      </div>
    )
  },

  /* a dashed travel route with a pin */
  route({ theme, index }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    return (
      <svg viewBox="0 0 300 140" style={abs({ ...at(o.where ?? 'br', '3%', '4%'), width: '28cqw', height: '13cqw', opacity: o.opacity ?? 0.6, transform: index % 2 ? 'scaleX(-1)' : undefined })} fill="none">
        <path d="M10 120C60 40 120 130 170 70S260 20 280 30" stroke={c} strokeWidth="2" strokeDasharray="6 7" strokeLinecap="round" />
        <path d="M280 8c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14z" fill={c} />
        <circle cx="280" cy="22" r="4.5" fill={theme.bg?.startsWith?.('#') ? theme.bg : '#fff'} />
      </svg>
    )
  },

  /* a field of small plus signs (health) */
  plus({ theme }, o = {}) {
    const c = encodeURIComponent(col(theme, o.color ?? 'acc'))
    const svg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 8v8M8 12h8' stroke='${c}' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E")`
    const mask = `radial-gradient(ellipse at ${o.x ?? '90%'} ${o.y ?? '10%'}, #000 5%, transparent 55%)`
    return <div style={abs({ inset: 0, opacity: o.opacity ?? 0.5, backgroundImage: svg, backgroundSize: '2.6cqw 2.6cqw', maskImage: mask, WebkitMaskImage: mask })} />
  },

  /* a code-editor title bar */
  window({ theme }, o = {}) {
    return (
      <div style={abs({ left: '6%', right: '6%', top: '4%', display: 'flex', alignItems: 'center', gap: '0.6cqw', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.9cqw', color: col(theme, 'mu') })}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: '0.9cqw', height: '0.9cqw', borderRadius: '50%', background: c, opacity: o.opacity ?? 0.85 }} />)}
        <span style={{ marginLeft: '1.2cqw' }}>~/qalam.ai</span>
      </div>
    )
  },

  /* bold geometric composition: circle + square */
  shapes({ theme, index, cover }, o = {}) {
    const a = col(theme, 'acc')
    const b = col(theme, 'acc2')
    const k = cover ? 1.5 : 0.7
    // inner pages: a smaller pair, always in the top-right corner where no text starts
    const right = !cover || index % 2 === 0
    return (
      <>
        <div style={abs({ [right ? 'right' : 'left']: '-4%', top: '-10%', width: `${18 * k}cqw`, aspectRatio: '1', borderRadius: '50%', background: a, opacity: o.opacity ?? 0.9 })} />
        <div style={abs({ [right ? 'right' : 'left']: `${10 * k}cqw`, top: `${10 * k}cqw`, width: `${8 * k}cqw`, aspectRatio: '1', background: b, mixBlendMode: o.blend ?? 'normal', opacity: o.opacity ?? 0.9, transform: 'rotate(12deg)' })} />
      </>
    )
  },

  /* brand set vertically along an edge */
  strip({ theme }, o = {}) {
    return (
      <div style={abs({ [o.side ?? 'left']: '1.2%', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'center', fontSize: '0.85cqw', letterSpacing: '0.5em', fontWeight: 600, color: col(theme, o.color ?? 'mu'), whiteSpace: 'nowrap' })}>
        QALAMAI
      </div>
    )
  },

  /* diagonal band across a corner */
  diag({ theme, cover }, o = {}) {
    if (o.when === 'cover' && !cover) return null
    return <div style={abs({ right: '-12%', top: '-30%', width: cover ? '40%' : '22%', height: '160%', background: col(theme, o.color ?? 'acc'), transform: 'rotate(18deg)', opacity: o.opacity ?? 1 })} />
  },

  /* chart axes in a corner (data) */
  axis({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'mu')
    return (
      <svg viewBox="0 0 100 60" style={abs({ ...at(o.where ?? 'br', '4%', '5%'), width: '16cqw', height: '9.6cqw', opacity: o.opacity ?? 0.35 })} fill="none" stroke={c} strokeWidth="0.8">
        <path d="M4 2v54h94" />
        {[14, 28, 42, 56, 70, 84].map((x) => <path key={x} d={`M${x} 56v3`} />)}
        <path d="M8 48L26 36 42 40 60 22 76 26 94 8" stroke={col(theme, 'acc')} strokeWidth="1.4" />
      </svg>
    )
  },

  /* architect's dimension lines */
  dims({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'tx')
    return (
      <svg viewBox="0 0 400 40" preserveAspectRatio="none" style={abs({ left: '6%', right: '6%', bottom: '3.4%', width: '88%', height: '2.6cqw', opacity: o.opacity ?? 0.4 })} fill="none" stroke={c} strokeWidth="0.8">
        <path d="M0 20h400M0 8v24M400 8v24M140 12v16M260 12v16" />
      </svg>
    )
  },

  /* a hand-drawn squiggle */
  squiggle({ theme, index }, o = {}) {
    const c = col(theme, o.color ?? 'acc2')
    return (
      <svg viewBox="0 0 120 30" style={abs({ ...at(index % 2 ? 'tl' : 'br', '5%', '8%'), width: '12cqw', height: '3cqw', opacity: o.opacity ?? 0.8 })} fill="none">
        <path d="M2 18c10-16 18 12 28-2s18 12 28-2 18 12 28-2 18 12 30-2" stroke={c} strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  },

  /* a sun or seal disc */
  disc({ theme, cover }, o = {}) {
    if (o.when === 'cover' && !cover) return null
    return <div style={abs({ ...at(o.where ?? 'tr', o.dx ?? '8%', o.dy ?? '10%'), width: `${(o.size ?? 10) * (cover ? 1.4 : 1)}cqw`, aspectRatio: '1', borderRadius: '50%', background: col(theme, o.color ?? 'acc'), opacity: o.opacity ?? 0.9 })} />
  },

  /* hazard stripes (robotics, industry) */
  hazard({ theme }, o = {}) {
    const c = col(theme, o.color ?? 'acc')
    return <div style={abs({ ...at(o.where ?? 'bl', '0%', '0%'), width: '18cqw', height: '1.4cqw', backgroundImage: `repeating-linear-gradient(135deg, ${c} 0 0.8cqw, transparent 0.8cqw 1.6cqw)`, opacity: o.opacity ?? 0.9 })} />
  },
}

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of map) while (n >= v) { out += s; n -= v }
  return n > 39 ? String(n) : out
}

/** Motif names a design can use (studio.js is checked against this list). */
export const MOTIF_NAMES = Object.keys(M)

/** The background of a studio design: its motifs, in order (later ones paint on top). */
export function StudioDecor({ theme, index = 0, cover = false }) {
  const ctx = { theme, index, cover }
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      {(theme.motifs ?? []).map(([name, o], i) => {
        const draw = M[name]
        // any motif can be limited to the cover/end pages or to the pages between
        if ((o?.when === 'cover' && !cover) || (o?.when === 'inner' && cover)) return null
        return draw ? <div key={`${name}-${i}`} style={abs({ inset: 0 })}>{draw(ctx, o)}</div> : null
      })}
    </div>
  )
}
