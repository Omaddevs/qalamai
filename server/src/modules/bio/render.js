// Server-side renderer for public Link-in-Bio pages. Every user value is escaped,
// links pass through a strict URL check, and the page ships no JavaScript.
import { normalizeUrl } from '../../../../shared/bio.js'
import { fontsHref, renderBio, toV2 } from '../../../../shared/bio2.js'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * @param {object} data  validated bio data
 * @param {{ slug?: string, track?: boolean, homeUrl?: string, canonicalUrl?: string, noindex?: boolean }} opts
 *   canonicalUrl — absolute address of the published page (absent in the downloadable export);
 *   noindex      — previews and pages with nothing on them stay out of search results.
 */
export function renderBioPage(data, { slug, track = false, homeUrl = '/', canonicalUrl, noindex = false } = {}) {
  const d = toV2(data)
  const title = d.name?.trim() || 'Link in Bio'
  const href = (l) => (track && slug ? `/b/${encodeURIComponent(slug)}/l/${encodeURIComponent(l.id)}` : normalizeUrl(l.url))
  // the same renderer the editor preview uses — the published page is exactly what was designed
  const { html, css, fonts } = renderBio(d, { scope: 'qb', href, homeUrl })
  const fontsUrl = fontsHref(fonts)
  const theme = d.style.page.bg2 ?? d.style.page.bg

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description(d, title))}">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}${canonicalUrl ? `<link rel="canonical" href="${esc(canonicalUrl)}">\n<meta property="og:url" content="${esc(canonicalUrl)}">\n` : ''}<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description(d, title))}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="${esc(/^#[0-9a-f]{6}/i.test(theme) ? theme.slice(0, 7) : '#ffffff')}">
${fontsUrl ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsUrl)}">\n` : ''}<style>
html,body{margin:0;min-height:100%}
body{min-height:100vh}
.qb{min-height:100vh}
${css}
</style>
</head>
<body>
${html}
</body>
</html>`
}

/** The bio itself, or — when it is empty — a sentence built from the visible link titles. */
function description(data, title) {
  const bio = String(data.bio ?? '').replace(/\s+/g, ' ').trim()
  if (bio) return bio.length > 160 ? `${bio.slice(0, 157).trimEnd()}…` : bio
  const links = (data.links ?? []).filter((l) => l.enabled !== false).map((l) => l.title).slice(0, 4)
  return links.length ? `${title}: ${links.join(' · ')}` : title
}

/** A page worth showing in search: it has a bio or at least one working link. */
export const hasContent = (data) => Boolean(String(data.bio ?? '').trim()) || (data.links ?? []).some((l) => l.enabled !== false && normalizeUrl(l.url))
