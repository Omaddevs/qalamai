// Pictures from pasted links (photos/fetchImage.js): link parsing, the private-address guard,
// image sniffing and page previews; the route refuses our own network and needs a session.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { client, samplePng, startServer } from './helpers.js'
import { imageUrlOf, isPrivateAddress, pagePicture, sniffImage } from '../src/modules/photos/fetchImage.js'

describe('image links', () => {
  test('private, loopback and link-local addresses are refused', () => {
    for (const a of ['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip']) {
      assert.equal(isPrivateAddress(a), true, a)
    }
    for (const a of ['8.8.8.8', '185.196.215.146', '2606:4700:4700::1111']) assert.equal(isPrivateAddress(a), false, a)
  })

  test('search-result links give the original picture', () => {
    const g = 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fupload.wikimedia.org%2Fa%2Fb.jpg&imgrefurl=https%3A%2F%2Fen.wikipedia.org%2F&h=1&w=1'
    assert.equal(imageUrlOf(g).href, 'https://upload.wikimedia.org/a/b.jpg')
    assert.equal(imageUrlOf('https://www.bing.com/images/search?mediaurl=https%3A%2F%2Fexample.com%2Fx.png').href, 'https://example.com/x.png')
    assert.equal(imageUrlOf('  https://example.com/pic.webp  ').href, 'https://example.com/pic.webp')
  })

  test('links that could reach inside are rejected before any request', () => {
    for (const u of ['ftp://example.com/a.png', 'file:///etc/passwd', 'http://127.0.0.1/a.png', 'http://[::1]/a.png', 'http://10.0.0.8/x', 'http://localhost/a.png', 'http://printer.local/x', 'http://example.com:8080/a.png', 'https://user:pw@example.com/a.png', 'javascript:alert(1)', 'not a link']) {
      assert.throws(() => imageUrlOf(u), (e) => e.code === 'IMAGE_URL_BAD', u)
    }
    // the inner address of a search link is checked too
    assert.throws(() => imageUrlOf('https://www.google.com/imgres?imgurl=http%3A%2F%2F127.0.0.1%2Fa.png'), (e) => e.code === 'IMAGE_URL_BAD')
  })

  test('only real image bytes count as a picture', async () => {
    assert.equal(sniffImage(await samplePng()), 'image/png')
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg')
    assert.equal(sniffImage(Buffer.from('GIF89a......')), 'image/gif')
    assert.equal(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'image/webp')
    assert.equal(sniffImage(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'image/svg+xml')
    assert.equal(sniffImage(Buffer.from('<!doctype html><html><body>hi</body></html>')), null)
    assert.equal(sniffImage(Buffer.from('{"json": true}')), null)
  })

  test('a web page gives its preview picture', () => {
    const html = '<html><head><meta property="og:image" content="/media/cover.jpg?a=1&amp;b=2"></head></html>'
    assert.equal(pagePicture(html, new URL('https://site.uz/post/1')), 'https://site.uz/media/cover.jpg?a=1&b=2')
    assert.equal(pagePicture('<meta content="https://cdn.x.com/p.png" name="twitter:image">', new URL('https://x.com/')), 'https://cdn.x.com/p.png')
    assert.equal(pagePicture('<html></html>', new URL('https://x.com/')), null)
  })
})

describe('POST /photos/fetch', () => {
  let srv
  before(async () => {
    srv = await startServer()
  })
  after(async () => {
    await srv?.close()
  })

  test('needs a session', async () => {
    const r = await client(srv.base).req('POST', '/api/v1/photos/fetch', { json: { url: 'https://example.com/a.png' } })
    assert.equal(r.status, 401)
  })

  test('never fetches from our own network', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    for (const url of [`${srv.base}/api/v1/health`, 'http://169.254.169.254/latest/meta-data/', 'http://[::1]:4000/']) {
      const r = await c.req('POST', '/api/v1/photos/fetch', { json: { url } })
      assert.equal(r.status, 400, url)
      assert.equal(r.body.error.code, 'IMAGE_URL_BAD')
    }
  })
})
