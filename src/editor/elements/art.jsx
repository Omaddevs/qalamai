// Original vector art for the Elements panel: decorations, flat illustrations and hand-drawn
// stickers. Every piece is drawn here (no stock art); `colors` are the defaults, and each colour
// can be changed from the toolbar. Strokes carry pathLength=1 so the "draw" animation works.
import { PATHS } from './shapes.js'

const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1 }
const doodle = (c, w = 5) => ({ ...LINE, stroke: c, strokeWidth: w })

const STICKER = { stroke: '#ffffff', strokeWidth: 6, strokeLinejoin: 'round', paintOrder: 'stroke' }

/**
 * id → { group: 'decor' | 'objects' | 'stickers' | 'loaders', vb, colors(theme) → string[], draw(c) → svg children }
 * `stretch` art fills the element box (preserveAspectRatio="none").
 */
export const ART = {
  /* ───────── decorations ───────── */
  blob: { group: 'decor', colors: (t) => [t.accent], draw: (c) => <path d={PATHS.blob1} fill={c[0]} /> },
  blobDuo: {
    group: 'decor',
    colors: (t) => [t.accent, '#ffd6a5'],
    draw: (c) => (
      <>
        <path d={PATHS.blob2} fill={c[1]} />
        <path d={PATHS.blob3} transform="translate(16 16) scale(.68)" fill={c[0]} />
      </>
    ),
  },
  waves: {
    group: 'decor',
    vb: '0 0 200 100',
    stretch: true,
    colors: (t) => [t.accent, '#a5d8ff'],
    draw: (c) => (
      <>
        <path d="M0 46C25 30 45 30 70 46S115 62 140 46S180 30 200 40V100H0Z" fill={c[1]} />
        <path d="M0 64C25 50 50 52 75 64S125 78 150 64S185 52 200 58V100H0Z" fill={c[0]} />
      </>
    ),
  },
  squiggle: {
    group: 'decor',
    vb: '0 0 200 50',
    colors: (t) => [t.accent],
    draw: (c) => <path d="M6 25C18 5 30 5 42 25S66 45 78 25S102 5 114 25S138 45 150 25S174 5 194 25" {...doodle(c[0], 7)} />,
  },
  dots: {
    group: 'decor',
    colors: (t) => [t.accent],
    draw: (c) => (
      <g fill={c[0]}>
        {Array.from({ length: 25 }, (_, i) => (
          <circle key={i} cx={10 + (i % 5) * 20} cy={10 + Math.floor(i / 5) * 20} r={4.2} />
        ))}
      </g>
    ),
  },
  halftone: {
    group: 'decor',
    colors: (t) => [t.accent],
    draw: (c) => (
      <g fill={c[0]}>
        {Array.from({ length: 49 }, (_, i) => {
          const x = i % 7
          const y = Math.floor(i / 7)
          return <circle key={i} cx={7 + x * 14.3} cy={7 + y * 14.3} r={Math.max(0.6, 5.6 * (1 - (x + y) / 13))} />
        })}
      </g>
    ),
  },
  ring: {
    group: 'decor',
    vb: '0 0 120 80',
    colors: () => ['#ff5757'],
    draw: (c) => <path d="M62 8C30 6 6 20 8 40C10 62 44 74 74 70C102 66 116 50 112 32C108 14 84 6 58 10C40 13 26 20 20 28" {...doodle(c[0], 4.5)} />,
  },
  swash: {
    group: 'decor',
    vb: '0 0 200 40',
    colors: (t) => [t.accent],
    draw: (c) => <path d="M4 30C50 14 110 8 196 12C150 14 90 20 8 36C5 36 3 33 4 30Z" fill={c[0]} />,
  },
  highlight: {
    group: 'decor',
    vb: '0 0 200 60',
    stretch: true,
    colors: () => ['#ffe066'],
    draw: (c) => <path d="M8 14C40 8 90 10 140 8C162 7 182 9 194 12C197 22 196 36 192 48C150 52 100 50 60 52C40 53 20 52 6 48C3 38 4 24 8 14Z" fill={c[0]} opacity=".9" />,
  },
  badge: {
    group: 'decor',
    colors: (t) => [t.accent, '#ffffff'],
    draw: (c) => (
      <>
        <path d={PATHS.burst} fill={c[0]} />
        <circle cx="50" cy="50" r="31" fill="none" stroke={c[1]} strokeWidth="1.6" strokeDasharray="3 3" />
      </>
    ),
  },
  confetti: {
    group: 'decor',
    colors: (t) => [t.accent, '#ffbd2e', '#ff66c4'],
    draw: (c) => (
      <>
        {[
          [12, 18, 20, 0], [40, 8, -30, 1], [72, 16, 45, 2], [88, 40, 10, 0], [20, 52, 60, 2], [56, 44, -15, 1], [78, 74, 30, 0], [34, 82, -40, 1], [8, 86, 15, 2],
        ].map(([x, y, r, k], i) => (
          <rect key={i} x={x} y={y} width="9" height="4" rx="1.5" fill={c[k]} transform={`rotate(${r} ${x + 4.5} ${y + 2})`} />
        ))}
        {[[28, 32, 1], [64, 28, 0], [50, 66, 2], [90, 60, 1], [14, 70, 0]].map(([x, y, k], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill={c[k]} />
        ))}
        <path d="M60 86c3-4 6 4 9 0s6 4 9 0" {...doodle(c[2], 2.6)} />
      </>
    ),
  },
  sparkles: {
    group: 'decor',
    colors: () => ['#ffbd2e'],
    draw: (c) => (
      <g fill={c[0]}>
        <path d={PATHS.sparkle} transform="translate(4 30) scale(.62)" />
        <path d={PATHS.sparkle} transform="translate(60 52) scale(.38)" />
        <path d={PATHS.sparkle} transform="translate(62 6) scale(.26)" />
      </g>
    ),
  },
  sun: {
    group: 'decor',
    colors: () => ['#ffbd2e'],
    draw: (c) => (
      <g fill={c[0]}>
        <circle cx="50" cy="50" r="22" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="47.5" y="3" width="5" height="15" rx="2.5" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
    ),
  },
  rainbow: {
    group: 'decor',
    vb: '0 0 100 56',
    colors: (t) => [t.accent, '#ffbd2e', '#ff5757'],
    draw: (c) => (
      <>
        <path d="M9 52A41 41 0 0 1 91 52" {...doodle(c[2], 8)} />
        <path d="M20 52A30 30 0 0 1 80 52" {...doodle(c[1], 8)} />
        <path d="M31 52A19 19 0 0 1 69 52" {...doodle(c[0], 8)} />
      </>
    ),
  },
  branch: {
    group: 'decor',
    colors: () => ['#2f9e44', '#69db7c'],
    draw: (c) => (
      <>
        <path d="M18 94C40 70 58 46 84 8" {...doodle(c[0], 2.4)} />
        {[
          [26, 84, -25, 0], [30, 79, -125, 1], [38, 70, -30, 1], [43, 64, -130, 0], [50, 56, -35, 0], [55, 49, -135, 1], [62, 41, -40, 1], [67, 33, -140, 0], [74, 24, -45, 0],
        ].map(([x, y, r, k], i) => (
          <path key={i} d="M0 0C5 -8 16 -10 24 -5C17 2 7 4 0 0Z" fill={c[k]} transform={`translate(${x} ${y}) rotate(${r})`} />
        ))}
      </>
    ),
  },
  circles: {
    group: 'decor',
    vb: '0 0 100 64',
    colors: (t) => [t.accent, '#ffbd2e'],
    draw: (c) => (
      <>
        <circle cx="34" cy="32" r="30" fill={c[1]} opacity=".9" />
        <circle cx="66" cy="32" r="30" fill={c[0]} opacity=".85" />
      </>
    ),
  },
  corners: {
    group: 'decor',
    stretch: true,
    colors: (t) => [t.accent],
    draw: (c) => <path d="M3 22V3H22M78 3H97V22M97 78V97H78M22 97H3V78" {...doodle(c[0], 3)} vectorEffect="non-scaling-stroke" />,
  },
  cloud: { group: 'decor', colors: () => ['#d0ebff'], draw: (c) => <path d={PATHS.cloud} fill={c[0]} /> },
  ribbon: {
    group: 'decor',
    vb: '0 0 200 70',
    stretch: true,
    colors: (t) => [t.accent, '#334155', '#0f172a'],
    draw: (c) => (
      <>
        <path d="M2 18H36V62H2L13 40Z" fill={c[1]} />
        <path d="M198 18H164V62H198L187 40Z" fill={c[1]} />
        <path d="M24 50L36 62V50Z" fill={c[2]} />
        <path d="M176 50L164 62V50Z" fill={c[2]} />
        <path d="M24 6H176V50H24Z" fill={c[0]} />
      </>
    ),
  },

  /* ───────── flat illustrations ───────── */
  bulb: {
    group: 'objects',
    colors: () => ['#ffd43b', '#475569'],
    draw: (c) => (
      <>
        <path d="M50 2V7M14 17L18.5 20.5M86 17L81.5 20.5M5 43H10M90 43H95" {...doodle(c[0], 4)} />
        <path d="M50 12C34 12 22 24 22 39C22 49 27 56 33 62C36 65 38 69 38 73H62C62 69 64 65 67 62C73 56 78 49 78 39C78 24 66 12 50 12Z" fill={c[0]} />
        <path d="M34 38C34 29 41 22 50 22" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="4" strokeLinecap="round" />
        <rect x="37" y="75" width="26" height="6" rx="3" fill={c[1]} />
        <rect x="39" y="83" width="22" height="6" rx="3" fill={c[1]} />
        <path d="M44 91H56C56 94 53 97 50 97C47 97 44 94 44 91Z" fill={c[1]} />
      </>
    ),
  },
  rocket: {
    group: 'objects',
    colors: (t) => [t.accent, '#ff5757', '#f1f5f9'],
    draw: (c) => (
      <g transform="rotate(38 50 50)">
        <path d="M43 80C43 88 47 94 50 99C53 94 57 88 57 80Z" fill="#ffb020" />
        <path d="M47 80C47 85 49 89 50 92C51 89 53 85 53 80Z" fill="#fff3bf" />
        <path d="M32 54L19 70V81L32 73Z" fill={c[1]} />
        <path d="M68 54L81 70V81L68 73Z" fill={c[1]} />
        <path d="M50 6C62 17 68 33 68 52V72H32V52C32 33 38 17 50 6Z" fill={c[2]} />
        <path d="M50 6C62 17 68 33 68 52V72H50Z" fill="#000" opacity=".07" />
        <path d="M50 6C56 11 60 18 63.5 26H36.5C40 18 44 11 50 6Z" fill={c[1]} />
        <circle cx="50" cy="44" r="8.5" fill={c[0]} stroke="#cbd5e1" strokeWidth="3" />
        <path d="M37 72H63L59 80H41Z" fill="#94a3b8" />
      </g>
    ),
  },
  trophy: {
    group: 'objects',
    colors: () => ['#f5b301', '#334155'],
    draw: (c) => (
      <>
        <path d="M28 18H17C17 34 23 41 32 43M72 18H83C83 34 77 41 68 43" fill="none" stroke={c[0]} strokeWidth="5" strokeLinecap="round" />
        <path d="M27 9H73V34C73 48 63 58 50 58C37 58 27 48 27 34Z" fill={c[0]} />
        <path d="M36 16V31" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
        <path d={PATHS.star5} transform="translate(43 22) scale(.15)" fill="#fff" opacity=".85" />
        <rect x="45" y="57" width="10" height="15" fill={c[0]} />
        <rect x="32" y="71" width="36" height="8" rx="2" fill={c[1]} />
        <rect x="25" y="79" width="50" height="11" rx="3" fill={c[1]} />
      </>
    ),
  },
  books: {
    group: 'objects',
    colors: (t) => [t.accent, '#ff914d', '#5271ff'],
    draw: (c) => (
      <>
        <rect x="9" y="70" width="82" height="19" rx="3" fill={c[0]} />
        <rect x="9" y="75.5" width="82" height="3" fill="#fff" opacity=".4" />
        <rect x="16" y="51" width="70" height="19" rx="3" fill={c[1]} />
        <rect x="16" y="56.5" width="70" height="3" fill="#fff" opacity=".4" />
        <g transform="rotate(-6 50 42)">
          <rect x="12" y="32" width="74" height="19" rx="3" fill={c[2]} />
          <rect x="12" y="37.5" width="74" height="3" fill="#fff" opacity=".4" />
        </g>
      </>
    ),
  },
  gradcap: {
    group: 'objects',
    colors: () => ['#1f2937', '#ffd43b'],
    draw: (c) => (
      <>
        <path d="M26 46V66C26 72 38 79 50 79C62 79 74 72 74 66V46L50 56Z" fill={c[0]} />
        <path d="M26 46V66C26 72 38 79 50 79V56Z" fill="#fff" opacity=".08" />
        <path d="M50 17L95 36L50 55L5 36Z" fill={c[0]} />
        <path d="M50 17L95 36L50 55Z" fill="#fff" opacity=".1" />
        <path d="M50 36L83 43V64" fill="none" stroke={c[1]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="79" y="62" width="8" height="13" rx="2" fill={c[1]} />
        <circle cx="50" cy="36" r="3.5" fill={c[1]} />
      </>
    ),
  },
  globe: {
    group: 'objects',
    colors: () => ['#4dabf7', '#51cf66'],
    draw: (c) => (
      <>
        <circle cx="50" cy="50" r="43" fill={c[0]} />
        <path d="M28 26C36 20 46 22 48 30C50 38 42 42 36 46C30 50 22 46 20 40C18 34 22 30 28 26Z" fill={c[1]} />
        <path d="M58 54C66 50 76 54 78 62C80 70 72 80 64 80C56 80 52 72 54 64Z" fill={c[1]} />
        <path d="M60 17C67 14 75 19 75 26C70 28 63 25 60 17Z" fill={c[1]} />
        <path d="M24 74C28 70 34 72 34 78C30 80 26 78 24 74Z" fill={c[1]} />
        <path d="M50 7A43 43 0 0 1 50 93A60 60 0 0 0 50 7Z" fill="#000" opacity=".08" />
        <path d="M21 36A31 31 0 0 1 38 17" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  target: {
    group: 'objects',
    colors: () => ['#ff5757', '#334155'],
    draw: (c) => (
      <>
        <circle cx="46" cy="54" r="42" fill={c[0]} />
        <circle cx="46" cy="54" r="31" fill="#fff" />
        <circle cx="46" cy="54" r="20" fill={c[0]} />
        <circle cx="46" cy="54" r="9" fill="#fff" />
        <path d="M46 54L86 14" stroke={c[1]} strokeWidth="4" strokeLinecap="round" />
        <path d="M80 12L88 4M84 18L96 14M80 12L84 18" stroke={c[1]} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  growth: {
    group: 'objects',
    colors: (t) => [t.accent, '#ff914d'],
    draw: (c) => (
      <>
        <path d="M30 76L22 95M70 76L78 95" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
        <rect x="7" y="11" width="86" height="66" rx="6" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        {[[19, 52, 16], [35, 44, 24], [51, 34, 34], [67, 24, 44]].map(([x, y, h]) => (
          <rect key={x} x={x} y={y} width="11" height={h} rx="2" fill={c[0]} />
        ))}
        <path d="M18 44L34 33L48 38L74 15" fill="none" stroke={c[1]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M64 13H76V25" fill="none" stroke={c[1]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  laptop: {
    group: 'objects',
    colors: (t) => [t.accent, '#e7f5ff'],
    draw: (c) => (
      <>
        <rect x="14" y="16" width="72" height="50" rx="5" fill="#1f2937" />
        <rect x="18" y="20" width="64" height="42" rx="2" fill={c[1]} />
        <rect x="24" y="26" width="28" height="5" rx="2.5" fill={c[0]} />
        <rect x="24" y="35" width="44" height="3" rx="1.5" fill={c[0]} opacity=".45" />
        <rect x="24" y="41" width="36" height="3" rx="1.5" fill={c[0]} opacity=".45" />
        {[[58, 50, 6], [64, 46, 10], [70, 42, 14]].map(([x, y, h]) => (
          <rect key={x} x={x} y={y} width="4" height={h} rx="1" fill={c[0]} />
        ))}
        <path d="M5 68H95L89 78H11Z" fill="#94a3b8" />
        <rect x="41" y="68" width="18" height="3" rx="1.5" fill="#64748b" />
      </>
    ),
  },
  megaphone: {
    group: 'objects',
    colors: (t) => [t.accent, '#334155'],
    draw: (c) => (
      <>
        <path d="M34 60L41 82H51L46 62Z" fill={c[1]} />
        <rect x="15" y="38" width="18" height="24" rx="4" fill={c[1]} />
        <path d="M30 40L74 18V82L30 60Z" fill={c[0]} />
        <ellipse cx="74" cy="50" rx="6" ry="32" fill={c[0]} />
        <ellipse cx="74" cy="50" rx="6" ry="32" fill="#000" opacity=".12" />
        <path d="M86 34L94 28M88 50H97M86 66L94 72" {...doodle(c[0], 4)} />
      </>
    ),
  },
  puzzle: {
    group: 'objects',
    colors: (t) => [t.accent, '#ffbd2e'],
    draw: (c) => (
      <>
        <path d="M8 30H30C28 22 33 15 40 15C47 15 52 22 50 30H66V48C58 46 52 51 52 58C52 65 58 70 66 68V88H8Z" fill={c[0]} />
        <path d="M70 14H92V72H70V56C77 58 82 53 82 47C82 41 77 36 70 38Z" fill={c[1]} />
      </>
    ),
  },
  calendar: {
    group: 'objects',
    colors: (t) => [t.accent],
    draw: (c) => (
      <>
        <rect x="11" y="18" width="78" height="72" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
        <path d="M11 26C11 21.6 14.6 18 19 18H81C85.4 18 89 21.6 89 26V37H11Z" fill={c[0]} />
        <rect x="29" y="9" width="7" height="17" rx="3.5" fill="#334155" />
        <rect x="64" y="9" width="7" height="17" rx="3.5" fill="#334155" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={21 + (i % 4) * 16} y={46 + Math.floor(i / 4) * 13.5} width="10" height="9" rx="2.5" fill={i === 6 ? c[0] : '#e2e8f0'} />
        ))}
      </>
    ),
  },
  clock: {
    group: 'objects',
    colors: (t) => [t.accent],
    draw: (c) => (
      <>
        <circle cx="50" cy="50" r="44" fill={c[0]} />
        <circle cx="50" cy="50" r="35" fill="#fff" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="48.8" y="18" width="2.4" height={i % 3 ? 4 : 7} rx="1.2" fill="#94a3b8" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <path d="M50 50V29M50 50L65 57" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4" fill={c[0]} />
      </>
    ),
  },
  plant: {
    group: 'objects',
    colors: () => ['#2f9e44', '#e8590c'],
    draw: (c) => (
      <>
        <path d="M50 60V30" stroke={c[0]} strokeWidth="3" strokeLinecap="round" />
        <path d="M50 42C37 42 27 33 25 20C38 20 48 29 50 42Z" fill={c[0]} />
        <path d="M50 35C61 33 71 24 73 11C60 12 52 22 50 35Z" fill={c[0]} />
        <path d="M50 52C42 52 34 47 32 38C41 38 48 43 50 52Z" fill={c[0]} opacity=".8" />
        <path d="M50 50C58 49 66 44 68 35C59 35 52 41 50 50Z" fill={c[0]} opacity=".8" />
        <path d="M31 63H69L63 93H37Z" fill={c[1]} />
        <rect x="26" y="56" width="48" height="10" rx="3" fill={c[1]} />
        <rect x="26" y="56" width="48" height="10" rx="3" fill="#000" opacity=".1" />
      </>
    ),
  },
  medal: {
    group: 'objects',
    colors: () => ['#f5b301', '#5271ff'],
    draw: (c) => (
      <>
        <path d="M33 4H48L57 42H42Z" fill={c[1]} />
        <path d="M67 4H52L43 42H58Z" fill={c[1]} />
        <path d="M67 4H52L43 42H58Z" fill="#000" opacity=".15" />
        <circle cx="50" cy="63" r="29" fill={c[0]} />
        <circle cx="50" cy="63" r="22" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
        <path d={PATHS.star5} transform="translate(38.5 51.5) scale(.23)" fill="#fff" />
      </>
    ),
  },
  pencil: {
    group: 'objects',
    colors: () => ['#ffd43b'],
    draw: (c) => (
      <g transform="rotate(-45 50 50)">
        <rect x="6" y="40" width="11" height="20" rx="3" fill="#ff8787" />
        <rect x="14" y="40" width="58" height="20" fill={c[0]} />
        <rect x="14" y="46.6" width="58" height="6.8" fill="#000" opacity=".08" />
        <rect x="14" y="40" width="7" height="20" fill="#adb5bd" />
        <path d="M72 40L93 50L72 60Z" fill="#f1d6b0" />
        <path d="M86.5 46.9L93 50L86.5 53.1Z" fill="#343a40" />
      </g>
    ),
  },
  pin: {
    group: 'objects',
    colors: () => ['#ff5757'],
    draw: (c) => (
      <>
        <ellipse cx="50" cy="93" rx="16" ry="4" fill="#000" opacity=".15" />
        <path d="M50 5C33 5 20 18 20 35C20 58 50 89 50 89S80 58 80 35C80 18 67 5 50 5Z" fill={c[0]} />
        <path d="M50 5C67 5 80 18 80 35C80 58 50 89 50 89Z" fill="#000" opacity=".08" />
        <circle cx="50" cy="35" r="11" fill="#fff" />
      </>
    ),
  },
  gift: {
    group: 'objects',
    colors: () => ['#ff5757', '#ffd43b'],
    draw: (c) => (
      <>
        <rect x="16" y="46" width="68" height="46" rx="4" fill={c[0]} />
        <rect x="16" y="46" width="68" height="46" rx="4" fill="#000" opacity=".1" />
        <rect x="10" y="32" width="80" height="17" rx="4" fill={c[0]} />
        <rect x="45" y="32" width="10" height="60" fill={c[1]} />
        <path d="M50 32C42 18 26 17 28 27C30 34 42 33 50 32Z" fill={c[1]} />
        <path d="M50 32C58 18 74 17 72 27C70 34 58 33 50 32Z" fill={c[1]} />
      </>
    ),
  },
  chat: {
    group: 'objects',
    colors: (t) => [t.accent, '#5271ff'],
    draw: (c) => (
      <>
        <path d="M14 12H62Q70 12 70 20V46Q70 54 62 54H30L18 65V54H14Q6 54 6 46V20Q6 12 14 12Z" fill={c[0]} />
        {[24, 38, 52].map((x) => (
          <circle key={x} cx={x} cy="33" r="4" fill="#fff" />
        ))}
        <path d="M40 44H86Q94 44 94 52V75Q94 83 86 83H82V94L70 83H40Q32 83 32 75V52Q32 44 40 44Z" fill={c[1]} />
        <rect x="42" y="56" width="40" height="4.5" rx="2.25" fill="#fff" />
        <rect x="42" y="67" width="28" height="4.5" rx="2.25" fill="#fff" opacity=".75" />
      </>
    ),
  },

  /* ───────── hand-drawn stickers ───────── */
  dCheck: { group: 'stickers', colors: () => ['#2f9e44'], draw: (c) => <path d="M12 52L38 77L89 21" {...doodle(c[0], 7)} /> },
  dCross: { group: 'stickers', colors: () => ['#e03131'], draw: (c) => <path d="M20 18C40 38 60 60 82 82M80 18C60 40 40 60 18 82" {...doodle(c[0], 7)} /> },
  dHeart: {
    group: 'stickers',
    colors: () => ['#e03131'],
    draw: (c) => <path d="M50 84C30 68 10 54 12 34C14 20 30 14 42 22C46 25 49 30 50 34C52 28 56 22 62 19C74 13 90 20 88 38C86 56 66 70 50 84" {...doodle(c[0], 5)} />,
  },
  dSmile: {
    group: 'stickers',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => (
      <>
        <path d="M50 8C74 8 92 26 92 50C92 74 74 92 50 92C26 92 8 74 8 50C8 27 25 9 48 8" {...doodle(c[0], 5)} />
        <path d="M36 38V45M64 38V45" {...doodle(c[0], 6)} />
        <path d="M31 58C39 71 61 71 69 58" {...doodle(c[0], 5)} />
      </>
    ),
  },
  dStar: { group: 'stickers', colors: () => ['#f59f00'], draw: (c) => <path d="M50 9L61 38L91 40L67 59L75 89L50 72L25 89L33 59L9 40L39 38Z" {...doodle(c[0], 5)} /> },
  dCurl: {
    group: 'stickers',
    vb: '0 0 120 80',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => (
      <>
        <path d="M8 62C26 66 40 52 34 38C28 24 12 34 20 46C30 60 62 58 82 36C90 27 96 20 104 14" {...doodle(c[0], 4)} />
        <path d="M88 11L105 13L101 30" {...doodle(c[0], 4)} />
      </>
    ),
  },
  dLoop: {
    group: 'stickers',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => (
      <>
        <path d="M28 8C70 6 86 40 62 50C44 58 36 38 52 34C70 30 76 58 66 88" {...doodle(c[0], 4)} />
        <path d="M54 77L66 90L77 76" {...doodle(c[0], 4)} />
      </>
    ),
  },
  dArrow: {
    group: 'stickers',
    vb: '0 0 120 40',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => <path d="M6 22C40 18 80 18 110 20M96 8L112 20L96 32" {...doodle(c[0], 4)} />,
  },
  dArrowUp: {
    group: 'stickers',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => <path d="M14 88C20 52 44 27 84 20M68 9L85 20L72 35" {...doodle(c[0], 4.5)} />,
  },
  dBang: {
    group: 'stickers',
    colors: () => ['#e03131'],
    draw: (c) => (
      <>
        <path d="M50 18V58M50 78V80" {...doodle(c[0], 8)} />
        <path d="M22 18L31 29M78 18L69 29M14 48H25M86 48H75" {...doodle(c[0], 4)} />
      </>
    ),
  },
  dQuestion: {
    group: 'stickers',
    colors: (t) => [t.accent],
    draw: (c) => <path d="M33 32C33 20 43 11 54 11C66 11 74 20 74 30C74 42 62 46 56 52C52 56 52 62 52 66M52 84V86" {...doodle(c[0], 7)} />,
  },
  dBubble: {
    group: 'stickers',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => <path d="M18 24C30 14 70 12 84 24C96 34 92 58 78 66C66 72 48 72 36 68L17 83L24 62C12 54 8 34 18 24Z" {...doodle(c[0], 4.5)} />,
  },
  dCrown: { group: 'stickers', colors: () => ['#f59f00'], draw: (c) => <path d="M14 72L20 28L38 50L50 20L62 50L80 28L86 72ZM16 84H84" {...doodle(c[0], 5)} /> },
  dBolt: { group: 'stickers', colors: () => ['#f59f00'], draw: (c) => <path d="M58 8L26 56H50L40 92L76 40H52Z" {...doodle(c[0], 5)} /> },
  dMarks: { group: 'stickers', colors: (t) => [t.accent], draw: (c) => <path d="M18 34L32 47M50 16V37M82 34L68 47" {...doodle(c[0], 6)} /> },
  dUnderline: {
    group: 'stickers',
    vb: '0 0 200 40',
    colors: (t) => [t.accent],
    draw: (c) => <path d="M6 14C60 8 140 8 194 12M14 30C70 24 130 24 186 28" {...doodle(c[0], 5)} />,
  },
  dSparkle: {
    group: 'stickers',
    colors: (t) => [t.text ?? '#111827'],
    draw: (c) => <path d="M46 14C49 40 58 49 84 52C58 55 49 64 46 90C43 64 34 55 8 52C34 49 43 40 46 14ZM82 10V26M74 18H90" {...doodle(c[0], 4)} />,
  },
  dFlower: {
    group: 'stickers',
    colors: () => ['#e64980'],
    draw: (c) => (
      <g {...doodle(c[0], 4)}>
        {Array.from({ length: 5 }, (_, i) => (
          <ellipse key={i} cx="50" cy="26" rx="11" ry="17" transform={`rotate(${i * 72} 50 50)`} pathLength={1} />
        ))}
        <circle cx="50" cy="50" r="8" pathLength={1} />
      </g>
    ),
  },
  dSun: {
    group: 'stickers',
    colors: () => ['#f59f00'],
    draw: (c) => (
      <>
        <circle cx="50" cy="50" r="18" {...doodle(c[0], 5)} />
        <path d="M50 8V20M50 80V92M8 50H20M80 50H92M20 20L28 28M72 72L80 80M80 20L72 28M20 80L28 72" {...doodle(c[0], 5)} />
      </>
    ),
  },
  sFace: {
    group: 'stickers',
    colors: () => ['#ffd43b'],
    draw: (c) => (
      <>
        <circle cx="50" cy="50" r="42" fill={c[0]} {...STICKER} />
        <ellipse cx="37" cy="42" rx="5" ry="7" fill="#3b2a1a" />
        <ellipse cx="63" cy="42" rx="5" ry="7" fill="#3b2a1a" />
        <circle cx="27" cy="58" r="6" fill="#ff8787" opacity=".6" />
        <circle cx="73" cy="58" r="6" fill="#ff8787" opacity=".6" />
        <path d="M34 60C40 72 60 72 66 60" fill="none" stroke="#3b2a1a" strokeWidth="5" strokeLinecap="round" />
      </>
    ),
  },
  sHeart: {
    group: 'stickers',
    colors: () => ['#ff5757'],
    draw: (c) => (
      <>
        <path d={PATHS.heart} transform="translate(8 9) scale(.84)" fill={c[0]} {...STICKER} strokeWidth={7} />
        <path d="M24 30C24 24 29 19 35 19" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" />
      </>
    ),
  },
  sStar: {
    group: 'stickers',
    colors: () => ['#ffd43b'],
    draw: (c) => <path d={PATHS.star5} transform="translate(7 7) scale(.86)" fill={c[0]} {...STICKER} strokeWidth={7} />,
  },
  sFire: {
    group: 'stickers',
    colors: () => ['#ff6b35', '#ffd43b'],
    draw: (c) => (
      <>
        <path d="M50 6C54 25 76 34 76 59C76 78 64 92 50 92C36 92 24 79 24 62C24 50 31 41 38 35C38 46 42 52 48 54C44 38 46 19 50 6Z" fill={c[0]} {...STICKER} />
        <path d="M50 52C54 60 62 64 62 74C62 82 56 88 50 88C44 88 38 82 38 75C38 68 44 64 46 58C47 64 49 66 50 66C49 60 49 56 50 52Z" fill={c[1]} />
      </>
    ),
  },

  /* ───────── animated-only pieces ───────── */
  loader: {
    group: 'loaders',
    vb: '0 0 100 40',
    colors: (t) => [t.accent],
    draw: (c) => (
      <g fill={c[0]}>
        {[20, 50, 80].map((x, i) => (
          <circle key={x} className="el-lp-dot" style={{ animationDelay: `${i * 0.16}s` }} cx={x} cy="20" r="10" />
        ))}
      </g>
    ),
  },
  bars: {
    group: 'loaders',
    vb: '0 0 100 60',
    colors: (t) => [t.accent],
    draw: (c) => (
      <g fill={c[0]}>
        {[10, 30, 50, 70].map((x, i) => (
          <rect key={x} className="el-lp-bar" style={{ animationDelay: `${i * 0.14}s` }} x={x} y="6" width="14" height="48" rx="5" />
        ))}
      </g>
    ),
  },
}

/** Aspect (width / height) of a piece's viewBox. */
export function artRatio(id) {
  const vb = (ART[id]?.vb ?? '0 0 100 100').split(' ').map(Number)
  return vb[2] / vb[3]
}
