// Presentation quality check: finds what makes a deck look unprofessional and fixes what can be fixed
// without touching its meaning. Three sources:
//   · the page data   — layout repetition, text density, empty titles, charts that cannot be right,
//                       picture pages without a picture, an accent colour too close to the page;
//   · the drawn page  — text that runs out of its area (measured in an off-screen render);
//   · free elements   — things placed (partly) outside the page.
// The automatic fix only ever scales a page's type down (`slide.fit`), never edits words or data.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import Slide from './Slide.jsx'
import { contrast, solidOf, valueOf } from './layoutKit.jsx'
import { fontSheetsReady, loadFonts } from './fonts.js'

/** How much each finding costs out of 100. */
const COST = { overflow: 12, chart: 8, contrast: 6, dense: 5, offPage: 4, image: 4, empty: 4, typeShare: 3, repeat: 2, chartSum: 3, small: 2 }

/** Steps tried by the fix, largest first; below the last one a page is reported as too full. */
const FITS = [0.93, 0.86, 0.8, 0.74]

const PICTURE_TYPES = new Set(['media', 'photo', 'chapter', 'features'])

/** Every user-visible string of a page's data (not ids, pictures or settings). */
function textOf(v, out = []) {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => textOf(x, out))
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) if (!['id', 'type', 'image', 'kind', 'icon', 'side', 'elements', 'bg', 'imageCredit'].includes(k)) textOf(x, out)
  return out
}

/** A page still drawn by its layout (not yet turned into free elements on the canvas). */
const structured = (s) => !s.free

/**
 * Findings from the deck's data alone (no rendering).
 * @returns {{ index: number, code: string, n?: number }[]}
 */
export function checkData(slides, theme) {
  const out = []
  const counts = {}
  slides.forEach((s, i) => {
    if (s.free) {
      // free pages: elements that leave the page
      const off = (s.elements ?? []).filter((e) => !e.bg && !e.decor && (e.x < -2 || e.y < -2 || e.x + e.w > 102 || e.y + (e.h ?? 0) > 102)).length
      if (off) out.push({ index: i, code: 'offPage', n: off })
      return
    }
    counts[s.type] = (counts[s.type] ?? 0) + 1
    if (i > 0 && structured(slides[i - 1]) && slides[i - 1].type === s.type && !['content', 'media'].includes(s.type)) out.push({ index: i, code: 'repeat' })
    const words = textOf(s).join(' ')
    if (words.length > 900) out.push({ index: i, code: 'dense' })
    if (['content', 'cards', 'stats', 'process', 'kpi', 'timeline', 'table', 'chart', 'summary', 'swot', 'matrix', 'pyramid', 'funnel'].includes(s.type) && !String(s.title ?? '').trim()) out.push({ index: i, code: 'empty' })
    if (PICTURE_TYPES.has(s.type) && !s.image) out.push({ index: i, code: 'image' })
    if (s.type === 'chart') {
      const vs = (s.bars ?? []).map((b) => valueOf(b.value))
      if (vs.length < 2 || vs.some((v) => !Number.isFinite(v))) out.push({ index: i, code: 'chart' })
      else if ((s.kind === 'donut' || s.kind === 'pie') && (s.bars ?? []).every((b) => /%/.test(String(b.value)))) {
        const sum = vs.reduce((a, b) => a + b, 0)
        if (sum < 95 || sum > 105) out.push({ index: i, code: 'chartSum', n: Math.round(sum) })
      }
    }
    if (s.fit && s.fit < 0.8) out.push({ index: i, code: 'small' })
  })
  // one layout carrying much of the deck reads as a template, not a design
  const laid = slides.filter(structured).length
  if (laid >= 6)
    for (const [type, n] of Object.entries(counts))
      if (!['content'].includes(type) && n / laid > 0.4) out.push({ index: slides.findIndex((s) => structured(s) && s.type === type), code: 'typeShare', n })
  // a brand accent that melts into the page
  const bg = solidOf(theme.bg)
  if (bg && theme.accent && contrast(theme.accent, bg) < 1.6) out.push({ index: 0, code: 'contrast' })
  return out
}

/** Score out of 100 for a list of findings. */
export const scoreOf = (issues) => Math.max(0, 100 - issues.reduce((a, x) => a + (COST[x.code] ?? 2), 0))

/* ───────── measuring drawn pages ───────── */

/** How far (as a share of the page height) anything in the layout area runs past its bounds. */
export function overflowOf(slideEl) {
  const area = slideEl.querySelector('.ly-area')
  if (!area) return 0
  const a = area.getBoundingClientRect()
  const page = slideEl.getBoundingClientRect()
  let over = 0
  for (const el of area.querySelectorAll('*')) {
    // full-bleed pictures leave the area on purpose
    if (el.closest('.ly-bleed, .ly-chap-img, .ly-img-ph')) continue
    // inside a drawing only the drawing's own box counts (gradient stops and defs report odd boxes)
    if (el.ownerSVGElement) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    // a little room below the area is fine (axis labels sit there); past it the text reaches the page edge or footer
    over = Math.max(over, r.bottom - Math.min(a.bottom + page.height * 0.07, page.bottom), r.right - Math.min(a.right + page.width * 0.04, page.right), a.top - r.top)
  }
  return page.height ? over / page.height : 0
}

/** The design's fonts, loaded before anything is measured (a fallback face is wider and would look like overflow). */
async function fontsFor(theme) {
  const fonts = [...new Set([...(theme.fonts ?? []), theme.titleFont, theme.bodyFont].filter(Boolean))]
  loadFonts(fonts)
  await Promise.race([fontSheetsReady(), new Promise((r) => setTimeout(r, 4000))])
  const family = (css) => /^\s*['"]?([^'",]+)/.exec(css)?.[1]
  await Promise.race([
    Promise.all([theme.titleFont, theme.bodyFont].filter(Boolean).flatMap((f) => [`${theme.titleWeight ?? 700} 32px "${family(f)}"`, `400 16px "${family(f)}"`, `700 16px "${family(f)}"`].map((q) => document.fonts?.load(q).catch(() => null)))),
    new Promise((r) => setTimeout(r, 4000)),
  ])
}

/** Draws pages off-screen, one at a time, and hands each drawn `.slide` to `look`. */
async function withStage(fn, theme) {
  if (theme) await fontsFor(theme)
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'fixed', left: '-12000px', top: '0', width: '960px', pointerEvents: 'none', contain: 'layout paint' })
  document.body.appendChild(host)
  const root = createRoot(host)
  const draw = async (slide, theme, index) => {
    root.render(createElement(Slide, { slide, theme, index }))
    await new Promise((r) => setTimeout(r, 0))
    await document.fonts?.ready
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return host.querySelector('.slide')
  }
  try {
    return await fn(draw)
  } finally {
    root.unmount()
    host.remove()
  }
}

/**
 * Measures every page still drawn by its layout and, where text runs over, scales its type down
 * step by step until it fits. Words and data are never changed.
 * @returns {Promise<{ slides: object[], overflow: number[], fixed: number[] }>}  overflow = pages still too full
 */
export async function fitDeck(slides, theme) {
  if (typeof document === 'undefined') return { slides, overflow: [], fixed: [] }
  const next = [...slides]
  const overflow = []
  const fixed = []
  await withStage(async (draw) => {
    for (let i = 0; i < next.length; i++) {
      const s = next[i]
      if (!structured(s)) continue
      const base = { ...s, fit: undefined }
      let el = await draw(base, theme, i)
      if (!el || overflowOf(el) <= 0.004) {
        if (s.fit) next[i] = base // fits at full size again (text was shortened)
        continue
      }
      let fit = null
      for (const f of FITS) {
        el = await draw({ ...s, fit: f }, theme, i)
        if (el && overflowOf(el) <= 0.004) {
          fit = f
          break
        }
      }
      next[i] = { ...s, fit: fit ?? FITS[FITS.length - 1] }
      if (fit) fixed.push(i)
      else overflow.push(i)
    }
  }, theme)
  return { slides: next, overflow, fixed }
}

/**
 * The full check: data findings plus pages whose text runs over (measured).
 * @returns {Promise<{ issues: { index: number, code: string, n?: number }[], score: number }>}
 */
export async function checkDeck(slides, theme) {
  const issues = checkData(slides, theme)
  if (typeof document !== 'undefined')
    await withStage(async (draw) => {
      for (let i = 0; i < slides.length; i++) {
        if (!structured(slides[i])) continue
        const el = await draw(slides[i], theme, i)
        if (el && overflowOf(el) > 0.004) issues.push({ index: i, code: 'overflow' })
      }
    }, theme)
  issues.sort((a, b) => (COST[b.code] ?? 0) - (COST[a.code] ?? 0) || a.index - b.index)
  return { issues, score: scoreOf(issues) }
}
