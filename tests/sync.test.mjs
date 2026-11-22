// End-to-end test of the browser ⇄ server sync (src/sync.js).
// Starts a real API with an in-memory database, loads the real frontend modules through Vite's
// SSR loader and gives them a minimal fake browser (window, document, localStorage).
// Run: npm test   (needs `npm install` in the root and in server/)
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { startServer } from '../server/test/helpers.js'

/* ───────── fake browser ─────────
 * Installed only AFTER the server is up: PGlite (WASM Postgres) would otherwise see `window`
 * and `document`, think it runs in a browser and try the wrong file system. */
const storage = new Map()
function installFakeBrowser() {
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  }
  const bus = new EventTarget()
  globalThis.window = {
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus),
  }
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, documentElement: { lang: 'uz' } }
}

let srv, vite, api, store, docs, profile, sync
const synced = []
const realFetch = globalThis.fetch
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
/** Let the 1.5 s push debounce fire, then finish the run it started. */
const settle = async () => {
  await wait(1600)
  await sync.syncNow()
}
const ids = (xs) => xs.map((x) => x.id).sort()

before(async () => {
  srv = await startServer()
  installFakeBrowser()
  process.env.VITE_API_URL = srv.base
  vite = await createServer({ root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  const load = (p) => vite.ssrLoadModule(p)
  api = await load('/src/api.js')
  store = await load('/src/store.js')
  docs = await load('/src/docs.js')
  profile = await load('/src/profile.js')
  sync = await load('/src/sync.js')
  window.addEventListener('qalam:synced', (e) => synced.push(e.detail))
  sync.startSync()
  // there are no guests: the browser signs up first
  await api.register({ login: 'sync@mail.uz', password: 'parol12345', name: 'Sinx' })
  await sync.syncNow()
})

after(async () => {
  globalThis.fetch = realFetch
  await vite?.close()
  await srv?.close()
})

test('fresh browser starts empty — no demo designs', async () => {
  assert.equal(api.currentUser().isGuest, false)
  assert.equal(store.loadDesigns().length, 0)
  assert.equal((await api.api.get('/designs')).items.length, 0)
  assert.equal(sync.syncStatus().state, 'idle')
})

test('old untouched example decks are dropped; a new design uploads', async () => {
  // what older versions left in browsers: an example flagged `seed`
  localStorage.setItem('qalamai.designs.v1', JSON.stringify([{ ...store.newDeck({ topic: 'Namuna' }), seed: true }]))
  assert.equal(store.loadDesigns().length, 0, 'never-edited example is not the user’s work')

  const deck = store.newDeck({ topic: 'Mening taqdimotim' })
  store.saveDesign(deck)
  assert.equal(sync.pendingCount(), 1)
  await settle()
  const items = (await api.api.get('/designs')).items
  assert.deepEqual(items.map((d) => d.name), ['Mening taqdimotim'])
  assert.equal(sync.pendingCount(), 0)
})

test('documents go up, remote edits and deletes come down', async () => {
  const doc = docs.blankDoc('Referat', '<p>bir</p>')
  docs.saveDocs([doc, ...docs.loadDocs()])
  await settle()
  assert.deepEqual(ids((await api.api.get('/documents')).items), [doc.id])

  synced.length = 0
  await api.request('PUT', `/documents/${doc.id}`, { json: { name: 'Referat', html: '<p>boshqa qurilma</p>', updatedAt: Date.now() + 1000 } })
  await sync.syncNow()
  assert.equal(docs.loadDocs().find((d) => d.id === doc.id).html, '<p>boshqa qurilma</p>')
  assert.ok(synced.some((g) => g.docs), 'screens are told to reload')

  await api.api.del(`/documents/${doc.id}`)
  await sync.syncNow()
  assert.equal(docs.loadDocs().find((d) => d.id === doc.id), undefined)
})

test('remote designs come down; local deletes go up', async () => {
  const at = Date.now()
  await api.request('PUT', '/designs/d-remote-1', { json: { name: 'Uzoqdan', data: { id: 'd-remote-1', name: 'Uzoqdan', slides: [], updatedAt: at }, updatedAt: at } })
  await sync.syncNow()
  assert.ok(store.loadDesigns().some((d) => d.name === 'Uzoqdan'))
  assert.ok(store.loadDesigns().every((d) => !d.seed))

  store.deleteDesign('d-remote-1')
  await settle()
  assert.ok(!(await api.api.get('/designs')).items.some((d) => d.id === 'd-remote-1'))
})

test('profile: local edit goes up, a newer remote edit comes down', async () => {
  profile.saveProfile({ ...profile.loadProfile(), fullName: 'Aziz Karimov', city: 'Samarqand' })
  await settle()
  assert.equal((await api.api.get('/me')).profile.fullName, 'Aziz Karimov')

  await api.api.patch('/me', { profile: { fullName: 'Aziz K. (telefon)', updatedAt: String(Date.now() + 5000) } })
  await sync.syncNow()
  assert.equal(profile.loadProfile().fullName, 'Aziz K. (telefon)')
  assert.equal(profile.loadProfile().city, 'Samarqand', 'fields the other device did not send are kept')
})

test('an id owned by another account is kept under a new id', async () => {
  const other = await (
    await realFetch(`${srv.base}/api/v1/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: 'begona@mail.uz', password: 'parol12345' }) })
  ).json()
  await realFetch(`${srv.base}/api/v1/documents/f_takenid1`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${other.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Begona', html: '<p>x</p>', updatedAt: Date.now() }),
  })
  docs.saveDocs([{ id: 'f_takenid1', name: 'Meniki', html: '<p>mine</p>', updatedAt: Date.now() }, ...docs.loadDocs()])
  await settle()
  const mine = docs.loadDocs().find((d) => d.name === 'Meniki')
  assert.notEqual(mine.id, 'f_takenid1')
  assert.ok((await api.api.get('/documents')).items.some((d) => d.id === mine.id))
})

test('more than one page on the server: nothing is mistaken for deleted', async () => {
  // 520 > the 500 page size: before paging, items past 500 looked "deleted remotely"
  const at = Date.now()
  for (let i = 0; i < 520; i++) {
    const id = `f_bulk${String(i).padStart(4, '0')}`
    await api.request('PUT', `/documents/${id}`, { json: { name: id, html: '', updatedAt: at } })
  }
  await sync.syncNow()
  const local = docs.loadDocs().filter((d) => d.id.startsWith('f_bulk'))
  assert.equal(local.length, 520)
  // a second run with everything "known synced" must not delete anything either
  await sync.syncNow()
  assert.equal(docs.loadDocs().filter((d) => d.id.startsWith('f_bulk')).length, 520)
  assert.equal((await api.api.get('/documents?limit=500')).nextCursor !== null, true)
})

test('an item the server refuses is reported and does not block the rest', async () => {
  const huge = { id: 'f_huge01', name: 'Juda katta', html: 'x'.repeat(5 * 1048576 + 10), updatedAt: Date.now() }
  const small = { id: 'f_small1', name: 'Kichik', html: '<p>ok</p>', updatedAt: Date.now() }
  docs.saveDocs([huge, small, ...docs.loadDocs()])
  await settle()
  const st = sync.syncStatus()
  assert.equal(st.state, 'error')
  assert.deepEqual(st.rejected.map((r) => r.id), ['f_huge01'])
  const onServer = (await api.api.get('/documents?limit=500&cursor=f_small0')).items.map((d) => d.id)
  assert.ok(onServer.includes('f_small1'), 'the small one still went up')
  // clean up so later tests start from a synced state
  docs.saveDocs(docs.loadDocs().filter((d) => d.id !== 'f_huge01'))
  await settle()
  assert.equal(sync.syncStatus().state, 'idle')
})

test('offline: edits wait, sign-out asks first, nothing is lost', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  docs.saveDocs([{ id: 'f_offline1', name: 'Internetsiz', html: '<p>muhim</p>', updatedAt: Date.now() }, ...docs.loadDocs()])
  await settle()
  assert.equal(sync.syncStatus().state, 'offline')
  assert.ok(sync.syncStatus().pending >= 1)

  // the user says "no, stay" → still signed in, the document is still here
  let asked = 0
  const out = await sync.signOutSafely((n) => {
    asked = n
    return false
  })
  assert.equal(out, false)
  assert.ok(asked >= 1)
  assert.ok(api.currentUser())
  assert.ok(docs.loadDocs().some((d) => d.id === 'f_offline1'))

  // back online → it goes up, the chip turns green, sign-out no longer asks
  globalThis.fetch = realFetch
  await sync.syncNow()
  assert.equal(sync.syncStatus().state, 'idle')
  assert.equal(sync.pendingCount(), 0)
  const all = (await api.api.get('/documents?limit=500&cursor=f_offline0')).items.map((d) => d.id)
  assert.ok(all.includes('f_offline1'))

  let askedAgain = false
  assert.equal(await sync.signOutSafely(() => (askedAgain = true)), true)
  assert.equal(askedAgain, false)
  assert.equal(localStorage.getItem('qalamai.docs.v1'), null)
  assert.equal(localStorage.getItem('qalamai.profile.v1'), null)
})
