// The presenter's voice. Three ways to speak, best first:
//   1. server — Azure neural voices (POST /voice/tts → MP3), the same in every browser;
//   2. browser — the device's own speech (speechSynthesis), when the server has no voice;
//   3. silent — no voice at all: the captions are shown for as long as reading them takes.
// speak() answers a handle the player drives: done · stop · pause · resume · level() · progress().
// level() (0…1, how loud right now) moves the character's mouth.
import { api, postForBlob } from '../../api.js'
import { convert, detectScript } from '../../lib/alifbo.js'

let info = null
/** Which languages the server can speak: { on, langs }. Asked once per page load. */
export function voiceInfo() {
  info ??= api.get('/voice').catch(() => ({ on: false, langs: [] }))
  return info
}

/* ───────── browser voices ───────── */

// a language the device has no voice for is read by a close one that reads the same letters
// (the new Uzbek Latin letters Ö Ğ Ş Ç are Turkish letters; Cyrillic texts → a Russian voice)
const NEAR = { uz: ['uz', 'tr'], 'uz-cyrl': ['uz', 'ru'], kk: ['kk', 'ru'], ky: ['ky', 'kk', 'ru'], tg: ['tg', 'ru'] }
const GOOD = /natural|neural|premium|enhanced|google|siri/i
const FEMALE = /female|woman|zira|samantha|victoria|karen|moira|tessa|milena|irina|yelda|madina|aigul|svetlana|ava|jenny|aria|joana|monica|paulina|anna|alice|amelie|helena|sara|ioana|kyoko|yuna|mei|ting|lekha|damayanti/i
const MALE = /male|man\b|david|mark|alex|daniel|fred|thomas|yuri|maxim|sardor|daulet|dmitry|andrew|guy|jorge|diego|luca|otoya|xander|rishi|aaron|arthur/i

function loadVoices() {
  const ss = window.speechSynthesis
  if (!ss) return Promise.resolve([])
  const now = ss.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => resolve(ss.getVoices())
    ss.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1200)
  })
}

const baseOf = (code) => code?.toLowerCase().replace('_', '-').split('-')[0]
/** True when a device voice really speaks `lang` (not a close language standing in for it). */
export const speaksLang = (voice, lang) => Boolean(voice) && baseOf(voice.lang) === baseOf(lang === 'uz-cyrl' ? 'uz' : lang)

/**
 * The text as a device voice should read it. An Uzbek voice (Microsoft Edge has Madina and
 * Sardor) knows the current Latin spelling oʻ gʻ sh ch, not the new letters Ö Ğ Ş Ç or Cyrillic;
 * a Turkish voice standing in for Uzbek reads the new letters best, so they stay.
 */
export function readable(text, voice) {
  if (baseOf(voice?.lang) !== 'uz') return text
  const from = detectScript(text)
  return from === 'old' ? text : convert(text, from, 'old')
}

/** The device voice for a language and gender, or null. */
export async function pickBrowserVoice(lang, gender) {
  const voices = await loadVoices()
  for (const code of NEAR[lang] ?? [lang]) {
    const list = voices.filter((v) => baseOf(v.lang) === code)
    if (!list.length) continue
    const want = gender === 'm' ? MALE : FEMALE
    const score = (v) => (want.test(v.name) ? 4 : 0) + (GOOD.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1)
    return list.sort((a, b) => score(b) - score(a))[0]
  }
  return null
}

/* ───────── the voice ───────── */

const wordsOf = (s) => s.split(/\s+/).filter(Boolean).length
const readingMs = (text, rate) => Math.max(1400, (wordsOf(text) / 2.5) * 1000 / rate + 300)

/**
 * @param {{ lang: string, gender: 'f'|'m', rate?: number, onFallback?: (reason: string) => void }} o
 */
export function createVoice({ lang, gender = 'f', rate = 1, onFallback }) {
  let mode = null // 'server' | 'browser' | 'silent'
  let speed = 1 // the player's speed button (0.75 … 1.5), on top of the voice's own rate
  let browserVoice = null
  const cache = new Map() // text → Promise<object URL>
  let ctx = null
  let analyser = null
  let buf = null
  const audio = new Audio()
  audio.preload = 'auto'

  async function ready() {
    if (mode) return mode
    const srv = await voiceInfo()
    if (srv.on && srv.langs.includes(lang)) mode = 'server'
    else {
      browserVoice = await pickBrowserVoice(lang, gender)
      mode = browserVoice ? 'browser' : 'silent'
    }
    return mode
  }

  /** Call from a click: browsers start sound only after the user did something. */
  function unlock() {
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)()
      ctx.resume?.()
      if (!analyser) {
        const src = ctx.createMediaElementSource(audio)
        analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        buf = new Uint8Array(analyser.fftSize)
        src.connect(analyser)
        analyser.connect(ctx.destination)
      }
    } catch {
      analyser = null // the sound still plays, the mouth moves by itself
    }
    // an empty utterance inside the click lets Safari speak later
    if (window.speechSynthesis && !window.speechSynthesis.speaking) {
      try {
        const u = new SpeechSynthesisUtterance('')
        u.volume = 0
        window.speechSynthesis.speak(u)
      } catch {
        /* nothing to unlock */
      }
    }
  }

  function fetchAudio(text) {
    if (!cache.has(text)) {
      const p = postForBlob('/voice/tts', { text, lang, voice: gender, rate }).then((blob) => URL.createObjectURL(blob))
      p.catch(() => cache.delete(text))
      cache.set(text, p)
    }
    return cache.get(text)
  }

  /** Starts fetching a part that comes soon, so there is no pause before it. */
  function prefetch(text) {
    if (mode === 'server' && text) fetchAudio(text).catch(() => {})
  }

  async function switchToBrowser(reason) {
    browserVoice = await pickBrowserVoice(lang, gender)
    mode = browserVoice ? 'browser' : 'silent'
    onFallback?.(reason)
  }

  /** Speaks one part. The handle's `done` resolves when it ends or is stopped. */
  function speak(text) {
    let stopped = false
    let paused = false
    let finish
    const done = new Promise((r) => (finish = r))
    const started = performance.now()
    let pausedAt = 0
    let pausedFor = 0
    let fakeLevel = () => 0
    let progress = () => Math.min(1, (performance.now() - started - pausedFor) / readingMs(text, rate * speed))
    let timer = null
    let onPause = () => {}
    let onResume = () => {}
    let onStop = () => {}

    // no sound to measure: the mouth moves on its own while the words are on screen
    const lively = () => {
      if (paused) return 0
      const t = performance.now() / 1000
      return Math.min(1, 0.25 + Math.abs(Math.sin(t * 11.3)) * 0.35 + Math.abs(Math.sin(t * 7.1)) * 0.25)
    }

    const silent = () => {
      fakeLevel = () => (progress() < 1 ? lively() : 0)
      let left = readingMs(text, rate * speed)
      let from = performance.now()
      const run = () => {
        timer = setTimeout(() => finish(), left)
      }
      onPause = () => {
        clearTimeout(timer)
        left -= performance.now() - from
      }
      onResume = () => {
        from = performance.now()
        run()
      }
      onStop = () => clearTimeout(timer)
      run()
    }

    const browser = () => {
      const ss = window.speechSynthesis
      const u = new SpeechSynthesisUtterance(readable(text, browserVoice))
      u.voice = browserVoice
      u.lang = browserVoice.lang
      u.rate = Math.min(2, rate * speed)
      let lastBoundary = 0
      u.onboundary = () => (lastBoundary = performance.now())
      u.onend = () => finish()
      u.onerror = () => finish()
      // no sound data from the device voice: a lively mouth while it speaks, brighter on each word
      fakeLevel = () => {
        if (paused) return 0
        const t = performance.now() / 1000
        const word = Math.max(0, 1 - (performance.now() - lastBoundary) / 220)
        return Math.min(1, 0.25 + Math.abs(Math.sin(t * 11.3)) * 0.35 + Math.abs(Math.sin(t * 7.1)) * 0.2 + word * 0.3)
      }
      onPause = () => ss.pause()
      onResume = () => ss.resume()
      onStop = () => ss.cancel()
      ss.cancel()
      ss.speak(u)
      // some voices never fire onend: stop waiting a while after the expected length
      timer = setTimeout(() => finish(), readingMs(text, rate * speed) * 2.5 + 4000)
    }

    const server = (url) => {
      audio.src = url
      audio.playbackRate = speed
      audio.onended = () => finish()
      audio.onerror = () => finish()
      progress = () => (audio.duration ? Math.min(1, audio.currentTime / audio.duration) : 0)
      onPause = () => audio.pause()
      onResume = () => audio.play().catch(() => {})
      onStop = () => {
        audio.pause()
        audio.onended = null
      }
      audio.play().catch(() => finish())
    }

    ;(async () => {
      await ready()
      if (stopped) return finish()
      if (mode === 'server') {
        try {
          const url = await fetchAudio(text)
          if (stopped) return finish()
          return server(url)
        } catch (err) {
          await switchToBrowser(err?.code ?? 'VOICE_FAILED')
          if (stopped) return finish()
        }
      }
      if (mode === 'browser') return browser()
      return silent()
    })()

    done.then(() => clearTimeout(timer))
    return {
      done,
      stop() {
        stopped = true
        onStop()
        finish()
      },
      pause() {
        if (paused) return
        paused = true
        pausedAt = performance.now()
        onPause()
      },
      resume() {
        if (!paused) return
        paused = false
        pausedFor += performance.now() - pausedAt
        onResume()
      },
      level() {
        if (paused || stopped) return 0
        if (mode === 'server' && analyser && !audio.paused) {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128
            sum += v * v
          }
          return Math.min(1, Math.sqrt(sum / buf.length) * 4.2)
        }
        if (mode === 'server' && !audio.paused) return 0.3 + Math.abs(Math.sin(performance.now() / 90)) * 0.4
        return fakeLevel()
      },
      progress: () => progress(),
    }
  }

  function dispose() {
    audio.pause()
    window.speechSynthesis?.cancel()
    for (const p of cache.values()) p.then((u) => URL.revokeObjectURL(u)).catch(() => {})
    cache.clear()
    ctx?.close?.().catch(() => {})
  }

  function setSpeed(v) {
    speed = v
    audio.playbackRate = v
  }

  return {
    ready, unlock, speak, prefetch, dispose, setSpeed,
    get mode() { return mode },
    /** No voice of this very language here (a close one reads, or none): a clearer one is in Edge. */
    get weak() { return mode === 'silent' || (mode === 'browser' && !speaksLang(browserVoice, lang)) },
  }
}
