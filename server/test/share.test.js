import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { client, startServer } from './helpers.js'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv.close())

const deck = { name: 'Turizm', templateId: 'pitch', accent: '#ff0000', slides: [{ id: 's1', type: 'title', title: 'Salom', elements: [] }] }

test('share a design → public view-only link → follows edits → unshare', async () => {
  const owner = client(srv.base)
  await owner.req('POST', '/api/v1/auth/guest')
  const put = await owner.req('PUT', '/api/v1/designs/d-share-1', { json: { name: deck.name, templateId: 'pitch', data: deck, updatedAt: Date.now() } })
  assert.equal(put.status, 200, JSON.stringify(put.body))

  const s1 = await owner.req('POST', '/api/v1/designs/d-share-1/share')
  assert.equal(s1.status, 200, JSON.stringify(s1.body))
  assert.match(s1.body.shareId, /^[A-Za-z0-9_-]{16}$/)
  const s2 = await owner.req('POST', '/api/v1/designs/d-share-1/share')
  assert.equal(s2.body.shareId, s1.body.shareId, 'sharing again keeps the same link')

  // anyone, without an account
  const pub = await fetch(`${srv.base}/api/v1/shared/${s1.body.shareId}`)
  assert.equal(pub.status, 200)
  const body = await pub.json()
  assert.equal(body.name, 'Turizm')
  assert.equal(body.deck.slides[0].title, 'Salom')
  assert.equal(body.deck.accent, '#ff0000')
  assert.equal(body.userId, undefined, 'owner is not exposed')

  // a sync later keeps the link and shows the new content
  await owner.req('PUT', '/api/v1/designs/d-share-1', { json: { name: 'Yangi', data: { ...deck, slides: [{ ...deck.slides[0], title: 'Yangilandi' }] }, updatedAt: Date.now() + 1000 } })
  const pub2 = await (await fetch(`${srv.base}/api/v1/shared/${s1.body.shareId}`)).json()
  assert.equal(pub2.deck.slides[0].title, 'Yangilandi')

  // someone else can't share or unshare it
  const other = client(srv.base)
  await other.req('POST', '/api/v1/auth/guest')
  assert.equal((await other.req('POST', '/api/v1/designs/d-share-1/share')).status, 404)
  assert.equal((await other.req('DELETE', '/api/v1/designs/d-share-1/share')).status, 404)

  assert.equal((await owner.req('DELETE', '/api/v1/designs/d-share-1/share')).status, 200)
  assert.equal((await fetch(`${srv.base}/api/v1/shared/${s1.body.shareId}`)).status, 404, 'link stops working')
  const s3 = await owner.req('POST', '/api/v1/designs/d-share-1/share')
  assert.notEqual(s3.body.shareId, s1.body.shareId, 'a new link after unsharing')

  assert.equal((await fetch(`${srv.base}/api/v1/shared/nope`)).status, 400)
  assert.equal((await fetch(`${srv.base}/api/v1/shared/aaaaaaaaaaaaaaaa`)).status, 404)
})
