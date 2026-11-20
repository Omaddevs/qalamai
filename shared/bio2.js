// Link-in-Bio, version 2: every part of the page is its own editable element (Canva-like).
// ONE renderer for both sides — the editor preview (browser) and the public page (server) call
// renderBio(), so what you edit is exactly what gets published.
//
// Model (all colours #rrggbb / #rrggbbaa / 'transparent', all sizes in px at a 400 px wide page):
//   content: name, role, headline, brand, bio, avatar, links[], socials{}, stats[], cta, footer
//   style:   page · card · order · font · avatar · brand · headline · name · role · bio · socials ·
//            buttons · stats · cta · footer · deco[]
import { BIO_ICONS } from './bio-icons.js'
import { BIO_THEMES, SOCIALS, normalizeUrl, socialUrl } from './bio.js'

/* ───────────────────────── fonts ───────────────────────── */

export const FONTS2 = {
  inter: { label: 'Inter', css: "'Inter', system-ui, sans-serif", g: 'Inter:wght@400;500;600;700;800' },
  dm: { label: 'DM Sans', css: "'DM Sans', system-ui, sans-serif", g: 'DM+Sans:wght@400;500;700' },
  poppins: { label: 'Poppins', css: "'Poppins', system-ui, sans-serif", g: 'Poppins:wght@400;500;600;700;800' },
  montserrat: { label: 'Montserrat', css: "'Montserrat', system-ui, sans-serif", g: 'Montserrat:wght@400;500;600;700;800' },
  manrope: { label: 'Manrope', css: "'Manrope', system-ui, sans-serif", g: 'Manrope:wght@400;600;800' },
  quicksand: { label: 'Quicksand', css: "'Quicksand', system-ui, sans-serif", g: 'Quicksand:wght@400;500;700' },
  grotesk: { label: 'Space Grotesk', css: "'Space Grotesk', sans-serif", g: 'Space+Grotesk:wght@400;500;700' },
  bricolage: { label: 'Bricolage', css: "'Bricolage Grotesque', sans-serif", g: 'Bricolage+Grotesque:wght@400;600;800' },
  oswald: { label: 'Oswald', css: "'Oswald', sans-serif", g: 'Oswald:wght@400;500;700' },
  league: { label: 'League Gothic', css: "'League Gothic', 'Oswald', sans-serif", g: 'League+Gothic' },
  anton: { label: 'Anton', css: "'Anton', 'Oswald', sans-serif", g: 'Anton' },
  archivo: { label: 'Archivo Black', css: "'Archivo Black', sans-serif", g: 'Archivo+Black' },
  unbounded: { label: 'Unbounded', css: "'Unbounded', sans-serif", g: 'Unbounded:wght@500;700;800' },
  playfair: { label: 'Playfair', css: "'Playfair Display', Georgia, serif", g: 'Playfair+Display:ital,wght@0,500;0,700;1,500' },
  cormorant: { label: 'Cormorant', css: "'Cormorant Garamond', Georgia, serif", g: 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500' },
  fraunces: { label: 'Fraunces', css: "'Fraunces', Georgia, serif", g: 'Fraunces:ital,wght@0,500;0,700;1,500' },
  marcellus: { label: 'Marcellus', css: "'Marcellus', Georgia, serif", g: 'Marcellus' },
  greatvibes: { label: 'Great Vibes', css: "'Great Vibes', cursive", g: 'Great+Vibes' },
  caveat: { label: 'Caveat', css: "'Caveat', cursive", g: 'Caveat:wght@500;700' },
  fredoka: { label: 'Fredoka', css: "'Fredoka', system-ui, sans-serif", g: 'Fredoka:wght@500;600;700' },
  pixel: { label: 'Pixelify', css: "'Pixelify Sans', monospace", g: 'Pixelify+Sans:wght@400;600;700' },
  mono: { label: 'Space Mono', css: "'Space Mono', monospace", g: 'Space+Mono:wght@400;700' },
}
export const FONT_IDS = Object.keys(FONTS2)
const fontCss = (id) => (FONTS2[id] ?? FONTS2.inter).css

/* ───────────────────────── enums the editor offers ───────────────────────── */

export const AVATAR_SHAPES = ['circle', 'oval', 'arch', 'rounded', 'square', 'wavy', 'blob', 'portrait', 'banner', 'window', 'hidden']
export const BUTTON_SHAPES = ['pill', 'rounded', 'square']
export const BUTTON_FILLS = ['solid', 'outline', 'soft', 'glass']
export const BUTTON_SHADOWS = ['none', 'soft', 'hard', 'glow']
export const BUTTON_ARROWS = ['none', 'arrow', 'caret', 'circle']
export const SOCIAL_STYLES = ['plain', 'circle', 'square', 'outline']
export const PATTERNS = ['none', 'dots', 'grid', 'lines', 'paper', 'linen', 'diagonal']
export const BLOCKS = ['brand', 'headline', 'avatar', 'name', 'role', 'bio', 'socials', 'buttons', 'stats', 'cta', 'footer']
export const LINK_ICONS = ['calendar', 'file', 'images', 'pin', 'chat', 'heart', 'gift', 'leaf', 'barbell', 'person', 'rocket', 'book', 'play', 'users', 'chart', 'trophy', 'bag', 'briefcase', 'palette', 'music', 'camera', 'coffee', 'crown', 'lightbulb', 'info', 'user', 'grid', 'globe', 'star', 'sparkle', 'link', 'scissors', 'paint', 'video', 'microphone', 'pen', 'home', 'clock', 'shield', 'money', 'flower', 'smiley', 'whatsapp', 'instagram', 'telegram', 'youtube', 'tiktok', 'linkedin', 'facebook', 'x', 'pinterest', 'spotify', 'email', 'phone']
export const DECO_KINDS = ['star4', 'star5', 'burst', 'flower', 'daisy', 'smiley', 'heart', 'pixelheart', 'cursor', 'squiggle', 'spiral', 'sparkle', 'blob', 'circle', 'ring', 'leaf', 'sunburst', 'asterisk', 'arrowcurve', 'dots']

/* ───────────────────────── defaults ───────────────────────── */

export const STYLE_DEFAULT = {
  page: { bg: '#fbfaf7', bg2: null, angle: 180, image: null, imageOpacity: 1, overlay: '#000000', overlayOpacity: 0, pattern: 'none', patternColor: '#00000014', padTop: 48, frame: 'transparent', frameWidth: 0 },
  card: { on: false, bg: '#ffffff', border: 'transparent', radius: 24, arch: false, shadow: false, margin: 16 },
  order: ['brand', 'headline', 'avatar', 'name', 'role', 'bio', 'socials', 'buttons', 'stats', 'cta', 'footer'],
  font: { heading: 'inter', body: 'inter' },
  brand: { color: '#16181d', size: 22, font: null, align: 'left', upper: true, menu: false },
  headline: { color: '#16181d', size: 40, font: null, upper: true, lineHeight: 0.95, align: 'center', overlap: 0, italic: false, bg: 'transparent', border: 'transparent' },
  avatar: { shape: 'circle', size: 112, border: '#ffffff', borderWidth: 3, backdrop: 'transparent', backdropSize: 1.25, title: '', titleBg: '#f472b6', titleColor: '#111111', shadow: true, align: 'center', phBg: '#d9dde3', phColor: '#ffffff' },
  name: { color: '#16181d', size: 26, font: null, weight: 700, italic: false, upper: false, align: 'center', badge: false, badgeColor: '#22c55e' },
  role: { color: '#14b8a6', size: 15, weight: 600, upper: false, spacing: 0, align: 'center' },
  bio: { color: '#6b717a', size: 15, align: 'center' },
  socials: { style: 'circle', bg: '#0000000d', color: '#16181d', size: 42, align: 'center' },
  buttons: {
    shape: 'rounded', fill: 'solid', bg: '#0b0b0d', bg2: null, color: '#ffffff', border: '#0b0b0d', borderWidth: 2,
    shadow: 'soft', shadowColor: '#000000', height: 56, size: 15.5, weight: 600, upper: false, font: null,
    align: 'center', icon: true, iconBg: '#ffffff26', iconBrand: false, arrow: 'none', numbered: false, columns: 1, gap: 12, width: 100,
  },
  stats: { bg: '#00000008', color: '#16181d', muted: '#6b717a', border: 'transparent' },
  cta: { bg: '#00000008', color: '#16181d', btnBg: '#0b0b0d', btnColor: '#ffffff', input: true },
  footer: { color: '#8b919a' },
  deco: [],
}

export const BIO2_DEFAULT = {
  v: 2,
  name: '',
  role: '',
  headline: '',
  brand: '',
  bio: '',
  avatar: null,
  links: [],
  socials: {},
  stats: [],
  cta: null,
  footer: '',
  style: STYLE_DEFAULT,
}

/* ───────────────────────── helpers ───────────────────────── */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const COLOR_RE = /^(#[0-9a-f]{3,8}|transparent)$/i
/** Only plain colours ever reach CSS — never a user-written CSS expression. */
const col = (v, fallback = 'transparent') => (COLOR_RE.test(String(v ?? '')) ? v : fallback)
const num = (v, min, max, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback)
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/
const img = (v) => (typeof v === 'string' && IMG_RE.test(v) ? v : null)

export function icon(name, size = 20, weight = 'regular') {
  const set = BIO_ICONS[name] ?? BIO_ICONS.link
  const paths = set[weight]?.length ? set[weight] : set.regular
  return `<svg width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`
}

/** Deep-merge the stored style over the defaults, so older/partial data always renders. */
export function fullStyle(style = {}) {
  const out = {}
  for (const [k, def] of Object.entries(STYLE_DEFAULT)) {
    const v = style?.[k]
    out[k] = Array.isArray(def) ? (Array.isArray(v) ? v : def) : def && typeof def === 'object' ? { ...def, ...(v && typeof v === 'object' ? v : {}) } : (v ?? def)
  }
  return out
}

/* ───────────────────────── version 1 → 2 ───────────────────────── */

/** Older pages (one theme + button style) become a full v2 style, keeping their look. */
export function toV2(data) {
  if (data?.v === 2) return { ...BIO2_DEFAULT, ...data, style: fullStyle(data.style) }
  const d = data ?? {}
  const t = BIO_THEMES[d.theme] ?? BIO_THEMES.qalam
  const solidBg = /^#/.test(t.bg) ? t.bg : t.dark ? '#14141c' : '#fbfaf7'
  const grad = String(t.bg).match(/#[0-9a-f]{6}/gi) ?? []
  const fontMap = { inter: 'inter', grotesk: 'grotesk', serif: 'playfair', display: 'unbounded', hand: 'caveat' }
  const font = fontMap[d.font ?? t.font] ?? 'inter'
  const fill = { fill: 'solid', outline: 'outline', soft: 'soft', shadow: 'solid' }[d.buttonStyle] ?? 'solid'
  const btnBg = col(t.btnBg, t.dark ? '#ffffff' : '#0b0b0d') === 'transparent' ? '#ffffff' : col(t.btnBg, '#0b0b0d')
  return {
    ...BIO2_DEFAULT,
    name: d.name ?? '',
    bio: d.bio ?? '',
    avatar: d.avatar ?? null,
    links: (d.links ?? []).map((l) => ({ ...l })),
    socials: { ...(d.socials ?? {}) },
    style: fullStyle({
      page: { bg: grad[0] ?? solidBg, bg2: grad.length > 1 ? grad[grad.length - 1] : null, angle: 160, pattern: d.theme === 'paper' ? 'lines' : d.theme === 'atlas' ? 'linen' : 'none' },
      font: { heading: font, body: font },
      avatar: { border: t.dark ? '#ffffff40' : '#ffffff' },
      name: { color: t.text },
      role: { color: t.accent },
      bio: { color: /^#/.test(t.muted) ? t.muted : t.dark ? '#ffffffb3' : '#6b717a' },
      socials: { color: t.text, bg: t.dark ? '#ffffff1a' : '#0000000d' },
      buttons: {
        fill,
        bg: btnBg,
        color: col(t.btnText, '#ffffff'),
        border: d.buttonStyle === 'shadow' ? t.text : col(t.btnBorder, btnBg),
        shadow: d.buttonStyle === 'shadow' ? 'hard' : 'soft',
        shadowColor: /^#/.test(t.text) ? t.text : '#000000',
        icon: false,
        arrow: 'arrow',
      },
      footer: { color: /^#/.test(t.muted) ? t.muted : '#8b919a' },
    }),
  }
}

/* ───────────────────────── decorations (original SVG) ───────────────────────── */

export function decoSvg(kind, c, c2) {
  const S = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" width="100%" height="100%" aria-hidden="true">${inner}</svg>`
  switch (kind) {
    case 'star4':
      return S(`<path d="M50 0C54 30 70 46 100 50 70 54 54 70 50 100 46 70 30 54 0 50 30 46 46 30 50 0z" fill="${c}"/>`)
    case 'star5':
      return S(`<path d="M50 4l13 28 30 3-23 21 7 30-27-16-27 16 7-30L7 35l30-3z" fill="${c}"/>`)
    case 'burst': {
      const pts = Array.from({ length: 32 }, (_, i) => {
        const r = i % 2 ? 38 : 50
        const a = (i / 32) * Math.PI * 2
        return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`
      }).join(' ')
      return S(`<polygon points="${pts}" fill="${c}"/><circle cx="50" cy="50" r="20" fill="${c2}"/>`)
    }
    case 'flower':
      return S(`${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="50" cy="26" rx="17" ry="25" fill="${c}" transform="rotate(${r} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="15" fill="${c2}"/>`)
    case 'daisy':
      return S(`${Array.from({ length: 12 }, (_, i) => `<ellipse cx="50" cy="22" rx="8" ry="22" fill="${c}" transform="rotate(${i * 30} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="13" fill="${c2}"/>`)
    case 'smiley':
      return S(`<circle cx="50" cy="50" r="48" fill="${c}"/><ellipse cx="36" cy="40" rx="5" ry="9" fill="${c2}"/><ellipse cx="64" cy="40" rx="5" ry="9" fill="${c2}"/><path d="M26 58c8 20 40 20 48 0" fill="none" stroke="${c2}" stroke-width="6" stroke-linecap="round"/>`)
    case 'heart':
      return S(`<path d="M50 88C20 66 4 50 4 32 4 18 15 8 28 8c9 0 17 5 22 13C55 13 63 8 72 8c13 0 24 10 24 24 0 18-16 34-46 56z" fill="${c}"/>`)
    case 'pixelheart':
      return S(`<path d="M10 20h20v10h10v10h20V30h10V20h20v10h10v20H90v10H80v10H70v10H60v10H40V80H30V70H20V60H10V50H0V30h10z" fill="${c}"/>`)
    case 'cursor':
      return S(`<path d="M18 6l64 38-28 8 18 32-12 7-18-32-20 20z" fill="${c}" stroke="${c2}" stroke-width="5" stroke-linejoin="round"/>`)
    case 'squiggle':
      return S(`<path d="M4 50c12-30 24 30 36 0s24 30 36 0 16-20 20-10" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`, '0 0 100 100')
    case 'spiral':
      return S(`<path d="M50 50c0-6 9-6 9 0s-9 15-17 9-6-24 8-25 26 12 22 28-26 26-40 16-14-38 4-46" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`)
    case 'sparkle':
      return S(`<path d="M50 6l8 30 30 8-30 8-8 30-8-30-30-8 30-8z" fill="${c}"/><circle cx="84" cy="16" r="6" fill="${c2}"/>`)
    case 'blob':
      return S(`<path d="M52 6c22 0 42 14 44 38s-16 46-42 50S6 82 6 54 30 6 52 6z" fill="${c}"/>`)
    case 'circle':
      return S(`<circle cx="50" cy="50" r="50" fill="${c}"/>`)
    case 'ring':
      return S(`<circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="6"/>`)
    case 'leaf':
      return S(`<path d="M12 88C12 40 44 10 92 8c0 48-30 80-80 80z" fill="${c}"/><path d="M14 86C40 60 60 40 84 16" stroke="${c2}" stroke-width="3" fill="none"/>`)
    case 'sunburst':
      return S(Array.from({ length: 8 }, (_, i) => `<rect x="44" y="2" width="12" height="32" rx="6" fill="${c}" transform="rotate(${i * 45} 50 50)"/>`).join(''))
    case 'asterisk':
      return S([0, 30, 60, 90, 120, 150].map((r) => `<rect x="45" y="4" width="10" height="92" rx="5" fill="${c}" transform="rotate(${r} 50 50)"/>`).join(''))
    case 'arrowcurve':
      return S(`<path d="M8 80C30 30 60 20 88 30M74 18l14 12-16 8" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`)
    case 'dots':
      return S(Array.from({ length: 16 }, (_, i) => `<circle cx="${12 + (i % 4) * 25}" cy="${12 + Math.floor(i / 4) * 25}" r="6" fill="${c}"/>`).join(''))
    default:
      return ''
  }
}

/** Official-looking tile colours for network icons (option "brand colours" on buttons). Constants, never user input. */
const BRAND_BG = {
  whatsapp: '#25d366', instagram: 'linear-gradient(45deg,#f9a825,#e1306c 50%,#833ab4)', linkedin: '#0a66c2', pinterest: '#e60023', telegram: '#229ed9',
  youtube: '#ff0000', tiktok: '#111111', facebook: '#1877f2', x: '#111111', spotify: '#1db954', email: '#ea4335', phone: '#34a853',
}

/* ───────────────────────── avatar shapes ───────────────────────── */

const wavyClip = (() => {
  const pts = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2
    const r = 46 + 4 * Math.cos(a * 12)
    return `${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`
  })
  return `polygon(${pts.join(',')})`
})()

function avatarCss(a) {
  const size = num(a.size, 48, 360, 112)
  const shape = pick(a.shape, AVATAR_SHAPES, 'circle')
  const base = `object-fit:cover;display:block;border:${num(a.borderWidth, 0, 12, 3)}px solid ${col(a.border)};${a.shadow ? 'box-shadow:0 14px 34px -14px rgba(0,0,0,.45);' : ''}`
  switch (shape) {
    case 'oval':
      return `${base}width:${size}px;height:${Math.round(size * 1.35)}px;border-radius:50%`
    case 'arch':
      return `${base}width:${size}px;height:${Math.round(size * 1.3)}px;border-radius:${size / 2}px ${size / 2}px 14px 14px`
    case 'rounded':
      return `${base}width:${size}px;height:${size}px;border-radius:22%`
    case 'square':
      return `${base}width:${size}px;height:${size}px;border-radius:4px`
    case 'wavy':
      return `${base.replace(/border:[^;]+;/, '')}width:${size}px;height:${size}px;clip-path:${wavyClip}`
    case 'blob':
      return `${base}width:${size}px;height:${size}px;border-radius:42% 58% 63% 37% / 41% 44% 56% 59%`
    case 'portrait':
      return `${base}width:${size}px;height:${Math.round(size * 1.3)}px;border-radius:18px`
    case 'banner':
      return `${base.replace(/border:[^;]+;/, '').replace(/box-shadow:[^;]+;/, '')}width:100%;height:${size}px;border-radius:0;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent)`
    case 'window':
      return `${base.replace(/border:[^;]+;/, '')}width:100%;height:${Math.round(size * 0.9)}px;border-radius:0`
    default:
      return `${base}width:${size}px;height:${size}px;border-radius:50%`
  }
}

/* ───────────────────────── page background ───────────────────────── */

function patternCss(p, c) {
  switch (p) {
    case 'dots':
      return `radial-gradient(${c} 1.4px, transparent 1.5px) 0 0/16px 16px`
    case 'grid':
      return `linear-gradient(${c} 1px, transparent 1px) 0 0/22px 22px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0/22px 22px`
    case 'lines':
      return `repeating-linear-gradient(0deg, transparent 0 31px, ${c} 31px 32px)`
    case 'paper':
      return `repeating-radial-gradient(circle at 30% 20%, ${c} 0 1px, transparent 1px 4px)`
    case 'linen':
      return `repeating-linear-gradient(90deg, ${c} 0 1px, transparent 1px 4px), repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 5px)`
    case 'diagonal':
      return `repeating-linear-gradient(45deg, ${c} 0 2px, transparent 2px 14px)`
    default:
      return null
  }
}

/* ───────────────────────── render ───────────────────────── */

/**
 * @param {object} raw  page data (v1 or v2)
 * @param {{ scope?: string, editor?: boolean, href?: (link) => string|null, homeUrl?: string }} opts
 *   scope  — CSS class every rule is prefixed with (several pages on one screen);
 *   editor — add data-el hooks and keep empty placeholders so they can be clicked.
 * @returns {{ html: string, css: string, fonts: string[] }}
 */
export function renderBio(raw, { scope = 'qb', editor = false, href = (l) => normalizeUrl(l.url), homeUrl = '/' } = {}) {
  const d = toV2(raw)
  const s = d.style
  const P = `.${scope}`
  const el = (id) => (editor ? ` data-el="${id}"` : '')
  const hf = fontCss(s.font.heading)
  const bf = fontCss(s.font.body)
  const usedFonts = new Set([s.font.heading, s.font.body, s.brand.font, s.headline.font, s.name.font, s.buttons.font].filter((f) => FONTS2[f]))

  /* page */
  const pg = s.page
  const bgBase = pg.bg2 ? `linear-gradient(${num(pg.angle, 0, 360, 180)}deg, ${col(pg.bg)}, ${col(pg.bg2)})` : col(pg.bg, '#ffffff')
  const pat = patternCss(pick(pg.pattern, PATTERNS, 'none'), col(pg.patternColor, '#00000014'))
  const bgImg = img(pg.image)

  /* blocks */
  const blocks = {}
  if (d.brand || editor) blocks.brand = d.brand ? `<div class="b-brand"${el('brand')}>${esc(d.brand)}${s.brand.menu ? `<span class="b-menu">${icon('menu', 26, 'regular')}</span>` : ''}</div>` : ''
  if (d.headline) blocks.headline = `<h2 class="b-headline"${el('headline')}>${esc(d.headline).replace(/\n/g, '<br>')}</h2>`

  const av = s.avatar
  if (av.shape !== 'hidden') {
    // no photo yet: a soft silhouette in the template's colours (the user drops a picture in)
    const pic = img(d.avatar) ? `<img class="b-av" src="${d.avatar}" alt="${esc(d.name)}">` : `<div class="b-av ph">${icon('user', 64, 'fill')}</div>`
    const inner =
      av.shape === 'window'
        ? `<div class="b-win"><div class="b-win-bar"><span>${esc(av.title || d.name)}</span><i>${icon('close', 12, 'regular')}</i></div>${pic}</div>`
        : pic
    blocks.avatar = `<div class="b-avwrap"${el('avatar')}>${col(av.backdrop) !== 'transparent' ? '<span class="b-avbd"></span>' : ''}${inner}</div>`
  }
  if (d.name) blocks.name = `<h1 class="b-name"${el('name')}>${esc(d.name)}${s.name.badge ? `<span class="b-badge">${icon('check', 20, 'fill')}</span>` : ''}</h1>`
  if (d.role) blocks.role = `<div class="b-role"${el('role')}>${esc(d.role)}</div>`
  if (d.bio) blocks.bio = `<p class="b-bio"${el('bio')}>${esc(d.bio)}</p>`

  const socials = SOCIALS.map((x) => [x, socialUrl(x.id, d.socials?.[x.id])]).filter(([, u]) => u)
  if (socials.length)
    blocks.socials = `<nav class="b-socials"${el('socials')}>${socials
      .map(([x, u]) => `<a class="b-so" href="${esc(u)}" rel="noopener nofollow" target="_blank" aria-label="${esc(x.label)}">${icon(x.id, Math.round(num(s.socials.size, 24, 64, 42) * 0.48))}</a>`)
      .join('')}</nav>`

  const bt = s.buttons
  const links = (d.links ?? []).filter((l) => l.enabled !== false && (l.title?.trim() || editor))
  if (links.length) {
    blocks.buttons = `<div class="b-links"${el('buttons')}>${links
      .map((l, i) => {
        const url = href(l)
        const tag = url ? `a href="${esc(url)}" rel="noopener nofollow" target="_blank"` : 'div'
        const own = [l.bg && col(l.bg) !== 'transparent' ? `--lb:${col(l.bg)}` : '', l.color && col(l.color) !== 'transparent' ? `--lc:${col(l.color)}` : ''].filter(Boolean).join(';')
        const brand = bt.iconBrand && BRAND_BG[l.icon]
        const ic = bt.icon && l.icon && BIO_ICONS[l.icon === 'globe' ? 'website' : l.icon] ? `<span class="b-lk-ic${brand ? ' brand' : ''}"${brand ? ` style="background:${brand}"` : ''}>${icon(l.icon === 'globe' ? 'website' : l.icon, 20, brand ? 'fill' : 'regular')}</span>` : ''
        const num2 = bt.numbered ? `<span class="b-lk-num">${String(i + 1).padStart(2, '0')}</span>` : ''
        const arrow =
          bt.arrow === 'arrow' ? `<span class="b-lk-ar">${icon('arrow', 16)}</span>` : bt.arrow === 'caret' ? `<span class="b-lk-ar">${icon('caret', 16)}</span>` : bt.arrow === 'circle' ? `<span class="b-lk-ar circ">${icon('arrowRight', 15)}</span>` : ''
        return `<${tag} class="b-lk${l.highlight ? ' hl' : ''}${i % 2 ? ' alt' : ''}"${own ? ` style="${own}"` : ''}${el(`link:${l.id}`)}>${ic}<span class="b-lk-t"><b>${esc(l.title || '—')}</b>${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</span>${num2}${arrow}</${tag.split(' ')[0]}>`
      })
      .join('')}</div>`
  }

  if (d.stats?.length)
    blocks.stats = `<div class="b-stats"${el('stats')}>${d.stats
      .slice(0, 4)
      .map((x) => `<div class="b-stat">${x.icon && BIO_ICONS[x.icon] ? `<span class="b-stat-ic">${icon(x.icon, 18)}</span>` : ''}<b>${esc(x.value)}</b><small>${esc(x.label)}</small></div>`)
      .join('')}</div>`

  if (d.cta?.title) {
    const ctaUrl = normalizeUrl(d.cta.url)
    blocks.cta = `<div class="b-cta"${el('cta')}><b>${esc(d.cta.title)}</b>${d.cta.text ? `<small>${esc(d.cta.text)}</small>` : ''}<div class="b-cta-row">${
      s.cta.input ? `<span class="b-cta-in">${esc(d.cta.placeholder || 'Email')}</span>` : ''
    }${ctaUrl ? `<a class="b-cta-btn" href="${esc(ctaUrl)}" rel="noopener nofollow" target="_blank">${esc(d.cta.button || 'OK')}</a>` : `<span class="b-cta-btn">${esc(d.cta.button || 'OK')}</span>`}</div></div>`
  }

  blocks.footer = `<footer class="b-foot"${el('footer')}>${d.footer ? `${esc(d.footer)}<br>` : ''}<a href="${esc(homeUrl)}">qalam<b>ai</b></a> bilan yaratilgan</footer>`

  // blocks missing from `order` are hidden; the footer (and its credit) always closes the page
  const listed = [...new Set((s.order ?? []).filter((b) => BLOCKS.includes(b) && b !== 'footer'))]
  const order = [...(listed.length ? listed : STYLE_DEFAULT.order.filter((b) => b !== 'footer')), 'footer']
  const body = order.map((b) => blocks[b] ?? '').join('')

  /* decorations: absolute, in % of the page box; layer 'back' sits behind the content */
  const decos = (s.deco ?? []).slice(0, 40)
  const decoHtml = (layer) =>
    decos
      .filter((x) => (x.layer === 'front' ? 'front' : 'back') === layer && DECO_KINDS.includes(x.kind))
      .map(
        (x) =>
          `<span class="b-deco"${el(`deco:${x.id}`)} style="left:${num(x.x, -30, 130, 10)}%;top:${num(x.y, -30, 130, 10)}%;width:${num(x.size, 2, 120, 14)}%;transform:translate(-50%,-50%) rotate(${num(x.rotate, -180, 180, 0)}deg);opacity:${num(x.opacity, 0, 1, 1)}">${decoSvg(x.kind, col(x.color, '#f472b6'), col(x.color2, '#ffffff'))}</span>`,
      )
      .join('')

  const html = `<div class="${scope}"${el('page')}>${bgImg ? `<div class="b-bgimg" style="background-image:url('${bgImg}')"></div>` : ''}${
    num(pg.overlayOpacity, 0, 1, 0) > 0 ? '<div class="b-overlay"></div>' : ''
  }${num(pg.frameWidth, 0, 24, 0) > 0 ? '<div class="b-frame"></div>' : ''}${decoHtml('back')}<main class="b-main${s.card.on ? ' carded' : ''}"><div class="b-card"${s.card.on ? el('card') : ''}>${body}</div></main>${decoHtml('front')}</div>`

  /* ── CSS ── */
  const t = (o, def) => (o ? fontCss(o) : def)
  const btnShape = { pill: '999px', rounded: '16px', square: '4px' }[pick(bt.shape, BUTTON_SHAPES, 'rounded')]
  const btnShadow = {
    none: 'none',
    soft: `0 10px 24px -14px ${col(bt.shadowColor, '#000000')}99`,
    hard: `4px 4px 0 ${col(bt.shadowColor, '#000000')}`,
    glow: `0 0 0 3px ${col(bt.bg)}40, 0 12px 30px -10px ${col(bt.bg)}`,
  }[pick(bt.shadow, BUTTON_SHADOWS, 'soft')]
  const fill = pick(bt.fill, BUTTON_FILLS, 'solid')
  const btnBg = fill === 'outline' ? 'transparent' : fill === 'soft' ? `${col(bt.bg).slice(0, 7)}22` : fill === 'glass' ? '#ffffff1f' : col(bt.bg)
  const btnColor = fill === 'solid' || fill === 'glass' ? col(bt.color, '#ffffff') : col(bt.bg)
  const align = (a) => pick(a, ['left', 'center', 'right'], 'center')
  const flexAlign = (a) => ({ left: 'flex-start', center: 'center', right: 'flex-end' })[align(a)]

  const css = `
${P}{position:relative;isolation:isolate;min-height:100%;overflow:hidden;background:${pat ? `${pat}, ` : ''}${bgBase};color:${col(s.name.color, '#16181d')};font-family:${bf};-webkit-font-smoothing:antialiased;word-break:break-word}
${P} *{box-sizing:border-box}
${P} .b-bgimg{position:absolute;inset:0;z-index:-2;background-size:cover;background-position:center;opacity:${num(pg.imageOpacity, 0, 1, 1)}}
${P} .b-overlay{position:absolute;inset:0;z-index:-1;background:${col(pg.overlay, '#000000')};opacity:${num(pg.overlayOpacity, 0, 1, 0)}}
${P} .b-frame{position:absolute;inset:10px;z-index:0;border:${num(pg.frameWidth, 0, 24, 0)}px solid ${col(pg.frame)};border-radius:6px;pointer-events:none}
${P} .b-deco{position:absolute;z-index:0;display:block;aspect-ratio:1;pointer-events:${editor ? 'auto' : 'none'}}
${P} .b-deco svg{display:block;overflow:visible}
${P} .b-main{position:relative;z-index:1;max-width:480px;margin:0 auto;padding:${num(pg.padTop, 0, 200, 48)}px 20px 36px}
${P} .b-main.carded{padding:${num(pg.padTop, 0, 200, 48)}px ${num(s.card.margin, 0, 60, 16)}px 36px}
${P} .b-card{display:flex;flex-direction:column;align-items:stretch;gap:0}
${P} .carded .b-card{padding:28px 20px 24px;background:${col(s.card.bg)};border:1.5px solid ${col(s.card.border)};border-radius:${s.card.arch ? '999px 999px' : `${num(s.card.radius, 0, 60, 24)}px ${num(s.card.radius, 0, 60, 24)}px`} ${num(s.card.radius, 0, 60, 24)}px ${num(s.card.radius, 0, 60, 24)}px;${s.card.arch ? 'padding-top:56px;' : ''}${s.card.shadow ? 'box-shadow:0 24px 50px -24px rgba(0,0,0,.45);' : ''}}
${P} .b-brand{display:flex;align-items:center;justify-content:${flexAlign(s.brand.align)};gap:8px;margin:0 0 20px;font-family:${t(s.brand.font, hf)};font-size:${num(s.brand.size, 10, 60, 22)}px;color:${col(s.brand.color)};letter-spacing:.02em;text-transform:${s.brand.upper ? 'uppercase' : 'none'};font-weight:600}
${P} .b-menu{margin-left:auto;display:grid}
${P} .b-headline{margin:0 0 8px;font-family:${t(s.headline.font, hf)};font-size:${num(s.headline.size, 16, 140, 40)}px;line-height:${num(s.headline.lineHeight, 0.7, 1.6, 0.95)};color:${col(s.headline.color)};text-align:${align(s.headline.align)};text-transform:${s.headline.upper ? 'uppercase' : 'none'};font-style:${s.headline.italic ? 'italic' : 'normal'};letter-spacing:-.01em;font-weight:inherit;position:relative;z-index:0;${col(s.headline.bg) !== 'transparent' || col(s.headline.border) !== 'transparent' ? `align-self:center;padding:10px 18px;border-radius:12px;background:${col(s.headline.bg)};border:3px solid ${col(s.headline.border)};box-shadow:0 10px 0 -4px ${col(s.headline.border)}55;` : ''}}
${P} .b-avwrap{position:relative;z-index:1;display:flex;justify-content:${flexAlign(av.align)};margin:${num(s.headline.overlap, 0, 200, 0) ? `-${num(s.headline.overlap, 0, 200, 0)}px` : '0'} 0 18px;${['banner', 'window'].includes(av.shape) ? 'width:100%;' : ''}}
${P} .b-avbd{position:absolute;left:50%;top:50%;width:${Math.round(num(av.size, 48, 360, 112) * num(av.backdropSize, 1, 2.2, 1.25))}px;aspect-ratio:1;border-radius:50%;background:${col(av.backdrop)};transform:translate(-50%,-50%);z-index:-1}
${P} .b-av{${avatarCss(av)}}
${P} .b-av.ph{display:grid;place-items:end center;overflow:hidden;background:${col(av.phBg, '#d9dde3')};color:${col(av.phColor, '#ffffff')}}
${P} .b-av.ph svg{width:72%;height:72%;margin-bottom:-6%}
${P} .b-win{width:100%;border:2.5px solid #1f1f1f;background:#e9e6df;box-shadow:6px 6px 0 #1f1f1f}
${P} .b-win-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:${col(av.titleBg, '#f472b6')};color:${col(av.titleColor, '#111111')};border-bottom:2.5px solid #1f1f1f;font-family:${hf};font-size:15px;font-weight:600}
${P} .b-win-bar i{display:grid;place-items:center;width:20px;height:20px;border:2px solid #1f1f1f;background:#e9e6df;font-style:normal}
${P} .b-name{display:flex;align-items:center;justify-content:${flexAlign(s.name.align)};gap:8px;margin:0;font-family:${t(s.name.font, hf)};font-size:${num(s.name.size, 12, 90, 26)}px;line-height:1.1;font-weight:${num(s.name.weight, 300, 900, 700)};font-style:${s.name.italic ? 'italic' : 'normal'};text-transform:${s.name.upper ? 'uppercase' : 'none'};color:${col(s.name.color)};text-align:${align(s.name.align)};letter-spacing:-.01em}
${P} .b-links + .b-name,${P} .b-links + .b-headline,${P} .b-stats + .b-name{margin-top:22px}
${P} .b-badge{display:grid;color:${col(s.name.badgeColor, '#22c55e')}}
${P} .b-role{margin-top:6px;font-size:${num(s.role.size, 9, 40, 15)}px;font-weight:${num(s.role.weight, 300, 900, 600)};color:${col(s.role.color)};text-align:${align(s.role.align)};text-transform:${s.role.upper ? 'uppercase' : 'none'};letter-spacing:${num(s.role.spacing, 0, 0.6, 0)}em}
${P} .b-bio{margin:10px 0 0;font-size:${num(s.bio.size, 10, 30, 15)}px;line-height:1.55;color:${col(s.bio.color)};text-align:${align(s.bio.align)};white-space:pre-line}
${P} .b-socials{display:flex;flex-wrap:wrap;justify-content:${flexAlign(s.socials.align)};gap:10px;margin-top:18px}
${P} .b-so{display:grid;place-items:center;width:${num(s.socials.size, 24, 64, 42)}px;height:${num(s.socials.size, 24, 64, 42)}px;color:${col(s.socials.color)};transition:transform .15s;${
    { plain: '', circle: `border-radius:50%;background:${col(s.socials.bg)};`, square: `border-radius:10px;background:${col(s.socials.bg)};`, outline: `border-radius:50%;border:2px solid ${col(s.socials.color)};` }[pick(s.socials.style, SOCIAL_STYLES, 'circle')]
  }}
${P} a.b-so:hover{transform:translateY(-2px)}
${P} .b-links{display:grid;grid-template-columns:repeat(${num(bt.columns, 1, 2, 1)},minmax(0,1fr));gap:${num(bt.gap, 4, 30, 12)}px;width:${num(bt.width, 50, 100, 100)}%;margin:22px auto 0}
${P} .b-lk{--lb:${btnBg};--lc:${btnColor};position:relative;display:flex;align-items:center;gap:12px;min-height:${num(bt.height, 36, 110, 56)}px;padding:10px 16px;border-radius:${btnShape};background:var(--lb);color:var(--lc);border:${num(bt.borderWidth, 0, 6, 2)}px solid ${fill === 'solid' ? col(bt.border) : col(bt.bg)};box-shadow:${btnShadow};text-decoration:none;font-family:${t(bt.font, bf)};text-align:${align(bt.align)};transition:transform .15s,box-shadow .15s;${fill === 'glass' ? 'backdrop-filter:blur(10px);' : ''}}
${P} .b-lk.alt{${bt.bg2 && col(bt.bg2) !== 'transparent' ? `--lb:${col(bt.bg2)};` : ''}}
${P} a.b-lk:hover{transform:translateY(-2px)}
${P} .b-lk-t{flex:1;display:flex;flex-direction:column;align-items:${flexAlign(bt.align)};min-width:0}
${P} .b-lk-t b{font-size:${num(bt.size, 11, 26, 15.5)}px;font-weight:${num(bt.weight, 300, 900, 600)};text-transform:${bt.upper ? 'uppercase' : 'none'};letter-spacing:${bt.upper ? '.04em' : '0'}}
${P} .b-lk-t small{margin-top:2px;font-size:${Math.round(num(bt.size, 11, 26, 15.5) * 0.78)}px;opacity:.8}
${P} .b-lk-ic{display:grid;place-items:center;flex-shrink:0;width:38px;height:38px;border-radius:${bt.shape === 'pill' ? '50%' : '10px'};background:${col(bt.iconBg, '#ffffff26')}}
${P} .b-lk-ic.brand{color:#fff}
${num(bt.columns, 1, 2, 1) === 2 ? `${P} .b-lk{flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:10px;padding:14px 14px 40px}${P} .b-lk-t{align-items:flex-start;text-align:left}${P} .b-lk-ar,${P} .b-lk-num{position:absolute;right:12px;bottom:10px}` : ''}
${P} .b-lk-num{font-family:${hf};font-size:${Math.round(num(bt.size, 11, 26, 15.5) * 1.5)}px;font-weight:500;opacity:.9}
${P} .b-lk-ar{display:grid;place-items:center;opacity:.7}
${P} .b-lk-ar.circ{width:30px;height:30px;border-radius:50%;background:var(--lc);color:var(--lb);opacity:1}
${P} .b-lk.hl{box-shadow:${btnShadow === 'none' ? '' : `${btnShadow},`}0 0 0 3px ${col(s.role.color, '#14b8a6')}}
${P} .b-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:4px;margin-top:22px;padding:14px 8px;border-radius:18px;background:${col(s.stats.bg)};border:1px solid ${col(s.stats.border)}}
${P} .b-stat{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}
${P} .b-stat-ic{display:grid;color:${col(s.stats.color)}}
${P} .b-stat b{font-family:${hf};font-size:22px;color:${col(s.stats.color)}}
${P} .b-stat small{font-size:12px;color:${col(s.stats.muted)}}
${P} .b-cta{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:22px;padding:18px;border-radius:18px;background:${col(s.cta.bg)};color:${col(s.cta.color)};text-align:center}
${P} .b-cta b{font-family:${hf};font-size:18px}
${P} .b-cta small{font-size:13px;opacity:.8}
${P} .b-cta-row{display:flex;gap:8px;width:100%;margin-top:10px}
${P} .b-cta-in{flex:1;display:flex;align-items:center;min-height:44px;padding:0 14px;border-radius:12px;background:#ffffff14;border:1px solid ${col(s.cta.color)}33;font-size:13.5px;opacity:.75;text-align:left}
${P} .b-cta-btn{display:grid;place-items:center;flex-shrink:0;min-height:44px;padding:0 18px;border-radius:12px;background:${col(s.cta.btnBg)};color:${col(s.cta.btnColor)};font-weight:600;font-size:14px;text-decoration:none;${s.cta.input ? '' : 'flex:1;'}}
${P} .b-foot{margin-top:34px;font-size:12px;line-height:1.6;text-align:center;color:${col(s.footer.color)}}
${P} .b-foot a{color:inherit;text-decoration:none}
${editor ? `${P} [data-el]{cursor:pointer}${P} [data-el].sel{outline:2px solid #14b8a6;outline-offset:3px}${P} [data-el]:not(.sel):hover{outline:1.5px dashed #14b8a6aa;outline-offset:3px}${P}[data-el].sel{outline-offset:-3px}` : ''}
`
  return { html, css, fonts: [...usedFonts].map((f) => FONTS2[f].g) }
}

/** Google Fonts stylesheet URL for the fonts a page uses. */
export const fontsHref = (fonts) => (fonts.length ? `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${f}`).join('&')}&display=swap` : null)
