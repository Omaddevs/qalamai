// Page-range parsing shared by the API (validation), the server tools and the browser tools.

/** Parse "1-3, 5" into sorted unique 0-based indexes within [0, total). */
export function parsePageRange(range, total) {
  if (!range?.trim()) return [...Array(total).keys()]
  const out = new Set()
  for (const part of range.split(',')) {
    const [a, b] = part.split('-').map((s) => Number(s.trim()))
    const from = Math.max(1, a)
    const to = Math.min(total, Number.isFinite(b) ? b : a)
    for (let p = from; p <= to; p++) out.add(p - 1)
  }
  return [...out].sort((x, y) => x - y)
}

/** "1-3, 4-6" → [[0,1,2],[3,4,5]] (for split by ranges). */
export function parseRangeGroups(range, total) {
  return range
    .split(',')
    .map((part) => {
      const [a, b] = part.split('-').map((s) => Number(s.trim()))
      const from = Math.max(1, a)
      const to = Math.min(total, Number.isFinite(b) ? b : a)
      return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from - 1 + i)
    })
    .filter((g) => g.length)
}
