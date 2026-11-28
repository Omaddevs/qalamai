// Hand-drawn pen marks for the presenter: SVG path data around a box on the stage.
// Every shape wobbles a little (seeded, so a replay draws the same stroke) — it should look like
// a teacher's pen on a whiteboard, not a vector frame.

/** Small seeded random numbers (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n) => Math.round(n * 10) / 10

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
export function smooth(pts) {
  if (pts.length < 2) return ''
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

/** A slightly uneven line from a to b. */
function wobbly(a, b, rand, amp) {
  const n = 4
  const pts = []
  for (let i = 0; i <= n; i++) {
    const k = i / n
    const edge = i === 0 || i === n ? 0.3 : 1
    pts.push([a[0] + (b[0] - a[0]) * k + (rand() - 0.5) * amp * 0.4, a[1] + (b[1] - a[1]) * k + (rand() - 0.5) * amp * edge])
  }
  return smooth(pts)
}

/**
 * Pen marks for one cue. `box` is { x, y, w, h } on the stage, `lines` the boxes of the text lines
 * inside it (for underline / highlight), `stage` { w, h }. `u` is the pen width for this stage size.
 * Returns { paths: [{ d, kind: 'pen'|'marker'|'head' }], spot?: d, tip: [x, y] }.
 */
export function marks(draw, { box, lines = [], stage, seed = 1 }) {
  const rand = rng(seed)
  const u = Math.max(2, stage.w / 360)
  const rows = (lines.length ? lines : [box]).slice(0, 3)
  switch (draw) {
    case 'underline': {
      const paths = rows.map((r) => {
        const y = r.y + r.h + u * 1.2
        return { d: wobbly([r.x - u, y + (rand() - 0.5) * u], [r.x + r.w + u * 2, y + (rand() - 0.3) * u * 1.5], rand, u * 1.4), kind: 'pen' }
      })
      const last = rows.at(-1)
      return { paths, tip: [last.x + last.w + u * 2, last.y + last.h + u] }
    }
    case 'highlight': {
      const paths = rows.map((r) => {
        const y = r.y + r.h * 0.55
        return { d: wobbly([r.x - u, y], [r.x + r.w + u, y + (rand() - 0.5) * u], rand, u * 0.6), kind: 'marker', width: Math.max(u * 3, r.h * 0.78) }
      })
      const last = rows.at(-1)
      return { paths, tip: [last.x + last.w + u, last.y + last.h * 0.55] }
    }
    case 'circle': {
      const pad = Math.max(u * 3, Math.min(box.w, box.h) * 0.12)
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      const rx = box.w / 2 + pad
      const ry = box.h / 2 + pad * 0.8
      const tilt = (rand() - 0.5) * 0.08
      const start = -Math.PI * (0.6 + rand() * 0.2)
      const pts = []
      const steps = 14
      // a little more than a full turn: the pen overshoots where it started, like a real circle
      for (let i = 0; i <= steps; i++) {
        const a = start + (i / steps) * Math.PI * 2.18
        const grow = 1 + (i / steps) * 0.06 + (rand() - 0.5) * 0.05
        const x = Math.cos(a) * rx * grow
        const y = Math.sin(a) * ry * grow
        pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)])
      }
      return { paths: [{ d: smooth(pts), kind: 'pen' }], tip: pts.at(-1) }
    }
    case 'box': {
      const p = u * 3
      const a = [box.x - p, box.y - p]
      const b = [box.x + box.w + p, box.y - p]
      const c = [box.x + box.w + p, box.y + box.h + p]
      const d = [box.x - p, box.y + box.h + p]
      const o = u * 2 // the corners overshoot a little
      const side = (s, e, dx, dy) => wobbly([s[0] - dx * o, s[1] - dy * o], [e[0] + dx * o, e[1] + dy * o], rand, u * 1.2)
      const paths = [side(a, b, 1, 0), side(b, c, 0, 1), side(c, d, -1, 0), side(d, a, 0, -1)].map((x) => ({ d: x, kind: 'pen' }))
      return { paths, tip: a }
    }
    case 'arrow': {
      // from the emptier side of the page towards the nearest edge of the box
      const left = box.x
      const right = stage.w - (box.x + box.w)
      const fromLeft = left > right
      const len = Math.min(stage.w * 0.14, Math.max(left, right) * 0.8)
      const end = [fromLeft ? box.x - u * 2 : box.x + box.w + u * 2, box.y + box.h / 2]
      const start = [end[0] + (fromLeft ? -len : len), end[1] + len * (0.35 + rand() * 0.2) * (box.y > stage.h / 2 ? -1 : 1)]
      const mid = [(start[0] + end[0]) / 2 + (rand() - 0.5) * len * 0.2, (start[1] + end[1]) / 2 - len * 0.18]
      const shaft = smooth([start, mid, end])
      const ang = Math.atan2(end[1] - mid[1], end[0] - mid[0])
      const hl = u * 5
      const h1 = [end[0] - hl * Math.cos(ang - 0.5), end[1] - hl * Math.sin(ang - 0.5)]
      const h2 = [end[0] - hl * Math.cos(ang + 0.5), end[1] - hl * Math.sin(ang + 0.5)]
      return {
        paths: [
          { d: shaft, kind: 'pen' },
          { d: `M${f(h1[0])} ${f(h1[1])} L${f(end[0])} ${f(end[1])} L${f(h2[0])} ${f(h2[1])}`, kind: 'head' },
        ],
        tip: end,
      }
    }
    case 'spot': {
      const p = u * 4
      const r = Math.min(u * 6, (box.h + p * 2) / 2)
      const x = box.x - p
      const y = box.y - p
      const w = box.w + p * 2
      const h = box.h + p * 2
      const hole = `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`
      return { paths: [], spot: `M0 0 H${f(stage.w)} V${f(stage.h)} H0 Z ${hole}`, tip: [x + w / 2, y + h / 2] }
    }
    default: // 'point': only the laser pointer moves there
      return { paths: [], tip: [box.x + Math.min(box.w * 0.15, u * 10), box.y + box.h / 2] }
  }
}

/** Boxes of the text lines inside `el`, relative to `origin` (a DOMRect). */
export function lineBoxes(el, origin) {
  try {
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2)
    // one box per visual line (inline pieces on the same line are merged)
    const rows = []
    for (const r of rects) {
      const row = rows.find((x) => Math.abs(x.top - r.top) < r.height * 0.5)
      if (row) {
        row.left = Math.min(row.left, r.left)
        row.right = Math.max(row.right, r.right)
        row.bottom = Math.max(row.bottom, r.bottom)
      } else rows.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })
    }
    return rows.map((r) => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.right - r.left, h: r.bottom - r.top }))
  } catch {
    return []
  }
}
