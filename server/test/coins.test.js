import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { client, startServer } from './helpers.js'
import { COIN_COSTS, COIN_PACKS, SIGNUP_BONUS } from '../../shared/coins.js'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.close())

async function member() {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const login = `u${Math.random().toString(36).slice(2, 10)}@test.uz`
  const r = await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name: 'Test' } })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return { c, user: r.body.user }
}

describe('QalamCoin', () => {
  test('prices are public', async () => {
    const r = await client(srv.base).req('GET', '/api/v1/coins/prices')
    assert.equal(r.status, 200)
    assert.equal(r.body.costs.referat.cost, COIN_COSTS.referat.cost)
    assert.equal(r.body.packs.length, COIN_PACKS.length)
  })

  test('registration gives the welcome bonus once, and the account is not premium', async () => {
    const { c, user } = await member()
    assert.equal(SIGNUP_BONUS, 30, 'the welcome bonus is 30 coins')
    assert.equal(user.coins, SIGNUP_BONUS)
    assert.equal(user.premium, false)
    assert.equal(user.tier, null)
    const w = await c.req('GET', '/api/v1/coins')
    assert.equal(w.body.balance, SIGNUP_BONUS)
    assert.deepEqual(w.body.history.map((h) => h.reason), ['signup'])
  })

  test('guests cannot spend', async () => {
    const g = client(srv.base)
    await g.req('POST', '/api/v1/auth/guest')
    const r = await g.req('POST', '/api/v1/coins/spend', { json: { action: 'prezentatsiya', ref: 'guest-try-1' } })
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'REGISTER_REQUIRED')
  })

  test('spending charges once per ref and refuses when the balance is short', async () => {
    const { c } = await member()
    const a = await c.req('POST', '/api/v1/coins/spend', { json: { action: 'prezentatsiya', ref: 'req-0001' } })
    assert.equal(a.status, 200)
    assert.equal(a.body.balance, SIGNUP_BONUS - COIN_COSTS.prezentatsiya.cost)
    const again = await c.req('POST', '/api/v1/coins/spend', { json: { action: 'prezentatsiya', ref: 'req-0001' } })
    assert.equal(again.body.balance, a.body.balance)
    assert.equal(again.body.repeated, true)

    const big = await c.req('POST', '/api/v1/coins/spend', { json: { action: 'kurs-ishi', ref: 'req-0002' } })
    assert.equal(big.status, 402)
    assert.equal(big.body.error.code, 'NOT_ENOUGH_COINS')
    assert.equal(big.body.error.details.balance, a.body.balance)
  })

  test('parallel spends never overdraw', async () => {
    const { c } = await member()
    // the welcome bonus pays for only so many presentations: the rest are refused, never overdrawn
    const fits = Math.floor(SIGNUP_BONUS / COIN_COSTS.prezentatsiya.cost)
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => c.req('POST', '/api/v1/coins/spend', { json: { action: 'prezentatsiya', ref: `par-${i}-xx` } })))
    assert.equal(rs.filter((r) => r.status === 200).length, fits)
    assert.equal((await c.req('GET', '/api/v1/coins')).body.balance, SIGNUP_BONUS - fits * COIN_COSTS.prezentatsiya.cost)
  })

  test('refund gives coins back once', async () => {
    const { c } = await member()
    await c.req('POST', '/api/v1/coins/spend', { json: { action: 'prezentatsiya', ref: 'ref-fail-1' } })
    const r1 = await c.req('POST', '/api/v1/coins/refund', { json: { ref: 'ref-fail-1' } })
    const r2 = await c.req('POST', '/api/v1/coins/refund', { json: { ref: 'ref-fail-1' } })
    assert.equal(r1.body.balance, SIGNUP_BONUS)
    assert.equal(r2.body.balance, SIGNUP_BONUS)
  })

  test('a demo purchase credits the pack and unlocks premium limits', async () => {
    const { c } = await member()
    const p = await c.req('POST', '/api/v1/coins/purchase', { json: { pack: 'c300' } })
    assert.equal(p.status, 200)
    assert.equal(p.body.balance, SIGNUP_BONUS + 300)
    const me = await c.req('GET', '/api/v1/me')
    assert.equal(me.body.premium, true)
    assert.equal(me.body.limits.plan, 'premium')
    assert.equal(me.body.coins, SIGNUP_BONUS + 300)
    assert.equal(p.body.tier, 'Pro')
    assert.equal(me.body.tier, 'Pro')
    // a smaller pack later does not lower the tier; a bigger one raises it
    await c.req('POST', '/api/v1/coins/purchase', { json: { pack: 'c100' } })
    assert.equal((await c.req('GET', '/api/v1/me')).body.tier, 'Pro')
    await c.req('POST', '/api/v1/coins/purchase', { json: { pack: 'c1000' } })
    assert.equal((await c.req('GET', '/api/v1/me')).body.tier, 'Max')
  })

  test('only admins can grant', async () => {
    const { c, user } = await member()
    const r = await c.req('POST', '/api/v1/coins/grant', { json: { userId: user.id, amount: 100 } })
    assert.equal(r.status, 403)
  })
})
