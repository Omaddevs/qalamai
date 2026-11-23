// Card payments: the team sets the cards, a buyer sends a receipt for a pack or any amount,
// an admin approves (coins arrive once) or rejects (the buyer is told why).
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { client, samplePng, startServer } from './helpers.js'
import { CUSTOM_COINS, MAX_PENDING_PAYMENTS, SIGNUP_BONUS, priceFor } from '../../shared/coins.js'

let srv
before(async () => {
  process.env.ADMIN_PASSWORD = 'Boshlangich-123'
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
    const type = res.headers.get('content-type') ?? ''
    return { status: res.status, type, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) }
  }
}

async function member() {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const login = `p${Math.random().toString(36).slice(2, 10)}@test.uz`
  const r = await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name: 'Xaridor' } })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return { c, user: r.body.user }
}

const order = async (c, fields, receipt) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
  if (receipt) form.append('receipt', new Blob([receipt.data], { type: receipt.type }), receipt.name)
  return c.req('POST', '/api/v1/payments/orders', { form })
}

test('payments: cards, receipt, approve once, reject with a reason', async () => {
  const a = adminClient()
  assert.equal((await a('POST', '/api/v1/admin/login', { password: 'Boshlangich-123' })).status, 200)
  const png = { data: await samplePng(), type: 'image/png', name: 'chek.png' }

  const { c, user } = await member()
  assert.equal(user.coins, SIGNUP_BONUS)

  // no cards yet → nothing to pay to
  assert.deepEqual((await c.req('GET', '/api/v1/payments/methods')).body.methods, [])
  assert.equal((await order(c, { coins: 50, method: 'humo' }, png)).body.error.code, 'PAY_METHOD_OFF')

  // the admin saves cards; a wrong number is refused
  assert.equal((await a('PUT', '/api/v1/admin/payment-cards', { humo: { number: '9860 12' } })).status, 400)
  const saved = await a('PUT', '/api/v1/admin/payment-cards', {
    humo: { number: '9860 1234 5678 9012', holder: 'Qalam AI', enabled: true },
    uzcard: { number: '8600 1111 2222 3333', holder: 'Qalam AI', enabled: false },
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.cards.humo.number, '9860123456789012')
  const methods = (await c.req('GET', '/api/v1/payments/methods')).body
  assert.deepEqual(methods.methods.map((m) => m.id), ['humo'], 'a switched-off card is not offered')
  assert.equal(methods.custom.min, CUSTOM_COINS.min)

  // validation: amount range, receipt required, receipt type
  assert.equal((await order(c, { coins: CUSTOM_COINS.min - 1, method: 'humo' }, png)).body.error.code, 'COINS_RANGE')
  assert.equal((await order(c, { coins: 50, method: 'humo' })).body.error.code, 'RECEIPT_REQUIRED')
  assert.equal((await order(c, { coins: 50, method: 'humo' }, { data: Buffer.from('salom'), type: 'text/plain', name: 'chek.txt' })).body.error.code, 'RECEIPT_TYPE')

  // a custom amount, priced on the server
  const o1 = await order(c, { coins: 150, method: 'humo', note: 'Karta: 1234' }, png)
  assert.equal(o1.status, 201, JSON.stringify(o1.body))
  assert.equal(o1.body.order.amount, priceFor(150))
  assert.equal(o1.body.order.status, 'pending')
  // and a pack
  const o2 = await order(c, { pack: 'c300', method: 'humo' }, png)
  assert.equal(o2.body.order.coins, 300)
  assert.equal(o2.body.order.amount, priceFor(300))

  // the admin sees them, waiting ones first, and can open the receipt
  const list = await a('GET', '/api/v1/admin/payments?status=pending')
  assert.equal(list.body.counts.pending, 2)
  assert.equal(list.body.items[0].id, o1.body.order.id, 'oldest first')
  const rc = await a('GET', list.body.items[0].receipt.url)
  assert.equal(rc.status, 200)
  assert.equal(rc.type, 'image/png')
  assert.ok(rc.body.length > 50)
  // only admins may open receipts
  assert.equal((await c.req('GET', list.body.items[0].receipt.url)).status, 401)

  // approve twice → coins once
  const ok1 = await a('POST', `/api/v1/admin/payments/${o1.body.order.id}/approve`)
  const ok2 = await a('POST', `/api/v1/admin/payments/${o1.body.order.id}/approve`)
  assert.equal(ok1.status, 200)
  assert.equal(ok1.body.balance, SIGNUP_BONUS + 150)
  assert.equal(ok2.body.repeated, true)
  const me = (await c.req('GET', '/api/v1/me')).body
  assert.equal(me.coins, SIGNUP_BONUS + 150)
  assert.equal(me.premium, true, 'a paid purchase unlocks premium')

  // reject needs a reason, and an approved one can't be rejected
  assert.equal((await a('POST', `/api/v1/admin/payments/${o2.body.order.id}/reject`, {})).status, 400)
  assert.equal((await a('POST', `/api/v1/admin/payments/${o1.body.order.id}/reject`, { reason: 'Kech' })).status, 409)
  const no = await a('POST', `/api/v1/admin/payments/${o2.body.order.id}/reject`, { reason: 'Çekdagi summa mos emas' })
  assert.equal(no.status, 200)
  assert.equal((await a('POST', `/api/v1/admin/payments/${o2.body.order.id}/approve`)).status, 409)

  // the buyer sees both outcomes and gets a notice for the rejection
  const mine = (await c.req('GET', '/api/v1/payments/orders')).body.orders
  assert.deepEqual(mine.map((o) => o.status).sort(), ['approved', 'rejected'])
  assert.equal(mine.find((o) => o.status === 'rejected').reason, 'Çekdagi summa mos emas')
  const notes = (await c.req('GET', '/api/v1/notifications')).body
  const kinds = (notes.items ?? notes.notifications ?? []).map((n) => n.kind)
  assert.ok(kinds.includes('payment.rejected'), JSON.stringify(kinds))
  assert.ok(kinds.includes('coins.purchase'))

  // totals
  const all = (await a('GET', '/api/v1/admin/payments?status=all')).body
  assert.equal(all.counts.approved, 1)
  assert.equal(all.amounts.approved, priceFor(150))
  assert.equal(all.today.coins, 150)
})

test('payments: guests can not buy, and pending payments are capped', async () => {
  const g = client(srv.base)
  await g.req('POST', '/api/v1/auth/guest')
  assert.equal((await g.req('GET', '/api/v1/payments/methods')).body.error.code, 'REGISTER_REQUIRED')

  const { c } = await member()
  const png = { data: await samplePng(), type: 'image/png', name: 'chek.png' }
  for (let i = 0; i < MAX_PENDING_PAYMENTS; i++) assert.equal((await order(c, { coins: 10, method: 'humo' }, png)).status, 201)
  assert.equal((await order(c, { coins: 10, method: 'humo' }, png)).body.error.code, 'PAYMENTS_PENDING')
})
