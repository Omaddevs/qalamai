// «AI taqdimotçi»: the script checks (pure functions, no model calls) and the voice endpoint
// against a stand-in for Azure AI Speech.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { client, startServer } from './helpers.js'
import { DRAWS, cleanNarration, narratePrompt, narrateSystem } from '../src/modules/ai/narrate.js'
import { spoken, ssml } from '../src/modules/voice/voices.js'

const slides = [
  { items: [{ k: 'text', t: 'Iqlim özgarişi' }, { k: 'image', t: 'glacier' }] },
  { items: [{ k: 'text', t: 'Sabablar' }, { k: 'chart', t: 'CO2' }] },
]

describe('cleanNarration', () => {
  test('keeps the spoken parts and valid cues', () => {
    const s = cleanNarration({ slide: 1, say: [{ text: 'Mana sabablar.', do: 'underline', on: 0 }, { text: 'Grafikka qarang', do: 'box', on: 1 }] }, slides)
    assert.deepEqual(s, { slide: 1, say: [{ text: 'Mana sabablar.', do: 'underline', on: 0 }, { text: 'Grafikka qarang', do: 'box', on: 1 }] })
  })

  test('a cue on a missing anchor is dropped, the words stay', () => {
    const s = cleanNarration({ slide: 0, say: [{ text: 'Salom!', do: 'circle', on: 9 }] }, slides)
    assert.deepEqual(s.say, [{ text: 'Salom!' }])
  })

  test('text-only cues on a picture become a circle; unknown cues are ignored', () => {
    const s = cleanNarration({ slide: 0, say: [{ text: 'Rasmga qarang', do: 'underline', on: 1 }, { text: 'Va bu', do: 'explode', on: 0 }] }, slides)
    assert.deepEqual(s.say, [{ text: 'Rasmga qarang', do: 'circle', on: 1 }, { text: 'Va bu' }])
  })

  test('markdown and wrapping quotes are removed; empty answers are null', () => {
    assert.equal(cleanNarration({ slide: 0, say: [{ text: '"**Muhim** gap"' }] }, slides).say[0].text, 'Muhim gap')
    assert.equal(cleanNarration({ slide: 5, say: [{ text: 'x y' }] }, slides), null)
    assert.equal(cleanNarration({ slide: 0, say: [] }, slides), null)
    assert.equal(cleanNarration(null, slides), null)
  })

  test('the prompt numbers the anchors and names every cue', () => {
    const p = narratePrompt({ lang: 'uz', title: 'Iqlim', tone: 'lesson', length: 'short', slides })
    assert.match(p, /\[1\] image: "glacier"/)
    assert.match(p, /exactly 2 lines/)
    const sys = narrateSystem('short')
    assert.match(sys, /25–45 words/)
    for (const d of DRAWS) assert.ok(sys.includes(`"${d}"`), d)
  })
})

describe('voice text', () => {
  test('Uzbek in the new alphabet or Cyrillic is read in the current Latin spelling', () => {
    assert.equal(spoken('Özbekiston — çiroyli', 'uz'), 'Oʻzbekiston — chiroyli')
    assert.equal(spoken('Ўзбекистон', 'uz-cyrl'), 'Oʻzbekiston')
    assert.equal(spoken('  Привет   мир ', 'ru'), 'Привет мир')
  })

  test('SSML escapes the text and sets the speed', () => {
    const x = ssml({ text: 'A < B & "C"', locale: 'uz-UZ', voice: 'uz-UZ-MadinaNeural', rate: 1.2 })
    assert.match(x, /A &lt; B &amp; &quot;C&quot;/)
    assert.match(x, /rate="\+20%"/)
    assert.match(x, /name="uz-UZ-MadinaNeural"/)
  })
})

/* ───────── the endpoint, with a stand-in for Azure ───────── */

const calls = []
const fake = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    calls.push({ url: req.url, key: req.headers['ocp-apim-subscription-key'], format: req.headers['x-microsoft-outputformat'], body })
    if (body.includes('FAIL')) {
      res.writeHead(500)
      return res.end()
    }
    res.writeHead(200, { 'content-type': 'audio/mpeg' })
    res.end(Buffer.from('ID3fake-mp3'))
  })
})

let srv
before(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  process.env.AZURE_SPEECH_KEY = 'speech-key'
  process.env.AZURE_SPEECH_ENDPOINT = `http://127.0.0.1:${fake.address().port}`
  process.env.TTS_DAILY_CHARS = '60'
  srv = await startServer()
})
after(async () => {
  delete process.env.AZURE_SPEECH_KEY
  delete process.env.AZURE_SPEECH_ENDPOINT
  delete process.env.TTS_DAILY_CHARS
  await srv?.close()
  fake.close()
})

describe('POST /voice/tts', () => {
  test('needs a session', async () => {
    const r = await client(srv.base).req('POST', '/api/v1/voice/tts', { json: { text: 'Salom', lang: 'uz' } })
    assert.equal(r.status, 401)
  })

  test('speaks, caches the same sentence, and keeps a daily allowance', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const info = await c.req('GET', '/api/v1/voice')
    assert.equal(info.body.on, true)
    assert.ok(info.body.langs.includes('uz') && !info.body.langs.includes('ky'))

    const r = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Özbekiston çiroyli', lang: 'uz', voice: 'm' } })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'audio/mpeg')
    assert.equal(r.body.toString(), 'ID3fake-mp3')
    const call = calls.at(-1)
    assert.equal(call.url, '/cognitiveservices/v1')
    assert.equal(call.key, 'speech-key')
    assert.match(call.body, /uz-UZ-SardorNeural/)
    assert.match(call.body, /Oʻzbekiston chiroyli/)

    // the same sentence again: from the cache, Azure is not asked
    const n = calls.length
    assert.equal((await c.req('POST', '/api/v1/voice/tts', { json: { text: 'Özbekiston çiroyli', lang: 'uz', voice: 'm' } })).status, 200)
    assert.equal(calls.length, n)

    // 18 characters used of 60: a 50-character sentence is over the day's allowance
    const big = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'x'.repeat(50), lang: 'en' } })
    assert.equal(big.status, 429)
    assert.equal(big.body.error.code, 'VOICE_LIMIT')
  })

  test('a failed synthesis is an error and does not count', async () => {
    const c = client(srv.base)
    await c.req('POST', '/api/v1/auth/guest')
    const r = await c.req('POST', '/api/v1/voice/tts', { json: { text: 'FAIL', lang: 'en' } })
    assert.equal(r.status, 502)
    assert.equal(r.body.error.code, 'VOICE_FAILED')
    assert.equal((await c.req('POST', '/api/v1/voice/tts', { json: { text: 'y'.repeat(55), lang: 'en' } })).status, 200)
  })

  test('without the AI the script endpoint answers AI_OFF and charges nothing', async () => {
    const c = client(srv.base)
    const g = await c.req('POST', '/api/v1/auth/guest')
    const before = (await c.req('GET', '/api/v1/coins')).body.balance
    const r = await c.req('POST', '/api/v1/ai/narrate', { json: { lang: 'uz', ref: 'r-narrate-1', slides } })
    assert.equal(r.status, 503)
    assert.equal(r.body.error.code, 'AI_OFF')
    assert.equal((await c.req('GET', '/api/v1/coins')).body.balance, before)
    assert.ok(g.status < 300)
  })
})
