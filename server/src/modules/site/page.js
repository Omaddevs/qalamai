// News pages for search engines and link previews (nginx sends these two addresses to the API):
//   GET /yangiliklar/:slug         the prerendered /yangiliklar page of the web app with this post's own
//                                  <title>, description, canonical, hreflang, Open Graph, NewsArticle JSON-LD
//                                  and readable text put in; the app then starts and shows the post itself.
//   GET /yangiliklar/sitemap.xml   every published post, in each language it is written in.
// The shell comes from the web container (config.webInternalUrl) and is cached for a few minutes.
import { and, desc, eq } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { DEFAULT_LANG, htmlLangOf, isLang } from '../../../../shared/i18n.js'
import { SLUG_RE, languagesOf, pickText, plainText, renderBody } from '../../../../shared/siteContent.js'
import { isLive, mediaUrl } from './routes.js'

const { siteNews } = schema
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const hreflangOf = (l) => (l === 'uz-cyrl' ? 'uz-Cyrl' : l)
const OG_LOCALE = { uz: 'uz_UZ', 'uz-cyrl': 'uz_UZ', ru: 'ru_RU', en: 'en_US' }
const SHELL_TTL = 5 * 60_000

export async function sitePageRoutes(app) {
  const { db, config } = app.ctx
  const site = config.appUrl
  const urlOf = (slug, lang) => `${site}/yangiliklar/${slug}${lang && lang !== DEFAULT_LANG ? `?lang=${lang}` : ''}`

  /** The /yangiliklar page of the web app in a language, as served by its nginx. */
  const shells = new Map()
  async function shell(lang) {
    const hit = shells.get(lang)
    if (hit && Date.now() - hit.at < SHELL_TTL) return hit.html
    try {
      const res = await fetch(`${config.webInternalUrl}/yangiliklar${lang === DEFAULT_LANG ? '' : `?lang=${lang}`}`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error(`web ${res.status}`)
      const html = await res.text()
      shells.set(lang, { html, at: Date.now() })
      return html
    } catch (err) {
      app.log.warn({ err: err.message }, 'news page: shell unavailable')
      return hit?.html ?? null // a stale copy beats none
    }
  }

  function fill(html, { lang, title, desc, url, image, alts, ld, body }) {
    const subs = [
      [/<html lang="[^"]*"[^>]*>/, `<html lang="${htmlLangOf(lang)}">`],
      [/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`],
      [/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`],
      [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(url)}" />`],
      [/(<meta property="og:url" content=")[^"]*/, `$1${esc(url)}`],
      [/(<meta property="og:type" content=")[^"]*/, '$1article'],
      [/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`],
      [/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`],
      [/(<meta property="og:locale" content=")[^"]*/, `$1${OG_LOCALE[lang] ?? 'uz_UZ'}`],
      [/(<meta property="og:image:alt" content=")[^"]*/, `$1${esc(title)}`],
      [/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(title)}`],
      [/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(desc)}`],
      [/<script type="application\/ld\+json" id="seo-page-ld">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="seo-page-ld">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`],
      [/(<div class="seo-static"[^>]*>)[\s\S]*?(<\/div><\/div>)/, `$1\n      ${body}\n    $2`],
    ]
    for (const [re, to] of subs) {
      if (!re.test(html)) return null // the shell changed shape: render the plain page instead
      html = html.replace(re, to)
    }
    // this post's own language versions instead of the list page's
    html = html.replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '')
    html = html.replace(/(<link rel="canonical" href="[^"]*" \/>)/, `$1${alts.map((a) => `\n    <link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`).join('')}`)
    if (image) {
      html = html.replace(/(<meta property="og:image" content=")[^"]*/, `$1${esc(image)}`).replace(/(<meta name="twitter:image" content=")[^"]*/, `$1${esc(image)}`)
      html = html.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/g, '')
    }
    return html
  }

  /** Without the shell (web container unreachable): a small readable page that links into the site. */
  const plain = ({ lang, title, desc, url, image, alts, ld, body }) => `<!doctype html>
<html lang="${htmlLangOf(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
${alts.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}">`).join('')}
<meta property="og:type" content="article"><meta property="og:url" content="${esc(url)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>body{font:17px/1.65 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#16181d}img{max-width:100%;border-radius:12px}a{color:inherit}</style>
</head><body><p><a href="/">QalamAI</a> · <a href="/yangiliklar">Yangiliklar</a></p>${body}</body></html>`

  app.get('/sitemap.xml', { schema: { hide: true } }, async (req, reply) => {
    const rows = await db.select().from(siteNews).where(isLive()).orderBy(desc(siteNews.publishedAt)).limit(5000)
    const urls = rows.flatMap((n) => {
      const langs = languagesOf(n.i18n)
      const alts = [...langs.map((l) => ({ hreflang: hreflangOf(l), href: urlOf(n.slug, l) })), { hreflang: 'x-default', href: urlOf(n.slug) }]
      const lastmod = (n.updatedAt ?? n.publishedAt).toISOString()
      return langs.map((l) =>
        [
          '  <url>',
          `    <loc>${esc(urlOf(n.slug, l))}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          ...alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}"/>`),
          '  </url>',
        ].join('\n'),
      )
    })
    reply.header('content-type', 'application/xml; charset=utf-8').header('cache-control', 'public, max-age=600')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
  })

  app.get('/:slug', { schema: { hide: true, params: { type: 'object', properties: { slug: { type: 'string', maxLength: 120 } } } } }, async (req, reply) => {
    const slug = String(req.params.slug)
    const notFoundPage = async () => {
      // the app's own "page not found", with status 404
      const html = (await shell(DEFAULT_LANG))?.replace(/(<meta name="robots" content=")[^"]*/, '$1noindex')
      return reply.code(404).type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(html ?? 'Not found')
    }
    if (slug !== slug.toLowerCase() && SLUG_RE.test(slug.toLowerCase())) return reply.redirect(`/yangiliklar/${slug.toLowerCase()}`, 301)
    if (!SLUG_RE.test(slug)) return notFoundPage()
    const [n] = await db.select().from(siteNews).where(and(eq(siteNews.slug, slug), isLive())).limit(1)
    if (!n) return notFoundPage()

    const langs = languagesOf(n.i18n)
    const asked = typeof req.query?.lang === 'string' && isLang(req.query.lang) ? req.query.lang : DEFAULT_LANG
    // a language the post isn't written in is the Uzbek page (canonical says so)
    const lang = langs.includes(asked) ? asked : DEFAULT_LANG
    const t = pickText(n.i18n, lang)
    const title = `${t.title} | QalamAI`
    const desc = (t.excerpt || plainText(t.body)).slice(0, 200)
    const url = urlOf(n.slug, lang)
    const image = n.coverKey ? `${site}${mediaUrl(n.coverKey)}` : null
    const alts = [...langs.map((l) => ({ hreflang: hreflangOf(l), href: urlOf(n.slug, l) })), { hreflang: 'x-default', href: urlOf(n.slug) }]
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'QalamAI', item: `${site}/` },
            { '@type': 'ListItem', position: 2, name: pickText({ uz: { t: 'Yangiliklar' }, ru: { t: 'Новости' }, en: { t: 'News' } }, lang).t, item: `${site}/yangiliklar${lang === DEFAULT_LANG ? '' : `?lang=${lang}`}` },
            { '@type': 'ListItem', position: 3, name: t.title, item: url },
          ],
        },
        {
          '@type': 'NewsArticle',
          '@id': `${url}#article`,
          headline: t.title.slice(0, 110),
          description: desc,
          inLanguage: htmlLangOf(lang),
          datePublished: n.publishedAt?.toISOString(),
          dateModified: (n.updatedAt ?? n.publishedAt)?.toISOString(),
          mainEntityOfPage: url,
          ...(image ? { image: [image] } : {}),
          author: { '@type': 'Organization', name: 'QalamAI', url: `${site}/` },
          publisher: { '@id': `${site}/#organization` },
        },
      ],
    }
    const body = [
      `<article><h1>${esc(t.title)}</h1>`,
      n.publishedAt ? `<p><time datetime="${n.publishedAt.toISOString()}">${n.publishedAt.toISOString().slice(0, 10)}</time></p>` : '',
      t.excerpt ? `<p>${esc(t.excerpt)}</p>` : '',
      image ? `<img src="${esc(image)}" alt="${esc(t.title)}">` : '',
      renderBody(t.body),
      '</article>',
    ].join('\n')
    const parts = { lang, title, desc, url, image, alts, ld, body }
    const base = await shell(lang)
    const html = (base && fill(base, parts)) ?? plain(parts)
    return reply.type('text/html; charset=utf-8').header('cache-control', 'public, max-age=60').send(html)
  })
}

