// PowerPoint (PPTX) → PDF: every slide drawn as a vector page of the slide's own size.
// Backgrounds (colour, gradient's first stop, picture), shapes (rectangles, rounded rectangles,
// ellipses, lines), pictures (with cropping), text boxes and placeholders with the sizes,
// colours, bullets and alignment they inherit from the layout and master, groups and tables.
// Charts, SmartArt and WordArt effects are not drawn. Unicode text uses the Noto fonts.
// Portable: runs in the server's worker threads and in the browser tool worker.
import { unzipSync } from 'fflate'
import {
  PDFDocument, clip, concatTransformationMatrix, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, setCharacterSpacing,
} from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { baseName } from '../../lib/filetypes.js'
import { fontSet, printable } from './fonts.js'
import { parseXml } from './xml.js'

const EMU = 12700 // per point
const utf8 = new TextDecoder()

/* ───────── package ───────── */

function openPackage(bytes) {
  let files
  try {
    files = unzipSync(bytes)
  } catch {
    throw new ToolError('UNSUPPORTED_FILE', 'PowerPoint faylni öqib bölmadi — u şikastlangan yoki eski .ppt formatida bölişi mumkin.')
  }
  const xmlCache = new Map()
  const xml = (path) => {
    if (!path || !files[path]) return null
    if (!xmlCache.has(path)) xmlCache.set(path, parseXml(utf8.decode(files[path])))
    return xmlCache.get(path)
  }
  /** Relationships of a part: id → absolute target path. */
  const rels = (path) => {
    const dir = path.slice(0, path.lastIndexOf('/'))
    const relPath = `${dir}/_rels/${path.slice(dir.length + 1)}.rels`
    const out = {}
    for (const r of xml(relPath)?.all('Relationship') ?? []) {
      const target = r.attr('Target')
      if (r.attr('TargetMode') === 'External') continue
      out[r.attr('Id')] = { type: r.attr('Type')?.split('/').pop(), path: resolve(dir, target) }
    }
    return out
  }
  return { files, xml, rels }
}

function resolve(dir, target) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = dir.split('/')
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

/* ───────── colours ───────── */

const PRESET_COLORS = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080' }

function hexRgb(hex) {
  const n = parseInt(hex, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function toHsl([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function fromHsl([h, s, l]) {
  if (!s) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    t = (t + 1) % 1
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
}

/** A colour element (a:srgbClr, a:schemeClr, …) with its modifiers → [r, g, b] 0..1, or null. */
function colorOf(el, theme) {
  if (!el) return null
  let c = null
  if (el.name === 'a:srgbClr') c = hexRgb(el.attr('val', '000000'))
  else if (el.name === 'a:schemeClr') c = theme.color(el.attr('val'))
  else if (el.name === 'a:sysClr') c = hexRgb(el.attr('lastClr', el.attr('val') === 'window' ? 'FFFFFF' : '000000'))
  else if (el.name === 'a:prstClr') c = hexRgb(PRESET_COLORS[el.attr('val')] ?? '000000')
  else if (el.name === 'a:scrgbClr') c = ['r', 'g', 'b'].map((k) => el.num(k, 0) / 100000)
  if (!c) return null
  let hsl = null
  for (const mod of el.children) {
    const v = mod.num('val', 0) / 100000
    if (mod.name === 'a:lumMod') (hsl ??= toHsl(c))[2] *= v
    else if (mod.name === 'a:lumOff') (hsl ??= toHsl(c))[2] += v
    else if (mod.name === 'a:tint') {
      if (hsl) (c = fromHsl(hsl)), (hsl = null)
      c = c.map((x) => x + (1 - x) * (1 - v))
    } else if (mod.name === 'a:shade') {
      if (hsl) (c = fromHsl(hsl)), (hsl = null)
      c = c.map((x) => x * v)
    }
  }
  if (hsl) c = fromHsl([hsl[0], hsl[1], Math.max(0, Math.min(1, hsl[2]))])
  return c.map((x) => Math.max(0, Math.min(1, x)))
}

const COLOR_TAGS = 'a:srgbClr|a:schemeClr|a:sysClr|a:prstClr|a:scrgbClr'

/** A gradient's average colour — what text painted with one looks like from a distance. */
function gradientMean(grad, theme) {
  const cs = (grad.at('a:gsLst')?.all('a:gs') ?? []).map((g) => colorOf(g.child(COLOR_TAGS), theme)).filter(Boolean)
  return cs.length ? [0, 1, 2].map((i) => cs.reduce((s, c) => s + c[i], 0) / cs.length) : null
}
const pdfColor = (c) => (c ? rgb(c[0], c[1], c[2]) : undefined)

function loadTheme(pkg, masterPath, master) {
  const themePath = Object.values(pkg.rels(masterPath)).find((r) => r.type === 'theme')?.path
  const theme = pkg.xml(themePath)
  const scheme = {}
  for (const c of theme?.at('a:themeElements', 'a:clrScheme')?.children ?? []) {
    const val = c.child(COLOR_TAGS)
    scheme[c.name.slice(2)] = val?.name === 'a:sysClr' ? hexRgb(val.attr('lastClr', '000000')) : val?.name === 'a:srgbClr' ? hexRgb(val.attr('val')) : null
  }
  const map = { ...(master.at('p:clrMap')?.attrs ?? { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }) }
  const fonts = theme?.at('a:themeElements', 'a:fontScheme')
  return {
    color: (name) => scheme[map[name] ?? name] ?? scheme[name] ?? null,
    major: fonts?.at('a:majorFont', 'a:latin')?.attr('typeface') ?? '',
    minor: fonts?.at('a:minorFont', 'a:latin')?.attr('typeface') ?? '',
  }
}

/* ───────── geometry ───────── */

function xfrmOf(spPr) {
  const x = spPr?.child('a:xfrm')
  const off = x?.child('a:off')
  const ext = x?.child('a:ext')
  if (!off || !ext) return null
  return { x: off.num('x', 0), y: off.num('y', 0), w: ext.num('cx', 0), h: ext.num('cy', 0), rot: x.num('rot', 0) / 60000 }
}

/* ───────── placeholders and text styles ───────── */

const phOf = (sp) => sp.at('p:nvSpPr', 'p:nvPr', 'p:ph') ?? sp.at('p:nvPicPr', 'p:nvPr', 'p:ph') ?? sp.at('p:nvGraphicFramePr', 'p:nvPr', 'p:ph')
const phType = (ph) => ph?.attr('type', 'body') ?? null
const TITLE = new Set(['title', 'ctrTitle'])

function findPlaceholder(tree, ph) {
  if (!tree || !ph) return null
  const type = phType(ph)
  const idx = ph.attr('idx')
  const shapes = tree.find('p:sp')
  const same = (t) => t === type || (TITLE.has(t) && TITLE.has(type)) || (t === 'body' && ['subTitle', 'obj'].includes(type))
  return (
    (idx != null && shapes.find((s) => phOf(s)?.attr('idx') === idx)) ||
    shapes.find((s) => phOf(s) && phType(phOf(s)) === type) ||
    shapes.find((s) => phOf(s) && same(phType(phOf(s)))) ||
    null
  )
}

/** Paragraph / run properties for a level, from most to least specific source. */
function levelProps(sources, lvl) {
  const out = { pPr: [], rPr: [] }
  for (const list of sources) {
    const p = list?.child(`a:lvl${lvl + 1}pPr`)
    if (p) {
      out.pPr.push(p)
      const d = p.child('a:defRPr')
      if (d) out.rPr.push(d)
    }
  }
  return out
}

const pick = (els, attr) => {
  for (const el of els) {
    const v = el?.attr(attr)
    if (v != null) return v
  }
  return null
}
const pickChild = (els, name) => {
  for (const el of els) {
    const c = el?.child(name)
    if (c) return c
  }
  return null
}

/* ───────── renderer ───────── */

export async function toPdf(input, platform) {
  const pkg = openPackage(await input.read())
  const pres = pkg.xml('ppt/presentation.xml')
  if (!pres) throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» PowerPoint taqdimotiga öxşamaydi.`)
  const size = pres.at('p:sldSz')
  const W = (size?.num('cx', 9144000) ?? 9144000) / EMU
  const H = (size?.num('cy', 6858000) ?? 6858000) / EMU
  const presRels = pkg.rels('ppt/presentation.xml')
  const slidePaths = (pres.at('p:sldIdLst')?.all('p:sldId') ?? []).map((s) => presRels[s.attr('r:id')]?.path).filter((p) => p && pkg.files[p])
  if (!slidePaths.length) throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» da slayd topilmadi.`)

  const doc = await PDFDocument.create()
  doc.setProducer('QalamAI')
  doc.setTitle(baseName(input.name))
  const fontOf = fontSet(doc, platform.font)
  const images = new Map()

  async function embedImage(path) {
    if (!images.has(path)) {
      images.set(
        path,
        (async () => {
          const bytes = pkg.files[path]
          if (!bytes) return null
          const ext = path.split('.').pop().toLowerCase()
          try {
            if (ext === 'png') return await doc.embedPng(bytes)
            if (ext === 'jpg' || ext === 'jpeg') return await doc.embedJpg(bytes)
          } catch {
            /* fall through to a re-encode */
          }
          if (['emf', 'wmf', 'svg'].includes(ext)) return null
          const png = await platform.toPng(bytes)
          return png ? doc.embedPng(png) : null
        })().catch(() => null),
      )
    }
    return images.get(path)
  }

  for (const slidePath of slidePaths) {
    const slide = pkg.xml(slidePath)
    if (slide.attr('show') === '0') continue
    const slideRels = pkg.rels(slidePath)
    const layoutPath = Object.values(slideRels).find((r) => r.type === 'slideLayout')?.path
    const layout = pkg.xml(layoutPath)
    const layoutRels = layoutPath ? pkg.rels(layoutPath) : {}
    const masterPath = Object.values(layoutRels).find((r) => r.type === 'slideMaster')?.path
    const master = pkg.xml(masterPath)
    const masterRels = masterPath ? pkg.rels(masterPath) : {}
    const theme = master ? loadTheme(pkg, masterPath, master) : { color: () => null, major: '', minor: '' }
    const txStyles = master?.child('p:txStyles')

    const page = doc.addPage([W, H])
    const ctx = { page, theme, W, H, embedImage, fontOf, txStyles, layout, master }

    /* background: slide → layout → master */
    const bgOwner = [
      [slide, slideRels],
      [layout, layoutRels],
      [master, masterRels],
    ].find(([x]) => x?.at('p:cSld', 'p:bg'))
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })
    if (bgOwner) await drawBackground(ctx, bgOwner[0].at('p:cSld', 'p:bg'), bgOwner[1])

    /* master and layout decorations (not their placeholders), then the slide */
    const showMaster = slide.attr('showMasterSp') !== '0' && layout?.attr('showMasterSp') !== '0'
    if (master && showMaster) await drawTree(ctx, master.at('p:cSld', 'p:spTree'), masterRels, { decorOnly: true, level: 'master' })
    if (layout && slide.attr('showMasterSp') !== '0') await drawTree(ctx, layout.at('p:cSld', 'p:spTree'), layoutRels, { decorOnly: true, level: 'layout' })
    await drawTree(ctx, slide.at('p:cSld', 'p:spTree'), slideRels, { level: 'slide' })
  }
  if (!doc.getPageCount()) throw new ToolError('UNSUPPORTED_FILE', 'Barça slaydlar yaşirilgan.')
  return { data: await doc.save(), pages: doc.getPageCount() }
}

async function drawBackground(ctx, bg, rels) {
  const pr = bg.child('p:bgPr')
  const { page, W, H, theme } = ctx
  if (pr) {
    const solid = pr.child('a:solidFill')
    const grad = pr.child('a:gradFill')
    const blip = pr.at('a:blipFill', 'a:blip')
    if (solid) page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: pdfColor(colorOf(solid.child(COLOR_TAGS), theme)) })
    else if (grad) await drawGradient(page, grad, theme, 0, 0, W, H)
    else if (blip) {
      const img = await ctx.embedImage(rels[blip.attr('r:embed')]?.path)
      if (img) page.drawImage(img, { x: 0, y: 0, width: W, height: H })
    }
    return
  }
  // a theme background reference: bg1 / its colour child
  const ref = bg.child('p:bgRef')
  const c = colorOf(ref?.child(COLOR_TAGS), theme)
  if (c) page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: pdfColor(c) })
}

/** Linear gradients as bands between their stops (angle from a:lin, default top → bottom). */
async function drawGradient(page, grad, theme, x, y, w, h) {
  const stops = (grad.at('a:gsLst')?.all('a:gs') ?? []).map((g) => ({ pos: g.num('pos', 0) / 100000, c: colorOf(g.child(COLOR_TAGS), theme) })).filter((s) => s.c).sort((a, b) => a.pos - b.pos)
  if (!stops.length) return
  const ang = ((grad.at('a:lin')?.num('ang', 5400000) ?? 5400000) / 60000) % 180
  const horizontal = ang < 45 || ang > 135
  const N = 48
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N
    let a = stops[0]
    let b = stops.at(-1)
    for (let k = 0; k < stops.length - 1; k++) if (t >= stops[k].pos && t <= stops[k + 1].pos) (a = stops[k]), (b = stops[k + 1])
    const f = b.pos > a.pos ? (t - a.pos) / (b.pos - a.pos) : 0
    const c = a.c.map((v, j) => v + (b.c[j] - v) * Math.max(0, Math.min(1, f)))
    if (horizontal) page.drawRectangle({ x: x + (w * i) / N, y, width: w / N + 0.6, height: h, color: rgb(...c) })
    else page.drawRectangle({ x, y: y + h - (h * (i + 1)) / N, width: w, height: h / N + 0.6, color: rgb(...c) })
  }
}

/** Shapes of one tree; `map` turns child coordinates of a group into slide EMUs. */
async function drawTree(ctx, tree, rels, opts, map = (b) => b) {
  if (!tree) return
  for (const el of tree.children) {
    try {
      if (el.name === 'p:sp') await drawShape(ctx, el, rels, opts, map)
      else if (el.name === 'p:pic') await drawPicture(ctx, el, rels, opts, map)
      else if (el.name === 'p:grpSp') {
        const g = el.at('p:grpSpPr', 'a:xfrm')
        const off = g?.child('a:off')
        const ext = g?.child('a:ext')
        const chOff = g?.child('a:chOff')
        const chExt = g?.child('a:chExt')
        const inner =
          off && ext && chOff && chExt
            ? (b) => {
                const sx = chExt.num('cx', 1) ? ext.num('cx', 0) / chExt.num('cx', 1) : 1
                const sy = chExt.num('cy', 1) ? ext.num('cy', 0) / chExt.num('cy', 1) : 1
                return map({ ...b, x: off.num('x', 0) + (b.x - chOff.num('x', 0)) * sx, y: off.num('y', 0) + (b.y - chOff.num('y', 0)) * sy, w: b.w * sx, h: b.h * sy })
              }
            : map
        const rot = (g?.num('rot', 0) ?? 0) / 60000
        const gbox = off && ext ? toBox(ctx, map({ x: off.num('x', 0), y: off.num('y', 0), w: ext.num('cx', 0), h: ext.num('cy', 0) })) : null
        await rotated(ctx.page, gbox, rot, () => drawTree(ctx, el, rels, opts, inner))
      } else if (el.name === 'p:graphicFrame') await drawFrame(ctx, el, opts, map)
      else if (el.name === 'mc:AlternateContent') {
        const alt = el.child('mc:Fallback') ?? el.child('mc:Choice')
        if (alt) await drawTree(ctx, alt, rels, opts, map)
      }
    } catch (err) {
      // one odd shape must not cost the whole slide
      if (globalThis.process?.env?.DEBUG_SLIDES) console.warn('slide shape:', err)
    }
  }
}

/** Run `fn` with the page turned by `deg` (PowerPoint's clockwise degrees) around the box centre. */
async function rotated(page, box, deg, fn) {
  if (!box || !deg || !Number.isFinite(deg)) return fn()
  const t = (-deg * Math.PI) / 180 // PDF's y axis points up: clockwise is a negative angle
  const [c, s] = [Math.cos(t), Math.sin(t)]
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy))
  try {
    return await fn()
  } finally {
    page.pushOperators(popGraphicsState())
  }
}

/** A custom geometry (a:custGeom) as an SVG path scaled to the box (y down from its top-left). */
function custPath(spPr, box) {
  const paths = spPr?.at('a:custGeom', 'a:pathLst')?.all('a:path') ?? []
  let d = ''
  for (const path of paths) {
    const sx = path.num('w', 0) ? box.w / path.num('w', 1) : 1 / EMU
    const sy = path.num('h', 0) ? box.h / path.num('h', 1) : 1 / EMU
    const pt = (el) => [Number(el.attr('x')) * sx, Number(el.attr('y')) * sy]
    let cur = [0, 0]
    for (const cmd of path.children) {
      const pts = cmd.all('a:pt').map(pt)
      if (pts.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return null // guide formulas: not supported
      if (cmd.name === 'a:moveTo') (d += `M ${pts[0].join(' ')} `), (cur = pts[0])
      else if (cmd.name === 'a:lnTo') (d += `L ${pts[0].join(' ')} `), (cur = pts[0])
      else if (cmd.name === 'a:cubicBezTo' && pts.length === 3) (d += `C ${pts.map((p) => p.join(' ')).join(' ')} `), (cur = pts[2])
      else if (cmd.name === 'a:quadBezTo' && pts.length === 2) (d += `Q ${pts.map((p) => p.join(' ')).join(' ')} `), (cur = pts[1])
      else if (cmd.name === 'a:arcTo') {
        const wR = cmd.num('wR', 0) * sx
        const hR = cmd.num('hR', 0) * sy
        const st = (cmd.num('stAng', 0) / 60000) * (Math.PI / 180)
        const sw = (cmd.num('swAng', 0) / 60000) * (Math.PI / 180)
        if (!Number.isFinite(wR + hR + st + sw)) return null
        const cx = cur[0] - wR * Math.cos(st)
        const cy = cur[1] - hR * Math.sin(st)
        const end = [cx + wR * Math.cos(st + sw), cy + hR * Math.sin(st + sw)]
        d += `A ${wR} ${hR} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${end.join(' ')} `
        cur = end
      } else if (cmd.name === 'a:close') d += 'Z '
    }
  }
  return d.trim() || null
}

/** Box in PDF points (origin bottom-left). */
const toBox = (ctx, b) => ({ x: b.x / EMU, y: ctx.H - (b.y + b.h) / EMU, w: b.w / EMU, h: b.h / EMU })

function inherited(ctx, sp, opts) {
  const ph = phOf(sp)
  if (!ph) return { ph: null, chain: [] }
  const fromLayout = opts.level === 'slide' ? findPlaceholder(ctx.layout, ph) : null
  const fromMaster = opts.level !== 'master' ? findPlaceholder(ctx.master, ph) : null
  return { ph, chain: [fromLayout, fromMaster].filter(Boolean) }
}

async function drawShape(ctx, sp, rels, opts, map) {
  const { ph, chain } = inherited(ctx, sp, opts)
  // placeholders on the master / layout are only prompts ("Click to add title"): not printed
  if (opts.decorOnly && ph) return
  const spPr = sp.child('p:spPr')
  const xf = xfrmOf(spPr) ?? chain.map((s) => xfrmOf(s.child('p:spPr'))).find(Boolean)
  if (!xf) return
  const box = toBox(ctx, map(xf))
  await rotated(ctx.page, box, xf.rot, () => drawShapeBody(ctx, sp, spPr, box, rels, { ph, chain }))
}

async function drawShapeBody(ctx, sp, spPr, box, rels, { ph, chain }) {
  const { page, theme } = ctx

  // fill & outline (own, else the style's references)
  const geom = spPr?.at('a:prstGeom')?.attr('prst') ?? (spPr?.child('a:custGeom') ? 'cust' : 'rect')
  const cust = geom === 'cust' ? custPath(spPr, box) : null
  const style = sp.child('p:style')
  let fill = null
  if (spPr?.child('a:noFill')) fill = null
  else if (spPr?.child('a:solidFill')) fill = colorOf(spPr.child('a:solidFill').child(COLOR_TAGS), theme)
  else if (spPr?.child('a:gradFill')) fill = 'grad'
  else if (style?.child('a:fillRef') && style.child('a:fillRef').num('idx', 0) > 0) fill = colorOf(style.child('a:fillRef').child(COLOR_TAGS), theme)
  const ln = spPr?.child('a:ln')
  let stroke = null
  if (ln?.child('a:noFill')) stroke = null
  else if (ln?.child('a:solidFill')) stroke = colorOf(ln.child('a:solidFill').child(COLOR_TAGS), theme)
  else if (style?.child('a:lnRef') && style.child('a:lnRef').num('idx', 0) > 0 && !ln?.child('a:noFill')) stroke = colorOf(style.child('a:lnRef').child(COLOR_TAGS), theme)
  const lw = Math.max(0.25, (ln?.num('w', 9525) ?? 9525) / EMU)
  const alpha = spPr?.at('a:solidFill')?.child(COLOR_TAGS)?.child('a:alpha')?.num('val', 100000) / 100000
  const strokeAlpha = ln?.at('a:solidFill')?.child(COLOR_TAGS)?.child('a:alpha')?.num('val', 100000) / 100000

  // a picture fill (Canva and Google Slides put photos in shapes)
  const blip = spPr?.at('a:blipFill', 'a:blip')
  if (blip) {
    const img = await ctx.embedImage(rels[blip.attr('r:embed')]?.path)
    if (img) {
      page.pushOperators(pushGraphicsState(), rectangle(box.x, box.y, box.w, box.h), clip(), endPath())
      page.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h })
      page.pushOperators(popGraphicsState())
    }
  }

  const isLine = ['line', 'straightConnector1', 'bentConnector2', 'bentConnector3', 'curvedConnector3'].includes(geom) || sp.parent?.name === 'p:cxnSp'
  if (isLine && stroke) {
    const flipV = spPr?.at('a:xfrm')?.attr('flipV') === '1'
    page.drawLine({ start: { x: box.x, y: flipV ? box.y : box.y + box.h }, end: { x: box.x + box.w, y: flipV ? box.y + box.h : box.y }, thickness: lw, color: pdfColor(stroke) })
  } else if (fill || stroke) {
    const common = {
      color: fill && fill !== 'grad' ? pdfColor(fill) : undefined,
      opacity: Number.isFinite(alpha) ? alpha : 1,
      borderColor: stroke ? pdfColor(stroke) : undefined,
      borderWidth: stroke ? lw : 0,
    }
    if (fill === 'grad') await drawGradient(page, spPr.child('a:gradFill'), theme, box.x, box.y, box.w, box.h)
    if (cust) page.drawSvgPath(cust, { x: box.x, y: box.y + box.h, color: common.color, opacity: common.opacity, borderColor: common.borderColor, borderWidth: common.borderWidth, borderOpacity: Number.isFinite(strokeAlpha) ? strokeAlpha : 1 })
    else if (geom === 'ellipse') page.drawEllipse({ x: box.x + box.w / 2, y: box.y + box.h / 2, xScale: box.w / 2, yScale: box.h / 2, ...common })
    else if (geom === 'roundRect') {
      const r = Math.min(box.w, box.h) * ((spPr?.at('a:prstGeom', 'a:avLst', 'a:gd')?.attr('fmla')?.match(/val (\d+)/)?.[1] ?? 16667) / 100000)
      page.drawSvgPath(roundRectPath(box.w, box.h, r), { x: box.x, y: box.y + box.h, color: common.color, opacity: common.opacity, borderColor: common.borderColor, borderWidth: common.borderWidth })
    } else if (geom === 'triangle') page.drawSvgPath(`M ${box.w / 2} 0 L ${box.w} ${box.h} L 0 ${box.h} Z`, { x: box.x, y: box.y + box.h, ...common })
    else if (fill !== 'grad' || stroke) page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, ...common, color: fill === 'grad' ? undefined : common.color })
  }

  const txBody = sp.child('p:txBody')
  if (txBody) await drawText(ctx, txBody, box, { ph, chain, style })
}

const roundRectPath = (w, h, r) =>
  `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`

async function drawPicture(ctx, pic, rels, opts, map) {
  const { ph, chain } = inherited(ctx, pic, opts)
  if (opts.decorOnly && ph) return
  const xf = xfrmOf(pic.child('p:spPr')) ?? chain.map((s) => xfrmOf(s.child('p:spPr'))).find(Boolean)
  const blipFill = pic.child('p:blipFill')
  const path = rels[blipFill?.at('a:blip')?.attr('r:embed')]?.path
  if (!xf || !path) return
  const img = await ctx.embedImage(path)
  if (!img) return
  const box = toBox(ctx, map(xf))
  await rotated(ctx.page, box, xf.rot, () => placeImage(ctx.page, img, box, blipFill.child('a:srcRect')))
}

function placeImage(page, img, box, src) {
  const [l, t, r, b] = ['l', 't', 'r', 'b'].map((k) => (src?.num(k, 0) ?? 0) / 100000)
  if (l || t || r || b) {
    // cropped: draw the whole picture larger and clip it to the frame
    const fw = box.w / Math.max(0.01, 1 - l - r)
    const fh = box.h / Math.max(0.01, 1 - t - b)
    page.pushOperators(pushGraphicsState(), rectangle(box.x, box.y, box.w, box.h), clip(), endPath())
    page.drawImage(img, { x: box.x - fw * l, y: box.y - fh * b, width: fw, height: fh })
    page.pushOperators(popGraphicsState())
  } else page.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h })
}

async function drawFrame(ctx, frame, opts, map) {
  if (opts.decorOnly) return
  const tbl = frame.at('a:graphic', 'a:graphicData', 'a:tbl')
  const x = frame.child('p:xfrm')
  const off = x?.child('a:off')
  if (!tbl || !off) return
  const cols = (tbl.at('a:tblGrid')?.all('a:gridCol') ?? []).map((g) => g.num('w', 0))
  let yEmu = off.num('y', 0)
  const { page, theme } = ctx
  const firstRow = tbl.at('a:tblPr')?.attr('firstRow') === '1'
  for (const [ri, tr] of tbl.all('a:tr').entries()) {
    const rowH = tr.num('h', 370840)
    let xEmu = off.num('x', 0)
    // rows grow to fit their text: measure first
    let need = rowH / EMU
    const cells = tr.all('a:tc')
    for (const [ci, tc] of cells.entries()) {
      const w = cols.slice(ci, ci + tc.num('gridSpan', 1)).reduce((s, v) => s + v, 0) / EMU
      const h = await drawText(ctx, tc.child('a:txBody'), { x: 0, y: 0, w, h: rowH / EMU }, { measure: true, table: true })
      need = Math.max(need, h)
    }
    for (const [ci, tc] of cells.entries()) {
      const span = tc.num('gridSpan', 1)
      const wEmu = cols.slice(ci, ci + span).reduce((s, v) => s + v, 0)
      if (tc.attr('hMerge') === '1' || tc.attr('vMerge') === '1') {
        xEmu += cols[ci] ?? 0
        continue
      }
      const box = toBox(ctx, map({ x: xEmu, y: yEmu, w: wEmu, h: need * EMU }))
      const tcPr = tc.child('a:tcPr')
      const fill = colorOf(tcPr?.at('a:solidFill')?.child(COLOR_TAGS), theme) ?? (ri === 0 && firstRow ? theme.color('accent1') : null)
      page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, color: pdfColor(fill), borderColor: rgb(0.75, 0.77, 0.8), borderWidth: 0.6 })
      await drawText(ctx, tc.child('a:txBody'), box, { table: true, header: ri === 0 && firstRow && !tcPr?.child('a:solidFill') })
      xEmu += cols[ci] ?? 0
    }
    yEmu += need * EMU
  }
}

const SERIF = /times|georgia|cambria|garamond|book antiqua|palatino|baskerville|constantia|serif/i

/**
 * Lay out and draw a text body inside `box` (PDF points). Returns the height the text needs
 * (with `measure`, draws nothing).
 */
async function drawText(ctx, txBody, box, { ph = null, chain = [], style = null, measure = false, table = false, header = false } = {}) {
  if (!txBody) return 0
  const { theme, txStyles, page } = ctx
  const type = phType(ph)
  const bodyPr = txBody.child('a:bodyPr')
  const chainBodyPr = chain.map((s) => s.at('p:txBody', 'a:bodyPr'))
  const bodyPrs = [bodyPr, ...chainBodyPr]
  const ins = (k, d) => Number(pick(bodyPrs, k) ?? d) / EMU
  const [lI, rI, tI, bI] = [ins('lIns', 91440), ins('rIns', 91440), ins('tIns', 45720), ins('bIns', 45720)]
  const anchor = pick(bodyPrs, 'anchor') ?? (TITLE.has(type) ? (type === 'ctrTitle' ? 'b' : 'ctr') : table ? 't' : 't')
  const noWrap = pick(bodyPrs, 'wrap') === 'none'
  const fontScale = (pickChild(bodyPrs, 'a:normAutofit')?.num('fontScale', 100000) ?? 100000) / 100000
  const lnReduce = (pickChild(bodyPrs, 'a:normAutofit')?.num('lnSpcReduction', 0) ?? 0) / 100000

  // list styles, most specific first: own, layout's, master's placeholder, master text styles
  const masterStyle = TITLE.has(type) ? txStyles?.child('p:titleStyle') : ph ? txStyles?.child('p:bodyStyle') : txStyles?.child('p:otherStyle')
  const lists = [txBody.child('a:lstStyle'), ...chain.map((s) => s.at('p:txBody', 'a:lstStyle')), masterStyle]
  const styleColor = colorOf(style?.child('a:fontRef')?.child(COLOR_TAGS), theme)
  const isMajor = TITLE.has(type)

  const maxW = Math.max(4, box.w - lI - rI)
  const lines = []
  let first = true
  for (const p of txBody.all('a:p')) {
    const pPr = p.child('a:pPr')
    const lvl = pPr?.num('lvl', 0) ?? 0
    const inh = levelProps(lists, lvl)
    const pPrs = [pPr, ...inh.pPr]
    const align = pick(pPrs, 'algn') ?? 'l'
    const marL = Number(pick(pPrs, 'marL') ?? 0) / EMU
    const indent = Number(pick(pPrs, 'indent') ?? 0) / EMU
    const lnPct = pickChild(pPrs, 'a:lnSpc')?.child('a:spcPct')?.num('val', 100000)
    const lnPts = pickChild(pPrs, 'a:lnSpc')?.child('a:spcPts')?.num('val')
    const before = (pickChild(pPrs, 'a:spcBef')?.child('a:spcPts')?.num('val', 0) ?? 0) / 100
    const after = (pickChild(pPrs, 'a:spcAft')?.child('a:spcPts')?.num('val', 0) ?? 0) / 100
    const buNone = pPr?.child('a:buNone') || (!pPr?.child('a:buChar') && !pPr?.child('a:buAutoNum') && inh.pPr.find((x) => x.child('a:buNone') || x.child('a:buChar') || x.child('a:buAutoNum'))?.child('a:buNone'))
    const buEl = buNone ? null : pickChild(pPrs, 'a:buChar') ?? pickChild(pPrs, 'a:buAutoNum')

    // runs
    const runs = []
    const defRPrs = [pPr?.child('a:defRPr'), ...inh.rPr]
    for (const r of p.children) {
      if (r.name === 'a:br') {
        runs.push({ br: true })
        continue
      }
      if (r.name !== 'a:r' && r.name !== 'a:fld') continue
      const text = r.child('a:t')?.text ?? ''
      if (!text) continue
      const rPr = r.child('a:rPr')
      const rPrs = [rPr, ...defRPrs]
      const sz = (Number(pick(rPrs, 'sz') ?? (table ? 1400 : isMajor ? 4400 : ph ? 2800 : 1800)) / 100) * fontScale
      const fillEl = pickChild(rPrs, 'a:solidFill|a:gradFill')
      const fillColor = fillEl?.name === 'a:gradFill' ? gradientMean(fillEl, theme) : colorOf(fillEl?.child(COLOR_TAGS), theme)
      const color = fillColor ?? styleColor ?? (header ? [1, 1, 1] : theme.color('tx1')) ?? [0, 0, 0]
      const opacity = (fillEl?.name === 'a:solidFill' ? fillEl.child(COLOR_TAGS)?.child('a:alpha')?.num('val', 100000) ?? 100000 : 100000) / 100000
      const face = pickChild(rPrs, 'a:latin')?.attr('typeface') ?? (isMajor ? theme.major : theme.minor)
      const resolvedFace = face === '+mj-lt' ? theme.major : face === '+mn-lt' ? theme.minor : face
      runs.push({
        text,
        size: sz,
        bold: (pick(rPrs, 'b') ?? (header ? '1' : '0')) === '1',
        italic: pick(rPrs, 'i') === '1',
        underline: (pick(rPrs, 'u') ?? 'none') !== 'none',
        spc: (Number(pick(rPrs, 'spc') ?? 0) / 100) * fontScale,
        opacity,
        caps: pick(rPrs, 'cap') === 'all',
        color,
        serif: SERIF.test(resolvedFace ?? ''),
      })
    }
    const endSz = (Number(pick([p.child('a:endParaRPr'), ...defRPrs], 'sz') ?? (isMajor ? 4400 : ph ? 2800 : 1800)) / 100) * fontScale
    const paraSize = runs.find((r) => !r.br)?.size ?? endSz
    const lineH = (lnPts ? lnPts / 100 : paraSize * 1.2 * ((lnPct ?? 100000) / 100000)) * (1 - lnReduce)

    // bullet
    let bullet = null
    if (buEl && runs.some((r) => r.text?.trim())) {
      const buColor = colorOf(pickChild(pPrs, 'a:buClr')?.child(COLOR_TAGS), theme) ?? runs.find((r) => !r.br)?.color
      const scale = (pickChild(pPrs, 'a:buSzPct')?.num('val', 100000) ?? 100000) / 100000
      let ch = buEl.name === 'a:buChar' ? buEl.attr('char', '•') : `${(ctx.autoNum = (ctx.autoNum ?? 0) + 1)}.`
      // Wingdings / Symbol private-use bullets → a plain one
      if (/[-]/.test(ch) || /^[§ü]$/.test(ch)) ch = '•'
      const bf = await ctx.fontOf({ family: 'sans' })
      const bt = printable(bf, ch)
      bullet = { text: bt, font: bf, size: paraSize * scale, color: buColor, x: Math.max(0, marL + indent), w: bf.widthOfTextAtSize(bt, paraSize * scale) }
    } else if (!buEl) ctx.autoNum = 0

    // words → lines; a bullet hangs at marL + indent and the text starts at marL (or after it)
    const firstX = bullet ? Math.max(marL, bullet.x + bullet.w + paraSize * 0.3) : Math.max(0, marL + indent)
    const avail = maxW - marL
    let line = { items: [], w: 0, x: firstX, avail: maxW - firstX, align, h: lineH, size: paraSize, bullet, spaceBefore: first ? 0 : before }
    const push = () => {
      lines.push(line)
      line = { items: [], w: 0, x: marL, avail, align, h: lineH, size: paraSize, spaceBefore: 0 }
    }
    for (const r of runs) {
      if (r.br) {
        push()
        continue
      }
      const f = await ctx.fontOf({ family: r.serif ? 'serif' : 'sans', bold: r.bold, italic: r.italic })
      const text = printable(f, r.caps ? r.text.toUpperCase() : r.text)
      for (const word of text.split(/(\s+)/)) {
        if (!word) continue
        const ww = f.widthOfTextAtSize(word, r.size) + r.spc * [...word].length
        if (!noWrap && line.items.length && /\S/.test(word) && line.w + ww > line.avail) {
          // drop the trailing space before breaking
          const last = line.items.at(-1)
          if (last && /^\s+$/.test(last.text)) line.w -= line.items.pop().w
          push()
        }
        if (!line.items.length && /^\s+$/.test(word)) continue
        line.items.push({ ...r, text: word, w: ww, f })
        line.w += ww
        line.size = Math.max(line.size, r.size)
        line.h = Math.max(line.h, (lnPts ? lnPts / 100 : r.size * 1.2 * ((lnPct ?? 100000) / 100000)) * (1 - lnReduce))
      }
    }
    if (line.items.length || !runs.length || lines.at(-1) !== line) push()
    if (lines.length) lines.at(-1).spaceAfter = after
    first = false
  }

  const total = lines.reduce((s, l) => s + l.spaceBefore + l.h + (l.spaceAfter ?? 0), 0) + tI + bI
  if (measure) return total
  const inner = box.h - tI - bI
  let y = box.y + box.h - tI
  const textH = total - tI - bI
  if (anchor === 'ctr') y -= (inner - textH) / 2
  else if (anchor === 'b') y -= inner - textH

  for (const l of lines) {
    y -= l.spaceBefore
    const base = y - l.h + (l.h - l.size * 1.2) / 2 + l.size * 0.25
    const room = maxW - l.x
    let x = box.x + lI + l.x + (l.align === 'ctr' ? (room - l.w) / 2 : l.align === 'r' ? room - l.w : 0)
    if (l.bullet) page.drawText(l.bullet.text, { x: box.x + lI + l.bullet.x, y: base, size: l.bullet.size, font: l.bullet.font, color: pdfColor(l.bullet.color) })
    for (const it of l.items) {
      if (/\S/.test(it.text)) {
        if (it.spc) page.pushOperators(setCharacterSpacing(it.spc))
        page.drawText(it.text, { x, y: base, size: it.size, font: it.f, color: pdfColor(it.color), opacity: it.opacity ?? 1 })
        if (it.spc) page.pushOperators(setCharacterSpacing(0))
      }
      if (it.underline && /\S/.test(it.text)) page.drawLine({ start: { x, y: base - it.size * 0.12 }, end: { x: x + it.w, y: base - it.size * 0.12 }, thickness: Math.max(0.4, it.size / 18), color: pdfColor(it.color) })
      x += it.w
    }
    y -= l.h + (l.spaceAfter ?? 0)
  }
  return total
}

export async function run({ inputs }, { progress, platform }) {
  const outputs = []
  let pages = 0
  for (const [i, input] of inputs.entries()) {
    progress(5 + (88 * i) / inputs.length, inputs.length > 1 ? `${i + 1} / ${inputs.length}: ${input.name}` : 'Slaydlar chizilmoqda')
    const res = await toPdf(input, platform)
    pages += res.pages
    outputs.push({ name: `${baseName(input.name)}.pdf`, data: res.data })
  }
  return { outputs, summary: { files: outputs.length, pages } }
}
