import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { client, startServer } from './helpers.js'

// A stand-in for api.unsplash.com
const calls = []
let limit = false
const fake = createServer((req, res) => {
  calls.push({ url: req.url, auth: req.headers.authorization, version: req.headers['accept-version'] })
  if (limit) {
    res.writeHead(403, { 'x-ratelimit-remaining': '0' })
    return res.end('Rate Limit Exceeded')
  }
  res.setHeader('content-type', 'application/json')
  if (req.url.startsWith('/search/photos')) {
    return res.end(
      JSON.stringify({
        total: 1,
        total_pages: 3,
        results: [
          {
            id: 'abc_123',
            width: 4000,
            height: 3000,
            color: '#a0b0c0',
            alt_description: 'green mountains',
            urls: { raw: 'https://images.unsplash.com/photo-1?ixid=x', small: 's', regular: 'r' },
            links: { html: 'https://unsplash.com/photos/abc_123', download_location: 'https://api.unsplash.com/photos/abc_123/download' },
            user: { name: 'Ali Valiyev', links: { html: 'https://unsplash.com/@ali' } },
          },
        ],
      }),
    )
  }
  if (req.url.startsWith('/photos/abc_123/download')) return res.end('{"url":"x"}')
  res.writeHead(404)
  res.end('{}')
})

let srv
before(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  process.env.UNSPLASH_ACCESS_KEY = 'test-key'
  process.env.UNSPLASH_API_URL = `http://127.0.0.1:${fake.address().port}`
  srv = await startServer()
})
after(async () => {
  await srv?.close()
  fake.close()
})

describe('photos (Unsplash)', () => {
  test('needs a session', async () => {
    const r = await client(srv.base).req('GET', '/api/v1/photos/search?q=tog')
    assert.equal(r.status, 401)
  })

  test('search answers editor-ready items and keeps the key on the server', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const r = await c.req('GET', '/api/v1/photos/search?q=Mountains&page=1')
    assert.equal(r.status, 200)
    assert.equal(r.body.provider, 'unsplash')
    assert.equal(r.body.more, true)
    const [p] = r.body.items
    assert.equal(p.id, 'abc_123')
    assert.equal(p.author, 'Ali Valiyev')
    assert.match(p.thumb, /^https:\/\/images\.unsplash\.com\/photo-1\?ixid=x&w=400/)
    assert.match(p.url, /&w=1920/)
    assert.match(p.authorUrl, /utm_source=qalamai&utm_medium=referral$/)
    assert.match(p.link, /utm_source=qalamai/)
    assert.ok(!JSON.stringify(r.body).includes('test-key'))
    const call = calls.at(-1)
    assert.equal(call.auth, 'Client-ID test-key')
    assert.equal(call.version, 'v1')
    assert.match(call.url, /query=mountains/)
  })

  test('the same search is answered from the cache', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const before = calls.length
    const r = await c.req('GET', '/api/v1/photos/search?q=mountains&page=1')
    assert.equal(r.status, 200)
    assert.equal(calls.length, before)
  })

  test('using a photo is reported to Unsplash', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const r = await c.req('POST', '/api/v1/photos/abc_123/download')
    assert.equal(r.status, 204)
    assert.match(calls.at(-1).url, /^\/photos\/abc_123\/download/)
  })

  test('a spent hourly limit says PHOTOS_LIMIT (the editor then uses Openverse)', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    limit = true
    const r = await c.req('GET', '/api/v1/photos/search?q=sea')
    limit = false
    assert.equal(r.status, 429)
    assert.equal(r.body.error.code, 'PHOTOS_LIMIT')
  })
})
