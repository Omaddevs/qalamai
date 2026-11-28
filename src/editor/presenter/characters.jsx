// The presenters: original flat-illustration characters drawn as one SVG rig, plus the user's own
// photo. They blink, sway a little, move the mouth with the voice (level() 0…1, read every frame
// without re-rendering React) and raise a hand towards the slide while the pen draws.
import { useEffect, useRef } from 'react'
import { useAsset } from '../../assets.js'

/** gender picks the default voice; role is a t() key (pr.role.*). */
export const PRESENTERS = [
  { id: 'madina', gender: 'f', role: 'teacher', skin: '#EDBE9A', hair: 'hijab', hairColor: '#0F766E', outfit: '#F3E8D6', trim: '#C9B79C', style: 'cardigan' },
  { id: 'nilufar', gender: 'f', role: 'teacher', skin: '#F2C9A8', hair: 'long', hairColor: '#1F1A17', outfit: '#1E3A5F', trim: '#F4F4F5', style: 'blazer', glasses: true },
  { id: 'aziz', gender: 'm', role: 'teacher', skin: '#D9A47E', hair: 'short', hairColor: '#211A15', outfit: '#2F3437', trim: '#FFFFFF', style: 'blazer', beard: 'short' },
  { id: 'akmal', gender: 'm', role: 'professor', skin: '#E3B08C', hair: 'bald', hairColor: '#B9B4AD', outfit: '#6B4F3A', trim: '#E9E2D6', style: 'blazer', beard: 'full', glasses: true },
  { id: 'dilnoza', gender: 'f', role: 'student', skin: '#F0C4A0', hair: 'bun', hairColor: '#5B3A26', outfit: '#C6F432', trim: '#111111', style: 'sweater' },
  { id: 'bobur', gender: 'm', role: 'student', skin: '#C98E68', hair: 'curly', hairColor: '#1B1512', outfit: '#F97316', trim: '#FFF7ED', style: 'hoodie' },
  { id: 'kamila', gender: 'f', role: 'business', skin: '#F5D0B5', hair: 'bob', hairColor: '#3B2418', outfit: '#B91C1C', trim: '#FFFFFF', style: 'blazer' },
  { id: 'qalam', gender: 'f', role: 'robot', robot: true, outfit: '#111111', trim: '#C6F432' },
]
export const presenterById = (id) => PRESENTERS.find((p) => p.id === id) ?? PRESENTERS[0]

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`
}

/** The mouth for an opening 0…1: a small smile when closed, an open rounded mouth when speaking. */
export function mouthPath(o) {
  const w = 11 + o * 2.5
  const top = 121 - o * 1.2
  const low = 122.5 + o * 10
  return `M${100 - w} ${top} Q100 ${top - 2.2 + o * 0.6} ${100 + w} ${top} Q${100 + w * 0.55} ${low} 100 ${low} Q${100 - w * 0.55} ${low} ${100 - w} ${top} Z`
}

/** Runs fn(level, t) every frame while mounted (the mouth, the ring). */
function useLevelFrame(level, fn) {
  const cb = useRef(fn)
  cb.current = fn
  useEffect(() => {
    let raf = 0
    let smooth = 0
    const tick = (now) => {
      const target = level?.() ?? 0
      // opens fast, closes a little slower — speech looks natural, not jittery
      smooth += (target - smooth) * (target > smooth ? 0.55 : 0.28)
      cb.current(smooth, now / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [level])
}

function HairBack({ p }) {
  const c = p.hairColor
  if (p.hair === 'long') return <path d="M60 92 C56 52 80 38 101 38 C124 38 146 54 141 96 C141 128 147 152 154 176 C130 182 70 182 46 176 C54 152 60 126 60 92 Z" fill={shade(c, 0.85)} />
  if (p.hair === 'bob') return <path d="M60 94 C56 54 80 40 101 40 C124 40 146 56 141 96 C141 112 143 124 147 134 C128 140 72 140 54 134 C58 124 60 110 60 94 Z" fill={shade(c, 0.85)} />
  if (p.hair === 'hijab')
    return (
      <>
        <path d="M40 200 C44 160 66 142 100 142 C134 142 156 160 160 200 Z" fill={shade(c, 0.82)} />
        <path d="M55 100 C50 54 78 36 100 36 C124 36 151 54 145 100 C145 130 134 148 116 156 L84 156 C66 148 55 130 55 100 Z" fill={c} />
      </>
    )
  if (p.hair === 'bun') return <circle cx="101" cy="40" r="15" fill={shade(c, 0.9)} />
  return null
}

function HairFront({ p }) {
  const c = p.hairColor
  switch (p.hair) {
    case 'short':
      return <path d="M64 94 C59 60 78 44 102 44 C127 45 142 61 136 94 C134 82 130 72 121 66 C108 71 86 70 74 64 C68 72 65 82 64 94 Z" fill={c} />
    case 'curly':
      return (
        <g fill={c}>
          <path d="M64 92 C60 64 76 48 100 48 C124 48 140 64 136 92 C132 78 124 70 112 68 C100 72 86 72 76 68 C70 76 66 84 64 92 Z" />
          {[[72, 58, 11], [86, 48, 12], [102, 45, 12], [118, 49, 12], [130, 60, 10], [66, 72, 8], [136, 74, 8], [94, 56, 9], [112, 57, 9]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      )
    case 'long':
    case 'bob':
      return <path d="M64 96 C62 60 82 46 102 46 C123 46 139 62 136 96 C130 76 118 64 98 62 C92 72 78 82 64 96 Z" fill={c} />
    case 'bun':
      return <path d="M65 92 C62 62 80 49 101 49 C122 49 139 62 136 92 C131 74 118 63 101 62 C84 63 70 74 65 92 Z" fill={c} />
    case 'hijab':
      return (
        <>
          <path d="M65 92 C64 62 82 50 100 50 C118 50 136 62 135 92 C129 70 116 59 100 59 C84 59 71 70 65 92 Z" fill={shade(c, 1.12)} />
          <path d="M86 150 Q100 162 114 150 L116 156 L84 156 Z" fill={shade(c, 0.9)} />
        </>
      )
    case 'bald':
      return (
        <g fill={c}>
          <path d="M63 100 C60 88 62 78 67 72 C70 82 71 92 71 104 Z" />
          <path d="M137 100 C140 88 138 78 133 72 C130 82 129 92 129 104 Z" />
        </g>
      )
    default:
      return null
  }
}

function Outfit({ p }) {
  const o = p.outfit
  const neck = shade(p.skin, 0.88)
  return (
    <g>
      <path d="M88 128 L88 150 Q100 158 112 150 L112 128 Z" fill={neck} />
      <path d="M28 200 C30 166 56 148 100 148 C144 148 170 166 172 200 Z" fill={o} />
      {p.style === 'blazer' && (
        <>
          <path d="M84 148 L100 186 L116 148 Z" fill={p.trim} />
          <path d="M80 149 L100 190 L90 200 L66 200 C70 178 74 160 80 149 Z" fill={shade(o, 0.82)} />
          <path d="M120 149 L100 190 L110 200 L134 200 C130 178 126 160 120 149 Z" fill={shade(o, 0.82)} />
        </>
      )}
      {p.style === 'cardigan' && (
        <>
          <path d="M86 148 Q100 172 114 148 Z" fill={p.trim} />
          <path d="M96 168 L96 200 M104 168 L104 200" stroke={shade(o, 0.8)} strokeWidth="2" />
        </>
      )}
      {p.style === 'sweater' && <path d="M84 149 Q100 166 116 149" fill="none" stroke={shade(o, 0.78)} strokeWidth="5" strokeLinecap="round" />}
      {p.style === 'hoodie' && (
        <>
          <path d="M70 152 Q100 178 130 152 Q122 166 100 168 Q78 166 70 152 Z" fill={shade(o, 0.8)} />
          <path d="M92 168 L90 192 M108 168 L110 192" stroke={p.trim} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

function Beard({ p }) {
  if (!p.beard) return null
  const c = p.hairColor
  if (p.beard === 'short')
    return <path d="M68 104 C70 128 84 140 100 140 C116 140 130 128 132 104 C128 118 120 126 112 128 C106 124 94 124 88 128 C80 126 72 118 68 104 Z" fill={c} opacity="0.92" />
  return <path d="M66 100 C66 134 82 150 100 150 C118 150 134 134 134 100 C130 118 122 128 112 130 C106 126 94 126 88 130 C78 128 70 118 66 100 Z" fill={c} />
}

/** The raised hand, pointing out of the frame towards the slide (left; `flip` → right). */
function Hand({ p, flip }) {
  const skin = p.skin ?? '#EDBE9A'
  return (
    <g transform={flip ? 'translate(200 0) scale(-1 1)' : undefined}>
      <g className="pr-hand">
        <path d="M30 200 C30 186 34 176 40 168 L58 180 C52 188 50 194 50 200 Z" fill={shade(p.outfit, 0.86)} />
        <g transform="translate(52 170) rotate(-140)">
          <rect x="0" y="-9" width="24" height="18" rx="8" fill={skin} />
          <rect x="18" y="-8" width="24" height="7" rx="3.5" fill={skin} />
          <rect x="6" y="5" width="9" height="7" rx="3.5" fill={shade(skin, 0.94)} />
        </g>
      </g>
    </g>
  )
}

function RobotFace({ mouth }) {
  return (
    <g>
      <path d="M28 200 C30 166 56 148 100 148 C144 148 170 166 172 200 Z" fill="#111" />
      <path d="M78 152 L100 172 L122 152" fill="none" stroke="#C6F432" strokeWidth="4" strokeLinejoin="round" />
      <rect x="92" y="128" width="16" height="24" rx="4" fill="#2A2A2A" />
      <line x1="100" y1="44" x2="100" y2="30" stroke="#2A2A2A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="27" r="6" fill="#C6F432" className="pr-antenna" />
      <rect x="58" y="44" width="84" height="88" rx="26" fill="#1C1C1E" />
      <rect x="66" y="54" width="68" height="62" rx="18" fill="#0B0B0C" />
      <g className="pr-eyes" style={{ transformOrigin: '100px 78px' }}>
        <rect x="80" y="70" width="10" height="16" rx="5" fill="#C6F432" />
        <rect x="110" y="70" width="10" height="16" rx="5" fill="#C6F432" />
      </g>
      <path ref={mouth} d="M88 100 Q100 104 112 100" fill="none" stroke="#C6F432" strokeWidth="4" strokeLinecap="round" />
      <rect x="50" y="76" width="8" height="24" rx="4" fill="#2A2A2A" />
      <rect x="142" y="76" width="8" height="24" rx="4" fill="#2A2A2A" />
    </g>
  )
}

/**
 * One character. `level` is a function (read every frame); `pointing` raises the hand towards
 * the slide; `side` is where the character sits ('right' → it points to the left).
 */
export function Character({ presenter, level, pointing = false, side = 'right', className = '' }) {
  const p = presenter
  const head = useRef(null)
  const mouth = useRef(null)
  const brows = useRef(null)
  useLevelFrame(level, (lv, t) => {
    const sway = Math.sin(t * 0.9) * 1.4 + Math.sin(t * 2.3) * lv * 1.6
    const nod = lv * 1.6
    head.current?.setAttribute('transform', `rotate(${sway.toFixed(2)} 100 130) translate(0 ${nod.toFixed(2)})`)
    if (p.robot) {
      const h = 2 + lv * 12
      mouth.current?.setAttribute('d', lv > 0.06 ? `M88 ${100 - h / 2} Q100 ${100 - h} 112 ${100 - h / 2} Q100 ${100 + h} 88 ${100 - h / 2} Z` : 'M88 100 Q100 104 112 100')
      mouth.current?.setAttribute('fill', lv > 0.06 ? '#C6F432' : 'none')
    } else mouth.current?.setAttribute('d', mouthPath(Math.min(1, lv)))
    brows.current?.setAttribute('transform', `translate(0 ${(-lv * 1.4).toFixed(2)})`)
  })
  const flip = side === 'left'
  return (
    <svg viewBox="0 0 200 200" className={`pr-char ${pointing ? 'pointing' : ''} ${className}`} aria-hidden="true">
      {p.robot ? (
        <g ref={head}>
          <RobotFace mouth={mouth} />
        </g>
      ) : (
        <>
          <HairBack p={p} />
          <Outfit p={p} />
          <g ref={head}>
            {p.hair !== 'hijab' && (
              <>
                <ellipse cx="65" cy="98" rx="6" ry="9" fill={shade(p.skin, 0.92)} />
                <ellipse cx="135" cy="98" rx="6" ry="9" fill={shade(p.skin, 0.92)} />
              </>
            )}
            <path d="M66 92 C66 60 82 50 100 50 C118 50 134 60 134 92 C134 122 120 140 100 140 C80 140 66 122 66 92 Z" fill={p.skin} />
            <path d="M70 110 C76 130 88 138 100 138 C112 138 124 130 130 110 C124 126 112 132 100 132 C88 132 76 126 70 110 Z" fill={shade(p.skin, 0.93)} />
            <Beard p={p} />
            <HairFront p={p} />
            <g ref={brows}>
              <path d="M78 84 Q86 79 93 83" fill="none" stroke={shade(p.hairColor === '#B9B4AD' ? '#7A746C' : p.hairColor, 1)} strokeWidth="3" strokeLinecap="round" />
              <path d="M107 83 Q114 79 122 84" fill="none" stroke={shade(p.hairColor === '#B9B4AD' ? '#7A746C' : p.hairColor, 1)} strokeWidth="3" strokeLinecap="round" />
            </g>
            <g className="pr-eyes" style={{ transformOrigin: '100px 95px' }}>
              <ellipse cx="86" cy="95" rx="3.6" ry="4.4" fill="#1B1B1F" />
              <ellipse cx="114" cy="95" rx="3.6" ry="4.4" fill="#1B1B1F" />
              <circle cx="87.3" cy="93.6" r="1.2" fill="#fff" />
              <circle cx="115.3" cy="93.6" r="1.2" fill="#fff" />
            </g>
            {p.glasses && (
              <g fill="none" stroke="#2A2A2E" strokeWidth="2.2">
                <rect x="74" y="86" width="22" height="17" rx="7" />
                <rect x="104" y="86" width="22" height="17" rx="7" />
                <path d="M96 93 Q100 90 104 93" />
              </g>
            )}
            <path d="M100 99 Q97 109 101 111" fill="none" stroke={shade(p.skin, 0.78)} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="78" cy="112" r="6" fill="#E8776B" opacity="0.16" />
            <circle cx="122" cy="112" r="6" fill="#E8776B" opacity="0.16" />
            <path ref={mouth} d={mouthPath(0)} fill="#7A2E2E" />
          </g>
        </>
      )}
      <Hand p={p.robot ? { ...p, skin: '#2A2A2A', outfit: '#111111' } : p} flip={flip} />
    </svg>
  )
}

/** The user's own photo as the presenter: a ring that glows with the voice. */
export function PhotoPresenter({ src, level }) {
  const box = useRef(null)
  const url = useAsset(src)
  useLevelFrame(level, (lv) => {
    box.current?.style.setProperty('--lv', lv.toFixed(3))
  })
  return (
    <div className="pr-photo" ref={box}>
      {url && <img src={url} alt="" draggable={false} />}
    </div>
  )
}

/** Whoever presents: a character, or the user's photo. */
export function PresenterFace({ narration, level, pointing, side }) {
  const who = narration?.presenter ?? {}
  if (who.photo) return <PhotoPresenter src={who.photo} level={level} />
  return <Character presenter={presenterById(who.id)} level={level} pointing={pointing} side={side} />
}
