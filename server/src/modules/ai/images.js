// Pictures for AI presentations, without any API key:
//   • Wikimedia Commons — real people, places, buildings, animals, maps (everything there is freely licensed);
//   • Openverse — openly licensed photos for general ideas (only licenses that allow commercial use).
// A search alone picks wrong pictures (boxing for "judo"), so several candidates from both services are
// shown to a small Claude model, which picks the one that really shows the subject — or none.
// The deck keeps the picture's own address (both services allow hotlinking) and its credit.

const UA = 'QalamAI/1.0 (https://qalamai.uz; presentation images)'
const TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHED = 2000
const WIDTH = 1280
const PER_SOURCE = 3
const MAX_CANDIDATES = 6
// Wikimedia serves only its standard thumbnail widths (a 400 px copy answers 400 Bad Request)
const THUMB = 330
const THUMB_MAX_BYTES = 600_000

const cache = new Map() // key → { at, value }
const remember = (key, value) => {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value)
  cache.set(key, { at: Date.now(), value })
  return value
}
const recall = (key) => {
  const hit = cache.get(key)
  return hit && Date.now() - hit.at < TTL_MS ? hit : null
}

async function getJson(url, ms = 8000) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const strip = (html = '') => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
const fitRatio = (w, h) => {
  const r = w && h ? w / h : 1.5
  return r <= 3 && r >= 0.4
}

/** A Wikimedia original (often 5–20 MB) → its 1280 px copy; other addresses stay as they are. */
export function sized(url, width = WIDTH) {
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/.exec(url)
  if (!m || !/\.(jpe?g|png|webp)$/i.test(m[3])) return url
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${width}px-${m[3]}`
}

/** Wikimedia Commons: photos (not icons, logos or tiny scans) for a search. */
async function commons(q) {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata|mime',
    iiurlwidth: String(WIDTH),
  })}`
  const json = await getJson(url)
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const out = []
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii?.thumburl || !/^image\/(jpeg|png|webp)$/.test(ii.mime ?? '')) continue
    if ((ii.width ?? 0) < 600 || (ii.height ?? 0) < 400 || !fitRatio(ii.width, ii.height)) continue
    const meta = ii.extmetadata ?? {}
    out.push({
      url: ii.thumburl,
      thumb: ii.thumburl.replace(/\/\d+px-/, `/${THUMB}px-`),
      title: strip(p.title?.replace(/^File:/, '')),
      credit: { source: 'Wikimedia Commons', author: strip(meta.Artist?.value) || null, license: strip(meta.LicenseShortName?.value) || null, link: ii.descriptionurl ?? null },
    })
    if (out.length >= PER_SOURCE) break
  }
  return out
}

/** Openverse: openly licensed photos that may be used commercially. */
async function openverse(q) {
  const url = `https://api.openverse.org/v1/images/?${new URLSearchParams({ q, license_type: 'commercial', mature: 'false', page_size: '15' })}`
  const json = await getJson(url)
  const out = []
  for (const r of json.results ?? []) {
    if (!r.url || (r.width && r.width < 600) || !fitRatio(r.width, r.height)) continue
    out.push({
      // a small original would be blown up from a thumbnail-sized copy — only resize big ones
      url: r.width && r.width > WIDTH ? sized(r.url) : r.url,
      thumb: r.thumbnail || sized(r.url, THUMB),
      title: strip(r.title),
      credit: { source: r.source ?? 'Openverse', author: r.creator ?? null, license: r.license ? `CC ${String(r.license).toUpperCase()}` : null, link: r.foreign_landing_url ?? null },
    })
    if (out.length >= PER_SOURCE) break
  }
  return out
}

/** Candidates for the queries from both services ('real' subjects: Wikimedia first). */
async function candidates(queries, kind, log) {
  const sources = kind === 'real' ? [commons, openverse] : [openverse, commons]
  const lists = await Promise.all(
    queries.flatMap((q) =>
      sources.map((find) =>
        find(q).catch((err) => {
          log?.warn({ err: err.message, q, via: find.name }, 'image search failed')
          return []
        }),
      ),
    ),
  )
  const seen = new Set()
  const out = []
  // round-robin, so the best of every list comes before the rest of any one
  for (let i = 0; i < PER_SOURCE; i++) {
    for (const list of lists) {
      const c = list[i]
      if (c && !seen.has(c.url)) {
        seen.add(c.url)
        out.push(c)
      }
    }
  }
  return out.slice(0, MAX_CANDIDATES)
}

/** A small copy of a candidate for the judge, as base64. */
async function thumbOf(c) {
  try {
    const res = await fetch(c.thumb, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(7000) })
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > THUMB_MAX_BYTES || buf.length < 500) return null
    return { ...c, media: type, data: buf.toString('base64') }
  } catch {
    return null
  }
}

/**
 * The picture for a slide, or null when nothing found really shows the subject.
 * @param {{ q: string, alt?: string, kind?: 'real' | 'generic', about: string }} want
 * @param {{ judge: (want: object, shown: object[]) => Promise<number>, exclude?: Set<string>, log?: object }} o
 *   judge returns the 1-based number of the fitting candidate, 0 for none; `exclude` holds pictures
 *   other slides of the deck already show.
 */
export async function pickImage(want, { judge, exclude = null, log } = {}) {
  const queries = [...new Set([want.q, want.alt].map((x) => String(x ?? '').trim().slice(0, 100)).filter(Boolean))]
  if (!queries.length) return null
  const key = `${want.kind}|${queries.join('|').toLowerCase()}|${String(want.about ?? '').toLowerCase().slice(0, 120)}`
  const fresh = !exclude?.size
  const hit = fresh ? recall(key) : null
  if (hit) return hit.value
  const found = (await candidates(queries, want.kind ?? 'generic', log)).filter((c) => !exclude?.has(c.url))
  const shown = (await Promise.all(found.map(thumbOf))).filter(Boolean)
  if (!shown.length) return fresh ? remember(key, null) : null
  let n = 0
  try {
    n = await judge(want, shown)
  } catch (err) {
    // without a check we would rather show no picture than a wrong one
    log?.warn({ err: err.message, q: want.q }, 'image check failed')
    return null
  }
  const pick = shown[n - 1]
  const value = pick ? { url: pick.url, credit: pick.credit } : null
  return fresh ? remember(key, value) : value
}
