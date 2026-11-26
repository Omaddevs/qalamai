// Icon names a feature card can carry (src/editor/layoutsPro.jsx draws them; the AI deck prompt in
// server/src/modules/ai/deck.js offers them). Kept here so both sides agree on the list.
export const SLIDE_ICONS = [
  'lightning', 'shield', 'growth', 'users', 'globe', 'rocket', 'gear', 'idea', 'target', 'leaf', 'heart', 'brain',
  'chip', 'cloud', 'lock', 'clock', 'star', 'book', 'education', 'science', 'partnership', 'money', 'mobile',
  'search', 'trophy', 'building', 'delivery', 'sparkle', 'code', 'crown', 'puzzle', 'atom', 'health', 'design',
  'marketing',
]

/** Chart kinds a chart page can be drawn as (src/editor/charts.jsx). */
export const CHART_KINDS = ['bar', 'hbar', 'line', 'area', 'donut', 'pie']

/** Page types the AI deck writer may produce (server/src/modules/ai/deck.js); a design's "prefer" hint is limited to them. */
export const AI_PAGE_TYPES = ['title', 'agenda', 'content', 'media', 'cards', 'stats', 'process', 'compare', 'quote', 'statement', 'bignum', 'summary', 'kpi', 'timeline', 'roadmap', 'swot', 'matrix', 'pyramid', 'funnel', 'table', 'problem', 'features', 'chart', 'photo', 'chapter', 'end']
