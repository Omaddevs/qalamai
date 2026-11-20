import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { client, startServer } from './helpers.js'

let srv
before(async () => {
  process.env.ADMIN_PASSWORD = 'Boshlangich-123'
  srv = await startServer()
})
after(() => srv.close())

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/** fetch that keeps the admin cookie */
function adminClient() {
  let cookie = null
  return async (method, path, json) => {
    const headers = { 'user-agent': UA }
    if (cookie) headers.cookie = cookie
    if (json !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(srv.base + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
    for (const s of res.headers.getSetCookie()) if (s.startsWith('qalam_adm=')) cookie = s.split(';')[0]
    return { status: res.status, body: await res.json().catch(() => null), cookie }
  }
}

test('admin: password sign-in, guarded routes, password change ends old sessions', async () => {
  const a = adminClient()
  assert.equal((await a('GET', '/api/v1/admin/stats')).status, 401)
  assert.equal((await a('POST', '/api/v1/admin/login', { password: 'notogri-parol' })).status, 401)
  const ok = await a('POST', '/api/v1/admin/login', { password: 'Boshlangich-123' })
  assert.equal(ok.status, 200)
  assert.equal((await a('GET', '/api/v1/admin/me')).status, 200)

  // a second admin session, then the password changes from the first one
  const b = adminClient()
  await b('POST', '/api/v1/admin/login', { password: 'Boshlangich-123' })
  assert.equal((await b('GET', '/api/v1/admin/me')).status, 200)
  assert.equal((await a('POST', '/api/v1/admin/password', { current: 'xato', next: 'Yangi-parol-77' })).status, 400)
  assert.equal((await a('POST', '/api/v1/admin/password', { current: 'Boshlangich-123', next: 'Yangi-parol-77' })).status, 200)
  assert.equal((await a('GET', '/api/v1/admin/me')).status, 200, 'the changing session continues')
  assert.equal((await b('GET', '/api/v1/admin/me')).status, 401, 'other sessions end')
  assert.equal((await adminClient()('POST', '/api/v1/admin/login', { password: 'Boshlangich-123' })).status, 401, 'env password no longer works')
})

test('page views + sign-up attribution show up in stats and the user list', async () => {
  const vid = 'v_test_visitor_0001'
  const beacon = (body) =>
    fetch(`${srv.base}/api/v1/t`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify(body) })
  let r = await beacon({ v: vid, s: 's_test_session_01', p: '/', e: true, r: 'https://www.google.com/search?q=qalam+ai', tz: 'Asia/Tashkent', l: 'uz-UZ', sc: '390x844' })
  assert.equal(r.status, 200)
  await beacon({ v: vid, s: 's_test_session_01', p: '/auth', tz: 'Asia/Tashkent', l: 'uz-UZ' })
  // bots are ignored
  await fetch(`${srv.base}/api/v1/t`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Googlebot/2.1' }, body: JSON.stringify({ v: 'v_bot_000000001', s: 's_bot_000000001', p: '/', e: true }) })

  const c = client(srv.base) // no guest first: the helper's own cookie header would replace qalam_vid
  const reg = await c.req('POST', '/api/v1/auth/register', {
    json: { login: 'stat@example.com', password: 'parol12345', name: 'Statistik' },
    headers: { cookie: `qalam_vid=${vid}`, 'user-agent': UA },
  })
  assert.equal(reg.status, 200, JSON.stringify(reg.body))

  const a = adminClient()
  await a('POST', '/api/v1/admin/login', { password: 'Yangi-parol-77' })
  const s = (await a('GET', '/api/v1/admin/stats?days=7')).body
  assert.equal(s.kpi.visitors, 1)
  assert.equal(s.kpi.views, 2)
  assert.equal(s.kpi.signups, 1)
  assert.equal(s.series.length, 7)
  assert.deepEqual(s.countries[0], { key: 'UZ', n: 1 })
  assert.equal(s.sources[0].key, 'search')
  assert.equal(s.searchEngines[0].key, 'Google')
  assert.equal(s.searchTerms[0].key, 'qalam ai')
  assert.equal(s.devices[0].key, 'mobile')

  const list = (await a('GET', '/api/v1/admin/users?q=stat@')).body
  assert.equal(list.total, 1)
  const u = list.items[0]
  assert.equal(u.method, 'password')
  assert.equal(u.country, 'UZ')
  assert.equal(u.source, 'search')
  assert.equal(u.referrer, 'google.com')
  assert.equal(u.device, 'mobile')
  assert.ok(u.registeredAt)

  const d = (await a('GET', `/api/v1/admin/users/${u.id}`)).body
  assert.equal(d.journey.length, 2)
  assert.equal(d.user.signup.landing, '/')
  const g = await a('POST', `/api/v1/admin/users/${u.id}/coins`, { amount: 25, note: 'sovğa' })
  assert.equal(g.status, 200)

  const us = (await a('GET', '/api/v1/admin/users/stats?days=30')).body
  assert.equal(us.totals.period, 1)
  assert.equal(us.methods[0].key, 'password')
})

test('Search Console verification file is served once set', async () => {
  const a = adminClient()
  await a('POST', '/api/v1/admin/login', { password: 'Yangi-parol-77' })
  assert.equal((await fetch(`${srv.base}/google0123abcd4567ef89.html`)).status, 404)
  assert.equal((await a('PATCH', '/api/v1/admin/settings', { gscFile: 'yomon.html' })).status, 400)
  const set = await a('PATCH', '/api/v1/admin/settings', { gscFile: 'google-site-verification: google0123abcd4567ef89.html', ga4Id: 'g-abc123xyz' })
  assert.equal(set.status, 200, JSON.stringify(set.body))
  const res = await fetch(`${srv.base}/google0123abcd4567ef89.html`)
  assert.equal(res.status, 200)
  assert.equal(await res.text(), 'google-site-verification: google0123abcd4567ef89.html')
  const t = await (await fetch(`${srv.base}/api/v1/t`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: '{}' })).json()
  assert.equal(t.ga, 'G-ABC123XYZ')
})
