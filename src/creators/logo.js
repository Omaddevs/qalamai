// Logo model: fonts, palettes, layouts, industry icon sets and the concept generator.
import {
  GraduationCap, BookOpen, Student, PencilSimple, Lightbulb, Exam, Cpu, Code, Lightning, Atom, Robot, Cloud, ForkKnife, Coffee,
  Cookie, Pizza, Hamburger, BowlFood, Flower, Sparkle, Heart, Butterfly, FlowerLotus, Drop, Buildings, HouseLine, Hammer, Wrench,
  Crane, Barbell, SoccerBall, Trophy, PersonSimpleRun, TShirt, Diamond, Crown, Handbag, Dress, ChartLineUp, Coins, Bank, ShieldCheck,
  Wallet, TrendUp, Airplane, Globe, Mountains, Compass, MapPin, Tent, Heartbeat, FirstAid, Pill, Tooth, Stethoscope, Star, Leaf,
  Infinity, Sun, Feather, Planet, Camera, MusicNotes, PaintBrush, Car, Truck, Baby, PawPrint, Plant, Cake, Scissors, Laptop, Package,
  Storefront, Medal,
} from '@phosphor-icons/react'

export const LOGO_FONTS = {
  unbounded: { label: 'Unbounded', css: "'Unbounded', sans-serif", weight: 800, google: 'Unbounded:wght@800' },
  grotesk: { label: 'Space Grotesk', css: "'Space Grotesk', sans-serif", weight: 700, google: 'Space+Grotesk:wght@700' },
  inter: { label: 'Inter', css: "'Inter', sans-serif", weight: 800, google: 'Inter:wght@800' },
  syne: { label: 'Syne', css: "'Syne', sans-serif", weight: 800, google: 'Syne:wght@800' },
  bebas: { label: 'Bebas Neue', css: "'Bebas Neue', sans-serif", weight: 400, upper: true, google: 'Bebas+Neue' },
  righteous: { label: 'Righteous', css: "'Righteous', sans-serif", weight: 400, google: 'Righteous' },
  playfair: { label: 'Playfair', css: "'Playfair Display', serif", weight: 700, google: 'Playfair+Display:wght@700' },
  dmserif: { label: 'DM Serif', css: "'DM Serif Display', serif", weight: 400, google: 'DM+Serif+Display' },
  instrument: { label: 'Instrument', css: "'Instrument Serif', serif", weight: 400, italic: true, google: 'Instrument+Serif:ital@1' },
  pacifico: { label: 'Pacifico', css: "'Pacifico', cursive", weight: 400, google: 'Pacifico' },
  caveat: { label: 'Caveat', css: "'Caveat', cursive", weight: 700, google: 'Caveat:wght@700' },
}
export const TAGLINE_FONT = { css: "'Inter', sans-serif", weight: 600, google: 'Inter:wght@600' }

export const PALETTES = [
  { id: 'teal', primary: '#14b8a6', secondary: '#0f766e', text: '#0b0b0d', bg: '#ffffff' },
  { id: 'ink', primary: '#0b0b0d', secondary: '#c8a24a', text: '#0b0b0d', bg: '#f7f5f0' },
  { id: 'royal', primary: '#4f46e5', secondary: '#818cf8', text: '#1e1b4b', bg: '#ffffff' },
  { id: 'coral', primary: '#f97362', secondary: '#f59e0b', text: '#3b0d0c', bg: '#fff7f2' },
  { id: 'forest', primary: '#166534', secondary: '#65a30d', text: '#052e16', bg: '#f7fee7' },
  { id: 'berry', primary: '#be185d', secondary: '#f472b6', text: '#500724', bg: '#fdf2f8' },
  { id: 'ocean', primary: '#0369a1', secondary: '#38bdf8', text: '#082f49', bg: '#f0f9ff' },
  { id: 'sunset', primary: '#ea580c', secondary: '#fbbf24', text: '#431407', bg: '#fffbeb' },
  { id: 'plum', primary: '#7c3aed', secondary: '#e879f9', text: '#2e1065', bg: '#faf5ff' },
  { id: 'sand', primary: '#a16207', secondary: '#ca8a04', text: '#422006', bg: '#fefce8' },
  { id: 'mono', primary: '#111111', secondary: '#6b7280', text: '#111111', bg: '#ffffff' },
  { id: 'night', primary: '#5eead4', secondary: '#a78bfa', text: '#ffffff', bg: '#0b0b14' },
]

export const LAYOUTS = {
  left: 'Yonma-yon',
  stack: 'Ustma-ust',
  emblem: 'Emblema',
  monogram: 'Monogramma',
  wordmark: 'Faqat matn',
}
export const SHAPES = { squircle: 'Yumaloq kvadrat', circle: 'Doira', hexagon: 'Olti burçak', diamond: 'Romb', none: 'Şaklsiz' }

export const INDUSTRIES = {
  umumiy: { label: 'Umumiy', icons: { Star, Leaf, Infinity, Sun, Feather, Planet, Lightning, Diamond } },
  talim: { label: 'Taʼlim', icons: { GraduationCap, BookOpen, Student, PencilSimple, Lightbulb, Exam, Medal } },
  texno: { label: 'Texnologiya', icons: { Cpu, Code, Lightning, Atom, Robot, Cloud, Laptop } },
  ovqat: { label: 'Oziq-ovqat', icons: { ForkKnife, Coffee, Cookie, Pizza, Hamburger, BowlFood, Cake } },
  gozallik: { label: 'Gözallik', icons: { Flower, Sparkle, Heart, Butterfly, FlowerLotus, Drop, Scissors } },
  qurilish: { label: 'Quriliş', icons: { Buildings, HouseLine, Hammer, Wrench, Crane } },
  sport: { label: 'Sport', icons: { Barbell, SoccerBall, Trophy, PersonSimpleRun, Lightning } },
  moda: { label: 'Moda', icons: { TShirt, Diamond, Crown, Handbag, Dress } },
  moliya: { label: 'Moliya', icons: { ChartLineUp, Coins, Bank, ShieldCheck, Wallet, TrendUp } },
  sayohat: { label: 'Sayohat', icons: { Airplane, Globe, Mountains, Compass, MapPin, Tent } },
  tibbiyot: { label: 'Tibbiyot', icons: { Heartbeat, FirstAid, Pill, Tooth, Stethoscope } },
  ijod: { label: 'Ijod', icons: { Camera, MusicNotes, PaintBrush, Feather, Sparkle } },
  savdo: { label: 'Savdo', icons: { Storefront, Package, Truck, Car, Handbag } },
  oila: { label: 'Bolalar va uy', icons: { Baby, PawPrint, Plant, HouseLine, Heart } },
}

/** Every icon by name, for the picker and for rendering saved logos. */
export const ICONS = Object.assign({}, ...Object.values(INDUSTRIES).map((i) => i.icons))

export const LOGO_DEFAULT = {
  name: 'Qalam Studio',
  tagline: 'Dizayn va brending',
  industry: 'umumiy',
  icon: 'Feather',
  layout: 'left',
  shape: 'squircle',
  font: 'grotesk',
  palette: 'teal',
  colors: null, // custom { primary, secondary, text, bg } overrides the palette
  iconWeight: 'fill',
  upper: false,
  spacing: 0,
}

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7)

// Twelve recipes chosen to look clearly different from one another.
const RECIPES = [
  { layout: 'left', shape: 'squircle', font: 'grotesk', iconWeight: 'fill' },
  { layout: 'stack', shape: 'circle', font: 'playfair', iconWeight: 'duotone' },
  { layout: 'emblem', shape: 'circle', font: 'grotesk', iconWeight: 'fill', upper: true, spacing: 2 },
  { layout: 'monogram', shape: 'squircle', font: 'unbounded', iconWeight: 'fill' },
  { layout: 'wordmark', shape: 'none', font: 'syne', iconWeight: 'fill' },
  { layout: 'left', shape: 'hexagon', font: 'bebas', iconWeight: 'bold', upper: true, spacing: 2 },
  { layout: 'stack', shape: 'none', font: 'instrument', iconWeight: 'duotone' },
  { layout: 'left', shape: 'circle', font: 'righteous', iconWeight: 'fill' },
  { layout: 'monogram', shape: 'circle', font: 'dmserif', iconWeight: 'fill' },
  { layout: 'wordmark', shape: 'none', font: 'pacifico', iconWeight: 'fill' },
  { layout: 'left', shape: 'diamond', font: 'inter', iconWeight: 'bold', upper: true, spacing: 1 },
  { layout: 'stack', shape: 'squircle', font: 'caveat', iconWeight: 'fill' },
]

/** Twelve logo concepts for a brand — deterministic for the same name and industry. */
export function generateConcepts({ name, tagline, industry }) {
  const icons = Object.keys(INDUSTRIES[industry]?.icons ?? INDUSTRIES.umumiy.icons)
  const seed = hash(`${name}|${industry}`)
  return RECIPES.map((r, i) => ({
    ...LOGO_DEFAULT,
    upper: false,
    spacing: 0,
    ...r,
    name,
    tagline,
    industry,
    icon: icons[(seed + i * 3) % icons.length],
    palette: PALETTES[(seed + i * 5) % PALETTES.length].id,
  }))
}

export const paletteOf = (m) => m.colors ?? PALETTES.find((p) => p.id === m.palette) ?? PALETTES[0]

export const initialsOf = (name) => {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? 'Q').slice(0, 2)).toUpperCase()
}

/** The same logo for a dark surface: light text, light mark. */
export function inverted(m) {
  const p = paletteOf(m)
  const dark = p.bg === '#0b0b14' || p.text === '#ffffff'
  if (dark) return m
  return { ...m, colors: { primary: '#ffffff', secondary: 'rgba(255,255,255,.7)', text: '#ffffff', bg: p.text, markText: p.primary } }
}

/* ───────── export: self-contained SVG / PNG ───────── */

async function toDataUrl(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(blob)
  })
}

/** @font-face rules with the fonts embedded — subset by Google Fonts to just the letters used. */
async function embeddedFontCss(model) {
  const text = [...new Set(`${model.name}${model.upper ? model.name.toUpperCase() : ''}${initialsOf(model.name)}${model.tagline}${model.tagline.toUpperCase()}`)].join('')
  const fonts = [LOGO_FONTS[model.font], TAGLINE_FONT]
  let css = ''
  for (const f of fonts) {
    try {
      const res = await fetch(`https://fonts.googleapis.com/css2?family=${f.google}&text=${encodeURIComponent(text)}`)
      let block = await res.text()
      for (const [, url] of block.matchAll(/url\((https:[^)]+)\)/g)) block = block.replace(url, await toDataUrl(url))
      css += block
    } catch {
      /* offline: the SVG falls back to system fonts */
    }
  }
  return css
}

export async function logoSvgString(svgEl, model, { background = true } = {}) {
  const clone = svgEl.cloneNode(true)
  const [, , w, h] = clone.getAttribute('viewBox').split(/\s+/).map(Number)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(Math.round(w)))
  clone.setAttribute('height', String(Math.round(h)))
  clone.removeAttribute('class')
  clone.querySelector('[data-bg]')?.setAttribute('opacity', background ? '1' : '0')
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = await embeddedFontCss(model)
  clone.insertBefore(style, clone.firstChild)
  return new XMLSerializer().serializeToString(clone)
}

export async function logoPng(svgString, width = 2048) {
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })
  const k = width / img.naturalWidth
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round(img.naturalHeight * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

export function saveBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
