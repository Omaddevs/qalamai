import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { client, startServer } from './helpers.js'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.close())

const PRESET_URL = /^\/avatars\/(\d{2})\.webp$/

async function signUp() {
  const c = client(srv.base)
  await c.req('POST', '/api/v1/auth/guest')
  const login = `a${Math.random().toString(36).slice(2, 10)}@test.uz`
  const r = await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name: 'Ali' } })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return { c, user: r.body.user }
}

describe('avatars', () => {
  test('guests have none, new accounts get the next drawn avatar in turn', async () => {
    const g = client(srv.base)
    const gs = await g.req('POST', '/api/v1/auth/guest')
    assert.equal(gs.body.user.avatarUrl, null)

    const nums = []
    for (let i = 0; i < 4; i++) {
      const { user } = await signUp()
      const m = PRESET_URL.exec(user.avatarUrl)
      assert.ok(m, user.avatarUrl)
      nums.push(Number(m[1]))
    }
    for (let i = 1; i < nums.length; i++) assert.equal(nums[i], (nums[i - 1] % 15) + 1, `rotation: ${nums}`)
  })

  test('the user picks another preset or uploads a photo', async () => {
    const { c } = await signUp()
    const p = await c.req('PUT', '/api/v1/me/avatar', { json: { preset: 7 } })
    assert.equal(p.status, 200, JSON.stringify(p.body))
    assert.equal(p.body.avatarUrl, '/avatars/07.webp')
    assert.equal((await c.req('PUT', '/api/v1/me/avatar', { json: { preset: 16 } })).status, 400)
    assert.equal((await c.req('PUT', '/api/v1/me/avatar', { json: {} })).status, 400)
    assert.equal((await c.req('PUT', '/api/v1/me/avatar', { json: { image: 'data:image/png;base64,AAAA' } })).status, 400)

    const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#3a7' } }).png().toBuffer()
    const u = await c.req('PUT', '/api/v1/me/avatar', { json: { image: `data:image/png;base64,${png.toString('base64')}` } })
    assert.equal(u.status, 200, JSON.stringify(u.body))
    assert.match(u.body.avatarUrl, /^\/api\/v1\/avatars\/usr_/)
    const img = await fetch(srv.base + u.body.avatarUrl)
    assert.equal(img.status, 200)
    const meta = await sharp(Buffer.from(await img.arrayBuffer())).metadata()
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 384, 384])

    // a later sign-in keeps the user's own choice
    const me = await c.req('GET', '/api/v1/me')
    assert.equal(me.body.avatarUrl, u.body.avatarUrl)
  })
})
