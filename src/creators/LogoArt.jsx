// Renders a logo model as SVG. The drawing is laid out in fixed units, then the real
// bounding box (after fonts load) becomes the viewBox, so any name length fits.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ICONS, LOGO_FONTS, TAGLINE_FONT, initialsOf, paletteOf } from './logo.js'

const isLight = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return false
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 170
}

const GUESS = { left: [-30, -30, 460, 160], stack: [-200, -30, 400, 260], emblem: [-150, -150, 300, 300], monogram: [-30, -30, 460, 160], wordmark: [-30, -30, 460, 160] }

function Mark({ m, p, x, y, size = 100, iconColor }) {
  const k = size / 100
  const Icon = ICONS[m.icon] ?? ICONS.Star
  const font = LOGO_FONTS[m.font] ?? LOGO_FONTS.grotesk
  const mono = m.layout === 'monogram'
  const shape = m.shape
  const fill = p.primary
  const inner = mono ? (
    <text
      x={x + 50 * k}
      y={y + 50 * k}
      textAnchor="middle"
      dominantBaseline="central"
      fill={shape === 'none' ? fill : iconColor}
      style={{ fontFamily: font.css, fontWeight: font.weight, fontStyle: font.italic ? 'italic' : 'normal' }}
      fontSize={(shape === 'none' ? 84 : initialsOf(m.name).length > 1 ? 42 : 54) * k}
      letterSpacing={-1 * k}
    >
      {initialsOf(m.name)}
    </text>
  ) : (
    (() => {
      const s = (shape === 'none' ? 100 : shape === 'diamond' ? 44 : shape === 'hexagon' ? 50 : 56) * k
      return <Icon x={x + (100 * k - s) / 2} y={y + (100 * k - s) / 2} size={s} weight={m.iconWeight} color={shape === 'none' ? fill : iconColor} />
    })()
  )
  const pts = (arr) => arr.map(([a, b]) => `${x + a * k},${y + b * k}`).join(' ')
  return (
    <g>
      {shape === 'circle' && <circle cx={x + 50 * k} cy={y + 50 * k} r={50 * k} fill={fill} />}
      {shape === 'squircle' && <rect x={x} y={y} width={100 * k} height={100 * k} rx={28 * k} fill={fill} />}
      {shape === 'hexagon' && <polygon points={pts([[50, 0], [93.3, 25], [93.3, 75], [50, 100], [6.7, 75], [6.7, 25]])} fill={fill} />}
      {shape === 'diamond' && <polygon points={pts([[50, 0], [100, 50], [50, 100], [0, 50]])} fill={fill} />}
      {inner}
    </g>
  )
}

export default function LogoArt({ model: m, background = true, className = '', svgRef, onBox }) {
  const p = paletteOf(m)
  const font = LOGO_FONTS[m.font] ?? LOGO_FONTS.grotesk
  const uid = useId().replace(/:/g, '')
  const group = useRef(null)
  const own = useRef(null)
  const ref = svgRef ?? own
  const [box, setBox] = useState(null)
  const onBoxRef = useRef(onBox)
  onBoxRef.current = onBox
  const name = m.upper || font.upper ? m.name.toLocaleUpperCase('uz') : m.name
  const tagline = m.tagline?.trim() ?? ''
  const iconColor = m.colors?.markText ?? (isLight(p.primary) ? '#0b0b14' : '#ffffff')
  const nameStyle = { fontFamily: font.css, fontWeight: font.weight, fontStyle: font.italic ? 'italic' : 'normal' }
  const tagStyle = { fontFamily: TAGLINE_FONT.css, fontWeight: TAGLINE_FONT.weight }

  // measure after fonts are ready; re-measure whenever a font finishes loading
  useLayoutEffect(() => {
    let dead = false
    const measure = () => {
      if (dead || !group.current) return
      const b = group.current.getBBox()
      if (b.width && b.height) {
        setBox({ x: b.x, y: b.y, width: b.width, height: b.height })
        onBoxRef.current?.(b)
      }
    }
    measure()
    Promise.all([document.fonts.load(`${font.italic ? 'italic ' : ''}${font.weight} 56px ${font.css}`, name), document.fonts.load(`600 15px ${TAGLINE_FONT.css}`, tagline || 'a')])
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(measure)
    document.fonts.addEventListener?.('loadingdone', measure)
    return () => {
      dead = true
      document.fonts.removeEventListener?.('loadingdone', measure)
    }
  }, [m, name, tagline, font])

  const pad = box ? Math.max(box.width, box.height) * 0.16 : 0
  const vb = box ? [box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2] : GUESS[m.layout]

  let content
  switch (m.layout) {
    case 'stack':
      content = (
        <>
          <Mark m={m} p={p} x={-50} y={0} iconColor={iconColor} />
          <text x={0} y={170} textAnchor="middle" fill={p.text} fontSize={52} letterSpacing={m.spacing * 2} style={nameStyle}>
            {name}
          </text>
          {tagline && (
            <text x={0} y={200} textAnchor="middle" fill={p.secondary} fontSize={14} letterSpacing={4} style={tagStyle}>
              {tagline.toLocaleUpperCase('uz')}
            </text>
          )}
        </>
      )
      break
    case 'emblem': {
      const top = `${uid}-top`
      const bottom = `${uid}-bot`
      const markColor = iconColor
      const Icon = ICONS[m.icon] ?? ICONS.Star
      content = (
        <>
          <circle cx={0} cy={0} r={124} fill={p.primary} />
          <circle cx={0} cy={0} r={113} fill="none" stroke={markColor} strokeOpacity={0.45} strokeWidth={1.5} />
          <circle cx={0} cy={0} r={64} fill="none" stroke={markColor} strokeOpacity={0.45} strokeWidth={1.5} />
          <Icon x={-34} y={-34} size={68} weight={m.iconWeight} color={markColor} />
          <path id={top} d="M -88 0 A 88 88 0 0 1 88 0" fill="none" />
          <path id={bottom} d="M -97 0 A 97 97 0 0 0 97 0" fill="none" />
          <text fill={markColor} fontSize={name.length > 16 ? 17 : 22} letterSpacing={2 + m.spacing} style={nameStyle}>
            <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
              {name.toLocaleUpperCase('uz')}
            </textPath>
          </text>
          {tagline && (
            <text fill={markColor} fillOpacity={0.85} fontSize={11} letterSpacing={3} style={tagStyle}>
              <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
                {tagline.toLocaleUpperCase('uz')}
              </textPath>
            </text>
          )}
          <circle cx={-92} cy={6} r={3} fill={markColor} />
          <circle cx={92} cy={6} r={3} fill={markColor} />
        </>
      )
      break
    }
    case 'wordmark':
      content = (
        <>
          <text x={0} y={70} fill={p.text} fontSize={76} letterSpacing={m.spacing * 2 - 1} style={nameStyle}>
            {name}
            <tspan fill={p.primary}>.</tspan>
          </text>
          {tagline && (
            <text x={4} y={106} fill={p.secondary} fontSize={15} letterSpacing={4} style={tagStyle}>
              {tagline.toLocaleUpperCase('uz')}
            </text>
          )}
        </>
      )
      break
    default:
      // left + monogram
      content = (
        <>
          <Mark m={m} p={p} x={0} y={0} iconColor={iconColor} />
          <text x={122} y={tagline ? 58 : 69} fill={p.text} fontSize={56} letterSpacing={m.spacing * 2} style={nameStyle}>
            {name}
          </text>
          {tagline && (
            <text x={125} y={88} fill={p.secondary} fontSize={15} letterSpacing={3.5} style={tagStyle}>
              {tagline.toLocaleUpperCase('uz')}
            </text>
          )}
        </>
      )
  }

  return (
    <svg ref={ref} className={`la ${className}`} viewBox={vb.join(' ')} role="img" aria-label={m.name} style={{ opacity: box ? 1 : 0 }}>
      <rect data-bg x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={p.bg} opacity={background ? 1 : 0} />
      <g ref={group}>{content}</g>
    </svg>
  )
}
