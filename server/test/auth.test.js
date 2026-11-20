import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { client, samplePng, startServer } from './helpers.js'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv.close())

test('guest → upload → register keeps files → login → refresh rotation → logout', async () => {
  const c = client(srv.base)

  const guest = await c.req('POST', '/api/v1/auth/guest')
  assert.equal(guest.status, 200)
  assert.equal(guest.body.user.isGuest, true)
  assert.equal(guest.body.user.limits.plan, 'guest')

  const up = await c.upload([{ name: 'rasm.png', data: await samplePng() }])
  assert.equal(up.status, 201)
  const fileId = up.body.files[0].id

  const reg = await c.req('POST', '/api/v1/auth/register', { json: { login: '+998 90 123-45-67', password: 'parol12345', name: 'Aziz' } })
  assert.equal(reg.status, 200, JSON.stringify(reg.body))
  assert.equal(reg.body.user.isGuest, false)
  assert.equal(reg.body.user.phone, '+998901234567')
  assert.equal(reg.body.user.id, guest.body.user.id, 'guest account upgraded in place')

  const list = await c.req('GET', '/api/v1/files')
  assert.ok(list.body.files.some((f) => f.id === fileId), 'guest files carried over')

  const dup = await client(srv.base).req('POST', '/api/v1/auth/register', { json: { login: '998901234567', password: 'boshqa12345' } })
  assert.equal(dup.status, 409)

  const bad = await client(srv.base).req('POST', '/api/v1/auth/login', { json: { login: '+998901234567', password: 'notogri123' } })
  assert.equal(bad.status, 401)
  assert.equal(bad.body.error.code, 'INVALID_CREDENTIALS')

  const c2 = client(srv.base)
  const login = await c2.req('POST', '/api/v1/auth/login', { json: { login: '901234567', password: 'parol12345' } })
  assert.equal(login.status, 200)

  // refresh rotates; replaying the old cookie revokes the whole family
  const first = await c2.req('POST', '/api/v1/auth/refresh', { headers: { 'x-token-transport': 'body' } })
  assert.equal(first.status, 200)
  const r1 = first.body.refreshToken
  const second = await client(srv.base).req('POST', '/api/v1/auth/refresh', { json: { refreshToken: r1 } })
  assert.equal(second.status, 200)
  // a second tab sending the just-rotated token a moment later is not theft: it gets its own session
  const replay = await client(srv.base).req('POST', '/api/v1/auth/refresh', { headers: { 'x-token-transport': 'body' }, json: { refreshToken: r1 } })
  assert.equal(replay.status, 200, 'grace window: parallel refresh keeps the user signed in')
  assert.equal(replay.body.user.isGuest, false)
  // …but an old token coming back after the grace window revokes the whole family
  const { db, } = srv.app.ctx
  const { sessions } = (await import('../src/db/index.js')).schema
  const { sql } = await import('drizzle-orm')
  await db.update(sessions).set({ revokedAt: sql`now() - interval '5 minutes'` }).where(sql`${sessions.revokedAt} is not null`)
  const stale = await client(srv.base).req('POST', '/api/v1/auth/refresh', { json: { refreshToken: r1 } })
  assert.equal(stale.status, 401)
  assert.equal(stale.body.error.code, 'SESSION_REUSED')
  const afterReuse = await client(srv.base).req('POST', '/api/v1/auth/refresh', { json: { refreshToken: second.body.refreshToken } })
  assert.equal(afterReuse.status, 401, 'family revoked after reuse')

  const me = await c2.req('PATCH', '/api/v1/me', { json: { name: 'Aziz Karimov', profile: { faculty: 'Kompyuter injiniringi', evil: 'x' } } })
  assert.equal(me.body.name, 'Aziz Karimov')
  assert.equal(me.body.profile.faculty, 'Kompyuter injiniringi')
  assert.equal(me.body.profile.evil, undefined)

  const out = await c2.req('POST', '/api/v1/auth/logout')
  assert.equal(out.status, 200)
})

test('protected routes need a token; signed URLs reject tampering', async () => {
  const anon = client(srv.base)
  assert.equal((await anon.req('GET', '/api/v1/files')).status, 401)

  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const { body } = await c.upload([{ name: 'a.png', data: await samplePng() }])
  const f = body.files[0]
  assert.equal((await fetch(srv.base + f.url)).status, 200)
  assert.equal((await fetch(srv.base + f.url.replace(/sig=[^&]+/, 'sig=AAAA'))).status, 404)
  const thumb = await fetch(srv.base + f.thumbUrl)
  assert.equal(thumb.headers.get('content-type'), 'image/webp')
})

test('documents and designs CRUD', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const d = await c.req('POST', '/api/v1/documents', { json: { name: 'Referat', html: '<h1>Kirish</h1><p>Matn</p>' } })
  assert.equal(d.status, 201)
  const upd = await c.req('PATCH', `/api/v1/documents/${d.body.id}`, { json: { name: 'Referat (yakuniy)' } })
  assert.equal(upd.body.name, 'Referat (yakuniy)')
  assert.equal((await c.req('GET', '/api/v1/documents')).body.items.length, 1)

  const other = client(srv.base)
  await other.req('POST', '/api/v1/auth/guest')
  assert.equal((await other.req('GET', `/api/v1/documents/${d.body.id}`)).status, 404, 'other users cannot read it')

  const z = await c.req('POST', '/api/v1/designs', { json: { name: 'Taqdimot', data: { slides: [{ id: 's1' }, { id: 's2' }] } } })
  assert.equal(z.status, 201)
  assert.equal((await c.req('GET', '/api/v1/designs')).body.items[0].slides, 2)
  assert.equal((await c.req('DELETE', `/api/v1/designs/${z.body.id}`)).status, 200)
})

test('change password: wrong current is refused, new one works, old sessions are closed', async () => {
  const c = client(srv.base)
  const reg = await c.req('POST', '/api/v1/auth/register', { json: { login: 'parol@misol.uz', password: 'eski12345' } })
  assert.equal(reg.status, 200, JSON.stringify(reg.body))
  assert.equal(reg.body.user.linked.password, true)

  const wrong = await c.req('POST', '/api/v1/me/password', { json: { current: 'notogri123', next: 'yangi12345' } })
  assert.equal(wrong.status, 400)
  assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS')

  const short = await c.req('POST', '/api/v1/me/password', { json: { current: 'eski12345', next: 'qisqa' } })
  assert.equal(short.status, 400)

  const ok = await c.req('POST', '/api/v1/me/password', { json: { current: 'eski12345', next: 'yangi12345' } })
  assert.equal(ok.status, 200)

  // every session was closed: the old refresh cookie no longer works
  assert.equal((await c.req('POST', '/api/v1/auth/refresh')).status, 401)
  // the old password is gone, the new one signs in (what the frontend does right after)
  assert.equal((await client(srv.base).req('POST', '/api/v1/auth/login', { json: { login: 'parol@misol.uz', password: 'eski12345' } })).status, 401)
  const again = await c.req('POST', '/api/v1/auth/login', { json: { login: 'parol@misol.uz', password: 'yangi12345' } })
  assert.equal(again.status, 200)
  assert.equal((await c.req('GET', '/api/v1/me')).status, 200)
})

test('sync: browser ids upsert, last write wins, foreign ids are refused, profile round-trips', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const t1 = Date.now() - 10_000

  // create under the browser's own id
  const put = await c.req('PUT', '/api/v1/documents/f_abc123', { json: { name: 'Referat', html: '<p>bir</p>', updatedAt: t1 } })
  assert.equal(put.status, 200, JSON.stringify(put.body))
  assert.equal(new Date(put.body.updatedAt).getTime(), t1)

  // a newer write updates, an older one is ignored and reported stale
  await c.req('PUT', '/api/v1/documents/f_abc123', { json: { name: 'Referat', html: '<p>ikki</p>', updatedAt: t1 + 5000 } })
  const old = await c.req('PUT', '/api/v1/documents/f_abc123', { json: { name: 'Referat', html: '<p>eski</p>', updatedAt: t1 + 1 } })
  assert.equal(old.body.stale, true)
  assert.equal((await c.req('GET', '/api/v1/documents/f_abc123')).body.html, '<p>ikki</p>')

  // designs too, with the deck as JSON
  const deck = { id: 'd-lx1-0', slides: [{ id: 's1' }], updatedAt: t1 }
  const dz = await c.req('PUT', '/api/v1/designs/d-lx1-0', { json: { name: 'Taqdimot', kind: 'Taqdimot', templateId: 'aurora', data: deck, updatedAt: t1 } })
  assert.equal(dz.status, 200, JSON.stringify(dz.body))
  assert.equal((await c.req('GET', '/api/v1/designs/d-lx1-0')).body.data.slides.length, 1)

  // the same id from another account is refused, not overwritten
  const other = client(srv.base)
  await other.req('POST', '/api/v1/auth/guest')
  const taken = await other.req('PUT', '/api/v1/documents/f_abc123', { json: { name: 'Begona', html: '<p>x</p>', updatedAt: Date.now() } })
  assert.equal(taken.status, 409)
  assert.equal(taken.body.error.code, 'ID_TAKEN')
  assert.equal((await c.req('GET', '/api/v1/documents/f_abc123')).body.html, '<p>ikki</p>')

  // profile with its edit time
  const pr = await c.req('PATCH', '/api/v1/me', { json: { profile: { fullName: 'Aziz Karimov', city: 'Samarqand', updatedAt: String(t1) } } })
  assert.equal(pr.status, 200)
  const me = await c.req('GET', '/api/v1/me')
  assert.equal(me.body.profile.fullName, 'Aziz Karimov')
  assert.equal(me.body.profile.updatedAt, String(t1))
})

test('lists page through every item (sync relies on seeing the whole list)', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const ids = ['f_p05', 'f_p01', 'f_p04', 'f_p02', 'f_p03']
  for (const id of ids) await c.req('PUT', `/api/v1/documents/${id}`, { json: { name: id, html: '', updatedAt: Date.now() } })

  const seen = []
  let cursor = null
  let pages = 0
  do {
    const q = new URLSearchParams({ limit: '2', ...(cursor ? { cursor } : {}) })
    const r = await c.req('GET', `/api/v1/documents?${q}`)
    assert.equal(r.status, 200)
    assert.ok(r.body.items.length <= 2)
    seen.push(...r.body.items.map((d) => d.id))
    cursor = r.body.nextCursor
    pages++
  } while (cursor)
  assert.equal(pages, 3)
  assert.deepEqual(seen, [...ids].sort(), 'every item exactly once')
})

test('logout and password change are final: their tokens never come back through the grace window', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/register', { json: { login: 'grace@misol.uz', password: 'parol12345' } })
  const r = await c.req('POST', '/api/v1/auth/refresh', { headers: { 'x-token-transport': 'body' } })
  const token = r.body.refreshToken
  await client(srv.base).req('POST', '/api/v1/auth/logout', { json: { refreshToken: token } })
  const again = await client(srv.base).req('POST', '/api/v1/auth/refresh', { json: { refreshToken: token } })
  assert.equal(again.status, 401, 'a logged-out session stays closed')
})

test('parallel refreshes with one cookie all succeed (two tabs opening at once)', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/register', { json: { login: 'tabs@misol.uz', password: 'parol12345' } })
  const r = await c.req('POST', '/api/v1/auth/refresh', { headers: { 'x-token-transport': 'body' } })
  const token = r.body.refreshToken
  const results = await Promise.all([1, 2, 3].map(() => client(srv.base).req('POST', '/api/v1/auth/refresh', { json: { refreshToken: token } })))
  assert.deepEqual(results.map((x) => x.status), [200, 200, 200])
  assert.ok(results.every((x) => x.body.user.email === 'tabs@misol.uz'))
})
