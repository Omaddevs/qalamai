// Sign-up / sign-in rules: no way in without an account, "sign in" never creates one and
// "sign up" never re-uses one (password, Google, Telegram), and password guessing is capped.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createTelegramLogin } from '../src/modules/telegram/login.js'
import { client, startServer } from './helpers.js'

const HOST = 'localhost:5173' // APP_URL default
let srv

before(async () => {
  srv = await startServer()
  const bot = { getMe: async () => ({ username: 'qalam_test_bot' }), sendMessage: async () => {}, profilePhoto: async () => null }
  const { db, auth, config, storage } = srv.app.ctx
  srv.app.ctx.telegram = createTelegramLogin({ db, bot, auth, secret: config.auth.jwtSecret, storage })
  srv.app.ctx.google = {
    authUrl: ({ state }) => `https://accounts.google.test/auth?state=${state}`,
    identity: async ({ code }) => JSON.parse(Buffer.from(code, 'base64url').toString()),
  }
})
after(() => srv.close())

const guestsOff = (fn) => async () => {
  srv.app.ctx.config.auth.allowGuests = false
  try {
    await fn()
  } finally {
    srv.app.ctx.config.auth.allowGuests = true
  }
}

/* ───────── no way in without an account ───────── */

test(
  'with guests off: no guest sessions, and a guest left from before is shut out',
  guestsOff(async () => {
    const r = await client(srv.base).req('POST', '/api/v1/auth/guest')
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'GUESTS_OFF')

    // a guest made while guests were on
    srv.app.ctx.config.auth.allowGuests = true
    const g = client(srv.base)
    assert.equal((await g.req('POST', '/api/v1/auth/guest')).status, 200)
    srv.app.ctx.config.auth.allowGuests = false

    const files = await g.req('GET', '/api/v1/files')
    assert.equal(files.status, 401)
    assert.equal(files.body.error.code, 'SIGN_IN_REQUIRED')
    const again = await g.req('POST', '/api/v1/auth/refresh')
    assert.equal(again.status, 401)
    assert.equal(again.body.error.code, 'SIGN_IN_REQUIRED')

    // a real account works as before
    const u = client(srv.base)
    assert.equal((await u.req('POST', '/api/v1/auth/register', { json: { login: 'real@mail.uz', password: 'parol12345' } })).status, 200)
    assert.equal((await u.req('GET', '/api/v1/files')).status, 200)
    assert.equal((await u.req('POST', '/api/v1/auth/refresh')).status, 200)
  }),
)

/* ───────── password ───────── */

test('sign-up refuses a taken login and a second account from inside a signed-in one', async () => {
  const a = client(srv.base)
  assert.equal((await a.req('POST', '/api/v1/auth/register', { json: { login: 'once@mail.uz', password: 'parol12345' } })).status, 200)

  const twice = await client(srv.base).req('POST', '/api/v1/auth/register', { json: { login: 'ONCE@mail.uz', password: 'boshqa12345' } })
  assert.equal(twice.status, 409)
  assert.equal(twice.body.error.code, 'ACCOUNT_EXISTS')

  const inside = await a.req('POST', '/api/v1/auth/register', { json: { login: 'second@mail.uz', password: 'parol12345' } })
  assert.equal(inside.status, 409)
  assert.equal(inside.body.error.code, 'ALREADY_SIGNED_IN')
})

test('five wrong passwords lock that login for a while — even the right password waits', async () => {
  await client(srv.base).req('POST', '/api/v1/auth/register', { json: { login: '+998 93 555 44 33', password: 'togri-parol-1' } })
  // the IP limit (10/min) is the outer guard; stay under it so the per-login lock is what answers
  const tryLogin = (password) => srv.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { login: '+998935554433', password }, remoteAddress: `10.0.0.${Math.floor(Math.random() * 250)}` })
  for (let i = 0; i < 5; i++) assert.equal((await tryLogin(`notogri-${i}-xx`)).statusCode, 401)
  const locked = await tryLogin('togri-parol-1')
  assert.equal(locked.statusCode, 429)
  assert.equal(locked.json().error.code, 'TOO_MANY_ATTEMPTS')
  // another login is not affected
  const other = await srv.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { login: 'once@mail.uz', password: 'parol12345' }, remoteAddress: '10.9.9.9' })
  assert.equal(other.statusCode, 200)
})

/* ───────── Google ───────── */

const codeFor = (identity) => Buffer.from(JSON.stringify(identity)).toString('base64url')
async function google(identity, mode) {
  const start = await srv.app.inject({ method: 'GET', url: `/api/v1/auth/google${mode ? `?mode=${mode}` : ''}`, headers: { host: HOST } })
  const state = new URL(start.headers.location).searchParams.get('state')
  const g = start.cookies.find((c) => c.name === 'qalam_g')
  const cb = await srv.app.inject({ method: 'GET', url: `/api/v1/auth/google/callback?code=${codeFor(identity)}&state=${state}`, headers: { host: HOST, cookie: `qalam_g=${g.value}` } })
  return { location: cb.headers.location, signedIn: cb.cookies.some((c) => c.name === 'qalam_rt' && c.value) }
}

test('Google: "sign in" never creates an account, "sign up" never re-uses one', async () => {
  const who = { sub: 'g-new-1', email: 'yangi@gmail.com', emailVerified: true, name: 'Yangi' }

  const login = await google(who, 'login')
  assert.equal(login.signedIn, false)
  assert.match(login.location, /auth_error=google_no_account#\/auth$/, 'sent to the sign-up form')

  const signup = await google(who, 'signup')
  assert.equal(signup.signedIn, true)
  assert.match(signup.location, /\/#\/$/)

  const again = await google(who, 'signup')
  assert.equal(again.signedIn, false)
  assert.match(again.location, /auth_error=google_exists#\/auth\/login$/, 'sent to the sign-in form')

  const back = await google(who, 'login')
  assert.equal(back.signedIn, true)

  // a password account with the same e-mail counts as "already registered" too
  await client(srv.base).req('POST', '/api/v1/auth/register', { json: { login: 'parolli@gmail.com', password: 'parol12345' } })
  const clash = await google({ sub: 'g-new-2', email: 'parolli@gmail.com', emailVerified: true, name: 'P' }, 'signup')
  assert.equal(clash.signedIn, false)
  assert.match(clash.location, /google_exists/)
})

/* ───────── Telegram ───────── */

let updateId = 1
const say = (from, fields) => srv.app.ctx.telegram.handleUpdate({ update_id: updateId++, message: { message_id: updateId, chat: { id: from.id, type: 'private' }, from, date: 0, ...fields } })

async function telegram(phone, from, mode, verifyMode = mode) {
  const start = await srv.app.inject({ method: 'POST', url: '/api/v1/auth/telegram/start', payload: { phone, ...(mode ? { mode } : {}) } })
  if (start.statusCode !== 200) return { start }
  const { id } = start.json()
  const cookie = `qalam_tg=${start.cookies.find((c) => c.name === 'qalam_tg').value}`
  await say(from, { text: `/start ${id}` })
  await say(from, { contact: { phone_number: phone, first_name: 'X', user_id: from.id } })
  const code = srv.app.ctx.telegram.codeFor(id)
  const verify = (m) => srv.app.inject({ method: 'POST', url: `/api/v1/auth/telegram/${id}/verify`, payload: { code, ...(m ? { mode: m } : {}) }, headers: { cookie } })
  return { start, verify: await verify(verifyMode), retry: verify }
}

test('Telegram: "sign in" needs an account, "sign up" refuses an existing one — before the bot trip and at the code', async () => {
  const from = { id: 70001, first_name: 'Sardor', is_bot: false }

  const login = await telegram('+998 97 100 20 30', from, 'login')
  assert.equal(login.start.statusCode, 404)
  assert.equal(login.start.json().error.code, 'ACCOUNT_NOT_FOUND')

  const signup = await telegram('+998 97 100 20 30', from, 'signup')
  assert.equal(signup.verify.statusCode, 200)

  const again = await telegram('+998 97 100 20 30', from, 'signup')
  assert.equal(again.start.statusCode, 409)
  assert.equal(again.start.json().error.code, 'ACCOUNT_EXISTS')

  const back = await telegram('+998 97 100 20 30', from, 'login')
  assert.equal(back.verify.statusCode, 200)
  assert.equal(back.verify.json().user.id, signup.verify.json().user.id)

  // the form changed between the bot and the code: refused without spending the code
  const other = { id: 70002, first_name: 'Nodira', is_bot: false }
  const mixed = await telegram('+998 97 200 30 40', other, 'signup', 'login')
  assert.equal(mixed.verify.statusCode, 404)
  assert.equal((await mixed.retry('signup')).statusCode, 200, 'the same code still works on the right form')
})
