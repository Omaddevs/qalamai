// The design-system collection: forty presentation designs for business, study, research, creative
// work, technology and industries. With the ten premium decks (templates.js) they make the fifty.
// Each one is a full design system, not a palette swap:
//   palette + font pairing (catalog fonts that draw Ö Ğ Ş Ç and Cyrillic) + type scale,
//   skin tokens (studio.css: cards, rules, headings, labels, photos),
//   a background composed from the motif library (studioDecor.jsx),
//   its layout family: `pages` (the sample deck) and `prefer` (layouts the AI favours for it).
// Names and cover samples: src/i18n/msg/studio.js.

const sans = (f) => `'${f}', system-ui, sans-serif`
const serif = (f) => `'${f}', Georgia, serif`
const mono = (f) => `'${f}', ui-monospace, monospace`
const MONO = mono('IBM Plex Mono')

const classic = { box: { l: 10, t: 30, w: 80 }, content: { l: 10, t: 14, w: 80 } }
const AREA = { l: 6, t: 14, w: 88, h: 76 }

/**
 * @typedef {{ id: string, cat: string, group: string, pages: string[], prefer: string[], theme: object }} StudioDesign
 * `cat` = library category, `group` = which of the five families it belongs to.
 */
const D = [
  /* ═════════ Business & corporate ═════════ */
  {
    id: 'consult', cat: 'biznes', group: 'business',
    pages: ['title', 'summary', 'kpi', 'matrix', 'table', 'chart:hbar', 'roadmap', 'statement', 'end'],
    prefer: ['summary', 'matrix', 'table', 'kpi', 'chart', 'roadmap', 'statement'],
    theme: {
      bg: '#ffffff', text: '#14213d', muted: '#5c677d', accent: '#0b6e4f', accent2: '#14213d', onAccent: '#ffffff',
      titleFont: serif('Source Serif 4'), bodyFont: sans('Source Sans 3'), titleWeight: 600, titleScale: 1.02,
      card: '#f5f7f9', cardText: '#14213d', cardBorder: 'transparent', radius: 0,
      cover: 'left', frame: 'flat', cardStyle: 'line', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #e3e8ee, #c7d0da)',
      motifs: [['band', { side: 'top', size: '0.9%' }], ['header', { rule: true }], ['footer', { align: 'left', rule: true }]],
    },
  },
  {
    id: 'boldcase', cat: 'biznes', group: 'business',
    pages: ['title', 'statement', 'problem', 'cards', 'matrix', 'bignum', 'process', 'compare', 'end'],
    prefer: ['statement', 'bignum', 'problem', 'matrix', 'process', 'compare'],
    theme: {
      bg: '#ffffff', text: '#0a0a0a', muted: '#55555c', accent: '#ff4d00', accent2: '#0a0a0a', onAccent: '#ffffff',
      titleFont: sans('Rubik'), bodyFont: sans('Inter'), titleWeight: 800, titleScale: 1.12, upper: true,
      card: '#0a0a0a', cardText: '#ffffff', cardBorder: 'transparent', radius: 0,
      cover: 'split', frame: 'flat', cardStyle: 'flat', ruleStyle: 'square', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #ececec, #cfcfcf)',
      motifs: [['band', { side: 'left', size: '1.6%' }], ['bignum', { outline: true, opacity: 0.18, color: 'tx' }], ['header', { mark: 'square' }]],
    },
  },
  {
    id: 'growth', cat: 'biznes', group: 'business',
    pages: ['title', 'agenda', 'chart:area', 'roadmap', 'swot', 'funnel', 'kpi', 'matrix', 'end'],
    prefer: ['roadmap', 'swot', 'chart', 'funnel', 'kpi', 'matrix'],
    theme: {
      bg: '#f4f7f2', text: '#10261b', muted: '#4f6357', accent: '#16a06a', accent2: '#f5a623', onAccent: '#ffffff',
      titleFont: sans('Manrope'), bodyFont: sans('Manrope'), titleWeight: 800, titleScale: 1.04,
      card: '#ffffff', cardText: '#10261b', cardBorder: 'transparent', radius: 1.2,
      cover: 'left', frame: 'round', cardStyle: 'shadow', ruleStyle: 'gradient', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #d9eadf, #b7d3c2)',
      motifs: [['bars', { opacity: 0.12 }], ['dots', { where: 'tr', color: 'acc' }], ['header', { mark: 'dot' }]],
    },
  },
  {
    id: 'investor', cat: 'biznes', group: 'business',
    pages: ['title', 'problem', 'features', 'chart:line', 'bignum', 'funnel', 'pricing', 'team', 'kpi', 'end'],
    prefer: ['problem', 'features', 'bignum', 'chart', 'funnel', 'kpi', 'pricing', 'team', 'roadmap'],
    theme: {
      bg: '#0d0d12', text: '#f5f5f7', muted: 'rgba(235,235,245,.64)', accent: '#8b6cff', accent2: '#00d1b2', onAccent: '#ffffff',
      titleFont: sans('Onest'), bodyFont: sans('Onest'), titleWeight: 800, titleScale: 1.05,
      card: 'rgba(255,255,255,.05)', cardText: '#f5f5f7', cardBorder: 'rgba(255,255,255,.1)', radius: 1.4,
      cover: 'center', center: true, frame: 'glow', cardStyle: 'glass', ruleStyle: 'none', headStyle: 'gradient', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, rgba(139,108,255,.3), rgba(0,209,178,.18))',
      motifs: [['blobs', { opacity: 0.3 }], ['grid', { opacity: 0.05, fade: true, color: 'tx' }], ['header', { mark: 'dot', color: 'mu' }]],
    },
  },
  {
    id: 'product', cat: 'biznes', group: 'business',
    pages: ['title', 'features', 'statement', 'process', 'kpi', 'chart:donut', 'pricing', 'compare', 'end'],
    prefer: ['features', 'process', 'kpi', 'pricing', 'compare', 'chart'],
    theme: {
      bg: '#f7f8fc', text: '#111827', muted: '#556074', accent: '#4f46e5', accent2: '#06b6d4', onAccent: '#ffffff',
      titleFont: sans('Inter'), bodyFont: sans('Inter'), titleWeight: 800, titleScale: 1.02,
      card: '#ffffff', cardText: '#111827', cardBorder: 'rgba(17,24,39,.06)', radius: 1.6,
      cover: 'split', frame: 'glow', cardStyle: 'shadow', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #e0e7ff, #cffafe)',
      motifs: [['glow', { x: '90%', y: '0%', opacity: 0.18 }], ['dots', { where: 'bl', color: 'acc', opacity: 0.35 }], ['header', { mark: 'dot' }]],
    },
  },
  {
    id: 'finance', cat: 'moliya', group: 'business',
    pages: ['title', 'kpi', 'chart', 'table', 'chart:line', 'chart:donut', 'bignum', 'summary', 'end'],
    prefer: ['kpi', 'table', 'chart', 'bignum', 'summary'],
    theme: {
      bg: '#ffffff', text: '#0f1b2d', muted: '#516079', accent: '#1f6feb', accent2: '#0f1b2d', onAccent: '#ffffff',
      titleFont: sans('IBM Plex Sans'), bodyFont: sans('IBM Plex Sans'), titleWeight: 700, titleScale: 0.98,
      card: '#f3f6fa', cardText: '#0f1b2d', cardBorder: 'transparent', radius: 0.3,
      cover: 'left', frame: 'flat', cardStyle: 'line', ruleStyle: 'long', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #dde6f2, #b9c9de)',
      motifs: [['band', { side: 'top', size: '7.5%', color: 'acc2' }], ['header', { mono: true, color: '#ffffff', y: '2.6%' }], ['axis', { opacity: 0.25, when: 'cover' }]],
    },
  },
  {
    id: 'annual', cat: 'moliya', group: 'business',
    pages: ['title', 'statement', 'kpi', 'timeline', 'chart:hbar', 'media', 'quote', 'table', 'end'],
    prefer: ['timeline', 'kpi', 'statement', 'chart', 'table', 'quote'],
    theme: {
      bg: '#fbfaf7', text: '#1c1c1c', muted: '#5f5b55', accent: '#c8102e', accent2: '#8a8178', onAccent: '#ffffff',
      titleFont: serif('Playfair Display'), bodyFont: sans('Source Sans 3'), titleWeight: 700, titleScale: 1.08,
      card: '#f2efe9', cardText: '#1c1c1c', cardBorder: 'transparent', radius: 0,
      cover: 'split', frame: 'flat', cardStyle: 'flat', ruleStyle: 'long', headStyle: 'tight', kickerStyle: 'line',
      placeholder: 'linear-gradient(135deg, #e8e2d8, #cfc5b5)',
      motifs: [['header', { rule: true, mark: 'bar' }], ['bignum', { outline: true, where: 'bl', dx: '5%', dy: '3%', size: 14, opacity: 0.12, color: 'acc' }]],
    },
  },
  {
    id: 'proposal', cat: 'biznes', group: 'business',
    pages: ['title', 'summary', 'features', 'process', 'pricing', 'timeline', 'compare', 'end'],
    prefer: ['summary', 'features', 'process', 'pricing', 'roadmap', 'timeline'],
    theme: {
      bg: '#fffdf8', text: '#1f2a37', muted: '#5b6573', accent: '#b08d57', accent2: '#1f2a37', onAccent: '#ffffff',
      titleFont: serif('Cormorant Garamond'), bodyFont: sans('Mulish'), titleWeight: 600, titleScale: 1.3,
      card: '#ffffff', cardText: '#1f2a37', cardBorder: 'rgba(176,141,87,.5)', radius: 0.2,
      cover: 'left', frame: 'flat', cardStyle: 'outline', ruleStyle: 'double', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #ece3d3, #d2c1a3)',
      motifs: [['band', { side: 'right', size: '34%', color: 'acc2', when: 'cover' }], ['corners', { size: 2.2, opacity: 0.7 }], ['footer', { style: 'dash', align: 'center' }]],
    },
  },

  /* ═════════ Education & academic ═════════ */
  {
    id: 'academic', cat: 'talim', group: 'education',
    pages: ['title', 'agenda', 'media', 'timeline', 'table', 'quote', 'summary', 'end'],
    prefer: ['timeline', 'table', 'summary', 'quote', 'process', 'compare'],
    theme: {
      bg: '#ffffff', text: '#13294b', muted: '#4d5d78', accent: '#8b1e3f', accent2: '#c9a227', onAccent: '#ffffff',
      titleFont: serif('EB Garamond'), bodyFont: sans('Noto Sans'), titleWeight: 600, titleScale: 1.2,
      card: '#f6f4f1', cardText: '#13294b', cardBorder: 'transparent', radius: 0,
      cover: 'center', center: true, frame: 'round', cardStyle: 'left', ruleStyle: 'double', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #e9e4dc, #cbbfae)',
      motifs: [['frame', { inset: 2.6, double: true, opacity: 0.45 }], ['rings', { where: 'tl', dx: '-6%', dy: '-12%', size: 22, n: 3, color: 'acc2', opacity: 0.4 }], ['footer', { style: 'dash', align: 'center', y: '5.4%' }]],
    },
  },
  {
    id: 'research', cat: 'ilmiy', group: 'education',
    pages: ['title', 'agenda', 'process', 'chart:line', 'table', 'pyramid', 'summary', 'matrix', 'end'],
    prefer: ['process', 'chart', 'table', 'summary', 'pyramid', 'compare'],
    theme: {
      bg: '#f7f9fb', text: '#1b2733', muted: '#53616f', accent: '#0077b6', accent2: '#00a896', onAccent: '#ffffff',
      titleFont: serif('Literata'), bodyFont: sans('Noto Sans'), titleWeight: 600, titleScale: 1.02,
      card: '#ffffff', cardText: '#1b2733', cardBorder: 'rgba(27,39,51,.08)', radius: 0.5,
      cover: 'left', frame: 'round', cardStyle: 'flat', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #dceaf3, #b6d3e3)',
      motifs: [['grid', { size: 1.6, opacity: 0.07, fade: true, color: 'acc' }], ['header', { mono: true, rule: true }], ['footer', {}]],
    },
  },
  {
    id: 'conference', cat: 'ilmiy', group: 'education',
    pages: ['title', 'statement', 'process', 'chart:area', 'kpi', 'table', 'summary', 'end'],
    prefer: ['chart', 'process', 'kpi', 'table', 'summary', 'statement'],
    theme: {
      bg: '#0b1d33', text: '#e8f1ff', muted: 'rgba(214,228,250,.7)', accent: '#ffb703', accent2: '#4cc9f0', onAccent: '#0b1d33',
      titleFont: sans('IBM Plex Sans'), bodyFont: sans('IBM Plex Sans'), titleWeight: 700, titleScale: 1.02,
      card: 'rgba(255,255,255,.04)', cardText: '#e8f1ff', cardBorder: 'rgba(76,201,240,.35)', radius: 0.4,
      cover: 'left', frame: 'round', cardStyle: 'outline', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #16365c, #0e2440)',
      motifs: [['orbits', { opacity: 0.3, size: 34, dx: '-11%', dy: '-24%' }], ['dots', { where: 'bl', color: 'acc2', opacity: 0.4 }], ['header', { mono: true, color: 'mu' }]],
    },
  },
  {
    id: 'defense', cat: 'talim', group: 'education',
    pages: ['title', 'agenda', 'problem', 'process', 'table', 'chart', 'summary', 'end'],
    prefer: ['problem', 'process', 'table', 'chart', 'summary', 'statement'],
    theme: {
      bg: '#ffffff', text: '#1d2433', muted: '#5a6375', accent: '#2a6f97', accent2: '#1d2433', onAccent: '#ffffff',
      titleFont: serif('PT Serif'), bodyFont: sans('PT Sans'), titleWeight: 700, titleScale: 1,
      card: '#f2f6f9', cardText: '#1d2433', cardBorder: 'transparent', radius: 0.3,
      cover: 'left', frame: 'round', cardStyle: 'left', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #dbe7ef, #b8cfdd)',
      motifs: [['band', { side: 'left', size: '0.9%' }], ['header', { rule: true }], ['footer', { align: 'right' }]],
    },
  },
  {
    id: 'doctoral', cat: 'ilmiy', group: 'education',
    pages: ['title', 'agenda', 'statement', 'pyramid', 'timeline', 'table', 'summary', 'quote', 'end'],
    prefer: ['statement', 'pyramid', 'timeline', 'table', 'summary', 'compare'],
    theme: {
      bg: '#f5f1e8', text: '#2b2118', muted: '#66584a', accent: '#6b2737', accent2: '#a8875a', onAccent: '#ffffff',
      titleFont: serif('Old Standard TT'), bodyFont: serif('Spectral'), titleWeight: 700, titleScale: 1.04, bodyScale: 1.02,
      card: '#fbf8f1', cardText: '#2b2118', cardBorder: 'rgba(107,39,55,.35)', radius: 0,
      cover: 'center', center: true, frame: 'round', cardStyle: 'outline', ruleStyle: 'double', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #e6dcc8, #c9b593)',
      motifs: [['frame', { inset: 3.4, opacity: 0.5 }], ['corners', { inset: '2.4%', size: 2.6, ornament: true, color: 'acc2' }], ['footer', { style: 'roman', align: 'center', y: '5.6%' }]],
    },
  },
  {
    id: 'medical', cat: 'talim', group: 'education',
    pages: ['title', 'agenda', 'media', 'process', 'pyramid', 'table', 'kpi', 'summary', 'end'],
    prefer: ['process', 'table', 'pyramid', 'compare', 'cards', 'kpi'],
    theme: {
      bg: '#f3fbfb', text: '#0d3b45', muted: '#4b6b72', accent: '#00a3a1', accent2: '#e5484d', onAccent: '#ffffff',
      titleFont: sans('Nunito Sans'), bodyFont: sans('Nunito Sans'), titleWeight: 800, titleScale: 1.02,
      card: '#ffffff', cardText: '#0d3b45', cardBorder: 'transparent', radius: 1.4,
      cover: 'split', frame: 'round', cardStyle: 'shadow', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #d4f0ef, #a9dedc)',
      motifs: [['plus', { opacity: 0.45 }], ['wave', { h: '11%', opacity: 0.5 }], ['header', { mark: 'dot' }]],
    },
  },
  {
    id: 'scholar', cat: 'talim', group: 'education',
    pages: ['title', 'statement', 'content', 'timeline', 'table', 'quote', 'summary', 'end'],
    prefer: ['statement', 'table', 'timeline', 'quote', 'summary'],
    theme: {
      bg: '#fafafa', text: '#222222', muted: '#6a6a6a', accent: '#222222', accent2: '#9a9a9a', onAccent: '#ffffff',
      titleFont: serif('Source Serif 4'), bodyFont: sans('Source Sans 3'), titleWeight: 500, titleScale: 1.06,
      card: '#fafafa', cardText: '#222222', cardBorder: 'transparent', radius: 0,
      cover: 'left', frame: 'flat', cardStyle: 'line', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #e8e8e8, #cfcfcf)',
      motifs: [['footer', { align: 'left', rule: true }]],
    },
  },

  /* ═════════ Creative & editorial ═════════ */
  {
    id: 'swiss', cat: 'ijod', group: 'creative',
    pages: ['title', 'statement', 'media', 'bignum', 'cards', 'timeline', 'quote', 'end'],
    prefer: ['statement', 'bignum', 'media', 'timeline', 'quote'],
    theme: {
      bg: '#ffffff', text: '#000000', muted: '#5c5c5c', accent: '#ff2a00', accent2: '#000000', onAccent: '#ffffff',
      titleFont: sans('Inter'), bodyFont: sans('Inter'), titleWeight: 800, titleScale: 1.2,
      card: '#ffffff', cardText: '#000000', cardBorder: 'transparent', radius: 0,
      cover: 'left', frame: 'flat', cardStyle: 'line', ruleStyle: 'square', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #eeeeee, #d4d4d4)',
      area: { l: 6, t: 22, w: 88, h: 70 },
      motifs: [['columns', { n: 12, opacity: 0.08 }], ['bignum', { where: 'tr', dx: '5.5%', dy: '3.5%', size: 9, opacity: 1, color: 'acc' }], ['header', { noNum: true }]],
    },
  },
  {
    id: 'typeset', cat: 'ijod', group: 'creative',
    pages: ['title', 'statement', 'bignum', 'cards', 'quote', 'compare', 'end'],
    prefer: ['statement', 'bignum', 'quote', 'compare'],
    theme: {
      bg: '#f2efe6', text: '#111111', muted: '#55524a', accent: '#3a2cff', accent2: '#111111', onAccent: '#ffffff',
      titleFont: sans('Unbounded'), bodyFont: sans('Jost'), titleWeight: 800, titleScale: 1.12, titleWidth: 1.35,
      card: '#ebe7dc', cardText: '#111111', cardBorder: 'transparent', radius: 0,
      cover: 'center', center: true, frame: 'flat', cardStyle: 'flat', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #e2ddd0, #c8c1b0)',
      motifs: [['bignum', { where: 'bl', dx: '-2%', dy: '-6%', size: 46, outline: true, opacity: 0.16, color: 'acc' }], ['footer', { align: 'right' }]],
    },
  },
  {
    id: 'brutal', cat: 'ijod', group: 'creative',
    pages: ['title', 'statement', 'cards', 'table', 'compare', 'kpi', 'end'],
    prefer: ['statement', 'table', 'compare', 'kpi', 'cards'],
    theme: {
      bg: '#e8e8e3', text: '#000000', muted: '#3d3d3d', accent: '#0047ff', accent2: '#ff3b00', onAccent: '#ffffff',
      titleFont: sans('Russo One'), bodyFont: mono('IBM Plex Mono'), titleWeight: 400, titleScale: 1.04, titleWidth: 1.15, bodyScale: 0.94, upper: true,
      card: '#ffffff', cardText: '#000000', cardBorder: '#000000', radius: 0,
      cover: 'left', frame: 'flat', cardStyle: 'brutal', ruleStyle: 'square', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'repeating-linear-gradient(45deg, #d6d6d0 0 0.6cqw, #e8e8e3 0.6cqw 1.2cqw)',
      motifs: [['band', { side: 'top', size: '1.4%', color: 'tx' }], ['crosshair', {}], ['header', { mono: true, y: '5.4%' }]],
    },
  },
  {
    id: 'artdir', cat: 'ijod', group: 'creative',
    pages: ['title', 'photo', 'statement', 'gallery', 'media', 'quote', 'end'],
    prefer: ['photo', 'gallery', 'media', 'statement', 'quote'],
    theme: {
      bg: '#1a1a1a', text: '#f2f2f2', muted: 'rgba(242,242,242,.64)', accent: '#ff6f61', accent2: '#ffd166', onAccent: '#1a1a1a',
      titleFont: sans('Tenor Sans'), bodyFont: sans('Jost'), titleWeight: 400, titleScale: 1.18,
      card: 'rgba(255,255,255,.05)', cardText: '#f2f2f2', cardBorder: 'transparent', radius: 0,
      cover: 'split', frame: 'flat', cardStyle: 'flat', ruleStyle: 'long', headStyle: 'wide', kickerStyle: 'plain', photoStyle: 'film',
      placeholder: 'linear-gradient(135deg, #2c2c2c, #1f1f1f)',
      motifs: [['shapes', { opacity: 0.85 }], ['strip', { side: 'left' }]],
    },
  },
  {
    id: 'cinema', cat: 'ijod', group: 'creative',
    pages: ['title', 'photo', 'chapter', 'statement', 'timeline', 'quote', 'end'],
    prefer: ['photo', 'chapter', 'statement', 'timeline', 'quote'],
    theme: {
      bg: '#050505', text: '#ffffff', muted: 'rgba(255,255,255,.62)', accent: '#d4a017', accent2: '#8a8a8a', onAccent: '#050505',
      titleFont: sans('Oswald'), bodyFont: sans('Inter'), titleWeight: 500, titleScale: 1.16, upper: true,
      card: 'rgba(255,255,255,.04)', cardText: '#ffffff', cardBorder: 'rgba(212,160,23,.4)', radius: 0,
      cover: 'bg', center: true, frame: 'flat', cardStyle: 'outline', ruleStyle: 'long', headStyle: 'wide', kickerStyle: 'plain', photoStyle: 'film',
      placeholder: 'linear-gradient(135deg, #1c1c1c, #0b0b0b)',
      motifs: [['letterbox', { h: '7%' }], ['footer', { style: 'dash', align: 'center', y: '1.8%', color: 'acc' }]],
    },
  },
  {
    id: 'mono', cat: 'ijod', group: 'creative',
    pages: ['title', 'statement', 'media', 'cards', 'quote', 'compare', 'end'],
    prefer: ['statement', 'media', 'quote', 'compare'],
    theme: {
      bg: '#ffffff', text: '#000000', muted: '#5e5e5e', accent: '#000000', accent2: '#000000', onAccent: '#ffffff',
      titleFont: sans('Manrope'), bodyFont: sans('Manrope'), titleWeight: 300, titleScale: 1.2,
      card: '#ffffff', cardText: '#000000', cardBorder: '#000000', radius: 0,
      cover: 'left', frame: 'flat', cardStyle: 'outline', ruleStyle: 'long', headStyle: 'light', kickerStyle: 'plain', photoStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #ededed, #cfcfcf)',
      alt: { bg: '#000000', text: '#ffffff', muted: 'rgba(255,255,255,.6)', accent: '#ffffff', accent2: '#ffffff', onAccent: '#000000', card: '#000000', cardText: '#ffffff', cardBorder: '#ffffff', placeholder: 'linear-gradient(135deg, #222, #111)' },
      motifs: [['frame', { inset: 2.4, color: 'tx', opacity: 0.9, w: 0.06 }], ['footer', { align: 'right', color: 'tx' }]],
    },
  },
  {
    id: 'fashion', cat: 'ijod', group: 'creative',
    pages: ['title', 'photo', 'gallery', 'media', 'quote', 'statement', 'end'],
    prefer: ['photo', 'gallery', 'media', 'quote'],
    theme: {
      bg: '#f6efe9', text: '#1b1b1b', muted: '#6d625b', accent: '#9d6b53', accent2: '#1b1b1b', onAccent: '#ffffff',
      titleFont: serif('Cormorant'), bodyFont: sans('Jost'), titleWeight: 500, titleScale: 1.42,
      card: '#efe6dd', cardText: '#1b1b1b', cardBorder: 'transparent', radius: 0,
      cover: 'split', frame: 'tall', cardStyle: 'flat', ruleStyle: 'long', headStyle: 'italic', kickerStyle: 'plain', photoStyle: 'warm',
      placeholder: 'linear-gradient(160deg, #e6d6c8, #c9ad98)',
      motifs: [['strip', { side: 'right', color: 'acc' }], ['header', { noNum: true, rule: true }], ['footer', { align: 'left' }]],
    },
  },
  {
    id: 'folio', cat: 'ijod', group: 'creative',
    pages: ['title', 'gallery', 'features', 'kpi', 'statement', 'team', 'end'],
    prefer: ['gallery', 'features', 'kpi', 'team', 'statement'],
    theme: {
      bg: '#111111', text: '#ffffff', muted: 'rgba(255,255,255,.65)', accent: '#ffe600', accent2: '#ff4fd8', onAccent: '#111111',
      titleFont: sans('Rubik'), bodyFont: sans('Rubik'), titleWeight: 800, titleScale: 1.12,
      card: '#1d1d1d', cardText: '#ffffff', cardBorder: 'transparent', radius: 2,
      cover: 'center', center: true, frame: 'round', cardStyle: 'flat', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
      motifs: [['stickers', { opacity: 0.95 }], ['header', { mark: 'dot', color: 'mu' }]],
    },
  },

  /* ═════════ Technology & AI ═════════ */
  {
    id: 'ai', cat: 'texno', group: 'tech',
    pages: ['title', 'statement', 'features', 'process', 'chart:line', 'kpi', 'roadmap', 'end'],
    prefer: ['features', 'process', 'chart', 'kpi', 'roadmap', 'statement'],
    theme: {
      bg: '#070b18', text: '#e6ecff', muted: 'rgba(214,224,255,.66)', accent: '#7aa2ff', accent2: '#c084fc', onAccent: '#070b18',
      titleFont: sans('Golos Text'), bodyFont: sans('Golos Text'), titleWeight: 700, titleScale: 1.04,
      card: 'rgba(122,162,255,.06)', cardText: '#e6ecff', cardBorder: 'rgba(122,162,255,.22)', radius: 1.2,
      cover: 'left', frame: 'glow', cardStyle: 'glass', ruleStyle: 'gradient', headStyle: 'gradient', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, rgba(122,162,255,.25), rgba(192,132,252,.2))',
      motifs: [['glow', { x: '85%', y: '20%', opacity: 0.2, color: 'acc2' }], ['net', { opacity: 0.5 }], ['header', { mono: true, color: 'mu' }]],
    },
  },
  {
    id: 'darkcode', cat: 'texno', group: 'tech',
    pages: ['title', 'process', 'table', 'features', 'compare', 'kpi', 'end'],
    prefer: ['process', 'table', 'features', 'compare', 'kpi'],
    theme: {
      bg: '#0d1117', text: '#e6edf3', muted: 'rgba(201,209,217,.7)', accent: '#3fb950', accent2: '#58a6ff', onAccent: '#0d1117',
      titleFont: mono('JetBrains Mono'), bodyFont: sans('Inter'), titleWeight: 700, titleScale: 0.94,
      card: '#161b22', cardText: '#e6edf3', cardBorder: '#30363d', radius: 0.6,
      cover: 'left', frame: 'round', cardStyle: 'outline', ruleStyle: 'dash', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #1b2230, #11161f)',
      motifs: [['scan', { opacity: 0.04 }], ['window', {}], ['footer', { align: 'right', color: 'acc' }]],
    },
  },
  {
    id: 'quantum', cat: 'ilmiy', group: 'tech',
    pages: ['title', 'statement', 'pyramid', 'process', 'chart:area', 'matrix', 'end'],
    prefer: ['pyramid', 'process', 'chart', 'matrix', 'statement'],
    theme: {
      bg: 'radial-gradient(ellipse at 70% 20%, #1c0b3a 0%, #090417 55%, #030108 100%)',
      text: '#f0eaff', muted: 'rgba(230,220,255,.66)', accent: '#b388ff', accent2: '#00e5ff', onAccent: '#090417',
      titleFont: sans('Unbounded'), bodyFont: sans('Manrope'), titleWeight: 500, titleScale: 0.9, titleWidth: 1.3,
      card: 'rgba(179,136,255,.06)', cardText: '#f0eaff', cardBorder: 'rgba(179,136,255,.3)', radius: 1.8,
      cover: 'center', center: true, frame: 'oval', cardStyle: 'glass', ruleStyle: 'dot', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'radial-gradient(circle at 30% 30%, #3b1f73, #120832)',
      motifs: [['dots', { where: 'full', color: '#ffffff', opacity: 0.18, gap: 2.2 }], ['orbits', { size: 46, opacity: 0.6 }], ['footer', { style: 'dash', align: 'center', color: 'acc' }]],
    },
  },
  {
    id: 'dataviz', cat: 'texno', group: 'tech',
    pages: ['title', 'kpi', 'chart', 'chart:line', 'chart:donut', 'chart:hbar', 'table', 'funnel', 'end'],
    prefer: ['chart', 'kpi', 'table', 'funnel', 'matrix'],
    theme: {
      bg: '#ffffff', text: '#1e293b', muted: '#5b6880', accent: '#2563eb', accent2: '#f97316', onAccent: '#ffffff',
      palette: ['#2563eb', '#f97316', '#14b8a6', '#a855f7', '#eab308', '#64748b'],
      titleFont: sans('Fira Sans'), bodyFont: sans('Fira Sans'), titleWeight: 700, titleScale: 1,
      card: '#f8fafc', cardText: '#1e293b', cardBorder: '#e2e8f0', radius: 0.8,
      cover: 'left', frame: 'round', cardStyle: 'flat', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
      motifs: [['grid', { size: 3, opacity: 0.05, color: 'tx' }], ['axis', { opacity: 0.4, when: 'cover' }], ['header', { mark: 'square' }]],
    },
  },
  {
    id: 'launch', cat: 'texno', group: 'tech',
    pages: ['title', 'statement', 'features', 'process', 'pricing', 'kpi', 'roadmap', 'end'],
    prefer: ['features', 'pricing', 'roadmap', 'kpi', 'process'],
    theme: {
      bg: 'linear-gradient(150deg, #0f0c29 0%, #24204f 55%, #302b63 100%)',
      text: '#ffffff', muted: 'rgba(235,233,255,.7)', accent: '#ff7a59', accent2: '#ffd166', onAccent: '#1a1033',
      titleFont: sans('Raleway'), bodyFont: sans('Raleway'), titleWeight: 800, titleScale: 1.06,
      card: 'rgba(255,255,255,.07)', cardText: '#ffffff', cardBorder: 'rgba(255,255,255,.14)', radius: 1.4,
      cover: 'center', center: true, frame: 'glow', cardStyle: 'glass', ruleStyle: 'gradient', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, rgba(255,122,89,.3), rgba(255,209,102,.2))',
      motifs: [['dots', { where: 'full', color: '#ffffff', opacity: 0.14, gap: 3 }], ['diag', { color: 'acc', opacity: 0.12, when: 'cover' }], ['glow', { x: '50%', y: '110%', opacity: 0.3 }], ['header', { mark: 'dot', color: 'mu' }]],
    },
  },
  {
    id: 'web3', cat: 'texno', group: 'tech',
    pages: ['title', 'statement', 'process', 'table', 'roadmap', 'kpi', 'chart:donut', 'end'],
    prefer: ['process', 'roadmap', 'chart', 'table', 'kpi'],
    theme: {
      bg: '#08080f', text: '#eaeaff', muted: 'rgba(220,220,255,.62)', accent: '#00ffa3', accent2: '#dc1fff', onAccent: '#08080f',
      titleFont: sans('Commissioner'), bodyFont: sans('Commissioner'), titleWeight: 800, titleScale: 1.02,
      card: 'rgba(255,255,255,.03)', cardText: '#eaeaff', cardBorder: 'rgba(0,255,163,.35)', radius: 1,
      cover: 'left', frame: 'glow', cardStyle: 'outline', ruleStyle: 'gradient', headStyle: 'gradient', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, rgba(0,255,163,.18), rgba(220,31,255,.18))',
      motifs: [['hex', { opacity: 0.4 }], ['glow', { x: '0%', y: '100%', color: 'acc2', opacity: 0.22 }], ['header', { mono: true, color: 'mu' }]],
    },
  },
  {
    id: 'robotics', cat: 'texno', group: 'tech',
    pages: ['title', 'process', 'features', 'kpi', 'table', 'roadmap', 'end'],
    prefer: ['process', 'features', 'kpi', 'roadmap', 'table'],
    theme: {
      bg: '#eef1f4', text: '#1b1f24', muted: '#545c66', accent: '#ff6a00', accent2: '#1b1f24', onAccent: '#ffffff',
      titleFont: sans('Russo One'), bodyFont: sans('Roboto'), titleWeight: 400, titleScale: 1, upper: true,
      card: '#ffffff', cardText: '#1b1f24', cardBorder: 'transparent', radius: 0,
      cover: 'left', frame: 'flat', cardStyle: 'notch', ruleStyle: 'square', headStyle: 'tight', kickerStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #dde2e8, #c2c9d2)',
      motifs: [['circuit', { opacity: 0.45 }], ['hazard', { where: 'tl' }], ['header', { mono: true, y: '5.6%' }]],
    },
  },
  {
    id: 'techconf', cat: 'texno', group: 'tech',
    pages: ['title', 'agenda', 'statement', 'team', 'timeline', 'features', 'end'],
    prefer: ['timeline', 'team', 'features', 'statement', 'agenda'],
    theme: {
      bg: '#ffffff', text: '#0b0b0b', muted: '#575757', accent: '#00a6e0', accent2: '#ff2d87', onAccent: '#ffffff',
      titleFont: sans('Ubuntu'), bodyFont: sans('Ubuntu'), titleWeight: 700, titleScale: 1.06,
      card: '#f4f9fc', cardText: '#0b0b0b', cardBorder: 'transparent', radius: 1.4,
      cover: 'left', frame: 'pill', cardStyle: 'tint', ruleStyle: 'gradient', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #d9f1fb, #ffd6e8)',
      motifs: [['blobs', { colors: ['acc', 'acc2'], opacity: 0.28, blur: 6 }], ['stripe', { colors: ['acc', 'acc2'], h: '1%' }], ['header', { mark: 'dot' }]],
    },
  },

  /* ═════════ Specialised industries ═════════ */
  {
    id: 'marketing', cat: 'marketing', group: 'industry',
    pages: ['title', 'funnel', 'swot', 'matrix', 'kpi', 'chart:donut', 'roadmap', 'end'],
    prefer: ['funnel', 'swot', 'matrix', 'kpi', 'chart', 'roadmap'],
    theme: {
      bg: '#fff6f0', text: '#2a1a12', muted: '#6e584c', accent: '#ff5a36', accent2: '#7a3cff', onAccent: '#ffffff',
      titleFont: sans('Wix Madefor Display'), bodyFont: sans('Golos Text'), titleWeight: 800, titleScale: 1.06,
      card: '#ffffff', cardText: '#2a1a12', cardBorder: 'transparent', radius: 1.6,
      cover: 'left', frame: 'round', cardStyle: 'shadow', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #ffe0d3, #e9dcff)',
      motifs: [['disc', { where: 'tr', dx: '-6%', dy: '-14%', size: 26, color: 'acc', opacity: 0.14 }], ['squiggle', {}], ['header', { mark: 'dot' }]],
    },
  },
  {
    id: 'social', cat: 'marketing', group: 'industry',
    pages: ['title', 'kpi', 'gallery', 'chart', 'features', 'statement', 'end'],
    prefer: ['kpi', 'gallery', 'chart', 'features', 'statement'],
    theme: {
      bg: '#fdf2ff', text: '#1f1033', muted: '#5f4d77', accent: '#ff3ea5', accent2: '#00b8f0', onAccent: '#ffffff',
      titleFont: sans('Comfortaa'), bodyFont: sans('Nunito'), titleWeight: 700, titleScale: 1.04,
      card: '#ffffff', cardText: '#1f1033', cardBorder: 'transparent', radius: 2.6,
      cover: 'center', center: true, frame: 'round', cardStyle: 'shadow', ruleStyle: 'dot', headStyle: 'tight', kickerStyle: 'pill', photoStyle: 'vivid',
      placeholder: 'linear-gradient(135deg, #ffd6ec, #d1f3ff)',
      motifs: [['halftone', { where: 'tr', opacity: 0.35 }], ['stickers', { opacity: 0.85 }]],
    },
  },
  {
    id: 'estate', cat: 'soha', group: 'industry',
    pages: ['title', 'photo', 'features', 'gallery', 'table', 'pricing', 'kpi', 'end'],
    prefer: ['photo', 'features', 'gallery', 'table', 'pricing'],
    theme: {
      bg: '#f7f5f2', text: '#1e2a2f', muted: '#5f6a6e', accent: '#b8875b', accent2: '#1e2a2f', onAccent: '#ffffff',
      titleFont: serif('Forum'), bodyFont: sans('Mulish'), titleWeight: 400, titleScale: 1.3,
      card: '#ffffff', cardText: '#1e2a2f', cardBorder: 'rgba(184,135,91,.35)', radius: 0.2,
      cover: 'split', frame: 'arch', cardStyle: 'outline', ruleStyle: 'long', headStyle: 'wide', kickerStyle: 'plain', photoStyle: 'warm',
      placeholder: 'linear-gradient(160deg, #e7dccd, #c7b298)',
      motifs: [['arches', { opacity: 0.35 }], ['header', { rule: true, noNum: true }], ['footer', { align: 'left' }]],
    },
  },
  {
    id: 'health', cat: 'soha', group: 'industry',
    pages: ['title', 'statement', 'process', 'kpi', 'features', 'chart:line', 'end'],
    prefer: ['process', 'kpi', 'features', 'chart', 'statement'],
    theme: {
      bg: '#ffffff', text: '#0b2e4f', muted: '#526a80', accent: '#1aa179', accent2: '#2b7de9', onAccent: '#ffffff',
      titleFont: sans('Mulish'), bodyFont: sans('Mulish'), titleWeight: 800, titleScale: 1.02,
      card: '#f1f8f6', cardText: '#0b2e4f', cardBorder: 'transparent', radius: 1.6,
      cover: 'left', frame: 'oval', cardStyle: 'tint', ruleStyle: 'gradient', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #d4efe7, #cfe2fb)',
      motifs: [['wave', { h: '14%', opacity: 0.35 }], ['plus', { x: '95%', y: '5%', opacity: 0.35 }], ['header', { mark: 'dot' }]],
    },
  },
  {
    id: 'archi', cat: 'soha', group: 'industry',
    pages: ['title', 'photo', 'gallery', 'media', 'timeline', 'table', 'end'],
    prefer: ['photo', 'gallery', 'media', 'timeline'],
    theme: {
      bg: '#e9e6e1', text: '#1a1a1a', muted: '#5b5650', accent: '#1a1a1a', accent2: '#9c8f7d', onAccent: '#ffffff',
      titleFont: sans('Didact Gothic'), bodyFont: sans('Didact Gothic'), titleWeight: 400, titleScale: 1.1,
      card: '#e9e6e1', cardText: '#1a1a1a', cardBorder: 'transparent', radius: 0,
      cover: 'split', frame: 'flat', cardStyle: 'line', ruleStyle: 'long', headStyle: 'wide', kickerStyle: 'plain', photoStyle: 'mono',
      placeholder: 'linear-gradient(135deg, #d6d1c9, #b8b0a4)',
      motifs: [['columns', { n: 6, opacity: 0.1 }], ['dims', { opacity: 0.4 }], ['header', { rule: true }]],
    },
  },
  {
    id: 'shop', cat: 'soha', group: 'industry',
    pages: ['title', 'kpi', 'funnel', 'features', 'chart:hbar', 'pricing', 'roadmap', 'end'],
    prefer: ['funnel', 'kpi', 'pricing', 'features', 'chart'],
    theme: {
      bg: '#ffffff', text: '#111111', muted: '#5a5a5a', accent: '#ff6b00', accent2: '#111111', onAccent: '#ffffff',
      titleFont: sans('Montserrat'), bodyFont: sans('Open Sans'), titleWeight: 800, titleScale: 1.02,
      card: '#ffffff', cardText: '#111111', cardBorder: 'transparent', radius: 1.2,
      cover: 'split', frame: 'round', cardStyle: 'shadow', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'pill',
      placeholder: 'linear-gradient(135deg, #ffe6d5, #f1f1f1)',
      motifs: [['disc', { where: 'br', dx: '-5%', dy: '-10%', size: 22, color: 'acc', opacity: 0.1 }], ['dots', { where: 'tr', color: 'tx', opacity: 0.18 }], ['header', { mark: 'square' }]],
    },
  },
  {
    id: 'travel', cat: 'soha', group: 'industry',
    pages: ['title', 'photo', 'gallery', 'timeline', 'media', 'features', 'end'],
    prefer: ['photo', 'gallery', 'timeline', 'media', 'features'],
    theme: {
      bg: '#fff8ef', text: '#13324b', muted: '#56697a', accent: '#ff8a3d', accent2: '#1aa6b7', onAccent: '#ffffff',
      titleFont: serif('Merriweather'), bodyFont: sans('Nunito Sans'), titleWeight: 800, titleScale: 0.98,
      card: '#ffffff', cardText: '#13324b', cardBorder: 'transparent', radius: 1.2,
      cover: 'split', frame: 'polaroid', cardStyle: 'shadow', ruleStyle: 'dash', headStyle: 'tight', kickerStyle: 'plain', photoStyle: 'vivid',
      placeholder: 'linear-gradient(160deg, #ffe1c7, #bfe9ee)',
      motifs: [['disc', { where: 'tr', size: 7, color: 'acc', opacity: 0.85, when: 'cover' }], ['route', { opacity: 0.55 }], ['wave', { h: '8%', opacity: 0.25 }]],
    },
  },
  {
    id: 'civic', cat: 'soha', group: 'industry',
    pages: ['title', 'agenda', 'statement', 'kpi', 'timeline', 'roadmap', 'table', 'end'],
    prefer: ['kpi', 'timeline', 'roadmap', 'table', 'statement'],
    theme: {
      bg: '#ffffff', text: '#0a2342', muted: '#4e6079', accent: '#0a2342', accent2: '#c1272d', onAccent: '#ffffff',
      titleFont: serif('Noto Serif'), bodyFont: sans('Noto Sans'), titleWeight: 700, titleScale: 1,
      card: '#f3f5f8', cardText: '#0a2342', cardBorder: 'transparent', radius: 0.2,
      cover: 'left', frame: 'round', cardStyle: 'left', ruleStyle: 'bar', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #dfe5ee, #bcc8d8)',
      motifs: [['stripe', { colors: ['acc', '#ffffff', 'acc2'], h: '1.4%' }], ['rings', { where: 'br', dx: '-6%', dy: '-16%', size: 30, n: 3, color: 'acc', opacity: 0.18 }], ['header', { rule: true, y: '5.4%' }]],
    },
  },
  {
    id: 'brandup', cat: 'marketing', group: 'industry',
    pages: ['title', 'statement', 'bignum', 'features', 'photo', 'kpi', 'roadmap', 'end'],
    prefer: ['statement', 'bignum', 'features', 'photo', 'roadmap'],
    theme: {
      bg: '#ffde2e', text: '#111111', muted: '#4a4215', accent: '#111111', accent2: '#ff3d00', onAccent: '#ffde2e',
      titleFont: sans('Dela Gothic One'), bodyFont: sans('Rubik'), titleWeight: 400, titleScale: 0.98, titleWidth: 1.3,
      card: '#111111', cardText: '#ffde2e', cardBorder: 'transparent', radius: 0.6,
      cover: 'left', frame: 'round', cardStyle: 'flat', ruleStyle: 'none', headStyle: 'tight', kickerStyle: 'plain',
      placeholder: 'linear-gradient(135deg, #f5cf1d, #e0b800)',
      alt: { bg: '#111111', text: '#ffffff', muted: 'rgba(255,255,255,.66)', accent: '#ffde2e', accent2: '#ff3d00', onAccent: '#111111', card: '#ffde2e', cardText: '#111111', placeholder: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)' },
      motifs: [['shapes', { opacity: 1 }], ['header', { mark: 'square' }]],
    },
  },
]

// the motion preset (motion.js) a new deck in each design starts with; it can be changed in «Harakat»
const GROUP_MOTION = { business: 'professional', education: 'minimal', creative: 'cinematic', tech: 'professional', industry: 'professional' }
const MOTION = { swiss: 'minimal', typeset: 'dynamic', brutal: 'minimal', mono: 'minimal', folio: 'dynamic', launch: 'dynamic', web3: 'dynamic', darkcode: 'minimal', quantum: 'cinematic', social: 'dynamic', brandup: 'dynamic', travel: 'cinematic', medical: 'professional', conference: 'professional', boldcase: 'dynamic', investor: 'dynamic' }

/** The design systems as templates (templates.js merges them after the premium ten). */
export const STUDIO = D.map((d) => {
  const th = d.theme
  const fonts = [th.titleFont, th.bodyFont, ...(th.kickerStyle === 'mono' || /Plex Mono/.test(th.bodyFont) ? [MONO] : []), ...(th.motifs?.some(([n]) => n === 'window') ? [mono('JetBrains Mono')] : [])]
  return {
    id: d.id,
    cat: d.cat,
    group: d.group,
    types: ['Prezentatsiya'],
    premium: true,
    studio: true,
    pages: d.pages,
    prefer: d.prefer,
    motion: MOTION[d.id] ?? GROUP_MOTION[d.group],
    theme: { layouts: true, skin: d.id, decor: 'studio', area: AREA, ...classic, ...th, fonts: [...new Set(fonts)] },
  }
})

/** The five families of the collection, in library order. */
export const GROUPS = ['business', 'education', 'creative', 'tech', 'industry']
