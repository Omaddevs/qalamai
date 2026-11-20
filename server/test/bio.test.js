import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { client, startServer } from './helpers.js'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv.close())

const page = {
  name: 'Dilnoza <Dizayner>',
  bio: 'Grafik dizayner · Toshkent',
  theme: 'midnight',
  buttonStyle: 'soft',
  links: [
    { id: 'a1', title: 'Portfolio', url: 'behance.net/dilnoza', highlight: true },
    { id: 'a2', title: 'Yashirin', url: 'https://example.com', enabled: false },
  ],
  socials: { telegram: '@dilnoza', instagram: 'dilnoza.design', email: 'd@mail.uz', phone: 'abc' },
}

test('publish → public page → counted redirect → stats', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')

  assert.equal((await c.req('GET', '/api/v1/bio/check/ab')).body.available, false, 'too short')
  assert.equal((await c.req('GET', '/api/v1/bio/check/admin')).body.available, false, 'reserved')
  assert.equal((await c.req('GET', '/api/v1/bio/check/dilnoza')).body.available, true)

  const pub = await c.req('PUT', '/api/v1/bio/dilnoza', { json: { designId: 'd-1', data: page } })
  assert.equal(pub.status, 200, JSON.stringify(pub.body))
  assert.match(pub.body.url, /\/b\/dilnoza$/)

  const html = await (await fetch(`${srv.base}/b/dilnoza`)).text()
  assert.match(html, /Dilnoza &lt;Dizayner&gt;/, 'name is escaped')
  assert.doesNotMatch(html, /<Dizayner>/)
  assert.doesNotMatch(html, /<script/i, 'no scripts on public pages')
  assert.match(html, /href="\/b\/dilnoza\/l\/a1"/, 'links go through the counter')
  assert.doesNotMatch(html, /Yashirin/, 'disabled links hidden')
  assert.match(html, /https:\/\/t\.me\/dilnoza/)
  assert.match(html, /mailto:d@mail\.uz/)
  assert.doesNotMatch(html, /tel:/, 'invalid phone dropped')

  const res = await fetch(`${srv.base}/b/dilnoza/l/a1`, { redirect: 'manual' })
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('location'), 'https://behance.net/dilnoza')
  await new Promise((r) => setTimeout(r, 150))

  const stats = (await c.req('GET', '/api/v1/bio/design/d-1')).body.page
  assert.equal(stats.views, 1)
  assert.equal(stats.clicks, 1)

  // another account cannot take the slug; the owner can rename it
  const other = client(srv.base)
  await other.req('POST', '/api/v1/auth/guest')
  assert.equal((await other.req('PUT', '/api/v1/bio/dilnoza', { json: { designId: 'x', data: page } })).status, 409)
  const renamed = await c.req('PUT', '/api/v1/bio/dilnoza-uz', { json: { designId: 'd-1', data: page } })
  assert.equal(renamed.status, 200)
  assert.equal((await fetch(`${srv.base}/b/dilnoza`)).status, 404)
  assert.equal((await fetch(`${srv.base}/b/dilnoza-uz`)).status, 200)
})

test('unsafe links and avatars are rejected', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const bad = await c.req('PUT', '/api/v1/bio/xavfli', { json: { designId: 'd', data: { links: [{ id: 'x', title: 'X', url: 'javascript:alert(1)' }] } } })
  assert.equal(bad.status, 400)
  const badAvatar = await c.req('PUT', '/api/v1/bio/xavfli', { json: { designId: 'd', data: { avatar: 'data:image/svg+xml;base64,PHN2Zz4=' } } })
  assert.equal(badAvatar.status, 400)
  const exp = await c.req('POST', '/api/v1/bio/export', { json: { data: page } })
  assert.equal(exp.status, 200)
  assert.match(exp.body.toString(), /href="https:\/\/behance\.net\/dilnoza"/, 'exported HTML links directly')
})

test('SEO: canonical, redirects, noindex and sitemap', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  assert.equal((await c.req('PUT', '/api/v1/bio/seo-sahifa', { json: { designId: 'seo-1', data: page } })).status, 200)
  assert.equal((await c.req('PUT', '/api/v1/bio/boshliq', { json: { designId: 'seo-2', data: { name: 'Boş' } } })).status, 200)

  const res = await fetch(`${srv.base}/b/seo-sahifa`)
  const html = await res.text()
  assert.match(html, /<link rel="canonical" href="http:\/\/localhost:5173\/b\/seo-sahifa">/, 'canonical uses APP_URL')
  assert.match(html, /<meta property="og:url" content="http:\/\/localhost:5173\/b\/seo-sahifa">/)
  assert.doesNotMatch(html, /name="robots"/, 'a real page is indexable')
  assert.equal(res.headers.get('x-robots-tag'), null)

  const preview = await fetch(`${srv.base}/b/seo-sahifa?preview`)
  assert.equal(preview.headers.get('x-robots-tag'), 'noindex', 'previews stay out of search')
  const empty = await fetch(`${srv.base}/b/boshliq`)
  assert.equal(empty.headers.get('x-robots-tag'), 'noindex', 'empty pages are not indexed')
  assert.match(await empty.text(), /<meta name="robots" content="noindex, follow">/)

  for (const path of ['/b/SEO-Sahifa', '/b/seo-sahifa/']) {
    const r = await fetch(`${srv.base}${path}`, { redirect: 'manual' })
    assert.equal(r.status, 301, path)
    assert.equal(r.headers.get('location'), '/b/seo-sahifa', path)
  }
  const missing = await fetch(`${srv.base}/b/yoq-sahifa`)
  assert.equal(missing.status, 404)
  assert.match(await missing.text(), /name="robots" content="noindex"/)

  const sm = await fetch(`${srv.base}/b/sitemap.xml`)
  assert.equal(sm.status, 200)
  assert.match(sm.headers.get('content-type'), /application\/xml/)
  const xml = await sm.text()
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<loc>http:\/\/localhost:5173\/b\/seo-sahifa<\/loc><lastmod>\d{4}-\d\d-\d\dT[\d:.]+Z<\/lastmod>/)
  assert.doesNotMatch(xml, /boshliq/, 'empty pages are left out')
  assert.equal((await fetch(`${srv.base}/b/sitemap-1.xml`)).status, 200)
  assert.equal((await fetch(`${srv.base}/b/sitemap-9.xml`)).status, 404)

  // unpublishing removes the page from the sitemap
  assert.equal((await c.req('DELETE', '/api/v1/bio/seo-sahifa')).status, 200)
  assert.doesNotMatch(await (await fetch(`${srv.base}/b/sitemap.xml`)).text(), /seo-sahifa/)
})

test('v2 pages: published exactly as designed, and style values can never inject markup or CSS', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const evil = '#fff;}</style><script>alert(1)</script>'
  const data = {
    v: 2,
    name: 'Kamola <b>',
    headline: 'Nail\nartist',
    links: [{ id: 'k1', title: 'Yoziliş', url: 't.me/kamola', sub: 'Bugun', icon: 'calendar', bg: '#f6b8a8' }],
    socials: { instagram: '@kamola' },
    stats: [{ id: 's1', value: '500+', label: 'Mijoz' }],
    style: {
      page: { bg: evil, pattern: 'url(javascript:alert(1))', image: null },
      font: { heading: '</style><script>', body: 'dm' },
      buttons: { shape: 'pill', fill: 'solid', bg: '#f6b8a8', color: evil, height: 1e9 },
      deco: [{ id: 'd1', kind: 'star4', x: 50, y: 10, size: 10, color: evil }, { id: 'd2', kind: '<img src=x onerror=1>', x: 1, y: 1, size: 1 }],
      order: ['headline', 'name', 'buttons', 'stats', '<script>'],
    },
  }
  const pub = await c.req('PUT', '/api/v1/bio/kamola2', { json: { designId: 'd-2', data } })
  assert.equal(pub.status, 200, JSON.stringify(pub.body))
  const html = await (await fetch(`${srv.base}/b/kamola2`)).text()
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /onerror/i)
  assert.match(html, /Kamola &lt;b&gt;/)
  assert.match(html, /Nail<br>artist/)
  assert.match(html, /href="\/b\/kamola2\/l\/k1"/, 'v2 links also go through the counter')
  assert.match(html, /500\+/)
  assert.match(html, /min-height:110px/, 'numbers are clamped')

  // a bad value in a v2 field is refused outright — never saved as a stripped-down v1 page
  const badLink = { ...data, links: [{ ...data.links[0], bg: evil }] }
  assert.equal((await c.req('PUT', '/api/v1/bio/kamola2', { json: { designId: 'd-2', data: badLink } })).status, 400)

  // a too-large background image is refused
  const big = { ...data, style: { ...data.style, page: { image: `data:image/png;base64,${'A'.repeat(1_300_000)}` } } }
  assert.equal((await c.req('PUT', '/api/v1/bio/kamola2', { json: { designId: 'd-2', data: big } })).status, 400)
})
