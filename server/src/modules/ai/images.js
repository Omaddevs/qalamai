// Pictures for AI presentations, without any API key:
//   • Wikimedia Commons — real people, places, buildings, animals, maps (everything there is freely licensed);
//   • Openverse — openly licensed photos for general ideas (only licenses that allow commercial use).
// The deck keeps the picture's own address (both services allow hotlinking) and its credit.
// Answers are cached for a day so the same query is never asked twice.

const UA = 'QalamAI/1.0 (https://qalamai.uz; presentation images)'
const TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHED = 2000
const WIDTH = 1280

const cache = new Map() // key → { at, value }

async function getJson(url, ms = 8000) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const strip = (html = '') => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)

/** Wikimedia Commons: the best-matching photo (not an icon, logo or tiny scan). */
async function commons(q) {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata|mime',
    iiurlwidth: String(WIDTH),
  })}`
  const json = await getJson(url)
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii?.thumburl || !/^image\/(jpeg|png|webp)$/.test(ii.mime ?? '')) continue
    if ((ii.width ?? 0) < 600 || (ii.height ?? 0) < 400) continue
    const ratio = ii.width / ii.height
    if (ratio > 3 || ratio < 0.4) continue
    const meta = ii.extmetadata ?? {}
    return {
      url: ii.thumburl,
      credit: {
        source: 'Wikimedia Commons',
        author: strip(meta.Artist?.value) || null,
        license: strip(meta.LicenseShortName?.value) || null,
        link: ii.descriptionurl ?? null,
      },
    }
  }
  return null
}

/** A Wikimedia original (often 5–20 MB) → its 1280 px copy; other addresses stay as they are. */
export function sized(url) {
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/.exec(url)
  if (!m || !/\.(jpe?g|png|webp)$/i.test(m[3])) return url
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${WIDTH}px-${m[3]}`
}

/** Openverse: an openly licensed photo that may be used commercially. */
async function openverse(q) {
  const url = `https://api.openverse.org/v1/images/?${new URLSearchParams({
    q,
    license_type: 'commercial',
    mature: 'false',
    page_size: '8',
    size: 'large',
  })}`
  const json = await getJson(url)
  for (const r of json.results ?? []) {
    if (!r.url || (r.width && r.width < 600)) continue
    const ratio = r.width && r.height ? r.width / r.height : 1.5
    if (ratio > 3 || ratio < 0.4) continue
    // a small original would be blown up from a thumbnail-sized copy — only resize big ones
    return {
      url: r.width && r.width > WIDTH ? sized(r.url) : r.url,
      credit: {
        source: r.source ?? 'Openverse',
        author: r.creator ?? null,
        license: r.license ? `CC ${String(r.license).toUpperCase()}` : null,
        link: r.foreign_landing_url ?? null,
      },
    }
  }
  return null
}

/**
 * A picture for `q` (an English search phrase). `kind` 'real' asks Wikimedia first (a real person,
 * place or thing), 'generic' asks Openverse first; the other one is the fallback. null if none fits.
 */
export async function findImage(q, kind = 'generic', { log } = {}) {
  const query = String(q ?? '').trim().slice(0, 100)
  if (!query) return null
  const key = `${kind}:${query.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const order = kind === 'real' ? [commons, openverse] : [openverse, commons]
  let value = null
  for (const find of order) {
    value = await find(query).catch((err) => {
      log?.warn({ err: err.message, q: query, via: find.name }, 'image search failed')
      return null
    })
    if (value) break
  }
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value)
  cache.set(key, { at: Date.now(), value })
  return value
}
