import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import sharp from 'sharp'
import { startServer } from './helpers.js'

// A stand-in for the web container: the prerendered /yangiliklar page (same tags as dist/yangiliklar.html).
const SHELL = `<!doctype html>
<html lang="uz-Latn">
  <head>
    <title>Yangiliklar | QalamAI</title>
    <meta name="description" content="Ro'yxat" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="https://qalamai.uz/yangiliklar" />
    <link rel="alternate" hreflang="uz" href="https://qalamai.uz/yangiliklar" />
    <link rel="alternate" hreflang="x-default" href="https://qalamai.uz/yangiliklar" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="uz_UZ" />
    <meta property="og:url" content="https://qalamai.uz/yangiliklar" />
    <meta property="og:title" content="Yangiliklar" />
    <meta property="og:description" content="Ro'yxat" />
    <meta property="og:image" content="https://qalamai.uz/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Yangiliklar" />
    <meta name="twitter:title" content="Yangiliklar" />
    <meta name="twitter:description" content="Ro'yxat" />
    <meta name="twitter:image" content="https://qalamai.uz/og-image.png" />
    <script type="application/ld+json" id="seo-page-ld">{"a":1}</script>
  </head>
  <body>
    <div id="root"><div class="seo-static" style="position:absolute">
      <h1>Yangiliklar</h1>
    </div></div>
  </body>
</html>`

let srv
let web
before(async () => {
  process.env.ADMIN_PASSWORD = 'Boshlangich-123'
  web = createServer((req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end(SHELL))
  await new Promise((r) => web.listen(0, '127.0.0.1', r))
  process.env.WEB_INTERNAL_URL = `http://127.0.0.1:${web.address().port}`
  process.env.APP_URL = 'https://qalamai.uz'
  srv = await startServer()
})
after(async () => {
  await srv.close()
  web.close()
})

function adminClient() {
  let cookie = null
  return async (method, path, json) => {
    const headers = {}
    if (cookie) headers.cookie = cookie
    if (json !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(srv.base + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
    for (const s of res.headers.getSetCookie()) if (s.startsWith('qalam_adm=')) cookie = s.split(';')[0]
    const type = res.headers.get('content-type') ?? ''
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), headers: res.headers }
  }
}
const get = (path) => fetch(srv.base + path).then(async (r) => ({ status: r.status, headers: r.headers, body: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() : await r.text() }))

test('site: news are written in the admin panel, published, listed and rendered for crawlers', async () => {
  const a = adminClient()
  assert.equal((await a('GET', '/api/v1/admin/site/news')).status, 401, 'admin only')
  assert.equal((await a('POST', '/api/v1/admin/login', { password: 'Boshlangich-123' })).status, 200)

  // a cover picture
  const png = await sharp({ create: { width: 900, height: 500, channels: 3, background: '#c6f432' } }).png().toBuffer()
  const up = await a('POST', '/api/v1/admin/site/media', { image: `data:image/png;base64,${png.toString('base64')}`, kind: 'cover' })
  assert.equal(up.status, 200)
  assert.match(up.body.key, /^site\/img_[A-Za-z0-9]{16}\.webp$/)
  const pic = await fetch(srv.base + up.body.url)
  assert.equal(pic.headers.get('content-type'), 'image/webp')
  assert.match(pic.headers.get('cache-control'), /immutable/)

  assert.equal((await a('POST', '/api/v1/admin/site/news', { i18n: { ru: { title: 'Только русский' } } })).status, 400, 'Uzbek title required')

  // a draft is not public
  const draft = await a('POST', '/api/v1/admin/site/news', {
    i18n: { uz: { title: 'Yangi şablonlar qöşildi!', excerpt: 'Qisqaça', body: '## Nima yangi\n\n**10 ta** şablon <script>alert(1)</script>' }, ru: { title: 'Новые шаблоны' } },
    coverKey: up.body.key,
  })
  assert.equal(draft.status, 200)
  assert.equal(draft.body.item.slug, 'yangi-shablonlar-qoshildi', 'slug from the Uzbek title, in plain Latin')
  assert.equal(draft.body.item.published, false)
  assert.equal((await get('/api/v1/site/news')).body.total, 0)
  assert.equal((await get('/api/v1/site/news/yangi-shablonlar-qoshildi')).status, 404)

  // the same title again gets a free slug
  const twin = await a('POST', '/api/v1/admin/site/news', { i18n: { uz: { title: 'Yangi şablonlar qöşildi!' } }, published: true })
  assert.equal(twin.body.item.slug, 'yangi-shablonlar-qoshildi-2')

  // publish the first one
  const pub = await a('PUT', `/api/v1/admin/site/news/${draft.body.item.id}`, { published: true })
  assert.equal(pub.status, 200)
  assert.ok(pub.body.item.publishedAt, 'a date is set when first published')

  // scheduled for tomorrow: not shown yet
  await a('POST', '/api/v1/admin/site/news', { i18n: { uz: { title: 'Ertangi xabar' } }, published: true, publishedAt: new Date(Date.now() + 86400000).toISOString() })

  const list = await get('/api/v1/site/news')
  assert.equal(list.body.total, 2)
  assert.equal(list.body.items[0].i18n.uz.body, undefined, 'lists carry no bodies')
  const one = await get('/api/v1/site/news/yangi-shablonlar-qoshildi')
  assert.equal(one.status, 200)
  assert.equal(one.body.item.i18n.ru.title, 'Новые шаблоны')
  assert.equal(one.body.more.length, 1)

  // the page crawlers and link previews get
  const page = await get('/yangiliklar/yangi-shablonlar-qoshildi')
  assert.equal(page.status, 200)
  assert.match(page.body, /<title>Yangi şablonlar qöşildi! \| QalamAI<\/title>/)
  assert.match(page.body, /<link rel="canonical" href="https:\/\/qalamai\.uz\/yangiliklar\/yangi-shablonlar-qoshildi" \/>/)
  assert.match(page.body, /hreflang="ru" href="https:\/\/qalamai\.uz\/yangiliklar\/yangi-shablonlar-qoshildi\?lang=ru"/)
  assert.doesNotMatch(page.body, /hreflang="en"/, 'no English version was written')
  assert.match(page.body, /"@type":"NewsArticle"/)
  assert.match(page.body, /og:type" content="article"/)
  assert.match(page.body, /og:image" content="https:\/\/qalamai\.uz\/api\/v1\/site\/media\/img_/)
  assert.match(page.body, /<h2>Nima yangi<\/h2>/)
  assert.doesNotMatch(page.body, /<script>alert/, 'body is escaped')
  const ru = await get('/yangiliklar/yangi-shablonlar-qoshildi?lang=ru')
  assert.match(ru.body, /<html lang="ru">/)
  assert.match(ru.body, /<title>Новые шаблоны \| QalamAI<\/title>/)
  const en = await get('/yangiliklar/yangi-shablonlar-qoshildi?lang=en')
  assert.match(en.body, /rel="canonical" href="https:\/\/qalamai\.uz\/yangiliklar\/yangi-shablonlar-qoshildi" \/>/, 'an unwritten language points at the Uzbek page')
  assert.equal((await get('/yangiliklar/yoq-narsa')).status, 404)
  assert.equal((await fetch(srv.base + '/yangiliklar/Yangi-Shablonlar-Qoshildi', { redirect: 'manual' })).status, 301)

  const map = await get('/yangiliklar/sitemap.xml')
  assert.match(map.body, /<loc>https:\/\/qalamai\.uz\/yangiliklar\/yangi-shablonlar-qoshildi\?lang=ru<\/loc>/)
  assert.doesNotMatch(map.body, /ertangi-xabar/, 'scheduled posts wait')

  // deleting takes the cover with it
  assert.equal((await a('DELETE', `/api/v1/admin/site/news/${draft.body.item.id}`)).status, 200)
  assert.equal((await fetch(srv.base + up.body.url)).status, 404)
})

test('site: team and partners — visible ones in their order', async () => {
  const a = adminClient()
  await a('POST', '/api/v1/admin/login', { password: 'Boshlangich-123' })
  assert.equal((await a('POST', '/api/v1/admin/site/team', { name: 'Ali', i18n: { uz: { bio: 'x' } } })).status, 400, 'role required')
  const m1 = await a('POST', '/api/v1/admin/site/team', { name: 'Ali Valiyev', i18n: { uz: { role: 'Asoşçi' } }, links: { telegram: '@ali_v', site: 'ali.uz' } })
  assert.equal(m1.status, 200)
  assert.deepEqual(m1.body.item.links, { telegram: 'https://t.me/ali_v', site: 'https://ali.uz/' })
  const m2 = await a('POST', '/api/v1/admin/site/team', { name: 'Vali', i18n: { uz: { role: 'Dizayner' } } })
  await a('PUT', '/api/v1/admin/site/team/order', { ids: [m2.body.item.id, m1.body.item.id] })
  assert.deepEqual((await get('/api/v1/site/team')).body.items.map((m) => m.name), ['Vali', 'Ali Valiyev'])
  await a('PUT', `/api/v1/admin/site/team/${m2.body.item.id}`, { visible: false })
  assert.deepEqual((await get('/api/v1/site/team')).body.items.map((m) => m.name), ['Ali Valiyev'])

  assert.equal((await a('POST', '/api/v1/admin/site/partners', { name: 'X', url: 'javascript:alert(1)' })).status, 400)
  const p = await a('POST', '/api/v1/admin/site/partners', { name: 'Universitet', url: 'https://example.uz', i18n: { uz: { about: 'Hamkor' } } })
  assert.equal(p.status, 200)
  const sum = await get('/api/v1/site/summary')
  assert.equal(sum.body.partners[0].name, 'Universitet')
  assert.equal(sum.body.team.length, 1)
})
