// The presenter's Uzbek voice through Aisha (aisha.group), against a stand-in for its API.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { client, startServer } from './helpers.js'
import { aishaTts } from '../src/modules/voice/routes.js'

const calls = []
let balance = true
/** Reads the multipart form fields of a request (enough for plain text fields). */
const fieldsOf = (body) => Object.fromEntries([...body.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => [m[1], m[2]]))
const fake = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/api/v1/tts/post/') {
      const fields = fieldsOf(body)
      calls.push({ key: req.headers['x-api-key'], fields })
      if (!balance) {
        res.writeHead(402, { 'content-type': 'application/json' })
        return res.end('{"detail":"Insufficient balance"}')
      }
      res.writeHead(201, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ audio_path: `/media/tts_audios/r${calls.length}.wav` }))
    }
    if (req.method === 'GET' && req.url.startsWith('/media/tts_audios/')) {
      res.writeHead(200, { 'content-type': 'audio/wav' })
      return res.end(Buffer.from('RIFFfake-wav'))
    }
    res.writeHead(404)
    res.end()
  })
})

let srv
let base
before(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${fake.address().port}`
  process.env.AISHA_API_KEY = 'aisha-key'
  process.env.AISHA_API_URL = base
  srv = await startServer()
})
after(async () => {
  delete process.env.AISHA_API_KEY
  delete process.env.AISHA_API_URL
  await srv?.close()
  fake.close()
})

describe('Aisha voice', () => {
  test('Uzbek is spoken by Gulnoza, in the spelling Aisha reads', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const info = await c.req('GET', '/api/v1/voice')
    assert.equal(info.body.on, true)
    assert.deepEqual(info.body.langs.sort(), ['en', 'ru', 'uz', 'uz-cyrl'])
    // no cloned man's voice yet: Uzbek has only a woman's voice
    assert.deepEqual(info.body.genders.uz, ['f'])

    const r = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Özbekiston çiroyli, ğalaba!', lang: 'uz', voice: 'm', rate: 1.1 } })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'audio/wav')
    assert.equal(r.body.toString(), 'RIFFfake-wav')
    const { key, fields } = calls.at(-1)
    assert.equal(key, 'aisha-key')
    assert.equal(fields.transcript, "O'zbekiston chiroyli, g'alaba!")
    assert.equal(fields.language, 'uz')
    assert.equal(fields.model, 'Gulnoza')
    assert.equal(fields.mood, 'Neutral')
    assert.equal(fields.speed, '1.1')
    assert.equal(fields.voice_id, undefined)

    // the same sentence again comes from the cache
    const n = calls.length
    assert.equal((await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Özbekiston çiroyli, ğalaba!', lang: 'uz', voice: 'm', rate: 1.1 } })).status, 200)
    assert.equal(calls.length, n)
  })

  test('Russian goes to Aisha without the Uzbek-only fields', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    assert.equal((await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Привет, мир', lang: 'ru' } })).status, 200)
    const { fields } = calls.at(-1)
    assert.equal(fields.language, 'ru')
    assert.equal(fields.model, undefined)
    assert.equal(fields.mood, undefined)
  })

  test('a language Aisha does not speak, with no Azure key, is VOICE_OFF', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const r = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Hola', lang: 'es' } })
    assert.equal(r.status, 503)
    assert.equal(r.body.error.code, 'VOICE_OFF')
  })

  test('an empty Aisha balance is an error the player can fall back from', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    balance = false
    const r = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Yangi gap', lang: 'uz' } })
    balance = true
    assert.equal(r.status, 503)
    assert.equal(r.body.error.code, 'VOICE_BALANCE')
  })

  test('a cloned man’s voice is asked for by its id, without a mood', async () => {
    const run = aishaTts({ key: 'k', url: base, maleVoiceId: 12 })
    const out = await run({ text: 'Salom', lang: 'uz', gender: 'm', rate: 1 })
    assert.equal(out.ext, 'wav')
    const { fields } = calls.at(-1)
    assert.equal(fields.voice_id, '12')
    assert.equal(fields.model, undefined)
    assert.equal(fields.mood, undefined)
  })
})
