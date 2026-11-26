// QalamAI slide templates — original designs. Each template = theme tokens + a background
// (decors.jsx) + a sequence of page layouts (layouts.jsx). Sizes inside slides use cqw so one
// design scales from a 150 px thumbnail to the full canvas.
import { getLang, t } from '../i18n/index.js'
import { samplePage } from './layouts.jsx'
import { STUDIO } from './studio.js'

const F = {
  sans: "'Inter', system-ui, sans-serif",
  garamond: "'Cormorant Garamond', Georgia, serif",
  fell: "'IM Fell English', 'Cormorant Garamond', Georgia, serif",
  fredoka: "'Fredoka', 'Space Grotesk', system-ui, sans-serif",
  oswald: "'Oswald', 'Bebas Neue', 'Inter', sans-serif",
  poppins: "'Poppins', 'Inter', system-ui, sans-serif",
  anton: "'Anton', 'Oswald', 'Inter', sans-serif",
  league: "'League Gothic', 'Oswald', 'Inter', sans-serif",
  antonio: "'Antonio', 'Oswald', 'Inter', sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  dm: "'DM Sans', 'Inter', system-ui, sans-serif",
  hand: "'Patrick Hand', 'Fredoka', system-ui, sans-serif",
  gochi: "'Gochi Hand', 'Patrick Hand', cursive",
  chewy: "'Chewy', 'Fredoka', system-ui, sans-serif",
  caveat: "'Caveat', 'Patrick Hand', cursive",
  baloo: "'Baloo 2', 'Fredoka', system-ui, sans-serif",
  archivo: "'Archivo Black', 'Anton', 'Inter', sans-serif",
  bricolage: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif",
  manrope: "'Manrope', 'Inter', system-ui, sans-serif",
  inclusive: "'Inclusive Sans', 'Inter', system-ui, sans-serif",
  fraunces: "'Fraunces', 'Playfair Display', Georgia, serif",
  heebo: "'Heebo', 'Inter', system-ui, sans-serif",
}

export const CATEGORIES = ['all', 'biznes', 'talim', 'ilmiy', 'texno', 'ijod', 'marketing', 'moliya', 'soha'].map((id) => ({
  id,
  get label() {
    return t(`tpl.cat.${id}`)
  },
}))

/*
 * Structured templates (layouts: true): every page is drawn by src/editor/layouts.jsx from these
 * tokens, the background by src/editor/decors.jsx. `pages` = the deck you get with "use all pages"
 * ('type' or 'type:variant'). `box`/`content` remain for the classic renderer's fallbacks.
 */
const classic = { box: { l: 10, t: 30, w: 80 }, content: { l: 10, t: 14, w: 80 } }

/*
 * Premium collection: ten designer-grade decks, each with its own font pairing from the catalog
 * (src/editor/fonts.js — they draw Ö Ğ Ş Ç and Cyrillic), palette, background (premiumDecors.jsx)
 * and typographic details (premium.css). Shown first; `premium` marks them in pickers.
 */
const P = {
  geologica: "'Geologica', system-ui, sans-serif",
  onest: "'Onest', system-ui, sans-serif",
  cormorantG: "'Cormorant Garamond', Georgia, serif",
  cormorant: "'Cormorant', Georgia, serif",
  jost: "'Jost', system-ui, sans-serif",
  unbounded: "'Unbounded', system-ui, sans-serif",
  manrope: "'Manrope', system-ui, sans-serif",
  yeseva: "'Yeseva One', Georgia, serif",
  commissioner: "'Commissioner', system-ui, sans-serif",
  exo: "'Exo 2', system-ui, sans-serif",
  plex: "'IBM Plex Sans', system-ui, sans-serif",
  wix: "'Wix Madefor Display', system-ui, sans-serif",
  golos: "'Golos Text', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  raleway: "'Raleway', system-ui, sans-serif",
  nunitoSans: "'Nunito Sans', system-ui, sans-serif",
  dela: "'Dela Gothic One', system-ui, sans-serif",
  rubik: "'Rubik', system-ui, sans-serif",
  montserrat: "'Montserrat', system-ui, sans-serif",
  sourceSans: "'Source Sans 3', system-ui, sans-serif",
}

// fonts the backgrounds use besides the title and body fonts
const EXTRA_FONTS = { blueprint: ["'IBM Plex Mono', monospace"], neon: ["'JetBrains Mono', monospace"] }

// the ten decks' place in the collection: family and the layouts the AI favours for each
const PREMIUM_FAMILY = {
  monolith: { group: 'business', motion: 'minimal', prefer: ['statement', 'kpi', 'table', 'timeline', 'summary'] },
  noir: { group: 'creative', motion: 'cinematic', prefer: ['photo', 'quote', 'statement', 'gallery', 'media'] },
  borealis: { group: 'tech', motion: 'professional', prefer: ['features', 'chart', 'kpi', 'roadmap', 'process'] },
  terra: { group: 'education', motion: 'professional', prefer: ['timeline', 'media', 'quote', 'chapter', 'cards'] },
  blueprint: { group: 'education', motion: 'professional', prefer: ['process', 'chart', 'table', 'pyramid', 'compare'] },
  pastel: { group: 'education', motion: 'dynamic', prefer: ['cards', 'process', 'media', 'quiz', 'timeline'] },
  editorial: { group: 'creative', motion: 'cinematic', prefer: ['photo', 'statement', 'media', 'quote', 'gallery'] },
  forest: { group: 'industry', motion: 'professional', prefer: ['media', 'kpi', 'timeline', 'statement', 'process'] },
  neon: { group: 'tech', motion: 'dynamic', prefer: ['kpi', 'chart', 'features', 'roadmap', 'statement'] },
  executive: { group: 'business', motion: 'professional', prefer: ['kpi', 'summary', 'chart', 'matrix', 'table'] },
}

const PREMIUM = [
  {
    id: 'monolith',
    cat: 'biznes',
    pages: ['title', 'agenda', 'section', 'cards', 'stats', 'media', 'process', 'quote', 'compare', 'end'],
    theme: {
      layouts: true, skin: 'monolith', decor: 'monolith', frame: 'round', cover: 'left',
      bg: '#f3f0e8', text: '#111111', muted: '#56524b', accent: '#e63a1f', accent2: '#111111', onAccent: '#ffffff',
      titleFont: P.geologica, bodyFont: P.onest, titleWeight: 800, titleScale: 1.1,
      card: '#ffffff', cardText: '#111111', cardBorder: 'rgba(17,17,17,.12)', radius: 0,
      placeholder: 'linear-gradient(135deg, #e3ded3, #cbc4b5)',
      area: { l: 6, t: 15, w: 88, h: 75 }, ...classic,
    },
  },
  {
    id: 'noir',
    cat: 'ijod',
    pages: ['title', 'agenda', 'media', 'quote', 'cards', 'stats', 'team', 'process', 'end'],
    theme: {
      layouts: true, skin: 'noir', decor: 'noir', frame: 'gold', cover: 'center', center: true,
      bg: 'radial-gradient(ellipse at 50% 0%, #1d1a17 0%, #0d0c0b 60%, #070707 100%)',
      text: '#f2ead8', muted: 'rgba(242,234,216,.66)', accent: '#d4b26a', accent2: '#8c7340', onAccent: '#0b0b0c',
      titleFont: P.cormorantG, bodyFont: P.jost, titleWeight: 500, titleScale: 1.35, bodyScale: 1.02,
      card: 'rgba(255,255,255,.035)', cardText: '#f2ead8', cardBorder: 'rgba(212,178,106,.35)', radius: 0.2,
      placeholder: 'linear-gradient(135deg, #2a241b, #14110d)',
      area: { l: 10, t: 13, w: 80, h: 74 }, ...classic,
    },
  },
  {
    id: 'borealis',
    cat: 'biznes',
    pages: ['title', 'agenda', 'cards', 'stats', 'media', 'process', 'chart', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'aurora', decor: 'aurora', frame: 'glow', cover: 'center', center: true,
      bg: '#060916', text: '#f4f6ff', muted: 'rgba(226,232,255,.66)', accent: '#5eead4', accent2: '#a78bfa', onAccent: '#060916',
      titleFont: P.unbounded, bodyFont: P.manrope, titleWeight: 600, titleScale: 0.92, titleWidth: 1.3,
      card: 'rgba(255,255,255,.06)', cardText: '#f4f6ff', cardBorder: 'rgba(255,255,255,.12)', radius: 1.6,
      placeholder: 'linear-gradient(135deg, rgba(94,234,212,.25), rgba(167,139,250,.2))',
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'terra',
    cat: 'ijod',
    pages: ['title', 'agenda', 'media', 'cards', 'process', 'stats', 'quote', 'team', 'end'],
    theme: {
      layouts: true, skin: 'terra', decor: 'terra', frame: 'arch', cover: 'left',
      bg: '#efe5d6', text: '#2b1d14', muted: '#6b5444', accent: '#c2593a', accent2: '#d99a3d', onAccent: '#fff8ef',
      titleFont: P.yeseva, bodyFont: P.commissioner, titleWeight: 400, titleScale: 1.08,
      card: '#f8f1e6', cardText: '#2b1d14', cardBorder: 'rgba(194,89,58,.22)', radius: 1.4,
      placeholder: 'linear-gradient(160deg, #e7c3a8, #c98b6b)',
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'blueprint',
    cat: 'talim',
    pages: ['title', 'agenda', 'process', 'cards', 'chart', 'stats', 'compare', 'media', 'end'],
    theme: {
      layouts: true, skin: 'blueprint', decor: 'blueprint', frame: 'round', cover: 'left', upper: true,
      bg: '#0d3b8c', text: '#ffffff', muted: 'rgba(220,232,255,.8)', accent: '#ffd23f', accent2: '#7cc4ff', onAccent: '#0d3b8c',
      titleFont: P.exo, bodyFont: P.plex, titleWeight: 800, titleScale: 1.02,
      card: 'rgba(255,255,255,.04)', cardText: '#ffffff', cardBorder: 'rgba(255,255,255,.55)', radius: 0.15,
      placeholder: 'repeating-linear-gradient(45deg, rgba(255,255,255,.1) 0 0.6cqw, transparent 0.6cqw 1.4cqw)',
      area: { l: 7, t: 14, w: 86, h: 72 }, ...classic,
    },
  },
  {
    id: 'pastel',
    cat: 'talim',
    pages: ['title', 'agenda', 'cards', 'media', 'stats', 'team', 'process', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'pastel', decor: 'pastel', frame: 'round', cover: 'center', center: true,
      bg: '#f6f2ff', text: '#231942', muted: '#5e5480', accent: '#7c5cff', accent2: '#ff8a65', onAccent: '#ffffff',
      titleFont: P.wix, bodyFont: P.golos, titleWeight: 800, titleScale: 1.08,
      card: 'rgba(255,255,255,.8)', cardText: '#231942', cardBorder: 'rgba(124,92,255,.12)', radius: 2.2,
      placeholder: 'linear-gradient(135deg, #ffe1d2, #e6dcff)',
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'editorial',
    cat: 'ijod',
    pages: ['title', 'media', 'quote', 'cards', 'media:1', 'stats', 'compare', 'team', 'end'],
    theme: {
      layouts: true, skin: 'editorial', decor: 'editorial', frame: 'tall', cover: 'split',
      bg: '#ffffff', text: '#111111', muted: '#5a5a5a', accent: '#e4002b', accent2: '#111111', onAccent: '#ffffff',
      titleFont: P.playfair, bodyFont: P.raleway, titleWeight: 800, titleScale: 1.15,
      card: '#f6f4f0', cardText: '#111111', cardBorder: 'transparent', radius: 0,
      placeholder: 'linear-gradient(135deg, #ebe8e2, #cfcac2)',
      area: { l: 5, t: 15, w: 90, h: 76 }, ...classic,
    },
  },
  {
    id: 'forest',
    cat: 'talim',
    pages: ['title', 'agenda', 'media', 'cards', 'quote', 'process', 'stats', 'team', 'end'],
    theme: {
      layouts: true, skin: 'forest', decor: 'forest', frame: 'arch', cover: 'center', center: true,
      bg: 'radial-gradient(ellipse at 50% 30%, #17382a 0%, #0e2419 55%, #08170f 100%)',
      text: '#f1ecdf', muted: 'rgba(241,236,223,.7)', accent: '#e8c87a', accent2: '#a8c3a0', onAccent: '#0e2419',
      titleFont: P.cormorant, bodyFont: P.nunitoSans, titleWeight: 600, titleScale: 1.32,
      card: 'rgba(255,255,255,.05)', cardText: '#f1ecdf', cardBorder: 'rgba(168,195,160,.3)', radius: 1,
      placeholder: 'linear-gradient(160deg, #2c5a43, #13301f)',
      area: { l: 10, t: 13, w: 80, h: 74 }, ...classic,
    },
  },
  {
    id: 'neon',
    cat: 'biznes',
    pages: ['title', 'agenda', 'stats', 'cards', 'chart', 'process', 'media', 'compare', 'end'],
    theme: {
      layouts: true, skin: 'neon', decor: 'neon', frame: 'glow', cover: 'center', center: true, upper: true,
      bg: '#05060b', text: '#f5f7ff', muted: 'rgba(220,226,255,.62)', accent: '#c6f432', accent2: '#22d3ee', onAccent: '#05060b',
      titleFont: P.dela, bodyFont: P.rubik, titleWeight: 400, titleScale: 0.88, titleWidth: 1.3,
      card: 'rgba(198,244,50,.05)', cardText: '#f5f7ff', cardBorder: 'rgba(198,244,50,.35)', radius: 0.8,
      placeholder: 'linear-gradient(135deg, rgba(34,211,238,.2), rgba(198,244,50,.15))',
      area: { l: 6, t: 14, w: 88, h: 74 }, ...classic,
    },
  },
  {
    id: 'executive',
    cat: 'biznes',
    pages: ['title', 'agenda', 'stats', 'cards', 'media', 'chart', 'process', 'team', 'compare', 'end'],
    theme: {
      layouts: true, skin: 'executive', decor: 'executive', frame: 'round', cover: 'split',
      bg: '#ffffff', text: '#0a2540', muted: '#4a5d75', accent: '#00a38c', accent2: '#0a2540', onAccent: '#ffffff',
      titleFont: P.montserrat, bodyFont: P.sourceSans, titleWeight: 800, titleScale: 1.02,
      card: '#f4f7fb', cardText: '#0a2540', cardBorder: 'rgba(10,37,64,.08)', radius: 0.6,
      placeholder: 'linear-gradient(135deg, #dbe5f0, #b8c9dc)',
      // every second page is the navy one
      alt: {
        bg: '#0a2540', text: '#ffffff', muted: 'rgba(255,255,255,.72)', accent2: '#8fb4d9',
        card: 'rgba(255,255,255,.06)', cardText: '#ffffff', cardBorder: 'rgba(255,255,255,.12)',
        placeholder: 'linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04))',
      },
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
].map((tpl) => ({
  ...tpl,
  types: ['Prezentatsiya'],
  premium: true,
  ...PREMIUM_FAMILY[tpl.id],
  // catalog fonts the page needs (Slide.jsx loads them when the page is shown)
  theme: { ...tpl.theme, fonts: [tpl.theme.titleFont, tpl.theme.bodyFont, ...(EXTRA_FONTS[tpl.id] ?? [])] },
}))

/** The premium collection's ids, in their order (the ten decks, then the design systems). */
export const PREMIUM_IDS = [...PREMIUM, ...STUDIO].map((tpl) => tpl.id)

export const TEMPLATES = [
  ...PREMIUM,
  ...STUDIO,
  {
    id: 'gallery',
    types: ['Prezentatsiya'],
    cat: 'ijod',
    pro: true,
    pages: ['title', 'agenda', 'media', 'cards', 'media:1', 'stats', 'quote', 'team', 'compare', 'end'],
    theme: {
      layouts: true, skin: 'gallery', decor: 'gallery', frame: 'gold', cover: 'center', center: true,
      bg: 'radial-gradient(ellipse at 50% 0%, #2b2118 0%, #15100b 55%, #0b0806 100%)',
      text: '#f3e6c8', muted: 'rgba(243,230,200,.72)', accent: '#c9a24a', accent2: '#8f6b2a',
      titleFont: F.garamond, bodyFont: F.garamond, titleWeight: 600, titleScale: 1.35, bodyScale: 1.15,
      card: 'rgba(20,14,9,.55)', cardText: '#f3e6c8', cardBorder: 'rgba(201,162,74,.45)', radius: 0.4,
      placeholder: 'radial-gradient(circle at 30% 30%, #6b4b2a, #2a1c10)',
      area: { l: 11, t: 12, w: 78, h: 76 }, ...classic,
    },
  },
  {
    id: 'chronicle',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'media', 'team', 'process', 'media:1', 'compare', 'chart', 'content', 'end'],
    theme: {
      layouts: true, skin: 'book', decor: 'book', frame: 'arch', cover: 'center', center: true, page: '#efe2c3',
      bg: 'radial-gradient(ellipse at 20% 0%, #4a2e17 0%, #2a180b 60%, #1a0e06 100%)',
      text: '#3b2614', muted: '#6b4e32', accent: '#8a3b1d', accent2: '#b5793a',
      titleFont: F.fell, bodyFont: F.garamond, titleWeight: 400, titleScale: 1.15, bodyScale: 1.15,
      card: 'rgba(255,248,230,.55)', cardText: '#3b2614', cardBorder: 'rgba(138,59,29,.35)', radius: 0.4,
      placeholder: 'linear-gradient(135deg, #c9b083, #8c6a3e)',
      area: { l: 11, t: 13, w: 78, h: 72 }, ...classic,
    },
  },
  {
    id: 'quiz',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'content:1', 'quiz:0', 'quiz:1', 'quiz:2', 'quiz:3', 'quiz:4', 'quiz:5', 'end'],
    theme: {
      layouts: true, skin: 'quiz', decor: 'quiz', frame: 'polaroid', cover: 'center', center: true, upper: true,
      cycle: ['#f9c6d3', '#fde68a', '#c4b5fd', '#bbf7d0', '#bae6fd'],
      bg: '#f9c6d3', text: '#1f2937', muted: '#4b5563', accent: '#ec4899', accent2: '#14b8a6',
      titleFont: F.fredoka, bodyFont: F.fredoka, titleWeight: 700, titleScale: 1.3,
      card: '#ffffff', cardText: '#1f2937', cardBorder: '#1f2937', radius: 1.2,
      placeholder: 'linear-gradient(135deg, #fde68a, #f9c6d3)',
      area: { l: 12, t: 16, w: 76, h: 70 }, ...classic,
    },
  },
  {
    id: 'lawfirm',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pro: true,
    pages: ['title', 'media', 'compare', 'cards:1', 'team', 'media:1', 'stats', 'process', 'end'],
    theme: {
      layouts: true, skin: 'law', decor: 'law', frame: 'round', cover: 'split', upper: true,
      bg: 'linear-gradient(135deg, #6b1222 0%, #4a0b17 55%, #2e060e 100%)',
      text: '#fff6f0', muted: 'rgba(255,240,235,.75)', accent: '#f1c9a5', accent2: '#d98c7a',
      titleFont: F.anton, bodyFont: F.sans, titleWeight: 400, titleScale: 1.3, onAccent: '#4a0b17',
      card: 'rgba(255,255,255,.08)', cardText: '#fff6f0', cardBorder: 'rgba(255,255,255,.18)', radius: 1,
      placeholder: 'linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.04))',
      area: { l: 6, t: 15, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'lawteal',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pro: true,
    pages: ['title', 'media', 'compare', 'cards:1', 'team', 'media:1', 'stats', 'process', 'end'],
    theme: {
      layouts: true, skin: 'law', decor: 'law', frame: 'tall', cover: 'split', upper: true,
      bg: 'linear-gradient(160deg, #1d5b66 0%, #12404a 50%, #0a2a31 100%)',
      text: '#eef8f8', muted: 'rgba(225,242,242,.74)', accent: '#7fd1d3', accent2: '#3c8f97', onAccent: '#0a2a31',
      titleFont: F.league, bodyFont: F.dm, titleWeight: 400, titleScale: 1.45,
      card: 'rgba(255,255,255,.07)', cardText: '#eef8f8', cardBorder: 'rgba(127,209,211,.3)', radius: 1,
      placeholder: 'linear-gradient(160deg, rgba(127,209,211,.25), rgba(255,255,255,.04))',
      area: { l: 6, t: 15, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'lawserif',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pro: true,
    pages: ['title', 'media', 'cards:1', 'process', 'media:1', 'cards', 'stats', 'team', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'lawserif', decor: 'velvet', frame: 'pill', cover: 'left',
      bg: 'linear-gradient(135deg, #7a1420 0%, #5e0d17 55%, #3f070e 100%)',
      text: '#fbefe6', muted: 'rgba(251,239,230,.72)', accent: '#e9b8a0', accent2: '#c77f6b', onAccent: '#3f070e',
      titleFont: F.playfair, bodyFont: F.sans, titleWeight: 600, titleScale: 1.15,
      card: 'rgba(0,0,0,.22)', cardText: '#fbefe6', cardBorder: 'rgba(233,184,160,.18)', radius: 0.6,
      placeholder: 'linear-gradient(135deg, rgba(233,184,160,.28), rgba(0,0,0,.2))',
      area: { l: 6, t: 12, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'lawagency',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'media', 'cards', 'media:1', 'compare', 'process', 'quote', 'stats', 'team', 'end'],
    theme: {
      layouts: true, skin: 'agency', decor: 'agency', frame: 'round', cover: 'split',
      bg: '#fbf8f5', text: '#1b1414', muted: '#5c5050', accent: '#cf2b2b', accent2: '#e35b4f', onAccent: '#ffffff',
      titleFont: F.playfair, bodyFont: F.sans, titleWeight: 500, titleScale: 1,
      card: '#ffffff', cardText: '#1b1414', cardBorder: 'rgba(207,43,43,.25)', radius: 0.3,
      placeholder: 'linear-gradient(135deg, #d9d4d0, #b9b2ad)',
      // every second page is the red one
      alt: {
        bg: '#cf2b2b', text: '#fff6f2', muted: 'rgba(255,246,242,.82)', accent: '#ffffff', onAccent: '#cf2b2b',
        card: 'rgba(255,255,255,.12)', cardText: '#fff6f2', cardBorder: 'rgba(255,255,255,.35)',
        placeholder: 'linear-gradient(135deg, rgba(255,255,255,.3), rgba(0,0,0,.15))',
      },
      area: { l: 6, t: 15, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'rights',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'media', 'media:1', 'cards', 'content', 'stats', 'process', 'quote', 'chart', 'end'],
    theme: {
      layouts: true, skin: 'rights', decor: 'rights', frame: 'round', cover: 'split', upper: true,
      bg: '#fbf6ea', text: '#1d2a6b', muted: '#4b5280', accent: '#f8d65a', accent2: '#f26a2e', onAccent: '#1d2a6b',
      titleFont: F.antonio, bodyFont: F.dm, titleWeight: 700, titleScale: 1,
      card: '#fffdf6', cardText: '#1d2a6b', cardBorder: 'transparent', radius: 1.6,
      placeholder: 'linear-gradient(135deg, #f8e6a0, #f3c9a8)',
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'legalfolio',
    types: ['Prezentatsiya'],
    cat: 'ijod',
    pro: true,
    pages: ['title', 'media', 'cards', 'media:1', 'content', 'stats', 'process', 'team', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'folio', decor: 'skyline', frame: 'round', cover: 'left', upper: true,
      bg: 'linear-gradient(160deg, #1f6a5a 0%, #173e4f 55%, #101f33 100%)',
      text: '#f6f2e7', muted: 'rgba(246,242,231,.75)', accent: '#f2c48d', accent2: '#7cc4a8', onAccent: '#101f33',
      titleFont: F.anton, bodyFont: F.dm, titleWeight: 400, titleScale: 1,
      card: '#f6efdf', cardText: '#14283a', cardBorder: 'transparent', radius: 1.4,
      placeholder: 'linear-gradient(160deg, rgba(242,196,141,.35), rgba(16,31,51,.4))',
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'kids',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'agenda', 'media', 'cards', 'media:1', 'compare', 'process', 'stats', 'content', 'end'],
    theme: {
      layouts: true, skin: 'kids', decor: 'kids', frame: 'round', cover: 'center', center: true, upper: true,
      bg: '#ffffff', text: '#1f2a44', muted: '#4b5568', accent: '#3b82f6', accent2: '#ec4899',
      alt: { accent: '#10b981', accent2: '#f59e0b' },
      titleFont: F.gochi, bodyFont: F.hand, titleWeight: 400, titleScale: 1.25, bodyScale: 1.15,
      card: '#fff7fb', cardText: '#1f2a44', cardBorder: 'transparent', radius: 1.6,
      placeholder: 'linear-gradient(135deg, #dbeafe, #fce7f3)',
      area: { l: 9, t: 15, w: 82, h: 72 }, ...classic,
    },
  },
  {
    id: 'crayon',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'media', 'cards', 'process', 'stats', 'media:1', 'compare', 'content', 'end'],
    theme: {
      layouts: true, skin: 'crayon', decor: 'crayon', frame: 'polaroid', cover: 'center', center: true, upper: true,
      bg: '#fdfbf6', text: '#3b2a1a', muted: '#6b5440', accent: '#f97316', accent2: '#ec4899',
      titleFont: F.chewy, bodyFont: F.hand, titleWeight: 400, titleScale: 1.3, bodyScale: 1.15,
      card: '#ffffff', cardText: '#3b2a1a', cardBorder: 'transparent', radius: 1.6,
      placeholder: 'linear-gradient(135deg, #fde68a, #fbcfe8)',
      area: { l: 13, t: 17, w: 74, h: 68 }, ...classic,
    },
  },
  {
    id: 'sketchedu',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'media', 'media:1', 'cards', 'process', 'quote', 'stats', 'compare', 'content', 'end'],
    theme: {
      layouts: true, skin: 'sketch', decor: 'sketch', frame: 'round', cover: 'center', center: true,
      bg: '#fafaf8', text: '#1f2937', muted: '#4b5563', accent: '#fcd34d', accent2: '#f59e0b',
      titleFont: F.caveat, bodyFont: F.hand, titleWeight: 700, titleScale: 1.35, bodyScale: 1.15,
      card: '#ffffff', cardText: '#1f2937', cardBorder: 'transparent', radius: 1,
      placeholder: 'repeating-linear-gradient(45deg, #e5e7eb 0 0.6cqw, #f3f4f6 0.6cqw 1.2cqw)',
      area: { l: 10, t: 14, w: 76, h: 74 }, ...classic,
    },
  },
  {
    id: 'chalkboard',
    types: ['Prezentatsiya'],
    cat: 'ijod',
    pages: ['title', 'media', 'cards', 'cards:1', 'media:1', 'process', 'team', 'stats', 'end'],
    theme: {
      layouts: true, skin: 'chalkboard', decor: 'chalkboard', frame: 'round', cover: 'center', center: true, upper: true,
      bg: '#2f3236', text: '#f4f4f0', muted: 'rgba(244,244,240,.75)', accent: '#fde68a', accent2: '#f9a8d4', onAccent: '#1f2937',
      titleFont: F.chewy, bodyFont: F.sans, titleWeight: 400, titleScale: 1.15,
      card: '#fde68a', cardText: '#1f2937', cardBorder: 'transparent', radius: 1,
      placeholder: 'linear-gradient(135deg, #4b5057, #3a3d42)',
      area: { l: 8, t: 13, w: 84, h: 66 }, ...classic,
    },
  },
  {
    id: 'doodle',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'agenda', 'media', 'cards', 'process', 'team', 'compare', 'cards:1', 'content', 'end'],
    theme: {
      layouts: true, skin: 'doodle', decor: 'doodle', frame: 'round', cover: 'center', center: true,
      bg: '#fdfdfb', text: '#111827', muted: '#374151', accent: '#f9a8d4', accent2: '#99f6e4', onAccent: '#111827',
      titleFont: F.baloo, bodyFont: F.hand, titleWeight: 800, titleScale: 1.05, bodyScale: 1.15,
      card: '#fbcfe8', cardText: '#111827', cardBorder: 'transparent', radius: 1,
      placeholder: 'linear-gradient(135deg, #fbcfe8, #99f6e4)',
      area: { l: 9, t: 15, w: 76, h: 72 }, ...classic,
    },
  },
  {
    id: 'debate',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pro: true,
    pages: ['title', 'agenda', 'cards', 'compare', 'media', 'process', 'cards:1', 'stats', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'stage', decor: 'stage', frame: 'round', cover: 'center', center: true, upper: true,
      bg: 'linear-gradient(180deg, #5a0b0b 0%, #8e1414 55%, #3a0505 100%)',
      text: '#ffffff', muted: 'rgba(255,240,236,.8)', accent: '#ff3b30', accent2: '#ffb4a8', onAccent: '#ffffff',
      titleFont: F.archivo, bodyFont: F.sans, titleWeight: 400, titleScale: 1,
      card: '#ffffff', cardText: '#2a0606', cardBorder: 'transparent', radius: 1.6,
      placeholder: 'linear-gradient(135deg, rgba(255,255,255,.25), rgba(0,0,0,.2))',
      area: { l: 8, t: 14, w: 84, h: 72 },
      ...classic,
    },
  },
  {
    id: 'debategreen',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'agenda', 'compare', 'cards', 'stats', 'process', 'cards:1', 'chart', 'content', 'end'],
    theme: {
      layouts: true, skin: 'splash', decor: 'splash', frame: 'round', cover: 'left',
      bg: '#fbfbf7', text: '#111111', muted: '#3f3f46', accent: '#c6f432', accent2: '#3b82f6', onAccent: '#111111',
      titleFont: F.inclusive, bodyFont: F.inclusive, titleWeight: 400, titleScale: 1.15,
      card: '#ffffff', cardText: '#111111', cardBorder: '#111111', radius: 1.2,
      placeholder: 'linear-gradient(135deg, #ecfccb, #dbeafe)',
      area: { l: 8, t: 14, w: 80, h: 72 },
      ...classic,
    },
  },
  {
    id: 'debateclub',
    types: ['Prezentatsiya'],
    cat: 'talim',
    pages: ['title', 'agenda', 'media', 'cards', 'stats', 'compare', 'process', 'chart', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'club', decor: 'club', frame: 'round', cover: 'left', upper: true,
      bg: '#fdf1e6', text: '#3a1218', muted: '#6b4a4e', accent: '#f0645a', accent2: '#7a1e2c', onAccent: '#ffffff',
      titleFont: F.bricolage, bodyFont: F.sans, titleWeight: 800, titleScale: 1,
      alt: { bg: '#f9e5d4' },
      card: '#fffaf5', cardText: '#3a1218', cardBorder: 'rgba(122,30,44,.15)', radius: 1,
      placeholder: 'linear-gradient(135deg, #f7c9b6, #e9a294)',
      area: { l: 6, t: 13, w: 88, h: 76 },
      ...classic,
    },
  },
  {
    id: 'softskill',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'agenda', 'media', 'cards', 'cards:1', 'process', 'media:1', 'stats', 'team', 'end'],
    theme: {
      layouts: true, skin: 'training', decor: 'training', frame: 'round', cover: 'split', upper: true,
      bg: '#ffffff', text: '#161616', muted: '#52525b', accent: '#f08a24', accent2: '#161616', onAccent: '#ffffff',
      titleFont: F.dm, bodyFont: F.dm, titleWeight: 700, titleScale: 1,
      alt: { bg: '#161616', text: '#ffffff', muted: 'rgba(255,255,255,.72)', card: '#262626', cardText: '#ffffff', placeholder: 'linear-gradient(135deg, #3f3f46, #27272a)' },
      card: '#161616', cardText: '#ffffff', cardBorder: 'transparent', radius: 0.4,
      placeholder: 'linear-gradient(135deg, #fed7aa, #e4e4e7)',
      area: { l: 6, t: 13, w: 86, h: 74 },
      ...classic,
    },
  },
  {
    id: 'roadmap',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'media', 'cards', 'media:1', 'process', 'stats', 'cards:1', 'compare', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'roadmap', decor: 'roadmap', frame: 'round', cover: 'left',
      bg: '#fdfbf3', text: '#2f4fd6', muted: '#475569', accent: '#4f6ff0', accent2: '#f97316', onAccent: '#ffffff',
      titleFont: F.manrope, bodyFont: F.manrope, titleWeight: 400, titleScale: 1.15,
      card: '#ffffff', cardText: '#1e293b', cardBorder: 'rgba(79,111,240,.2)', radius: 1.6,
      placeholder: 'linear-gradient(135deg, #dbe4ff, #ffedd5)',
      area: { l: 6, t: 13, w: 88, h: 70 },
      ...classic,
    },
  },
  {
    id: 'workshop',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'agenda', 'cards', 'process', 'media', 'compare', 'cards:1', 'team', 'content', 'end'],
    theme: {
      layouts: true, skin: 'workshop', decor: 'workshop', frame: 'round', cover: 'left', upper: true,
      bg: '#ffffff', text: '#111111', muted: '#52525b', accent: '#111111', accent2: '#71717a', onAccent: '#ffffff',
      titleFont: F.sans, bodyFont: F.sans, titleWeight: 800, titleScale: 1,
      card: '#f4f4f5', cardText: '#111111', cardBorder: '#111111', radius: 0.6,
      placeholder: 'repeating-linear-gradient(45deg, #e4e4e7 0 0.5cqw, #fafafa 0.5cqw 1cqw)',
      area: { l: 6, t: 14, w: 72, h: 74 },
      ...classic,
    },
  },
  {
    id: 'strategy',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'content', 'agenda', 'cards', 'compare', 'cards:1', 'process', 'stats', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'strategy', decor: 'strategy', frame: 'round', cover: 'center', center: true,
      bg: '#efefed', text: '#1c1c1c', muted: '#6b6b6b', accent: '#1c1c1c', accent2: '#8a8a8a', onAccent: '#ffffff',
      titleFont: F.sans, bodyFont: F.sans, titleWeight: 800, titleScale: 1,
      card: '#f8f8f6', cardText: '#1c1c1c', cardBorder: 'rgba(0,0,0,.1)', radius: 1,
      placeholder: 'linear-gradient(135deg, #e0e0de, #f5f5f3)',
      area: { l: 8, t: 13, w: 84, h: 76 },
      ...classic,
    },
  },
  {
    id: 'pitchsun',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pro: true,
    pages: ['title', 'media', 'stats', 'cards', 'media:1', 'process', 'chart', 'compare', 'team', 'end'],
    theme: {
      layouts: true, skin: 'sunrise', decor: 'sunrise', frame: 'round', cover: 'left',
      bg: '#fffaf5', text: '#1f1a17', muted: '#6b5e55', accent: '#f97316', accent2: '#fdba74', onAccent: '#ffffff',
      titleFont: F.fraunces, bodyFont: F.manrope, titleWeight: 500, titleScale: 1.15,
      card: 'rgba(255,255,255,.75)', cardText: '#1f1a17', cardBorder: 'rgba(249,115,22,.15)', radius: 1.4,
      placeholder: 'linear-gradient(135deg, #fdc79a, #ffe6cf)',
      area: { l: 6, t: 13, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'startup',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'agenda', 'team', 'media', 'cards', 'stats', 'media:1', 'chart', 'process', 'end'],
    theme: {
      layouts: true, skin: 'flame', decor: 'flame', frame: 'round', cover: 'left',
      bg: '#fafafa', text: '#111111', muted: '#52525b', accent: '#f97316', accent2: '#facc15', onAccent: '#ffffff',
      titleFont: F.heebo, bodyFont: F.heebo, titleWeight: 700, titleScale: 1.1,
      card: '#ffffff', cardText: '#111111', cardBorder: 'rgba(0,0,0,.06)', radius: 1.4,
      placeholder: 'linear-gradient(135deg, #fed7aa, #fef3c7)',
      area: { l: 6, t: 14, w: 80, h: 74 }, ...classic,
    },
  },
  {
    id: 'saas',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'stats', 'media', 'cards', 'media:1', 'compare', 'cards:1', 'process', 'team', 'end'],
    theme: {
      layouts: true, skin: 'saas', decor: 'saas', frame: 'round', cover: 'split',
      bg: '#eef3fb', text: '#0f172a', muted: '#475569', accent: '#2563eb', accent2: '#93c5fd', onAccent: '#ffffff',
      titleFont: F.sans, bodyFont: F.sans, titleWeight: 700, titleScale: 1.05,
      card: '#ffffff', cardText: '#0f172a', cardBorder: 'rgba(37,99,235,.1)', radius: 1.6,
      placeholder: 'linear-gradient(135deg, #bcd4fb, #dbe7fb)',
      area: { l: 6, t: 15, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'pitch',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    video: true,
    pages: ['title', 'agenda', 'cards', 'media', 'stats', 'team', 'process', 'chart', 'end'],
    theme: {
      layouts: true, skin: 'pitch', decor: 'pitch', frame: 'glow', cover: 'split',
      bg: '#f5f7fb', text: '#0b1220', muted: '#5b6474', accent: '#2563eb', accent2: '#60a5fa',
      titleFont: F.sans, bodyFont: F.sans, titleWeight: 600, titleScale: 1.2,
      card: '#ffffff', cardText: '#0b1220', cardBorder: 'rgba(15,23,42,.08)', radius: 1.4,
      placeholder: 'linear-gradient(135deg, #dbe6ff, #eef2ff)',
      // every second page goes dark
      alt: {
        bg: 'radial-gradient(ellipse at 80% 100%, #0f1b3d 0%, #0a0d14 60%)', text: '#f5f7fb', muted: 'rgba(245,247,251,.65)',
        card: 'rgba(255,255,255,.06)', cardText: '#f5f7fb', cardBorder: 'rgba(255,255,255,.1)',
        placeholder: 'linear-gradient(135deg, #1e293b, #0f172a)',
      },
      area: { l: 6, t: 14, w: 88, h: 76 }, ...classic,
    },
  },
  {
    id: 'brand',
    types: ['Prezentatsiya'],
    cat: 'biznes',
    pages: ['title', 'media', 'cards', 'stats', 'media:1', 'process', 'quote', 'end'],
    theme: {
      layouts: true, skin: 'brand', decor: 'brand', frame: 'round', cover: 'split',
      bg: '#f6efe6', text: '#1a1414', muted: '#6b5e57', accent: '#c8102e', accent2: '#ef6b6b',
      titleFont: F.poppins, bodyFont: F.poppins, titleWeight: 800, titleScale: 1.15,
      card: '#fffaf4', cardText: '#1a1414', cardBorder: 'rgba(200,16,46,.18)', radius: 1.4,
      placeholder: 'linear-gradient(135deg, #ead8c6, #d7bfa8)',
      area: { l: 6, t: 13, w: 88, h: 78 }, ...classic,
    },
  },
]

/**
 * Templates that were retired → the closest current one. Saved designs, the landing page and
 * older links keep working: they simply render in the new look.
 */
const LEGACY = {
  aurora: 'pitch',
  violet: 'pitch',
  waves: 'pitch',
  sunset: 'brand',
  grid: 'brand',
  blocks: 'brand',
  ikat: 'gallery',
  invite: 'gallery',
  thesis: 'chronicle',
  lines: 'chronicle',
  paper: 'chronicle',
  chalk: 'quiz',
}

// Names and sample texts follow the interface language (src/i18n/msg/templates.js).
for (const tpl of TEMPLATES) {
  Object.defineProperties(tpl, {
    name: { get: () => t(`tpl.name.${tpl.id}`), enumerable: true },
    sample: {
      get: () => {
        const [title, subtitle] = t(`tpl.sample.${tpl.id}`).split('|')
        return { title, subtitle }
      },
      enumerable: true,
    },
  })
}

export const BRAND_COLORS = ['#14b8a6', '#2f5bff', '#c2185b', '#ff6b2c', '#7c3aed', '#16a34a', '#111111', '#e5a50a']

/**
 * A plain white page for designs opened from a type card before any template is picked.
 * Not listed in TEMPLATES, so no picker shows it.
 */
export const BLANK = {
  id: 'blank',
  cat: null,
  pages: null,
  theme: {
    bg: '#ffffff', text: '#0b1220', muted: '#5b6474', accent: '#2563eb',
    titleFont: F.sans, bodyFont: F.sans, titleWeight: 600, ...classic,
  },
  get name() { return t('design.untitled') },
  get sample() { return { title: t('design.untitled'), subtitle: '' } },
}

export const getTemplate = (id) => (id === BLANK.id ? BLANK : TEMPLATES.find((t) => t.id === (LEGACY[id] ?? id)) ?? TEMPLATES[0])

/** Template for create types that have none of their own yet (their designs come later). */
export const DEFAULT_TEMPLATE = 'pitch'

/** Templates made for a create type (src/home/create.jsx ids: 'Prezentatsiya', 'Referat' …). */
export const templatesFor = (typeId) => TEMPLATES.filter((tpl) => tpl.types?.includes(typeId))

/** The current id for a template id that may have been retired. */
export const templateIdOf = (id) => getTemplate(id).id

/**
 * The template's own pages filled with sample text — what "use all pages" gives.
 * `title`/`subtitle` replace the cover texts (e.g. the topic the user typed).
 */
export function templatePages(tpl, { title, subtitle } = {}) {
  return tpl.pages.map((entry, i) => {
    const [type, v] = entry.split(':')
    // 'media:1' is a numbered variant; 'chart:line' a named one that samplePage reads itself
    const page = v != null && Number.isNaN(Number(v)) ? samplePage(entry) : samplePage(type, Number(v) || 0)
    if (i === 0) {
      page.title = title || tpl.sample.title
      page.subtitle = subtitle ?? tpl.sample.subtitle
    }
    return { ...page, id: newId('s'), elements: [] }
  })
}

/** Sample pages used to preview a template. Cached per template and language. */
const sampleCache = new Map()
export function sampleDeck(tpl, count = Infinity) {
  const key = `${getLang()}:${tpl.id}`
  if (!sampleCache.has(key)) sampleCache.set(key, templatePages(tpl))
  return sampleCache.get(key).slice(0, count)
}

export const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? ''

/** Theme of a deck = its template's theme + optional brand accent override. */
export const deckTheme = (deck) => {
  const theme = getTemplate(deck.templateId).theme
  return deck.accent ? { ...theme, accent: deck.accent } : theme
}

let uid = 0
export const newId = (p = 'id') => `${p}-${Date.now().toString(36)}-${(uid++).toString(36)}`

const SECTION_COUNT = 6

/** Demo "AI" deck: a title slide plus section slides built from the topic. */
export function generateSlides(topic, count = 6) {
  const name = topic.trim() || t('tpl.untitled')
  const slides = [{ id: newId('s'), type: 'title', title: name, subtitle: t('tpl.deckSub'), elements: [] }]
  for (let i = 0; i < Math.max(1, count - 1); i++) {
    const [title, ...bullets] = t(`tpl.sec.${i % SECTION_COUNT}`, { country: t('bp.localExp') }).split('|')
    slides.push({ id: newId('s'), type: 'content', title, bullets, elements: [] })
  }
  return slides
}
