// "Google bilan kiriş" end to end, with Google itself replaced by a fake client:
// state/PKCE cookie, callback checks, guest upgrade, linking by e-mail, repeat sign-in.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { generateKeyPair, SignJWT } from 'jose'
import { createGoogleClient, pkceChallenge } from '../src/modules/auth/google.js'
import { client, startServer } from './helpers.js'

const HOST = 'localhost:5173' // APP_URL default
let srv

before(async () => {
  srv = await startServer()
})
after(() => srv.close())

/** Fake Google: the "code" carries the identity it should resolve to. */
function useFakeGoogle() {
  const seen = []
  srv.app.ctx.google = {
    authUrl: ({ redirectUri, state, verifier }) => `https://accounts.google.test/auth?state=${state}&v=${verifier}&r=${encodeURIComponent(redirectUri)}`,
    async identity({ code, redirectUri, verifier }) {
      seen.push({ redirectUri, verifier })
      return JSON.parse(Buffer.from(code, 'base64url').toString())
    },
  }
  return seen
}
const codeFor = (identity) => Buffer.from(JSON.stringify(identity)).toString('base64url')

/** Walk the browser through /google → Google → /google/callback. */
async function signIn(identity, { rtCookie } = {}) {
  const start = await srv.app.inject({ method: 'GET', url: '/api/v1/auth/google', headers: { host: HOST } })
  assert.equal(start.statusCode, 302)
  const state = new URL(start.headers.location).searchParams.get('state')
  const g = start.cookies.find((c) => c.name === 'qalam_g')
  assert.ok(g?.httpOnly, 'state cookie is httpOnly')
  const cookie = [`qalam_g=${g.value}`, rtCookie].filter(Boolean).join('; ')
  const cb = await srv.app.inject({
    method: 'GET',
    url: `/api/v1/auth/google/callback?code=${codeFor(identity)}&state=${state}`,
    headers: { host: HOST, cookie },
  })
  const rt = cb.cookies.find((c) => c.name === 'qalam_rt')
  return { cb, rt: rt ? `qalam_rt=${rt.value}` : null }
}

async function me(rt) {
  const r = await srv.app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: rt } })
  assert.equal(r.statusCode, 200, r.body)
  return r.json().user
}

test('without keys the button sends the user back with a reason', async () => {
  srv.app.ctx.google = null
  const r = await srv.app.inject({ method: 'GET', url: '/api/v1/auth/google', headers: { host: HOST } })
  assert.equal(r.statusCode, 302)
  assert.match(r.headers.location, /auth_error=google_off/)
})

test('start redirects other hosts to APP_URL so the state cookie lands where Google returns', async () => {
  useFakeGoogle()
  const r = await srv.app.inject({ method: 'GET', url: '/api/v1/auth/google', headers: { host: '127.0.0.1:5173' } })
  assert.equal(r.headers.location, 'http://localhost:5173/api/v1/auth/google')
})

test('guest signs in with Google → same account, upgraded; second sign-in finds it again', async () => {
  const seen = useFakeGoogle()
  const c = client(srv.base)
  const guest = await c.req('POST', '/api/v1/auth/guest')
  const guestRt = guest.headers.getSetCookie().find((s) => s.startsWith('qalam_rt=')).split(';')[0]

  const id = { sub: 'g-111', email: 'Lola@Gmail.com', emailVerified: true, name: 'Lola' }
  const { cb, rt } = await signIn(id, { rtCookie: guestRt })
  assert.equal(cb.headers.location, 'http://localhost:5173/#/')
  assert.equal(seen.at(-1).redirectUri, 'http://localhost:5173/api/v1/auth/google/callback')
  assert.ok(seen.at(-1).verifier.length >= 43, 'PKCE verifier passed through')

  const u = await me(rt)
  assert.equal(u.id, guest.body.user.id, 'guest upgraded in place')
  assert.equal(u.isGuest, false)
  assert.equal(u.email, 'lola@gmail.com')
  assert.equal(u.name, 'Lola')
  assert.ok(u.coins > 0, 'signup bonus')

  const old = await srv.app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: guestRt } })
  assert.equal(old.statusCode, 401, 'guest refresh token revoked')

  const again = await signIn({ ...id, email: 'other@gmail.com' })
  assert.equal((await me(again.rt)).id, u.id, 'found by Google id')
})

test('Google account with an e-mail already registered links to that account', async () => {
  useFakeGoogle()
  const c = client(srv.base)
  const reg = await c.req('POST', '/api/v1/auth/register', { json: { login: 'aziz@mail.uz', password: 'parol12345', name: 'Aziz' } })
  assert.equal(reg.status, 200)

  const { rt } = await signIn({ sub: 'g-222', email: 'aziz@mail.uz', emailVerified: true, name: 'Aziz G' })
  const u = await me(rt)
  assert.equal(u.id, reg.body.user.id)
  assert.equal(u.name, 'Aziz', 'existing name kept')

  // the password still works
  const login = await client(srv.base).req('POST', '/api/v1/auth/login', { json: { login: 'aziz@mail.uz', password: 'parol12345' } })
  assert.equal(login.status, 200)
})

test('an unverified Google e-mail never takes over an existing account', async () => {
  useFakeGoogle()
  await client(srv.base).req('POST', '/api/v1/auth/register', { json: { login: 'vali@mail.uz', password: 'parol12345' } })
  const { rt } = await signIn({ sub: 'g-333', email: 'vali@mail.uz', emailVerified: false, name: 'Vali' })
  const u = await me(rt)
  assert.equal(u.email, null)
  assert.equal(u.name, 'Vali')
})

test('callback rejects a missing or wrong state, and a cancelled consent', async () => {
  useFakeGoogle()
  const code = codeFor({ sub: 'g-444', email: null, emailVerified: false, name: '' })
  const noCookie = await srv.app.inject({ method: 'GET', url: `/api/v1/auth/google/callback?code=${code}&state=abc`, headers: { host: HOST } })
  assert.match(noCookie.headers.location, /auth_error=google_state/)
  assert.ok(!noCookie.cookies.some((c) => c.name === 'qalam_rt' && c.value))

  const wrong = await srv.app.inject({
    method: 'GET',
    url: `/api/v1/auth/google/callback?code=${code}&state=abd`,
    headers: { host: HOST, cookie: 'qalam_g=abc.verifier' },
  })
  assert.match(wrong.headers.location, /auth_error=google_state/)

  const denied = await srv.app.inject({ method: 'GET', url: '/api/v1/auth/google/callback?error=access_denied', headers: { host: HOST } })
  assert.match(denied.headers.location, /auth_error=google_cancelled/)
})

test('the real client verifies the ID token signature, issuer and audience', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const token = (claims, aud = 'cid') =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://accounts.google.com').setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey)
  let sent
  const make = (idToken) =>
    createGoogleClient(
      { clientId: 'cid', clientSecret: 'sec' },
      {
        jwks: async () => publicKey,
        fetchFn: async (url, init) => {
          sent = Object.fromEntries(init.body)
          return new Response(JSON.stringify({ id_token: idToken }), { status: 200, headers: { 'content-type': 'application/json' } })
        },
      },
    )

  const ok = await make(await token({ sub: '42', email: 'A@B.UZ', email_verified: true, name: 'Ali' })).identity({ code: 'c', redirectUri: 'r', verifier: 'v' })
  assert.deepEqual(ok, { sub: '42', email: 'a@b.uz', emailVerified: true, name: 'Ali' })
  assert.equal(sent.code_verifier, 'v')
  assert.equal(sent.client_secret, 'sec')

  await assert.rejects(make(await token({ sub: '42' }, 'someone-else')).identity({ code: 'c', redirectUri: 'r', verifier: 'v' }), /GOOGLE_TOKEN_INVALID|tasdiqlanmadi/)

  const url = new URL(make('x').authUrl({ redirectUri: 'http://x/cb', state: 's', verifier: 'v' }))
  assert.equal(url.searchParams.get('code_challenge'), pkceChallenge('v'))
  assert.equal(url.searchParams.get('scope'), 'openid email profile')
})
