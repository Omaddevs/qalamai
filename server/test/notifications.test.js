import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { client, startServer } from './helpers.js'

let srv
before(async () => {
  process.env.ADMIN_PASSWORD = 'Admin-parol-123'
  srv = await startServer()
})
after(() => srv?.close())

const registered = async (name = 'Aziz') => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const login = `u${Math.random().toString(36).slice(2, 10)}@test.uz`
  assert.equal((await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name } })).status, 200)
  return c
}

const adminClient = async () => {
  let cookie = null
  const a = async (method, path, json) => {
    const headers = cookie ? { cookie } : {}
    if (json !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(srv.base + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
    for (const s of res.headers.getSetCookie()) if (s.startsWith('qalam_adm=')) cookie = s.split(';')[0]
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  assert.equal((await a('POST', '/api/v1/admin/login', { password: 'Admin-parol-123' })).status, 200)
  return a
}

describe('Bildirişnomalar', () => {
  test('signed-out visitors get 401', async () => {
    assert.equal((await client(srv.base).req('GET', '/api/v1/notifications')).status, 401)
  })

  test('registering brings a welcome notice; reading it clears the count', async () => {
    const c = await registered()
    const l = await c.req('GET', '/api/v1/notifications')
    assert.equal(l.status, 200, JSON.stringify(l.body))
    const welcome = l.body.items.find((x) => x.kind === 'welcome')
    assert.ok(welcome)
    assert.equal(welcome.read, false)
    assert.ok(welcome.data.coins > 0)
    assert.ok(l.body.unread >= 1)

    const r = await c.req('POST', `/api/v1/notifications/${welcome.id}/read`)
    assert.equal(r.status, 200)
    assert.equal(r.body.unread, l.body.unread - 1)
    assert.equal((await c.req('POST', '/api/v1/notifications/ntf_nope/read')).status, 404)
  })

  test('announcements reach everyone, admin grants and answered messages reach one user', async () => {
    const c = await registered('Dilnoza')
    const other = await registered('Boşqa')
    const a = await adminClient()

    const bad = await a('POST', '/api/v1/admin/notifications', { title: 'Yangilik', body: 'Matn', link: 'javascript:alert(1)' })
    assert.equal(bad.status, 400)
    const ann = await a('POST', '/api/v1/admin/notifications', { title: 'Yangi şablonlar', body: '10 ta yangi şablon qöşildi', link: '#/' })
    assert.equal(ann.status, 200, JSON.stringify(ann.body))

    const meId = (await c.req('GET', '/api/v1/me')).body.id
    assert.equal((await a('POST', `/api/v1/admin/users/${meId}/coins`, { amount: 25, note: 'Sovğa' })).status, 200)

    const sent = await c.req('POST', '/api/v1/support', { json: { topic: 'question', message: 'Savol bor', contact: { name: 'Dilnoza', phone: '+998901234567' } } })
    const msgId = sent.body.message.id
    await a('PATCH', `/api/v1/admin/chat/${msgId}`, { status: 'done' })
    await a('PATCH', `/api/v1/admin/chat/${msgId}`, { status: 'done' }) // twice: still one notice

    const mine = (await c.req('GET', '/api/v1/notifications')).body
    const kinds = mine.items.map((x) => x.kind)
    assert.deepEqual(kinds.filter((k) => k === 'support.done'), ['support.done'])
    assert.ok(kinds.includes('coins.grant'))
    assert.equal(mine.items.find((x) => x.kind === 'coins.grant').data.coins, 25)
    assert.equal(mine.items.find((x) => x.kind === 'announce').title, 'Yangi şablonlar')

    const theirs = (await other.req('GET', '/api/v1/notifications')).body.items.map((x) => x.kind)
    assert.ok(theirs.includes('announce'))
    assert.ok(!theirs.includes('coins.grant') && !theirs.includes('support.done'))

    assert.equal((await c.req('POST', '/api/v1/notifications/read-all')).body.unread, 0)
    assert.equal((await c.req('GET', '/api/v1/notifications/unread')).body.unread, 0)
    // the announcement read by one user is still unread for the other
    assert.ok((await other.req('GET', '/api/v1/notifications/unread')).body.unread >= 1)

    const listed = await a('GET', '/api/v1/admin/notifications')
    assert.equal(listed.body.items.find((x) => x.id === ann.body.id).reads, 1)
    assert.equal((await a('DELETE', `/api/v1/admin/notifications/${ann.body.id}`)).status, 200)
    assert.ok(!(await other.req('GET', '/api/v1/notifications')).body.items.some((x) => x.kind === 'announce'))
  })

  test('paging with before', async () => {
    const c = await registered()
    const first = (await c.req('GET', '/api/v1/notifications?limit=1')).body
    assert.equal(first.items.length, 1)
    const next = (await c.req('GET', `/api/v1/notifications?limit=50&before=${encodeURIComponent(first.items[0].createdAt)}`)).body
    assert.ok(!next.items.some((x) => x.id === first.items[0].id))
  })
})
