// Category tiles of the Elements panel: a glossy card on a tilted back card, with a small
// original illustration of what the category holds.
import { useId } from 'react'

const TONES = {
  shapes: ['#2fd0cf', '#0f8796'],
  lines: ['#d9ff5a', '#9cc90c'],
  graphics: ['#ffa94d', '#f2600c'],
  icons: ['#8b6cff', '#5432d8'],
  photos: ['#5d9bff', '#2458d8'],
  frames: ['#45d38a', '#138a4b'],
  grids: ['#cf6bff', '#8c2fd8'],
  tables: ['#ff9157', '#e2540b'],
  charts: ['#3dd2e3', '#0b8ea3'],
  mockups: ['#ff77a6', '#d33a70'],
  animations: ['#ffc94d', '#f08c00'],
  stickers: ['#ff6b6b', '#d32f3a'],
}

function Landscape({ x, y, w, h }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill="#bfe0ff" />
      <circle cx={x + w * 0.74} cy={y + h * 0.3} r={Math.min(w, h) * 0.12} fill="#ffd43b" />
      <path d={`M${x} ${y + h * 0.78}L${x + w * 0.3} ${y + h * 0.5}L${x + w * 0.52} ${y + h * 0.68}L${x + w * 0.76} ${y + h * 0.44}L${x + w} ${y + h * 0.72}V${y + h}H${x}Z`} fill="#40a35a" />
    </>
  )
}

function Glyph({ id, uid }) {
  switch (id) {
    case 'shapes':
      return (
        <>
          <circle cx="22" cy="23" r="10" fill="#fff" />
          <path d="M42 12L54 33H30Z" fill="#ffe066" stroke="#ffe066" strokeWidth="2" strokeLinejoin="round" />
          <rect x="14" y="38" width="16" height="15" rx="3" fill="#fff" opacity=".7" />
          {[36, 41, 46, 51].map((x) => (
            <circle key={x} cx={x} cy="47" r="1.8" fill="#0b3b44" />
          ))}
        </>
      )
    case 'lines':
      return (
        <g fill="none" stroke="#1b2a05" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 46L46 16" />
          <path d="M34 16H46V28" />
          <path d="M14 54H50" strokeDasharray="1 6.5" />
        </g>
      )
    case 'graphics':
      return (
        <>
          <path d="M32 40V56" stroke="#2f9e44" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 50C26 50 21 46 20 41C26 41 31 45 32 50Z" fill="#40c057" />
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={i} cx="32" cy="17" rx="6" ry="9" fill="#fff" transform={`rotate(${i * 60} 32 27)`} />
          ))}
          <circle cx="32" cy="27" r="6" fill="#ffd43b" />
        </>
      )
    case 'icons':
      return (
        <g fill="#fff">
          <path d="M20 30C14 26 10 22 10 18C10 15 12 13 15 13C17 13 19 14 20 16C21 14 23 13 25 13C28 13 30 15 30 18C30 22 26 26 20 30Z" />
          <path d="M44 10L47 17L54 17.5L48.6 22L50.4 29L44 25.2L37.6 29L39.4 22L34 17.5L41 17Z" />
          <path d="M23 35L14 47H20L17 56L27 43H21L23 35Z" />
          <path d="M36 46L41 51L52 39" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'photos':
      return (
        <>
          <rect x="10" y="12" width="44" height="40" rx="4" fill="#fff" />
          <clipPath id={`${uid}p`}>
            <rect x="14" y="16" width="36" height="32" rx="2" />
          </clipPath>
          <g clipPath={`url(#${uid}p)`}>
            <Landscape x={14} y={16} w={36} h={32} />
          </g>
        </>
      )
    case 'frames':
      return (
        <>
          <path d="M32 9C44 10 54 18 55 31C56 44 47 55 33 55C19 55 9 46 9 33C9 19 20 8 32 9Z" fill="#fff" />
          <clipPath id={`${uid}f`}>
            <path d="M32 13C42 14 51 21 51 31C52 42 44 51 33 51C21 51 13 44 13 33C13 21 22 12 32 13Z" />
          </clipPath>
          <g clipPath={`url(#${uid}f)`}>
            <Landscape x={10} y={12} w={44} h={40} />
          </g>
        </>
      )
    case 'grids':
      return (
        <>
          <rect x="9" y="11" width="46" height="42" rx="4" fill="#fff" />
          {[[12, 14, 19, 17], [33, 14, 19, 17], [12, 33, 19, 17], [33, 33, 19, 17]].map(([x, y, w, h], i) => (
            <g key={i}>
              <clipPath id={`${uid}g${i}`}>
                <rect x={x} y={y} width={w} height={h} rx="1.5" />
              </clipPath>
              <g clipPath={`url(#${uid}g${i})`}>
                <Landscape x={x} y={y} w={w} h={h} />
              </g>
            </g>
          ))}
        </>
      )
    case 'tables':
      return (
        <>
          <rect x="9" y="12" width="46" height="40" rx="4" fill="#fff" />
          <path d="M9 16C9 13.8 10.8 12 13 12H51C53.2 12 55 13.8 55 16V22H9Z" fill="#ffe8d9" />
          <path d="M9 32H55M9 42H55M24 12V52M40 12V52" stroke="#f6c3a5" strokeWidth="1.6" />
        </>
      )
    case 'charts':
      return (
        <>
          <rect x="9" y="11" width="46" height="42" rx="4" fill="#fff" />
          <rect x="16" y="34" width="6" height="13" rx="1.5" fill="#7c5cff" />
          <rect x="26" y="27" width="6" height="20" rx="1.5" fill="#7c5cff" />
          <rect x="36" y="31" width="6" height="16" rx="1.5" fill="#7c5cff" />
          <rect x="46" y="21" width="6" height="26" rx="1.5" fill="#7c5cff" opacity=".55" />
          <path d="M16 26L28 19L38 23L50 14" fill="none" stroke="#0b8ea3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="28" cy="19" r="2.4" fill="#0b8ea3" />
          <circle cx="38" cy="23" r="2.4" fill="#0b8ea3" />
        </>
      )
    case 'mockups':
      return (
        <>
          <rect x="20" y="7" width="24" height="50" rx="6" fill="#1f2937" />
          <clipPath id={`${uid}m`}>
            <rect x="22.5" y="9.5" width="19" height="45" rx="4" />
          </clipPath>
          <g clipPath={`url(#${uid}m)`}>
            <Landscape x={22.5} y={9.5} w={19} h={45} />
          </g>
          <rect x="28" y="11.5" width="8" height="2.6" rx="1.3" fill="#111" />
        </>
      )
    case 'animations':
      return (
        <>
          <path d="M8 40C10 30 14 24 20 20M6 30C7 25 9 21 12 18" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="36" cy="32" r="18" fill="#fff" />
          <path d="M31 23L45 32L31 41Z" fill="#f08c00" stroke="#f08c00" strokeWidth="2" strokeLinejoin="round" />
          <path d="M52 12L53.6 16.4L58 18L53.6 19.6L52 24L50.4 19.6L46 18L50.4 16.4Z" fill="#fff" />
        </>
      )
    case 'stickers':
      return (
        <>
          <path d="M32 8C45 8 56 19 56 32C56 40 52 47 46 51L44 41C43 38 41 37 38 38L28 41C25 42 24 44 25 47L27 55C16 53 8 43 8 32C8 19 19 8 32 8Z" fill="#ffd43b" stroke="#fff" strokeWidth="2.4" />
          <path d="M27 55L25 47C24 44 25 42 28 41L38 38C41 37 43 38 44 41L46 51C41 54 34 56 27 55Z" fill="#fff" />
          <ellipse cx="25" cy="25" rx="2.6" ry="3.6" fill="#3b2a1a" />
          <ellipse cx="39" cy="25" rx="2.6" ry="3.6" fill="#3b2a1a" />
          <path d="M22 33C26 39 36 39 41 33" fill="none" stroke="#3b2a1a" strokeWidth="2.8" strokeLinecap="round" />
        </>
      )
    default:
      return null
  }
}

export default function CatArt({ id }) {
  const uid = `ca${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [a, b] = TONES[id] ?? TONES.shapes
  return (
    <span className="ep-cat-art" style={{ '--c1': a, '--c2': b }}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <Glyph id={id} uid={uid} />
      </svg>
    </span>
  )
}
