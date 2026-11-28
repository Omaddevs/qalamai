// The presenter's voice («AI taqdimotçi»): text → audio, through one of two services.
//
//   GET  /voice        → { on, langs: ['uz', …], genders: { uz: ['f', 'm'], … } }
//   POST /voice/tts    { text, lang, voice: 'f'|'m', rate } → audio/wav or audio/mpeg
//
// Services, best first for each language:
//   • Aisha (aisha.group, AISHA_API_KEY) — natural Uzbek (built on the Navoiy model). One built-in
//     voice, Gulnoza (a woman); a man's voice is a custom cloned voice (AISHA_MALE_VOICE_ID).
//     Also Russian and English.
//   • Azure AI Speech (AZURE_SPEECH_KEY) — neural voices for 23 languages, a woman and a man each.
// Every answer is kept on disk (storage/tts/<hash>.<ext>): the same sentence in the same voice is
// synthesized once, so replaying a presentation costs nothing. New characters count towards a
// daily allowance per account, so the endpoint can't be used as a free TTS service.
// With neither key it answers VOICE_OFF and the player uses the browser's voice.
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppError } from '../../lib/errors.js'
import { VOICES, spoken, ssml } from './voices.js'

const off = () => new AppError(503, 'VOICE_OFF', 'Ovoz xizmati ulanmagan')
const failed = () => new AppError(502, 'VOICE_FAILED', 'Ovoz xizmatidan javob kelmadi — birozdan keyin urinib köring')
export const TEXT_MAX = 900
const TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav' }

/** Azure AI Speech REST: SSML in, MP3 out. */
export function azureTts({ key, endpoint }) {
  return async ({ text, lang, gender, rate }) => {
    const v = VOICES[lang]
    const res = await fetch(`${endpoint}/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'content-type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'user-agent': 'qalamai-tts',
      },
      body: ssml({ text, locale: v.locale, voice: v[gender], rate }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429) throw new AppError(429, 'VOICE_BUSY', 'Ovoz xizmati band — birozdan keyin urinib köring')
    if (!res.ok) throw Object.assign(failed(), { upstream: res.status })
    return { audio: Buffer.from(await res.arrayBuffer()), ext: 'mp3' }
  }
}

/** Languages Aisha speaks (its API's language codes). */
export const AISHA_LANGS = { uz: 'uz', 'uz-cyrl': 'uz', ru: 'ru', en: 'en' }

/**
 * Aisha TTS REST (back.aisha.group): a form in, the address of a WAV file out, then the file.
 * Uzbek: the built-in Gulnoza voice with a mood, or a custom cloned voice (voice_id) for a man.
 */
export function aishaTts({ key, url, maleVoiceId = null, mood = 'Neutral' }) {
  return async ({ text, lang, gender, rate }) => {
    const language = AISHA_LANGS[lang]
    const form = new FormData()
    // Aisha's Uzbek is written with the plain apostrophe (oʻ → o')
    form.set('transcript', language === 'uz' ? text.replace(/[ʻʼ‘’`]/g, "'") : text)
    form.set('language', language)
    if (language === 'uz') {
      if (gender === 'm' && maleVoiceId) form.set('voice_id', String(maleVoiceId))
      else {
        form.set('model', 'Gulnoza')
        form.set('mood', mood)
      }
      form.set('speed', String(rate))
    }
    const headers = { 'X-Api-Key': key, 'Accept-Language': 'en', 'user-agent': 'qalamai-tts' }
    const res = await fetch(`${url}/api/v1/tts/post/`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(60_000) })
    if (res.status === 402) throw Object.assign(new AppError(503, 'VOICE_BALANCE', 'Ovoz xizmatida balans tugagan'), { upstream: 402 })
    if (res.status === 429) throw new AppError(429, 'VOICE_BUSY', 'Ovoz xizmati band — birozdan keyin urinib köring')
    if (!res.ok) throw Object.assign(failed(), { upstream: res.status })
    const { audio_path: path } = await res.json().catch(() => ({}))
    if (!path) throw Object.assign(failed(), { upstream: 'no audio_path' })
    const file = await fetch(new URL(path, url), { headers, signal: AbortSignal.timeout(60_000) })
    if (!file.ok) throw Object.assign(failed(), { upstream: `audio ${file.status}` })
    const type = file.headers.get('content-type') ?? ''
    return { audio: Buffer.from(await file.arrayBuffer()), ext: /mpeg|mp3/.test(type) ? 'mp3' : 'wav' }
  }
}

/** @param {import('fastify').FastifyInstance} app */
export default async function voiceRoutes(app) {
  const { config } = app.ctx
  const aisha = config.aisha ? { run: aishaTts(config.aisha), cfg: config.aisha } : null
  const azure = config.tts ? { run: azureTts(config.tts) } : null
  const daily = config.aisha?.dailyChars ?? config.tts?.dailyChars ?? 60_000
  const dir = join(config.storageDir, 'tts')
  await mkdir(dir, { recursive: true })

  /**
   * Who speaks `lang` in `gender`: { run, voice (a cache name), gender }. Uzbek goes to Aisha first;
   * Azure takes the languages Aisha doesn't speak (and Russian/English, where it has two voices).
   * A man's voice Aisha doesn't have yet is spoken by Azure if it can, else by Gulnoza.
   */
  function pick(lang, gender) {
    const uz = AISHA_LANGS[lang] === 'uz'
    if (aisha && uz) {
      const male = gender === 'm' && aisha.cfg.maleVoiceId
      if (gender === 'm' && !male && azure) return { run: azure.run, voice: `azure:${VOICES[lang].m}`, gender: 'm' }
      return { run: aisha.run, voice: male ? `aisha:v${aisha.cfg.maleVoiceId}` : `aisha:Gulnoza:${aisha.cfg.mood}`, gender: male ? 'm' : 'f' }
    }
    if (azure && VOICES[lang]) return { run: azure.run, voice: `azure:${VOICES[lang][gender]}`, gender }
    if (aisha && AISHA_LANGS[lang]) return { run: aisha.run, voice: `aisha:${AISHA_LANGS[lang]}`, gender }
    return null
  }
  const langs = Object.keys(VOICES).filter((l) => pick(l, 'f'))
  const genders = Object.fromEntries(langs.map((l) => [l, [...new Set(['f', 'm'].map((g) => pick(l, g).gender))]]))

  // characters synthesized today, per account (kept in memory: a restart only resets the day early)
  let day = ''
  const used = new Map()
  const spend = (userId, n) => {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== day) {
      day = today
      used.clear()
    }
    const now = (used.get(userId) ?? 0) + n
    if (now > daily) throw new AppError(429, 'VOICE_LIMIT', 'Bugungi ovoz limiti tugadi — ertaga yana davom etadi')
    used.set(userId, now)
  }

  app.addHook('preHandler', app.authenticate)

  app.get('/', { schema: { tags: ['voice'], summary: 'Qaysi tillarda server ovozi bor' } }, async () => ({ on: langs.length > 0, langs, genders }))

  app.post(
    '/tts',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['voice'],
        summary: 'Matndan ovoz, taqdimotçi uçun',
        body: {
          type: 'object',
          required: ['text', 'lang'],
          additionalProperties: false,
          properties: {
            text: { type: 'string', minLength: 1, maxLength: TEXT_MAX },
            lang: { type: 'string', enum: Object.keys(VOICES) },
            voice: { type: 'string', enum: ['f', 'm'] },
            rate: { type: 'number', minimum: 0.7, maximum: 1.4 },
          },
        },
      },
    },
    async (req, reply) => {
      const { lang, voice: g = 'f' } = req.body
      const who = pick(lang, g)
      if (!who) throw off()
      const rate = Math.round((req.body.rate ?? 1) * 20) / 20
      const text = spoken(req.body.text, lang)
      if (!text) throw new AppError(400, 'BAD_REQUEST', 'Matn böş')
      const hash = createHash('sha256').update(`${who.voice}|${rate}|${text}`).digest('hex').slice(0, 40)
      let hit = null
      for (const ext of ['mp3', 'wav']) {
        const audio = await readFile(join(dir, `${hash}.${ext}`)).catch(() => null)
        if (audio) {
          hit = { audio, ext }
          break
        }
      }
      if (!hit) {
        spend(req.user.id, text.length)
        try {
          hit = await who.run({ text, lang, gender: who.gender, rate })
        } catch (err) {
          used.set(req.user.id, Math.max(0, (used.get(req.user.id) ?? 0) - text.length))
          if (err instanceof AppError) {
            if (err.upstream) req.log.warn({ status: err.upstream, voice: who.voice }, 'tts upstream failed')
            throw err
          }
          req.log.warn({ err }, 'tts failed')
          throw failed()
        }
        const file = join(dir, `${hash}.${hit.ext}`)
        const tmp = `${file}.${process.pid}.tmp`
        await writeFile(tmp, hit.audio).then(() => rename(tmp, file)).catch((err) => req.log.warn({ err }, 'tts cache write failed'))
      }
      return reply.header('content-type', TYPES[hit.ext]).header('cache-control', 'private, max-age=31536000, immutable').send(hit.audio)
    },
  )
}
