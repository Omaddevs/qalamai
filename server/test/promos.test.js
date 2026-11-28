import assert from 'node:assert/strict'
import { after, before, mock, test } from 'node:test'
import { client, startServer } from './helpers.js'
import { SIGNUP_BONUS } from '../../shared/coins.js'
import { fridayWindow, lastFridays, tashkentDay } from '../../shared/promos.js'

let srv
before(async () => {
  process.env.ADMIN_PASSWORD = 'Aksiya-parol-1'
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

async function member({ ref, vid } = {}) {
  const c = client(srv.base)
  const login = `p${Math.random().toString(36).slice(2, 10)}@test.uz`
  const cookie = [ref && `qalam_ref=${ref}`, vid && `qalam_vid=${vid}`].filter(Boolean).join('; ')
  const r = await c.req('POST', '/api/v1/auth/register', { json: { login, password: 'parol12345', name: 'Aziz Karimov' }, headers: cookie ? { cookie } : {} })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return { c, user: r.body.user, res: r }
}

const balance = async (c) => (await c.req('GET', '/api/v1/coins')).body.balance

test('friday window in Tashkent time', () => {
  // 2026-11-27 is a Friday; 23:30 Tashkent on Thursday is still not Friday
  assert.equal(fridayWindow(new Date('2026-11-26T18:29:00Z')).today, false)
  const f = fridayWindow(new Date('2026-11-26T19:30:00Z')) // 00:30 Friday in Tashkent
  assert.equal(f.today, true)
  assert.equal(f.key, '2026-11-27')
  assert.equal(f.endsAt.toISOString(), '2026-11-27T19:00:00.000Z')
  assert.equal(fridayWindow(new Date('2026-11-28T10:00:00Z')).nextAt.toISOString(), '2026-12-03T19:00:00.000Z')
  assert.deepEqual(lastFridays(3, new Date('2026-11-28T10:00:00Z')), ['2026-11-27', '2026-11-20', '2026-11-13'])
  assert.deepEqual(lastFridays(1, new Date('2026-11-27T10:00:00Z')), ['2026-11-27'])
  assert.equal(tashkentDay(new Date('2026-11-27T19:00:00Z')), '2026-11-28')
})

test('friday coins: once per Friday, only on Friday, admin amount and switch', async () => {
  const { c } = await member()
  const before = await balance(c)
  const st = await c.req('GET', '/api/v1/promos')
  assert.equal(st.status, 200)
  assert.equal(st.body.friday.coins, 20)

  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-27T07:00:00Z') })
  try {
    const s = await c.req('GET', '/api/v1/promos')
    assert.equal(s.body.friday.canClaim, true)
    const a = await c.req('POST', '/api/v1/promos/friday/claim')
    assert.equal(a.status, 200, JSON.stringify(a.body))
    assert.equal(a.body.balance, before + 20)
    const b = await c.req('POST', '/api/v1/promos/friday/claim')
    assert.equal(b.status, 409)
    assert.equal(b.body.error.code, 'ALREADY_CLAIMED')
    assert.equal((await c.req('GET', '/api/v1/promos')).body.friday.claimed, true)

    // the admin raises the amount: a new account gets the new amount
    const adm = adminClient()
    await adm('POST', '/api/v1/admin/login', { password: 'Aksiya-parol-1' })
    const cur = (await adm('GET', '/api/v1/admin/promos')).body
    assert.equal(cur.stats.friday.weeks[0].day, '2026-11-27')
    assert.equal(cur.stats.friday.weeks[0].users, 1)
    const saved = await adm('PUT', '/api/v1/admin/promos', { ...cur.settings, friday: { enabled: true, coins: 35 } })
    assert.equal(saved.status, 200)
    const other = await member()
    const o = await other.c.req('POST', '/api/v1/promos/friday/claim')
    assert.equal(o.body.coins, 35)

    // switched off
    await adm('PUT', '/api/v1/admin/promos', { ...cur.settings, friday: { enabled: false, coins: 35 } })
    const third = await member()
    const off = await third.c.req('POST', '/api/v1/promos/friday/claim')
    assert.equal(off.body.error.code, 'PROMO_OFF')
    await adm('PUT', '/api/v1/admin/promos', { ...cur.settings, friday: { enabled: true, coins: 20 } })
  } finally {
    mock.timers.reset()
  }

  // not Friday any more (today in the test is the real date, or a Friday — then it is claimed already)
  const late = await c.req('POST', '/api/v1/promos/friday/claim')
  assert.equal(late.status, 409)
})

test('guests cannot take the friday coins', async () => {
  const g = client(srv.base)
  await g.req('POST', '/api/v1/auth/guest')
  const r = await g.req('POST', '/api/v1/promos/friday/claim')
  assert.equal(r.status, 403)
})

test('referral: the inviter gets coins once per friend, with limits and checks', async () => {
  const inviter = await member({ vid: 'visitor-aaaa-1111' })
  const st = (await inviter.c.req('GET', '/api/v1/promos')).body
  const code = st.referral.code
  assert.match(code, /^[A-Z2-9]{7}$/)
  assert.equal((await inviter.c.req('GET', '/api/v1/promos')).body.referral.code, code, 'the code stays the same')
  const start = await balance(inviter.c)

  // the public check used by the sign-up page
  const pub = await client(srv.base).req('GET', `/api/v1/promos/invite/${code.toLowerCase()}`)
  assert.equal(pub.body.invite.name, 'Aziz K.')
  assert.equal((await client(srv.base).req('GET', '/api/v1/promos/invite/NOPE2345')).body.invite, null)

  const friend = await member({ ref: code, vid: 'visitor-bbbb-2222' })
  assert.equal(friend.user.coins, SIGNUP_BONUS, 'no extra for the friend by default')
  assert.ok(friend.res.headers.getSetCookie().some((s) => s.startsWith('qalam_ref=;')), 'the ref cookie is cleared')
  assert.equal(await balance(inviter.c), start + 30)

  const mine = (await inviter.c.req('GET', '/api/v1/promos')).body.referral
  assert.equal(mine.invited, 1)
  assert.equal(mine.rewarded, 1)
  assert.equal(mine.earned, 30)
  assert.equal(mine.friends[0].name, 'Aziz K.')
  const notes = (await inviter.c.req('GET', '/api/v1/notifications')).body
  assert.ok((notes.items ?? notes.notifications ?? []).some((n) => n.kind === 'referral.reward'), JSON.stringify(notes).slice(0, 300))

  // the same browser as the inviter: not paid
  await member({ ref: code, vid: 'visitor-aaaa-1111' })
  assert.equal(await balance(inviter.c), start + 30)

  // the admin gives the friend a bonus too and caps it at 2 paid friends
  const adm = adminClient()
  await adm('POST', '/api/v1/admin/login', { password: 'Aksiya-parol-1' })
  const cur = (await adm('GET', '/api/v1/admin/promos')).body.settings
  await adm('PUT', '/api/v1/admin/promos', { ...cur, referral: { enabled: true, coins: 50, friendCoins: 10, maxPerUser: 2 } })
  const f2 = await member({ ref: code, vid: 'visitor-cccc-3333' })
  assert.equal(f2.user.coins, SIGNUP_BONUS + 10)
  assert.equal(await balance(inviter.c), start + 80)
  await member({ ref: code, vid: 'visitor-dddd-4444' }) // over the limit
  assert.equal(await balance(inviter.c), start + 80)

  // switched off: recorded but not paid
  await adm('PUT', '/api/v1/admin/promos', { ...cur, referral: { ...cur.referral, enabled: false } })
  await member({ ref: code, vid: 'visitor-eeee-5555' })
  assert.equal(await balance(inviter.c), start + 80)

  const stats = (await adm('GET', '/api/v1/admin/promos')).body.stats.referral
  assert.equal(stats.total, 5)
  assert.equal(stats.rewarded, 2)
  assert.equal(stats.skipped, 3)
  assert.deepEqual(stats.recent.map((r) => r.reason).sort(), [null, null, 'limit', 'off', 'same_device'].sort())
  assert.equal(stats.top[0].id, inviter.user.id)
  assert.equal(stats.top[0].coins, 80)

  // bad body is refused
  assert.equal((await adm('PUT', '/api/v1/admin/promos', { ...cur, friday: { enabled: true, coins: 0 } })).status, 400)
  await adm('PUT', '/api/v1/admin/promos', cur)
})
