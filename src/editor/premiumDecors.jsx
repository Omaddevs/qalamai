// Backgrounds of the ten "Premium" templates (templates.js → PREMIUM). Original CSS/SVG artwork,
// sized in cqw so a page looks the same from a 150 px thumbnail to full screen. `cover` = first or
// last page (more artwork there), `index` varies the composition from page to page.
// Each one carries only brand and page-number text, so it needs no translation.
import './premium.css'

const abs = (s) => ({ position: 'absolute', pointerEvents: 'none', ...s })
const num = (i) => String(i + 1).padStart(2, '0')

/* ───────── Monolit: Swiss editorial — warm paper, hairline columns, one signal-red block ───────── */
function Monolith({ theme, index }) {
  const cover = index === 0 // the big composition only on the first page; the centred end page stays clear
  const line = 'rgba(17,17,17,.12)'
  return (
    <div style={abs({ inset: 0 })}>
      {[6, 50, 94].map((x) => <div key={x} style={abs({ left: `${x}%`, top: 0, bottom: 0, width: '0.06cqw', background: line })} />)}
      <div style={abs({ left: '6%', right: '6%', top: '7.5%', height: '0.06cqw', background: theme.text })} />
      <div style={abs({ left: '6%', right: '6%', top: '4%', display: 'flex', alignItems: 'center', fontSize: '0.95cqw', fontWeight: 600, letterSpacing: '0.16em', color: theme.text })}>
        <span style={{ width: '0.9cqw', height: '0.9cqw', background: theme.accent, marginInlineEnd: '0.8cqw' }} />
        <span>QALAMAI</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{num(index)}</span>
      </div>
      {cover ? (
        <>
          <div style={abs({ right: 0, top: 0, bottom: 0, width: '30%', background: theme.accent })} />
          <div style={abs({ right: '6%', bottom: '8%', fontFamily: theme.titleFont, fontSize: '16cqw', fontWeight: 800, lineHeight: 0.8, color: 'rgba(255,255,255,.92)', letterSpacing: '-0.06em' })}>Q</div>
        </>
      ) : (
        <div style={abs({ right: '6%', bottom: '5%', width: '2.4cqw', height: '2.4cqw', background: theme.accent })} />
      )}
    </div>
  )
}

/* ───────── Noir: black velvet, champagne hairline frame, diamond corners ───────── */
function Noir({ theme, index, cover }) {
  const gold = theme.accent
  const Corner = ({ s }) => (
    <svg viewBox="0 0 40 40" style={abs({ width: '3.2cqw', ...s })} fill="none" stroke={gold} strokeWidth="1">
      <path d="M2 38V2h36" />
      <path d="M8 38V8h30" opacity=".5" />
      <rect x="0" y="0" width="5" height="5" transform="rotate(45 2.5 2.5) translate(-1 -1)" fill={gold} stroke="none" />
    </svg>
  )
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(212,178,106,.12), transparent 70%)' })} />
      <div style={abs({ inset: '3.2%', border: `0.07cqw solid ${gold}`, opacity: 0.55 })} />
      <div style={abs({ inset: '4.1%', border: `0.05cqw solid ${gold}`, opacity: 0.25 })} />
      <Corner s={{ left: '2.6%', top: '4.4%' }} />
      <Corner s={{ right: '2.6%', top: '4.4%', transform: 'scaleX(-1)' }} />
      <Corner s={{ left: '2.6%', bottom: '4.4%', transform: 'scaleY(-1)' }} />
      <Corner s={{ right: '2.6%', bottom: '4.4%', transform: 'scale(-1)' }} />
      {cover && (
        <div style={abs({ left: '50%', top: '50%', width: '44cqw', aspectRatio: '1', transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `0.06cqw solid ${gold}`, opacity: 0.35 })} />
      )}
      <div style={abs({ left: 0, right: 0, bottom: '5.6%', textAlign: 'center', fontSize: '0.9cqw', letterSpacing: '0.4em', color: gold, opacity: 0.8 })}>— {num(index)} —</div>
    </div>
  )
}

/* ───────── Avrora: midnight with drifting aurora light and a fine dot field ───────── */
function Aurora({ theme, index, cover }) {
  const k = index % 3
  const spots = [
    [['-8%', '-20%', '#2dd4bf'], ['55%', '-25%', '#8b5cf6'], ['70%', '55%', '#f472b6']],
    [['60%', '-30%', '#22d3ee'], ['-10%', '40%', '#8b5cf6'], ['40%', '70%', '#2dd4bf']],
    [['20%', '-30%', '#f472b6'], ['75%', '10%', '#2dd4bf'], ['-15%', '60%', '#6366f1']],
  ][k]
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      {spots.map(([l, tp, c], i) => (
        <div key={i} style={abs({ left: l, top: tp, width: cover ? '52cqw' : '40cqw', aspectRatio: '1', borderRadius: '50%', background: c, opacity: cover ? 0.5 : 0.32, filter: 'blur(7cqw)' })} />
      ))}
      <div style={abs({ inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.16) 0.08cqw, transparent 0.09cqw)', backgroundSize: '2.2cqw 2.2cqw', maskImage: 'radial-gradient(ellipse at 50% 50%, #000 20%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, #000 20%, transparent 75%)' })} />
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '0.8cqw', fontSize: '0.95cqw', fontWeight: 600, color: theme.muted })}>
        <span style={{ width: '1.6cqw', height: '1.6cqw', borderRadius: '50%', background: 'conic-gradient(from 90deg, #2dd4bf, #8b5cf6, #f472b6, #2dd4bf)' }} />
        <span>QalamAI</span>
        <span style={{ flex: 1 }} />
        <span style={{ padding: '0.3cqw 0.9cqw', borderRadius: '9cqw', border: '0.07cqw solid rgba(255,255,255,.2)', fontVariantNumeric: 'tabular-nums' }}>{num(index)}</span>
      </div>
    </div>
  )
}

/* ───────── Terrakota: sun-baked sand, terracotta arch, mustard sun, olive stem ───────── */
function Terra({ theme, index }) {
  const cover = index === 0 // the big composition only on the first page; the centred end page stays clear
  const right = index % 2 === 0
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      {cover ? (
        <>
          <div style={abs({ right: '6%', bottom: 0, width: '30%', height: '78%', borderRadius: '50% 50% 0 0 / 34% 34% 0 0', background: theme.accent })} />
          <div style={abs({ right: '10.5%', bottom: 0, width: '21%', height: '62%', borderRadius: '50% 50% 0 0 / 34% 34% 0 0', background: '#e7a07f' })} />
          <div style={abs({ right: '24%', top: '12%', width: '9cqw', aspectRatio: '1', borderRadius: '50%', background: theme.accent2 })} />
          <svg viewBox="0 0 60 120" style={abs({ right: '3%', bottom: '4%', width: '7cqw' })} fill="none" stroke="#6b7a3a" strokeWidth="2.4" strokeLinecap="round">
            <path d="M30 118V20" />
            {[30, 50, 70, 90].map((y, i) => <path key={y} d={i % 2 ? `M30 ${y}c-14-4-22-14-24-26 12 2 22 10 24 26z` : `M30 ${y}c14-4 22-14 24-26-12 2-22 10-24 26z`} fill="#6b7a3a" />)}
          </svg>
        </>
      ) : (
        <>
          <div style={abs({ [right ? 'right' : 'left']: '-4cqw', bottom: '-6cqw', width: '16cqw', height: '22cqw', borderRadius: '50% 50% 0 0 / 40% 40% 0 0', background: theme.accent, opacity: 0.9 })} />
          <div style={abs({ [right ? 'right' : 'left']: '9cqw', bottom: '6cqw', width: '3.4cqw', aspectRatio: '1', borderRadius: '50%', background: theme.accent2 })} />
        </>
      )}
      <div style={abs({ left: '6%', top: '5%', fontSize: '0.95cqw', letterSpacing: '0.14em', color: theme.muted })}>QALAMAI · {num(index)}</div>
    </div>
  )
}

/* ───────── Chizma: engineering blueprint — grid, crop marks, title block ───────── */
function Blueprint({ theme, index }) {
  const fine = 'rgba(255,255,255,.07)'
  const bold = 'rgba(255,255,255,.14)'
  const Mark = ({ s }) => (
    <svg viewBox="0 0 30 30" style={abs({ width: '2.2cqw', ...s })} stroke="rgba(255,255,255,.7)" strokeWidth="1.2" fill="none">
      <path d="M15 0v30M0 15h30" />
      <circle cx="15" cy="15" r="7" />
    </svg>
  )
  return (
    <div style={abs({ inset: 0 })}>
      <div style={abs({ inset: 0, backgroundImage: `linear-gradient(${bold} 0.07cqw, transparent 0.07cqw), linear-gradient(90deg, ${bold} 0.07cqw, transparent 0.07cqw), linear-gradient(${fine} 0.05cqw, transparent 0.05cqw), linear-gradient(90deg, ${fine} 0.05cqw, transparent 0.05cqw)`, backgroundSize: '10cqw 10cqw, 10cqw 10cqw, 2cqw 2cqw, 2cqw 2cqw' })} />
      <div style={abs({ inset: '3%', border: '0.1cqw solid rgba(255,255,255,.55)' })} />
      <Mark s={{ left: '1.9%', top: '1.9%' }} />
      <Mark s={{ right: '1.9%', top: '1.9%' }} />
      <Mark s={{ left: '1.9%', bottom: '1.9%' }} />
      <div style={abs({ right: '3%', bottom: '3%', display: 'grid', gridTemplateColumns: 'auto auto', border: '0.1cqw solid rgba(255,255,255,.55)', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: '0.85cqw', color: 'rgba(255,255,255,.85)', background: 'rgba(13,59,140,.85)' })}>
        <span style={{ padding: '0.5cqw 1cqw', borderInlineEnd: '0.1cqw solid rgba(255,255,255,.55)' }}>QALAMAI</span>
        <span style={{ padding: '0.5cqw 1cqw', color: theme.accent }}>{num(index)}</span>
      </div>
    </div>
  )
}

/* ───────── Pastel: soft studio light — glossy sphere, blurred peach, mint and lilac ───────── */
function Pastel({ theme, index, cover }) {
  const flip = index % 2 === 1
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      <div style={abs({ [flip ? 'left' : 'right']: '-8%', top: '-18%', width: '40cqw', aspectRatio: '1', borderRadius: '50%', background: '#ffcfb5', filter: 'blur(5cqw)', opacity: 0.8 })} />
      <div style={abs({ [flip ? 'right' : 'left']: '-10%', bottom: '-22%', width: '38cqw', aspectRatio: '1', borderRadius: '50%', background: '#bff0dc', filter: 'blur(5cqw)', opacity: 0.85 })} />
      <div style={abs({ left: '40%', top: '30%', width: '26cqw', aspectRatio: '1', borderRadius: '50%', background: '#d8c8ff', filter: 'blur(6cqw)', opacity: 0.55 })} />
      {cover && (
        <>
          <div style={abs({ right: '9%', top: '16%', width: '13cqw', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f4ecff 18%, #c9b5ff 55%, #8f79e8 100%)', boxShadow: '0 3cqw 5cqw -2cqw rgba(110,80,220,.45)' })} />
          <div style={abs({ left: '9%', bottom: '14%', width: '6cqw', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #fff1e8 20%, #ffb995 60%, #f08a5d 100%)', boxShadow: '0 2cqw 3cqw -1.5cqw rgba(240,120,70,.45)' })} />
        </>
      )}
      <div style={abs({ left: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '0.6cqw', padding: '0.45cqw 1cqw', borderRadius: '9cqw', background: 'rgba(255,255,255,.7)', fontSize: '0.9cqw', fontWeight: 700, color: theme.text })}>
        <span style={{ width: '0.8cqw', height: '0.8cqw', borderRadius: '50%', background: theme.accent }} /> QalamAI
      </div>
      <div style={abs({ right: '5%', top: '5%', padding: '0.45cqw 1cqw', borderRadius: '9cqw', background: 'rgba(255,255,255,.7)', fontSize: '0.9cqw', fontWeight: 700, color: theme.muted, fontVariantNumeric: 'tabular-nums' })}>{num(index)}</div>
    </div>
  )
}

/* ───────── Jurnal: magazine masthead, double rule, ghost folio number, red tab ───────── */
function Editorial({ theme, index, cover }) {
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      <div style={abs({ left: '5%', right: '5%', top: '4.2%', display: 'flex', alignItems: 'baseline', fontFamily: theme.titleFont, color: theme.text })}>
        <span style={{ fontSize: '1.7cqw', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.02em' }}>Qalam</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: theme.bodyFont, fontSize: '0.85cqw', letterSpacing: '0.24em', textTransform: 'uppercase' }}>№ {num(index)}</span>
      </div>
      <div style={abs({ left: '5%', right: '5%', top: '8.6%', height: '0.28cqw', background: theme.text })} />
      <div style={abs({ left: '5%', right: '5%', top: '9.3%', height: '0.06cqw', background: theme.text })} />
      <div style={abs({ right: 0, top: cover ? '18%' : '24%', width: '1.2cqw', height: cover ? '22%' : '10%', background: theme.accent })} />
      {!cover && (
        <div style={abs({ right: '4%', bottom: '-4cqw', fontFamily: theme.titleFont, fontSize: '22cqw', fontWeight: 800, fontStyle: 'italic', lineHeight: 1, color: 'rgba(17,17,17,.045)' })}>{index + 1}</div>
      )}
      <div style={abs({ left: '5%', right: '5%', bottom: '4%', height: '0.06cqw', background: 'rgba(17,17,17,.25)' })} />
    </div>
  )
}

/* ───────── O‘rmon: deep forest green, botanical line art, warm candle glow ───────── */
function Forest({ theme, index, cover }) {
  const ink = 'rgba(232,240,220,.22)'
  const Leaf = ({ s, flip }) => (
    <svg viewBox="0 0 120 160" style={abs({ width: cover ? '20cqw' : '13cqw', transform: flip ? 'scaleX(-1)' : undefined, ...s })} fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round">
      <path d="M60 158C58 110 62 60 60 4" />
      {[22, 44, 66, 88, 110, 132].map((y, i) => (
        <g key={y}>
          <path d={`M60 ${y + 10}C44 ${y + 4} 26 ${y - 6} 14 ${y - 22}C34 ${y - 22} 52 ${y - 8} 60 ${y + 10}z`} />
          <path d={`M60 ${y + 18}C76 ${y + 12} 94 ${y + 2} 106 ${y - 14}C86 ${y - 14} 68 ${y} 60 ${y + 18}z`} opacity={i % 2 ? 0.7 : 1} />
        </g>
      ))}
    </svg>
  )
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(232,200,122,.12), transparent 70%)' })} />
      <Leaf s={{ left: '-2%', bottom: '-6%' }} />
      <Leaf s={{ right: '-2%', top: '-8%', transform: 'rotate(180deg)' }} />
      {cover && <Leaf s={{ right: '6%', bottom: '-10%' }} flip />}
      <div style={abs({ left: 0, right: 0, top: '5%', textAlign: 'center', fontSize: '0.9cqw', letterSpacing: '0.42em', color: theme.accent, opacity: 0.85 })}>QALAMAI</div>
      <div style={abs({ left: 0, right: 0, bottom: '5%', textAlign: 'center', fontFamily: theme.titleFont, fontStyle: 'italic', fontSize: '1.3cqw', color: theme.muted })}>{num(index)}</div>
    </div>
  )
}

/* ───────── Neon: night city grid — perspective floor, glowing horizon, scanlines ───────── */
function Neon({ theme, index, cover }) {
  const c1 = theme.accent
  const c2 = theme.accent2
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      <div style={abs({ left: '-20%', right: '-20%', bottom: '-6%', height: cover ? '40%' : '22%', transform: 'perspective(30cqw) rotateX(62deg)', transformOrigin: 'bottom', backgroundImage: `linear-gradient(${c1}55 0.12cqw, transparent 0.12cqw), linear-gradient(90deg, ${c1}55 0.12cqw, transparent 0.12cqw)`, backgroundSize: '4cqw 4cqw', maskImage: 'linear-gradient(to top, #000 30%, transparent)', WebkitMaskImage: 'linear-gradient(to top, #000 30%, transparent)' })} />
      <div style={abs({ left: 0, right: 0, bottom: cover ? '24%' : '12%', height: '0.15cqw', background: `linear-gradient(90deg, transparent, ${c2}, ${c1}, ${c2}, transparent)`, boxShadow: `0 0 2cqw 0.4cqw ${c1}88` })} />
      {cover && <div style={abs({ left: '50%', bottom: '24%', width: '24cqw', aspectRatio: '2', transform: 'translateX(-50%)', borderRadius: '24cqw 24cqw 0 0', background: `linear-gradient(${c1}, ${c2})`, opacity: 0.22, filter: 'blur(1.5cqw)' })} />}
      <div style={abs({ inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 0.12cqw, transparent 0.12cqw 0.5cqw)' })} />
      <div style={abs({ left: '5%', right: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '0.8cqw', fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace", fontSize: '0.9cqw', color: theme.muted })}>
        <span style={{ width: '0.8cqw', height: '0.8cqw', borderRadius: '50%', background: c1, boxShadow: `0 0 0.8cqw ${c1}` }} />
        qalamai://
        <span style={{ flex: 1 }} />
        <span style={{ color: c1 }}>[{num(index)}]</span>
      </div>
    </div>
  )
}

/* ───────── Executive: boardroom white, navy diagonal, teal stripe, dot matrix ───────── */
function Executive({ theme, index }) {
  const cover = index === 0 // the big composition only on the first page; the centred end page stays clear
  const navy = theme.text
  return (
    <div style={abs({ inset: 0, overflow: 'hidden' })}>
      {cover ? (
        <>
          {/* the cover's picture sits on this navy panel (cover: 'split', picture on the right) */}
          <div style={abs({ right: 0, top: 0, bottom: 0, width: '46%', background: navy, clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)' })} />
          <div style={abs({ right: '41%', top: 0, bottom: 0, width: '2.4%', background: theme.accent, clipPath: 'polygon(70% 0, 100% 0, 30% 100%, 0 100%)' })} />
        </>
      ) : (
        <>
          <div style={abs({ left: 0, right: 0, top: 0, height: '0.7cqw', background: navy })} />
          <div style={abs({ left: 0, top: 0, width: '18%', height: '0.7cqw', background: theme.accent })} />
        </>
      )}
      <div style={abs({ [cover ? 'left' : 'right']: '4%', bottom: '6%', width: '12cqw', height: '8cqw', backgroundImage: `radial-gradient(${theme.accent}66 0.18cqw, transparent 0.2cqw)`, backgroundSize: '1.2cqw 1.2cqw' })} />
      <div style={abs({ left: '5%', top: '4.2%', fontSize: '0.95cqw', fontWeight: 800, letterSpacing: '0.12em', color: navy })}>
        <span>QALAMAI</span><span style={{ color: theme.accent }}>.</span>
      </div>
      {!cover && <div style={abs({ right: '5%', top: '4.2%', fontSize: '0.95cqw', fontWeight: 600, color: theme.muted, fontVariantNumeric: 'tabular-nums' })}>{num(index)}</div>}
    </div>
  )
}

export const PREMIUM_DECORS = { monolith: Monolith, noir: Noir, aurora: Aurora, terra: Terra, blueprint: Blueprint, pastel: Pastel, editorial: Editorial, forest: Forest, neon: Neon, executive: Executive }
