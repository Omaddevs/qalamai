// QalamAI's own Uzbek voice (tts/server.py), against a stand-in for that service.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { client, startServer } from './helpers.js'

const calls = []
const fake = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/speak') {
      const json = JSON.parse(body)
      calls.push(json)
      if (json.text.includes('BUZUQ')) {
        res.writeHead(422, { 'content-type': 'application/json' })
        return res.end('{"error":"NothingToPronounce"}')
      }
      res.writeHead(200, { 'content-type': 'audio/wav' })
      return res.end(Buffer.from(`RIFF-${json.voice}`))
    }
    res.writeHead(404)
    res.end()
  })
})

let srv
before(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  process.env.LOCAL_TTS_URL = `http://127.0.0.1:${fake.address().port}`
  srv = await startServer()
})
after(async () => {
  delete process.env.LOCAL_TTS_URL
  await srv?.close()
  fake.close()
})

describe('own Uzbek voice', () => {
  test('Uzbek has a man’s and a woman’s voice; other languages have none here', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const info = await c.req('GET', '/api/v1/voice')
    assert.equal(info.body.on, true)
    assert.deepEqual(info.body.langs.sort(), ['uz', 'uz-cyrl'])
    assert.deepEqual(info.body.genders.uz, ['f', 'm'])
    const ru = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Привет', lang: 'ru' } })
    assert.equal(ru.status, 503)
    assert.equal(ru.body.error.code, 'VOICE_OFF')
  })

  test('speaks the current Latin spelling with the plain apostrophe, in the asked voice', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const m = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Özbekiston — ğalaba!', lang: 'uz', voice: 'm', rate: 1.2 } })
    assert.equal(m.status, 200)
    assert.equal(m.headers.get('content-type'), 'audio/wav')
    assert.equal(m.body.toString(), 'RIFF-m')
    assert.deepEqual(calls.at(-1), { text: "O'zbekiston — g'alaba!", voice: 'm', speed: 1.2 })
    const f = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Ўзбекистон', lang: 'uz-cyrl', voice: 'f' } })
    assert.equal(f.body.toString(), 'RIFF-f')
    assert.equal(calls.at(-1).text, "O'zbekiston")
  })

  test('a sentence the model can’t read is an error, not a crash', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const r = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'BUZUQ', lang: 'uz' } })
    assert.equal(r.status, 502)
    assert.equal(r.body.error.code, 'VOICE_FAILED')
  })
})
