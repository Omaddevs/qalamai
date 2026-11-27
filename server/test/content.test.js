import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { client, startServer } from './helpers.js'
import { creationKind } from '../../shared/creations.js'

let srv
before(async () => {
  process.env.ADMIN_PASSWORD = 'Kontent-statistika-1'
  srv = await startServer()
})
after(() => srv.close())

function adminClient() {
  let cookie = null
  return async (method, path, json) => {
    const headers = {}
    if (cookie) headers.cookie = cookie
    if (json !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(srv.base + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined })
    for (const s of res.headers.getSetCookie()) if (s.startsWith('qalam_adm=')) cookie = s.split(';')[0]
    return { status: res.status, body: await res.json().catch(() => null) }
  }
}

test('kinds fold old and new spellings onto one key', () => {
  assert.equal(creationKind('Taqdimot'), 'prezentatsiya')
  assert.equal(creationKind('Kurs işi', 'document'), 'kurs-ishi')
  assert.equal(creationKind('Kurs ishi', 'document'), 'kurs-ishi')
  assert.equal(creationKind('Mustaqil iş'), 'mustaqil-ish')
  assert.equal(creationKind('Dars'), 'dars-ishlanma')
  assert.equal(creationKind('Link in Bio'), 'bio')
  assert.equal(creationKind(null, 'document'), 'hujjat')
  assert.equal(creationKind('Nimadir'), 'boshqa')
})

test('admin sees what was created, by kind, by AI and by user — deletions keep the count', async () => {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const now = Date.now()
  const deck = (kind) => ({ name: 'D', kind, data: { slides: [] }, updatedAt: now })
  assert.equal((await c.req('PUT', '/api/v1/designs/d-1', { json: deck('Taqdimot') })).status, 200)
  await c.req('PUT', '/api/v1/designs/d-1', { json: { ...deck('Taqdimot'), updatedAt: now + 1 } }) // an edit: not a new one
  await c.req('PUT', '/api/v1/designs/d-2', { json: deck('Taqdimot') })
  await c.req('PUT', '/api/v1/designs/d-3', { json: deck('Logo') })
  await c.req('PUT', '/api/v1/documents/f_1', { json: { name: 'R', kind: 'Referat', html: '<p>x</p>', updatedAt: now } })
  await c.req('POST', '/api/v1/documents', { json: { name: 'Oddiy', html: '<p>y</p>' } })
  assert.equal((await c.req('DELETE', '/api/v1/designs/d-2')).status, 200)

  // AI wrote one referat (spend), and one presentation that failed (spend + refund)
  const me = (await c.req('GET', '/api/v1/me')).body
  const userId = me.user?.id ?? me.id
  const { coins } = srv.app.ctx
  await coins.grant(userId, 500, 'test')
  await coins.spend({ id: userId, isGuest: false }, 'referat', { ref: 'r1' })
  await coins.spend({ id: userId, isGuest: false }, 'prezentatsiya', { ref: 'p1' })
  await coins.refund({ id: userId }, 'p1')
  await coins.spend({ id: userId, isGuest: false }, 'tarjima', { ref: 't1' })

  const a = adminClient()
  assert.equal((await a('POST', '/api/v1/admin/login', { password: 'Kontent-statistika-1' })).status, 200)
  const s = (await a('GET', '/api/v1/admin/content?days=30')).body
  const k = Object.fromEntries(s.kinds.map((x) => [x.kind, x]))
  assert.equal(k.prezentatsiya.total, 2, 'deleted deck still counted, edit not')
  assert.equal(k.prezentatsiya.ai, 0, 'refunded AI run is not counted')
  assert.equal(k.logo.total, 1)
  assert.equal(k.referat.total, 1)
  assert.equal(k.referat.ai, 1)
  assert.equal(k.hujjat.total, 1)
  assert.equal(s.kpi.total, 5)
  assert.equal(s.kpi.creators, 1)
  assert.equal(s.aiText.find((x) => x.item === 'tarjima').n, 1)
  assert.equal(s.top[0].id, userId)
  assert.equal(s.top[0].total, 5)
  assert.ok(s.series.length >= 30)

  const only = (await a('GET', '/api/v1/admin/content?days=0&kind=referat')).body
  assert.equal(only.top[0].total, 1)

  const u = (await a('GET', `/api/v1/admin/users/${userId}`)).body
  assert.equal(u.created.total, 5)
  assert.equal(u.counts.designs, 2)
  const list = (await a('GET', '/api/v1/admin/users?status=all&sort=created')).body
  assert.equal(list.items[0].counts.created, 5)
})

test('designs and documents from before the log are backfilled once', async () => {
  const { db } = srv.app.ctx
  const { sql } = await import('drizzle-orm')
  const { backfillCreations } = await import('../src/modules/admin/content.js')
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  await c.req('PUT', '/api/v1/designs/old-1', { json: { name: 'Eski', kind: 'Kurs işi', data: {}, updatedAt: Date.now() } })
  await db.execute(sql`DELETE FROM creations WHERE item_id = 'old-1'`)
  assert.equal(await backfillCreations(db), 1)
  assert.equal(await backfillCreations(db), 0, 'nothing twice')
  const [row] = (await db.execute(sql`SELECT kind FROM creations WHERE item_id = 'old-1'`)).rows
  assert.equal(row.kind, 'kurs-ishi')
})
