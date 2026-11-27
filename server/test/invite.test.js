import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { client, samplePng, startServer } from './helpers.js'
import { INVITE_RESERVED, INVITE_TEMPLATES, checkInviteSlug, normalizeInvite, renderInvitePage } from '../../shared/invite.js'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv.close())

const data = () => {
  const d = structuredClone(INVITE_TEMPLATES[0].data)
  d.names.a = 'Jasur <b>'
  return d
}

test('every public page address is reserved, so no invitation can hide it', () => {
  const src = readFileSync(new URL('../../src/landing/pages.js', import.meta.url), 'utf8')
  // fixed pages (path: '/narxlar') and product pages (slug: 'referat-yaratish', served at /<slug>)
  const paths = [...src.matchAll(/path: '\/([a-z0-9-]+)/g)].map((m) => m[1])
  const products = src.slice(src.indexOf('PRODUCT_PAGES')).split('].map')[0]
  const slugs = [...products.matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1])
  assert.ok(paths.length > 8 && slugs.length >= 3)
  for (const seg of [...paths, ...slugs]) assert.ok(INVITE_RESERVED.has(seg), `${seg} must be in INVITE_RESERVED`)
  for (const seg of ['admin', 'api', 'b', 'v', 'narxlar', 'vositalar']) assert.equal(checkInviteSlug(seg).ok, false, seg)
  assert.equal(checkInviteSlug('jasur-madina').ok, true)
  assert.equal(checkInviteSlug('a--b').ok, false)
  assert.equal(checkInviteSlug('-ab').ok, false)
})

test('renderer escapes text and drops foreign addresses', () => {
  const d = data()
  d.sections[0].photo = 'https://evil.example/x.png'
  d.sections[2].map = 'javascript:alert(1)'
  d.theme.bg = 'red;}body{display:none'
  const clean = normalizeInvite(d)
  assert.equal(clean.sections[0].photo, null)
  assert.equal(clean.sections[2].map, '')
  assert.equal(clean.theme.bg, INVITE_TEMPLATES[0].data.theme.bg)
  const html = renderInvitePage(d, {})
  assert.match(html, /Jasur &lt;b&gt;/)
  assert.doesNotMatch(html, /evil\.example|javascript:/)
  assert.doesNotMatch(renderInvitePage(d, { static: true }), /<script/)
})

test('publish → page at /<slug> → guests answer → owner sees answers', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')

  assert.equal((await c.req('GET', '/api/v1/invites/check/narxlar')).body.available, false)
  assert.equal((await c.req('GET', '/api/v1/invites/check/jasur-madina')).body.available, true)

  // a picture: stored as WebP and served back
  const form = new FormData()
  form.append('file', new Blob([await samplePng()], { type: 'image/png' }), 'a.png')
  const up = await c.req('POST', '/api/v1/invites/media', { form })
  assert.equal(up.status, 200, JSON.stringify(up.body))
  assert.match(up.body.url, /^\/api\/v1\/i\/media\/img_[A-Za-z0-9]{16}\.webp$/)
  const img = await fetch(srv.base + up.body.url)
  assert.equal(img.headers.get('content-type'), 'image/webp')

  // a song: kept as is, byte ranges answered
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(2000, 7)])
  const af = new FormData()
  af.append('file', new Blob([mp3], { type: 'audio/mpeg' }), 'song.mp3')
  const au = await c.req('POST', '/api/v1/invites/media', { form: af })
  assert.equal(au.status, 200, JSON.stringify(au.body))
  const part = await fetch(srv.base + au.body.url, { headers: { range: 'bytes=0-99' } })
  assert.equal(part.status, 206)
  assert.equal((await part.arrayBuffer()).byteLength, 100)
  const bad = new FormData()
  bad.append('file', new Blob([Buffer.from('not music at all')], { type: 'audio/mpeg' }), 'x.mp3')
  assert.equal((await c.req('POST', '/api/v1/invites/media', { form: bad })).status, 400)

  const d = data()
  d.sections[0].photo = up.body.url
  d.music = { src: au.body.url, name: 'Song' }
  const pub = await c.req('PUT', '/api/v1/invites/jasur-madina', { json: { designId: 'd-1', data: d } })
  assert.equal(pub.status, 200, JSON.stringify(pub.body))
  assert.match(pub.body.url, /\/jasur-madina$/)

  const res = await fetch(`${srv.base}/jasur-madina`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-security-policy'), /script-src 'nonce-/)
  assert.match(res.headers.get('x-robots-tag'), /noindex/)
  const html = await res.text()
  assert.match(html, /Jasur &lt;b&gt;/)
  assert.ok(html.includes(up.body.url) && html.includes(au.body.url))
  assert.equal((await fetch(`${srv.base}/Jasur-Madina`, { redirect: 'manual' })).status, 301)
  assert.equal((await fetch(`${srv.base}/yoq-sahifa`)).status, 404)

  const guest = await fetch(`${srv.base}/api/v1/i/jasur-madina/rsvp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Aziz', answer: 'yes', guests: 3, note: 'Tabriklaymiz' }),
  })
  assert.equal(guest.status, 200)
  await fetch(`${srv.base}/api/v1/i/jasur-madina/rsvp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Vali', answer: 'no' }) })

  const list = (await c.req('GET', '/api/v1/invites/jasur-madina/rsvps')).body.rsvps
  assert.equal(list.length, 2)
  const page = (await c.req('GET', '/api/v1/invites/design/d-1')).body.page
  assert.deepEqual(page.rsvp, { answers: 2, yes: 1, guests: 3 })
  assert.equal(page.views, 1)

  // the address belongs to its owner
  const other = client(srv.base)
  await other.req('POST', '/api/v1/auth/guest')
  assert.equal((await other.req('PUT', '/api/v1/invites/jasur-madina', { json: { designId: 'x', data: d } })).status, 409)
  assert.equal((await other.req('GET', '/api/v1/invites/jasur-madina/rsvps')).status, 404)

  assert.equal((await c.req('DELETE', '/api/v1/invites/jasur-madina')).status, 200)
  assert.equal((await fetch(`${srv.base}/jasur-madina`)).status, 404)
})
