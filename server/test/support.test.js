import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { client, startServer } from './helpers.js'

let srv
before(async () => {
  process.env.ADMIN_PASSWORD = 'Admin-parol-123'
  srv = await startServer()
})
after(() => srv?.close())

describe('QalamChat', () => {
  test('anonymous visitors must sign in', async () => {
    const r = await client(srv.base).req('POST', '/api/v1/support', { json: { topic: 'question', message: 'Salom', contact: { name: 'Aziz', phone: '+998901234567' } } })
    assert.equal(r.status, 401)
  })

  test('guests are asked to register', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const r = await c.req('POST', '/api/v1/support', { json: { topic: 'complaint', message: 'Fayl yuklanmadi', contact: { name: 'Aziz', phone: '+998901234567' } } })
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'REGISTER_REQUIRED')
  })

  test('a registered user sends messages and sees them', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const login = `u${Math.random().toString(36).slice(2, 10)}@test.uz`
    assert.equal((await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name: 'Aziz' } })).status, 200)

    const contact = { name: 'Aziz Karimov', phone: '+998 90 123 45 67', email: '' }
    const s = await c.req('POST', '/api/v1/support', { json: { topic: 'partnership', message: 'Hamkorlik taklifi bor', contact } })
    assert.equal(s.status, 200, JSON.stringify(s.body))
    assert.match(s.body.message.id, /^msg_/)
    assert.deepEqual(s.body.message.contact, { name: 'Aziz Karimov', phone: '+998 90 123 45 67', email: null })

    const bad = async (json) => (await c.req('POST', '/api/v1/support', { json })).body.error?.code
    assert.equal(await bad({ topic: 'spam', message: 'x y', contact }), 'VALIDATION_ERROR')
    assert.equal(await bad({ topic: 'idea', message: '   ', contact }), 'VALIDATION_ERROR')
    assert.equal(await bad({ topic: 'idea', message: 'Salom' }), 'VALIDATION_ERROR')
    assert.equal(await bad({ topic: 'idea', message: 'Salom', contact: { name: 'A', phone: '+998901234567' } }), 'CONTACT_NAME')
    assert.equal(await bad({ topic: 'idea', message: 'Salom', contact: { name: 'Aziz' } }), 'CONTACT_REQUIRED')
    assert.equal(await bad({ topic: 'idea', message: 'Salom', contact: { name: 'Aziz', phone: 'call me' } }), 'CONTACT_PHONE')
    assert.equal(await bad({ topic: 'idea', message: 'Salom', contact: { name: 'Aziz', email: 'nope' } }), 'CONTACT_EMAIL')
    assert.equal((await c.req('POST', '/api/v1/support', { json: { topic: 'idea', message: 'Email bilan', contact: { name: 'Aziz', email: 'a@b.uz' } } })).status, 200)

    const l = await c.req('GET', '/api/v1/support')
    assert.deepEqual(l.body.messages.map((m) => m.message), ['Hamkorlik taklifi bor', 'Email bilan'])
  })

  test('admins see messages with the sender and contact, and mark them done', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const login = `u${Math.random().toString(36).slice(2, 10)}@test.uz`
    await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name: 'Hisob Egasi' } })
    const sent = await c.req('POST', '/api/v1/support', { json: { topic: 'complaint', message: 'Eksport işlamadi', contact: { name: 'Dilnoza', phone: '+998 93 000 11 22' } } })
    const id = sent.body.message.id

    let cookie = null
    const a = async (method, path, json) => {
      const headers = cookie ? { cookie } : {}
      if (json !== undefined) headers['content-type'] = 'application/json'
      const res = await fetch(srv.base + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
      for (const s of res.headers.getSetCookie()) if (s.startsWith('qalam_adm=')) cookie = s.split(';')[0]
      return { status: res.status, body: await res.json().catch(() => null) }
    }
    assert.equal((await a('GET', '/api/v1/admin/chat')).status, 401)
    assert.equal((await a('POST', '/api/v1/admin/login', { password: 'Admin-parol-123' })).status, 200)

    const list = await a('GET', '/api/v1/admin/chat?q=Dilnoza')
    assert.equal(list.status, 200, JSON.stringify(list.body))
    const item = list.body.items.find((m) => m.id === id)
    assert.ok(item)
    assert.deepEqual(item.contact, { name: 'Dilnoza', phone: '+998 93 000 11 22', email: null })
    assert.equal(item.user.name, 'Hisob Egasi')
    assert.ok(list.body.counts.new >= 1)

    assert.equal((await a('PATCH', `/api/v1/admin/chat/${id}`, { status: 'done' })).body.status, 'done')
    const fresh = await a('GET', '/api/v1/admin/chat?status=new')
    assert.ok(!fresh.body.items.some((m) => m.id === id))
    const done = await a('GET', '/api/v1/admin/chat?status=done&topic=complaint')
    assert.ok(done.body.items.some((m) => m.id === id && m.doneAt))
  })
})
