// What the Elements panel offers, by category. Each item makes the element(s) it adds to the
// page — `make(theme)` → element objects without ids (positions in % of the page).
import { t } from '../../i18n/index.js'
import { ART, artRatio } from './art.jsx'
import { DEVICES } from './render.jsx'
import { ICON_GROUPS, iconWords } from './icons.js'

/** Size for a visual aspect ratio (width / height) on the 16:9 page. */
export const box = (w, ratio = 1) => ({ w, h: Math.round(((w * 16) / 9 / ratio) * 100) / 100 })

const list = (key) => t(key).split('|')

export const CATEGORIES = ['shapes', 'lines', 'graphics', 'icons', 'photos', 'frames', 'grids', 'tables', 'charts', 'mockups', 'animations', 'stickers']

/* ───────── shapes ───────── */

const SHAPES = [
  ['square', { kind: 'rect', radius: 0 }, 1, 'square box rectangle'],
  ['rounded', { kind: 'rect', radius: '2cqw' }, 1, 'rounded square'],
  ['circle', { kind: 'circle' }, 1, 'circle round'],
  ['triangle', null, 1.1, 'triangle'],
  ['rtriangle', null, 1, 'right triangle'],
  ['diamond', null, 1, 'diamond rhombus'],
  ['pentagon', null, 1.05, 'pentagon'],
  ['hexagon', null, 1.15, 'hexagon'],
  ['octagon', null, 1, 'octagon'],
  ['parallelogram', null, 1.5, 'parallelogram'],
  ['trapezoid', null, 1.5, 'trapezoid'],
  ['cross', null, 1, 'cross plus'],
  ['ring', null, 1, 'ring donut'],
  ['arch', null, 0.8, 'arch'],
  ['semicircle', null, 2, 'semicircle half'],
  ['quarter', null, 1, 'quarter circle'],
  ['pill', { kind: 'rect', radius: '100cqw' }, 2.4, 'pill capsule button'],
  ['heart', null, 1.1, 'heart love'],
  ['star5', null, 1.05, 'star'],
  ['star6', null, 1, 'star six'],
  ['sparkle', null, 1, 'sparkle star shine'],
  ['burst', null, 1, 'burst badge sale'],
  ['seal', null, 1, 'seal badge stamp'],
  ['flower', null, 1, 'flower scallop'],
  ['drop', null, 0.8, 'drop water'],
  ['leaf', null, 1, 'leaf'],
  ['moon', null, 1, 'moon crescent'],
  ['cloud', null, 1.3, 'cloud'],
  ['blob1', null, 1, 'blob organic'],
  ['blob2', null, 1, 'blob organic'],
  ['shield', null, 0.85, 'shield security'],
  ['bolt', null, 0.8, 'lightning bolt'],
]

const ARROWS = [
  ['arrowR', 2, 'arrow right'],
  ['arrowL', 2, 'arrow left'],
  ['arrowUp', 0.7, 'arrow up'],
  ['arrowLR', 2.2, 'arrow double'],
  ['chevron', 1.4, 'chevron step'],
  ['tag', 2, 'tag label pentagon'],
  ['bubble', 1.3, 'speech bubble'],
  ['bubbleRound', 1.3, 'speech bubble chat'],
]

const OUTLINES = [
  ['square', 1], ['ellipse', 1], ['triangle', 1.1], ['diamond', 1], ['hexagon', 1.15], ['star5', 1.05], ['heart', 1.1], ['bubble', 1.3],
]

const shapeItem = (id, base, ratio, words, group) => ({
  id: `shape:${id}`,
  cat: 'shapes',
  group,
  name: () => t(`el.s.${id}`),
  words,
  make: () => [{ ...(base ?? { kind: 'shape', shape: id }), ...box(id === 'pill' ? 20 : 15, ratio) }],
})

const shapeItems = [
  ...SHAPES.map(([id, base, ratio, words]) => shapeItem(id, base, ratio, words, 'basic')),
  ...ARROWS.map(([id, ratio, words]) => shapeItem(id, null, ratio, words, 'arrows')),
  ...OUTLINES.map(([id, ratio]) => ({
    id: `outline:${id}`,
    cat: 'shapes',
    group: 'outline',
    name: () => t('el.s.outlined', { name: t(`el.s.${id}`) }),
    words: `${id} outline border`,
    make: () => [{ kind: 'shape', shape: id, outline: true, sw: 0.35, ...box(15, ratio) }],
  })),
]

/* ───────── lines ───────── */

const LINES = [
  ['line', {}],
  ['dashed', { dash: 'dashed' }],
  ['dotted', { dash: 'dotted', thick: 0.4 }],
  ['arrow', { end: 'arrow' }],
  ['arrowTri', { end: 'triangle' }],
  ['double', { start: 'arrow', end: 'arrow' }],
  ['dashedArrow', { dash: 'dashed', end: 'triangle' }],
  ['dots', { start: 'circle', end: 'circle' }],
  ['measure', { start: 'bar', end: 'bar', thick: 0.2 }],
  ['thick', { thick: 0.9 }],
]

const lineItems = LINES.map(([id, opts]) => ({
  id: `line:${id}`,
  cat: 'lines',
  name: () => t(`el.l.${id}`),
  words: `line ${id} arrow`,
  make: () => [{ kind: 'stroke', dash: 'solid', start: 'none', end: 'none', thick: 0.3, w: 30, h: 6, ...opts }],
}))

/* ───────── graphics & stickers ───────── */

const artItem = (id, extra = {}) => {
  const r = artRatio(id)
  const g = ART[id].group
  const w = r >= 2 ? 28 : g === 'stickers' ? 11 : g === 'objects' ? 14 : 18
  return {
    id: `art:${id}${extra.loop ? `:${extra.loop}` : ''}`,
    cat: extra.loop ? 'animations' : g === 'stickers' ? 'stickers' : 'graphics',
    group: g,
    name: () => t(`el.g.${id}`),
    words: id.replace(/^[ds]([A-Z])/, '$1').toLowerCase(),
    make: () => [{ kind: 'graphic', g: id, ...box(w, r), ...extra }],
  }
}

const graphicItems = Object.keys(ART)
  .filter((id) => ART[id].group === 'decor' || ART[id].group === 'objects')
  .map((id) => artItem(id))
const stickerItems = Object.keys(ART)
  .filter((id) => ART[id].group === 'stickers')
  .map((id) => artItem(id))

/* ───────── icons ───────── */

const iconItems = ICON_GROUPS.flatMap((g) =>
  g.names.map((name) => ({
    id: `icon:${name}`,
    cat: 'icons',
    group: g.id,
    icon: name,
    name: () => iconWords(name),
    words: `${iconWords(name)} icon`,
    make: (theme, opts = {}) => [{ kind: 'icon', icon: name, weight: opts.weight ?? 'regular', ...(opts.weight === 'duotone' ? { color: theme.accent } : {}), ...box(8) }],
  })),
)

/* ───────── frames ───────── */

const FRAMES = [
  ['ellipse', 'circle', 1], ['rounded', 'rounded', 1], ['squircle', 'squircle', 1], ['arch', 'arch', 0.78], ['archDouble', 'archDouble', 0.78],
  ['pill', 'pill', 0.62], ['blob1', 'blob1', 1], ['blob2', 'blob2', 1], ['blob3', 'blob3', 1], ['heart', 'heart', 1.1], ['star5', 'star5', 1.05],
  ['hexagon', 'hexagon', 1.15], ['diamond', 'diamond', 1], ['flower', 'flower', 1], ['seal', 'seal', 1], ['drop', 'drop', 0.8], ['leaf', 'leaf', 1],
]

const frameItems = [
  ...FRAMES.map(([mask, name, ratio]) => ({
    id: `frame:${mask}`,
    cat: 'frames',
    name: () => t(`el.s.${name}`),
    words: `frame photo ${mask}`,
    make: () => [{ kind: 'image', src: null, mask, fit: 'cover', ...box(20, ratio) }],
  })),
  {
    id: 'frame:polaroid',
    cat: 'frames',
    name: () => t('el.f.polaroid'),
    words: 'polaroid photo frame',
    make: () => [{ kind: 'image', src: null, frame: 'polaroid', fit: 'cover', ...box(18, 0.84) }],
  },
  {
    id: 'frame:plain',
    cat: 'frames',
    name: () => t('el.f.plain'),
    words: 'photo frame rectangle',
    make: () => [{ kind: 'image', src: null, fit: 'cover', radius: 0, ...box(28, 4 / 3) }],
  },
]

/* ───────── grids (collages) ───────── */

const T = 1 / 3
export const GRIDS = {
  full: [[0, 0, 1, 1]],
  halvesV: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  halvesH: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  thirds: [[0, 0, T, 1], [T, 0, T, 1], [2 * T, 0, T, 1]],
  bigLeft: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]],
  bigTop: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]],
  quad: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  sideStack: [[0, 0, 0.5, 1], [0.5, 0, 0.5, T], [0.5, T, 0.5, T], [0.5, 2 * T, 0.5, T]],
  strip4: [[0, 0, 0.25, 1], [0.25, 0, 0.25, 1], [0.5, 0, 0.25, 1], [0.75, 0, 0.25, 1]],
  six: [[0, 0, T, 0.5], [T, 0, T, 0.5], [2 * T, 0, T, 0.5], [0, 0.5, T, 0.5], [T, 0.5, T, 0.5], [2 * T, 0.5, T, 0.5]],
  mosaic: [[0, 0, 0.4, 0.6], [0, 0.6, 0.4, 0.4], [0.4, 0, 0.6, 0.4], [0.4, 0.4, 0.3, 0.6], [0.7, 0.4, 0.3, 0.6]],
  framed: [[0.06, 0.1, 0.88, 0.8]],
}

/** Cells of a grid in % of the page, with an even gap (gap in % of the page width). */
export function gridRects(id, gap = 1) {
  const gx = gap
  const gy = (gap * 16) / 9
  const r2 = (v) => Math.round(v * 100) / 100
  return GRIDS[id].map(([x, y, w, h]) => {
    const l = x * 100 + (x > 0.001 ? gx / 2 : 0)
    const r = (x + w) * 100 - (x + w < 0.999 ? gx / 2 : 0)
    const tp = y * 100 + (y > 0.001 ? gy / 2 : 0)
    const b = (y + h) * 100 - (y + h < 0.999 ? gy / 2 : 0)
    return { x: r2(l), y: r2(tp), w: r2(r - l), h: r2(b - tp) }
  })
}

const gridItems = Object.keys(GRIDS).map((id) => ({
  id: `grid:${id}`,
  cat: 'grids',
  grid: id,
  name: () => t('el.cat.grids'),
  words: `grid collage ${id}`,
  make: () => gridRects(id, id === 'full' || id === 'framed' ? 0 : 1).map((r) => ({ kind: 'image', src: null, fit: 'cover', radius: 0, ...r })),
}))

/* ───────── tables ───────── */

const blank = (n) => Array.from({ length: n }, () => '')

const TABLES = {
  basic: () => ({ tstyle: 'grid', rows: [list('el.t.basicHead'), blank(3), blank(3), blank(3)] }),
  header: () => {
    const first = list('el.t.money')
    const nums = [['120', '135', '150'], ['80', '90', '95'], ['40', '45', '55']]
    return { tstyle: 'header', firstCol: true, rows: [list('el.t.quarters'), ...first.map((l, i) => [l, ...nums[i]])] }
  },
  zebra: () => ({ tstyle: 'zebra', rows: [list('el.t.rankHead'), ...[1, 2, 3, 4, 5].map((n) => [String(n), '', ''])] }),
  lines: () => ({ tstyle: 'lines', firstCol: true, rows: [list('el.t.paramHead'), blank(2), blank(2), blank(2), blank(2)] }),
  compare: () => ({
    tstyle: 'header',
    firstCol: true,
    rows: [list('el.t.compareHead'), [t('el.t.feature', { n: 1 }), '✓', '✓'], [t('el.t.feature', { n: 2 }), '—', '✓'], [t('el.t.feature', { n: 3 }), '—', '✓']],
  }),
  schedule: () => ({ tstyle: 'grid', firstCol: true, rows: [list('el.t.week'), ...['09:00', '10:30', '12:00', '14:00'].map((h) => [h, ...blank(5)])] }),
  minimal: () => ({ tstyle: 'minimal', rows: [list('el.t.basicHead'), blank(3), blank(3), blank(3)] }),
}

const tableItems = Object.entries(TABLES).map(([id, make]) => ({
  id: `table:${id}`,
  cat: 'tables',
  name: () => t(`el.t.${id}`),
  words: `table ${id}`,
  make: () => {
    const spec = make()
    const cols = spec.rows[0].length
    return [{ kind: 'table', size: cols > 4 ? 1.15 : 1.3, head: true, w: cols > 4 ? 60 : 46, h: Math.min(70, spec.rows.length * 7.2), ...spec }]
  },
}))

/* ───────── charts ───────── */

const months = (n) => list('el.c.months').slice(0, n)

const CHARTS = {
  column: () => ({ data: { labels: months(6), series: [{ name: '2025', values: [12, 19, 15, 24, 22, 30] }, { name: '2026', values: [18, 24, 21, 30, 28, 36] }] }, ...box(40, 1.6) }),
  bar: () => ({ values: true, data: { labels: list('el.c.items'), series: [{ name: t('el.c.series', { n: 1 }), values: [42, 35, 28, 19] }] }, ...box(40, 1.6) }),
  stacked: () => ({
    data: { labels: months(4), series: [{ name: 'A', values: [10, 14, 12, 18] }, { name: 'B', values: [8, 9, 12, 11] }, { name: 'C', values: [5, 7, 6, 9] }] },
    ...box(40, 1.6),
  }),
  line: () => ({ smooth: true, data: { labels: months(6), series: [{ name: '2025', values: [20, 28, 24, 36, 32, 44] }, { name: '2026', values: [26, 32, 38, 40, 48, 56] }] }, ...box(40, 1.6) }),
  area: () => ({ smooth: true, data: { labels: months(6), series: [{ name: t('el.c.series', { n: 1 }), values: [14, 22, 18, 30, 26, 38] }] }, ...box(40, 1.6) }),
  pie: () => ({ data: { labels: list('el.c.items'), series: [{ name: t('el.c.series', { n: 1 }), values: [40, 25, 20, 15] }] }, ...box(34, 1.5) }),
  donut: () => ({ data: { labels: list('el.c.items'), series: [{ name: t('el.c.series', { n: 1 }), values: [45, 30, 25] }] }, ...box(34, 1.5) }),
  progress: () => ({ data: { labels: [t('el.c.done')], series: [{ name: '', values: [72] }] }, ...box(16, 1) }),
  meter: () => ({ multi: true, data: { labels: list('el.c.skills'), series: [{ name: '', values: [85, 70, 55, 40] }] }, ...box(34, 1.35) }),
}

const chartItems = Object.entries(CHARTS).map(([id, make]) => ({
  id: `chart:${id}`,
  cat: 'charts',
  name: () => t(`el.c.${id}`),
  words: `chart graph ${id} diagram`,
  make: () => {
    const spec = make()
    if (id === 'donut') spec.data.labels = spec.data.labels.slice(0, 3)
    return [{ kind: 'chart', chart: id, ...spec }]
  },
}))

/* ───────── mockups ───────── */

const MOCKUPS = [
  ['phone', 13],
  ['tablet', 18],
  ['laptop', 42],
  ['browser', 40],
  ['monitor', 36],
]

const mockupItems = MOCKUPS.map(([device, w]) => ({
  id: `mockup:${device}`,
  cat: 'mockups',
  name: () => t(`el.m.${device}`),
  words: `mockup device ${device}`,
  make: () => [{ kind: 'mockup', device, src: null, ...box(w, DEVICES[device].vb[0] / DEVICES[device].vb[1]) }],
}))

/* ───────── animations ───────── */

const ANIMATED = [
  ['sparkles', 'twinkle'], ['rocket', 'float'], ['sHeart', 'pulse'], ['sun', 'spin'], ['dCheck', 'draw'], ['ring', 'draw'], ['dUnderline', 'draw'],
  ['dCurl', 'draw'], ['loader', 'dots'], ['bars', 'dots'], ['megaphone', 'wiggle'], ['sStar', 'bounce'], ['badge', 'spin'], ['sFire', 'pulse'],
  ['pin', 'bounce'], ['dBang', 'wiggle'], ['bulb', 'pulse'], ['confetti', 'float'], ['dSparkle', 'twinkle'], ['trophy', 'swing'],
]

const animationItems = [
  ...ANIMATED.map(([id, loop]) => artItem(id, { loop })),
  ...[['Bell', 'swing'], ['Heart', 'pulse'], ['Star', 'spin'], ['ArrowDown', 'bounce']].map(([icon, loop]) => ({
    id: `icon:${icon}:${loop}`,
    cat: 'animations',
    name: () => iconWords(icon),
    words: `${iconWords(icon)} animated`,
    make: (theme) => [{ kind: 'icon', icon, weight: 'duotone', color: theme.accent, loop, ...box(9) }],
  })),
]

/* ───────── all ───────── */

export const ITEMS = [
  ...shapeItems,
  ...lineItems,
  ...graphicItems,
  ...iconItems,
  ...frameItems,
  ...gridItems,
  ...tableItems,
  ...chartItems,
  ...mockupItems,
  ...animationItems,
  ...stickerItems,
]

export const ITEM_BY_ID = new Map(ITEMS.map((it) => [it.id, it]))

/** Sub-sections of a category (null = one flat list). */
export const GROUPS = {
  shapes: ['basic', 'arrows', 'outline'],
  graphics: ['objects', 'decor'],
  icons: ICON_GROUPS.map((g) => g.id),
}

/** Search text: lower-case, Uzbek letters folded so "şakl", "shakl" and "sakl" all match. */
export function fold(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ'‘’`]/g, '')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
}

/** Items matching a query, best first. */
export function searchItems(q) {
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits = []
  for (const it of ITEMS) {
    const name = fold(it.name())
    const hay = `${name} ${fold(it.words)} ${fold(t(`el.cat.${it.cat}`))} ${it.group ? fold(t(`el.grp.${it.group}`)) : ''}`
    if (!words.every((w) => hay.includes(w))) continue
    hits.push({ it, score: words.every((w) => name.includes(w)) ? 0 : 1 })
  }
  return hits.sort((a, b) => a.score - b.score).map((h) => h.it)
}
