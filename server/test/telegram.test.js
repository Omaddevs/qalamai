// "Telegram orqali kiriş" with the Bot API replaced by a recorder: the site asks, the bot
// receives /start and a contact, the site reads the code (auto-fill) and signs in.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createTelegramLogin } from '../src/modules/telegram/login.js'
import { client, startServer } from './helpers.js'

let srv
let sent
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9])
before(async () => {
  srv = await startServer()
  sent = []
  const bot = {
    getMe: async () => ({ username: 'qalam_test_bot' }),
    sendMessage: async (chatId, text, extra) => sent.push({ chatId, text, extra }),
    // user 5001 has a picture; everyone else hides it
    profilePhoto: async (userId) => (String(userId) === '5001' ? JPEG : null),
  }
  const { db, auth, config, storage } = srv.app.ctx
  srv.app.ctx.telegram = createTelegramLogin({ db, bot, auth, secret: config.auth.jwtSecret, storage })
})
after(() => srv.close())

const tg = () => srv.app.ctx.telegram
let updateId = 1
const fromUser = (id, extra = {}) => ({ id, first_name: 'Jasur', is_bot: false, ...extra })
const message = (from, fields) => ({ update_id: updateId++, message: { message_id: updateId, chat: { id: from.id, type: 'private' }, from, date: 0, ...fields } })
const openBot = (from, id) => tg().handleUpdate(message(from, { text: `/start ${id}` }))
const shareContact = (from, phone, userId = from.id) => tg().handleUpdate(message(from, { contact: { phone_number: phone, first_name: 'X', user_id: userId } }))

/** Browser side: start, keep the qalam_tg cookie, poll, verify. */
function browser() {
  const c = client(srv.base)
  let tgCookie = null
  return {
    c,
    async start(phone) {
      const r = await srv.app.inject({ method: 'POST', url: '/api/v1/auth/telegram/start', payload: { phone } })
      const ck = r.cookies.find((x) => x.name === 'qalam_tg')
      if (ck) tgCookie = `qalam_tg=${ck.value}`
      return r
    },
    status: (id, cookie = tgCookie) => srv.app.inject({ method: 'GET', url: `/api/v1/auth/telegram/${id}`, headers: cookie ? { cookie } : {} }),
    async verify(id, code, extra = {}) {
      const headers = { ...(tgCookie ? { cookie: tgCookie } : {}), ...(c.token ? { authorization: `Bearer ${c.token}` } : {}) }
      const r = await srv.app.inject({ method: 'POST', url: `/api/v1/auth/telegram/${id}/verify`, payload: { code, ...extra }, headers })
      return { status: r.statusCode, body: r.json() }
    },
  }
}

test('guest confirms their own number in the bot → code auto-fills → same account, phone verified', async () => {
  const b = browser()
  const guest = await b.c.req('POST', '/api/v1/auth/guest')

  const st = await b.start('90 123 45 67')
  assert.equal(st.statusCode, 200, st.body)
  const { id, botUrl, phone } = st.json()
  assert.equal(phone, '+998901234567')
  assert.equal(botUrl, `https://t.me/qalam_test_bot?start=${id}`)
  assert.equal((await b.status(id)).json().status, 'pending')

  const me = fromUser(5001, { last_name: 'Karimov', username: 'jasur_k' })
  await openBot(me, id)
  assert.match(sent.at(-1).text, /\+998 90 \*\*\* 45 67/, 'bot shows the masked number')
  assert.equal(sent.at(-1).extra.reply_markup.keyboard[0][0].request_contact, true)
  assert.equal((await b.status(id)).json().status, 'opened')

  await shareContact(me, '998901234567')
  const code = tg().codeFor(id)
  assert.match(sent.at(-1).text, new RegExp(code))
  const s = (await b.status(id)).json()
  assert.deepEqual(s, { status: 'verified', code }, 'browser gets the code for auto-fill')

  const wrong = await b.verify(id, code === '000000' ? '111111' : '000000')
  assert.equal(wrong.status, 400)
  const ok = await b.verify(id, code)
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.user.id, guest.body.user.id, 'guest upgraded in place')
  assert.equal(ok.body.user.phone, '+998901234567')
  assert.equal(ok.body.user.phoneVerified, true)
  assert.equal(ok.body.user.name, 'Jasur Karimov', 'name from Telegram')
  assert.equal(ok.body.user.telegramUsername, 'jasur_k')
  assert.equal(ok.body.user.linked.telegram, true)

  // the Telegram profile picture is the avatar now
  assert.match(ok.body.user.avatarUrl, /^\/api\/v1\/avatars\/usr_\w+\?v=\d+$/)
  const pic = await srv.app.inject({ method: 'GET', url: ok.body.user.avatarUrl })
  assert.equal(pic.statusCode, 200)
  assert.equal(pic.headers['content-type'], 'image/jpeg')
  assert.deepEqual(pic.rawPayload, JPEG)

  const again = await b.verify(id, code)
  assert.notEqual(again.status, 200, 'single use')
})

test('someone else’s number can not be confirmed', async () => {
  const b = browser()
  const { id } = (await b.start('+998 93 555 11 22')).json()
  const attacker = fromUser(6001)
  await openBot(attacker, id)

  // the attacker's own Telegram number differs from the one typed on the site
  await shareContact(attacker, '+998977777777')
  assert.match(sent.at(-1).text, /mos emas/)
  // a forwarded contact of the victim: user_id is the victim's (or missing)
  await shareContact(attacker, '+998935551122', 7777)
  assert.match(sent.at(-1).text, /Faqat öz raqamingizni/)
  await shareContact(attacker, '+998935551122', null)
  assert.match(sent.at(-1).text, /Faqat öz raqamingizni/)

  const s = (await b.status(id)).json()
  assert.equal(s.status, 'opened')
  assert.equal(s.code, undefined, 'no code leaks')
  const v = await b.verify(id, tg().codeFor(id))
  assert.equal(v.status, 400)
  assert.equal(v.body.error.code, 'TG_NOT_CONFIRMED')
})

test('the code and status need the browser that started the request', async () => {
  const b = browser()
  const { id } = (await b.start('+998 94 000 00 01')).json()
  const u = fromUser(8001)
  await openBot(u, id)
  await shareContact(u, '+998940000001')

  assert.equal((await b.status(id, null)).statusCode, 404)
  assert.equal((await b.status(id, 'qalam_tg=guess')).statusCode, 404)
  const other = await client(srv.base).req('POST', `/api/v1/auth/telegram/${id}/verify`, { json: { code: tg().codeFor(id) } })
  assert.equal(other.status, 404)
})

test('a link opened by one Telegram account can not be taken over by another', async () => {
  const b = browser()
  const { id } = (await b.start('+998 95 000 00 02')).json()
  await openBot(fromUser(9001), id)
  await openBot(fromUser(9002), id)
  assert.match(sent.at(-1).text, /boşqa Telegram hisobi/)
})

test('existing phone account (password) gets linked, and the password keeps working', async () => {
  const reg = await client(srv.base).req('POST', '/api/v1/auth/register', { json: { login: '+998 99 111 22 33', password: 'parol12345', name: 'Dilnoza' } })
  assert.equal(reg.status, 200)
  assert.equal(reg.body.user.phoneVerified, false)

  const b = browser()
  const { id } = (await b.start('991112233')).json()
  const u = fromUser(10001, { first_name: 'D' })
  await openBot(u, id)
  await shareContact(u, '+998 99 111 22 33')
  const ok = await b.verify(id, tg().codeFor(id))
  assert.equal(ok.body.user.id, reg.body.user.id)
  assert.equal(ok.body.user.name, 'Dilnoza', 'an existing name is kept')
  assert.equal(ok.body.user.phoneVerified, true)
  assert.equal(ok.body.user.avatarUrl, reg.body.user.avatarUrl, 'no Telegram picture: the drawn avatar from sign-up stays')
  assert.match(ok.body.user.avatarUrl, /^\/avatars\/\d{2}\.webp$/)

  const login = await client(srv.base).req('POST', '/api/v1/auth/login', { json: { login: '+998991112233', password: 'parol12345' } })
  assert.equal(login.status, 200)
})

test('wrong codes run out; bad numbers and missing bot are refused', async () => {
  const b = browser()
  const { id } = (await b.start('+998 90 999 88 77')).json()
  const u = fromUser(11001)
  await openBot(u, id)
  await shareContact(u, '+998909998877')
  const bad = tg().codeFor(id) === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) await b.verify(id, bad)
  const locked = await b.verify(id, tg().codeFor(id))
  assert.equal(locked.status, 429)

  const r = await browser().start('12345')
  assert.equal(r.statusCode, 400)

  const saved = srv.app.ctx.telegram
  srv.app.ctx.telegram = null
  const off = await browser().start('+998901112233')
  srv.app.ctx.telegram = saved
  assert.equal(off.statusCode, 503)
})
