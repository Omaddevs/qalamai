// «AI taqdimotçi» as a video file: the same show the player runs — the presenter's voice, the pen
// drawing on the slides, the presenter in the corner moving the mouth with the voice, captions —
// written to an MP4 (H.264 + AAC) entirely in the browser.
//
//  1. pages   every slide rendered at 1920×1080 and captured once (exporter.jsx); the anchors
//             of each page are read from the same DOM, so the pen marks land where the player puts them
//  2. voice   every spoken part fetched from /voice/tts (cached on the server) and decoded to 48 kHz
//  3. video   a timeline is laid out from the real lengths of the audio; each frame is drawn on a
//             canvas (page, pen, presenter, captions) and encoded with WebCodecs; the audio track is
//             the parts mixed at their times
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { postForBlob } from '../../api.js'
import { assetBlob, isAssetRef } from '../../assets.js'
import { FPS, H, W, capture, encoderConfig, fontCss, mount } from '../exporter.jsx'
import { collectAnchors, findAnchor } from './anchors.js'
import { lineBoxes, marks } from './ink.js'
import { Character, presenterById } from './characters.jsx'
import { voiceInfo } from './voice.js'
import { blinkAt, createRig, waveAt } from './photoRig.js'

const RATE = 48_000
const ENTER = 0.9 // s before the talk on a page starts (the page fades in)
const FADE = 0.5
const GAP = 0.25 // s between two parts
const TAIL = 0.7 // s after the last part of a page
const EMPTY_PAGE = 4 // s for a page without a script
const POINT = 1.4 // s the presenter's hand stays up after a cue
const PEN_MS = { underline: 520, highlight: 560, circle: 820, box: 300, arrow: 480 }
const PEN = '#e5484d'
const LIME = '#c6f432'

const wordsOf = (s) => s.split(/\s+/).filter(Boolean)
const readingSeconds = (text, rate) => Math.max(1.4, wordsOf(text).length / 2.5 / rate + 0.3)
const easeOut = (k) => 1 - Math.pow(1 - k, 2.2)

/** Throws when the job was cancelled. */
const check = (signal) => {
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError')
}

/** True when this browser can write the video (H.264 encoder; the sound is optional). */
export const canRecordVideo = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function'

/** Whether the server can speak this language — without it the video has captions but no voice. */
export async function hasServerVoice(lang) {
  const info = await voiceInfo()
  return Boolean(info.on && info.langs.includes(lang))
}

/* ───────── 1. pages and pen marks ───────── */

/** Path length and points along it, read from an SVG path in the document. */
function measure(svg, d) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  svg.append(el)
  const len = el.getTotalLength()
  const n = 40
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const p = el.getPointAtLength((len * i) / n)
    return [p.x, p.y]
  })
  el.remove()
  return { len, pts, path: new Path2D(d) }
}

/** Every page's picture and, for every cue in its script, the pen marks in video pixels. */
async function preparePages({ slides, theme, narration, watermark, onStep, signal }) {
  const indexes = slides.map((_, i) => i)
  const { pages, dispose } = await mount(slides, theme, indexes, watermark)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('style', 'position:fixed;left:-9999px;width:10px;height:10px')
  document.body.append(svg)
  try {
    const fonts = await fontCss(pages)
    const out = []
    for (const [i, page] of pages.entries()) {
      check(signal)
      const picture = await capture(page, 1, fonts)
      const origin = page.getBoundingClientRect()
      const k = W / origin.width // the page is laid out at 1920 px; in case it is not
      const anchors = collectAnchors(page.querySelector('.slide'))
      const say = narration.slides?.[slides[i].id]?.say ?? []
      const cues = say.map((p, j) => {
        if (!p.do) return null
        const a = findAnchor(anchors, p)
        if (!a) return null
        const r = a.el.getBoundingClientRect()
        const box = { x: (r.left - origin.left) * k, y: (r.top - origin.top) * k, w: r.width * k, h: r.height * k }
        const lines = a.k === 'text' ? lineBoxes(a.el, origin).map((l) => ({ x: l.x * k, y: l.y * k, w: l.w * k, h: l.h * k })) : []
        const m = marks(p.do, { box, lines, stage: { w: W, h: H }, seed: i * 100 + j + 1 })
        return {
          draw: p.do,
          paths: m.paths.map((x) => ({ ...x, ...measure(svg, x.d) })),
          spot: m.spot ? new Path2D(m.spot) : null,
          tip: m.tip,
        }
      })
      out.push({ picture, say, cues })
      onStep(i + 1, pages.length)
    }
    return out
  } finally {
    svg.remove()
    dispose()
  }
}

/* ───────── 2. the voice ───────── */

async function decode(blob) {
  const ctx = new OfflineAudioContext(1, 1, RATE)
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice()
  // several channels: their average
  const out = new Float32Array(buf.length)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels
  }
  return out
}

/** The decoded audio of every spoken part ([page][part] → Float32Array | null). */
async function prepareVoice({ pages, narration, speak, onStep, signal }) {
  const total = pages.reduce((n, p) => n + p.say.length, 0)
  let done = 0
  let failed = 0
  const out = []
  for (const page of pages) {
    const row = []
    for (const part of page.say) {
      check(signal)
      let pcm = null
      if (speak && part.text.trim()) {
        try {
          const blob = await postForBlob('/voice/tts', { text: part.text.slice(0, 900), lang: narration.lang, voice: narration.voice?.g ?? 'f', rate: narration.voice?.rate ?? 1 }, { signal })
          pcm = await decode(blob)
        } catch (err) {
          if (err.name === 'AbortError') throw err
          failed++
        }
      }
      row.push(pcm)
      onStep(++done, total)
    }
    out.push(row)
  }
  return { audio: out, failed }
}

/* ───────── 3. the timeline ───────── */

function layout(pages, audio, rate) {
  let t = 0
  const slides = pages.map((page, i) => {
    const start = t
    let at = start + ENTER
    const parts = page.say.map((p, j) => {
      const pcm = audio[i][j]
      const dur = pcm ? pcm.length / RATE : readingSeconds(p.text, rate)
      const part = { text: p.text, start: at, dur, pcm, cue: page.cues[j] }
      at += dur + GAP
      return part
    })
    const end = parts.length ? at - GAP + TAIL : start + EMPTY_PAGE
    t = end
    return { start, end, parts, picture: page.picture }
  })
  return { slides, duration: t }
}

/** The sound track and, per video frame, how loud the voice is (0…1, for the mouth). */
function mixdown(timeline) {
  const track = new Float32Array(Math.ceil(timeline.duration * RATE) + RATE)
  for (const s of timeline.slides)
    for (const p of s.parts) {
      if (!p.pcm) continue
      track.set(p.pcm.subarray(0, track.length - Math.round(p.start * RATE)), Math.round(p.start * RATE))
    }
  const frames = Math.ceil(timeline.duration * FPS)
  const level = new Float32Array(frames)
  const win = Math.round(RATE / FPS)
  let smooth = 0
  for (let f = 0; f < frames; f++) {
    let sum = 0
    const from = f * win
    for (let i = from; i < from + win && i < track.length; i++) sum += track[i] * track[i]
    const target = Math.min(1, Math.sqrt(sum / win) * 4.2)
    smooth += (target - smooth) * (target > smooth ? 0.6 : 0.3)
    level[f] = smooth
  }
  return { track, level }
}

/* ───────── the presenter ───────── */

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const OPEN_STEPS = 6

/** The presenter's pictures: a character in every mouth opening × hand × blink, or the user's photo. */
async function preparePresenter(narration) {
  const who = narration.presenter ?? {}
  if (who.photo) {
    const blob = isAssetRef(who.photo) ? await assetBlob(who.photo) : null
    if (!blob) return null
    return { photo: await createImageBitmap(blob) }
  }
  const presenter = presenterById(who.id)
  const side = narration.side === 'left' ? 'left' : 'right'
  if (presenter.real) {
    // a real-looking host: the same WebGL rig as the player, drawn into every frame
    const img = await loadImage(presenter.real.src)
    const rig = createRig(img, presenter.real.rig, { width: 640, flip: side !== 'left' })
    return rig ? { rig, presenter } : { still: img, presenter }
  }
  const frames = {}
  for (let o = 0; o < OPEN_STEPS; o++)
    for (const pointing of [false, true])
      for (const blink of [false, true]) {
        const markup = renderToStaticMarkup(createElement(Character, { presenter, side, still: { open: o / (OPEN_STEPS - 1), pointing, blink } }))
        const svg = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"')
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
        try {
          frames[`${o}|${pointing}|${blink}`] = await loadImage(url)
        } finally {
          URL.revokeObjectURL(url)
        }
      }
  return { frames, presenter }
}

/* ───────── drawing a frame ───────── */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h)
}

/** The pen icon at (x, y): its tip on the point. */
function drawPen(ctx, x, y) {
  ctx.save()
  ctx.translate(x - 3, y - 27)
  ctx.scale(30 / 32, 30 / 32)
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#1A1A1A'
  ctx.fill(new Path2D('M3 29 L6 21 L22 5 L27 10 L11 26 Z'))
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = PEN
  ctx.fill(new Path2D('M22 5 L25 2 L30 7 L27 10 Z'))
  ctx.fillStyle = '#F5D0B5'
  ctx.fill(new Path2D('M3 29 L6 21 L11 26 Z'))
  ctx.restore()
}

/** One cue's strokes `elapsed` seconds after it started; returns where the pen is, or null. */
function drawMark(ctx, cue, elapsed, alpha) {
  const each = (PEN_MS[cue.draw] ?? 500) / 1000
  let left = elapsed
  let pen = null
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const [i, p] of cue.paths.entries()) {
    const dur = cue.draw === 'arrow' && i === 1 ? 0.18 : each
    if (left <= 0) break
    const k = Math.min(1, left / dur)
    const e = easeOut(k)
    left -= dur
    if (p.kind === 'marker') {
      ctx.strokeStyle = LIME
      ctx.globalAlpha = alpha * 0.42
      ctx.lineWidth = p.width ?? 24
    } else {
      ctx.strokeStyle = PEN
      ctx.globalAlpha = alpha
      ctx.lineWidth = 8
    }
    ctx.setLineDash([p.len, p.len + 1])
    ctx.lineDashOffset = p.len * (1 - e)
    ctx.stroke(p.path)
    if (k < 1) pen = p.pts[Math.round(e * (p.pts.length - 1))]
  }
  ctx.restore()
  return pen
}

/** Captions: lines of the part, the words already said in white. */
function drawCaptions(ctx, text, progress, side, host = false) {
  const words = wordsOf(text)
  if (!words.length) return
  const said = Math.round(progress * words.length)
  const size = 34
  ctx.font = `500 ${size}px Inter, system-ui, sans-serif`
  const maxW = host ? W * 0.56 : W * 0.62
  const space = ctx.measureText(' ').width
  const lines = []
  let line = []
  let width = 0
  words.forEach((w, i) => {
    const ww = ctx.measureText(w).width
    if (line.length && width + space + ww > maxW) {
      lines.push({ items: line, width })
      line = []
      width = 0
    }
    line.push({ w, i, ww })
    width += (line.length > 1 ? space : 0) + ww
  })
  if (line.length) lines.push({ items: line, width })
  const lh = size * 1.75
  const cx = W / 2 + (side === 'left' ? 1 : -1) * W * (host ? 0.12 : 0.06)
  let y = H - W * 0.03 - lines.length * lh
  for (const l of lines) {
    const x0 = cx - l.width / 2
    ctx.fillStyle = 'rgba(10,10,12,0.78)'
    roundRect(ctx, x0 - 20, y, l.width + 40, lh - 6, 10)
    ctx.fill()
    let x = x0
    ctx.textBaseline = 'middle'
    for (const it of l.items) {
      ctx.fillStyle = it.i < said ? '#ffffff' : 'rgba(255,255,255,0.55)'
      ctx.fillText(it.w, x, y + (lh - 6) / 2 + 1)
      x += it.ww + space
    }
    y += lh
  }
}

/** A real-looking host standing at the bottom corner, beside the slide. */
function drawHost(ctx, art, { t, level, waveSince, name, side }) {
  const w = W * 0.29
  const h = w / (art.rig?.aspect ?? art.still.width / art.still.height)
  const x = side === 'left' ? W * 0.006 : W - W * 0.006 - w
  const y = H - h
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 16
  if (art.rig) {
    art.rig.draw({ t, level, wave: waveAt(t, waveSince), blink: blinkAt(t) })
    ctx.drawImage(art.rig.canvas, x, y, w, h)
  } else if (art.still) {
    ctx.translate(x + w, y)
    ctx.scale(side === 'left' ? 1 : -1, 1)
    ctx.drawImage(art.still, side === 'left' ? -w : 0, 0, w, h)
  }
  ctx.restore()
  ctx.save()
  ctx.font = '600 20px Inter, system-ui, sans-serif'
  const tw = ctx.measureText(name).width
  const cx = x + w / 2
  const ny = H - W * 0.014 - 32
  ctx.fillStyle = '#111'
  roundRect(ctx, cx - tw / 2 - 14, ny, tw + 28, 32, 16)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(name, cx, ny + 16)
  ctx.restore()
}

/** The free-download mark, drawn last so nothing covers it (the same pill as exporter.jsx). */
function drawWatermark(ctx) {
  ctx.save()
  ctx.font = '700 19px Inter, system-ui, sans-serif'
  const label = 'qalam ai'
  const tw = ctx.measureText(label).width
  const pw = tw + W * 0.016
  const ph = 19 * 1.3 + W * 0.005
  const x = W - W * 0.013 - pw
  const y = H - W * 0.011 - ph
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  roundRect(ctx, x, y, pw, ph, ph / 2)
  ctx.fill()
  ctx.fillStyle = '#16181d'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + W * 0.008, y + ph / 2 + 1)
  ctx.restore()
}

function drawPresenter(ctx, art, { level, pointing, blink, talking, name, side }) {
  const size = 220
  const x = side === 'left' ? W * 0.024 : W - W * 0.024 - size
  // above the watermark of a free download (bottom right), which must stay readable
  const y = H - W * 0.032 - size - 34
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.save()
  // the ring: white, lime while speaking
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 34
  ctx.shadowOffsetY = 14
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2 + (talking ? 6 : 3), 0, Math.PI * 2)
  ctx.fillStyle = talking ? LIME : '#ffffff'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2 + 3, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  if (talking) ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.clip()
  const bg = ctx.createRadialGradient(cx, y + size * 0.35, 0, cx, cy, size * 0.7)
  bg.addColorStop(0, '#fafaf7')
  bg.addColorStop(1, '#e9ebe4')
  ctx.fillStyle = bg
  ctx.fillRect(x, y, size, size)
  if (art.photo) {
    const s = 1 + level * 0.035
    const im = art.photo
    const k = Math.max(size / im.width, size / im.height) * s
    ctx.drawImage(im, cx - (im.width * k) / 2, cy - (im.height * k) / 2, im.width * k, im.height * k)
    if (level > 0.02) {
      ctx.lineWidth = level * 14
      ctx.strokeStyle = 'rgba(198,244,50,0.85)'
      ctx.stroke()
    }
  } else {
    const o = Math.min(OPEN_STEPS - 1, Math.round(level * (OPEN_STEPS - 1)))
    const img = art.frames[`${o}|${pointing}|${blink}`]
    if (img) ctx.drawImage(img, x, y, size, size)
  }
  ctx.restore()
  // name
  ctx.save()
  ctx.font = '600 20px Inter, system-ui, sans-serif'
  const tw = ctx.measureText(name).width
  ctx.fillStyle = '#111'
  roundRect(ctx, cx - tw / 2 - 14, y + size - 8, tw + 28, 32, 16)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(name, cx, y + size + 8)
  ctx.restore()
}

/* ───────── 4. encoding ───────── */

/**
 * Keeps the encoder's queue short. A hardware encoder (VideoToolbox on a Mac) may hold frames
 * without giving any back until it is flushed: when the queue stops moving for a moment, flush it.
 */
async function drain(enc, failed) {
  const until = Date.now() + 8000
  while (enc.encodeQueueSize > 8 && !failed()) {
    const before = enc.encodeQueueSize
    await new Promise((r) => setTimeout(r, 30))
    if (enc.encodeQueueSize >= before && !failed()) {
      const flushed = await Promise.race([enc.flush().then(() => true), new Promise((r) => setTimeout(() => r(false), 5000))])
      if (!flushed || Date.now() > until) throw new Error('video encoder stalled')
    }
  }
}

async function audioConfig() {
  if (typeof AudioEncoder !== 'function') return null
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const config = { codec, sampleRate: RATE, numberOfChannels: 1, bitrate: 128_000 }
    try {
      if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux }
    } catch {
      /* the next codec */
    }
  }
  return null
}

/**
 * Writes the narrated presentation as an MP4.
 * @param {{ slides: object[], theme: object, narration: object, name: string, presenterName: string,
 *           watermark: boolean, onProgress?: (p: { phase: 'pages'|'voice'|'video', done: number, total: number }) => void,
 *           signal?: AbortSignal }} job
 * @returns {Promise<{ blob: Blob, silent: boolean, voiceFailed: number }>}
 */
export async function narratedVideo({ slides, theme, narration, presenterName, watermark, onProgress, signal }) {
  const progress = (phase) => (done, total) => onProgress?.({ phase, done, total })
  const rate = narration.voice?.rate ?? 1
  const speak = await hasServerVoice(narration.lang)

  const pages = await preparePages({ slides, theme, narration, watermark, onStep: progress('pages'), signal })
  const { audio, failed } = await prepareVoice({ pages, narration, speak, onStep: progress('voice'), signal })
  const timeline = layout(pages, audio, rate)
  const { track, level } = mixdown(timeline)
  const hasSound = audio.some((row) => row.some(Boolean))
  const art = await preparePresenter(narration)
  const side = narration.side === 'left' ? 'left' : 'right'
  const captions = narration.captions !== false

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const vconfig = await encoderConfig()
  const aconf = hasSound ? await audioConfig() : null
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    ...(aconf ? { audio: { codec: aconf.mux, numberOfChannels: 1, sampleRate: RATE } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  })
  let failure = null

  // the sound first (small), then the pictures
  if (aconf) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (failure = e) })
    aenc.configure(aconf.config)
    const step = RATE / 10
    for (let i = 0; i < track.length; i += step) {
      check(signal)
      const data = track.slice(i, Math.min(track.length, i + step))
      const ad = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: data.length, numberOfChannels: 1, timestamp: Math.round((i / RATE) * 1e6), data })
      aenc.encode(ad)
      ad.close()
    }
    await aenc.flush()
    aenc.close()
    if (failure) throw failure
  }

  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) })
  venc.configure(vconfig)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  // a canvas in memory, not on the GPU: the GPU stays free for the encoder and the presenter's
  // WebGL (on some machines the three together stall the hardware encoder)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const frames = Math.ceil(timeline.duration * FPS)
  let si = 0
  for (let f = 0; f < frames; f++) {
    check(signal)
    if (failure) throw failure
    const t = f / FPS
    while (si < timeline.slides.length - 1 && t >= timeline.slides[si].end) si++
    const s = timeline.slides[si]
    const prev = timeline.slides[si - 1]

    // the page, faded in over the one before
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    const into = t - s.start
    if (prev && into < FADE) {
      ctx.drawImage(prev.picture, 0, 0, W, H)
      ctx.globalAlpha = Math.max(0, into / FADE)
    }
    ctx.drawImage(s.picture, 0, 0, W, H)
    ctx.globalAlpha = 1

    // the part being said, and the cues started so far on this page
    const now = s.parts.findLast?.((p) => t >= p.start) ?? [...s.parts].reverse().find((p) => t >= p.start)
    const started = s.parts.filter((p) => p.cue && t >= p.start)
    const last = started.at(-1)
    if (last?.cue?.spot && last.cue.draw === 'spot') {
      ctx.save()
      ctx.globalAlpha = Math.min(1, (t - last.start) / 0.45)
      ctx.fillStyle = 'rgba(8,8,10,0.62)'
      ctx.fill(last.cue.spot, 'evenodd')
      ctx.restore()
    }
    let pen = null
    const drawn = started.filter((p) => p.cue.paths.length).slice(-3)
    drawn.forEach((p, k) => {
      const at = drawMark(ctx, p.cue, t - p.start, k === drawn.length - 1 ? 1 : 0.38)
      if (at && k === drawn.length - 1) pen = at
    })
    if (pen) drawPen(ctx, pen[0], pen[1])
    if (last?.cue?.draw === 'point') {
      const [lx, ly] = last.cue.tip
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 18)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.3, '#ff3b3b')
      g.addColorStop(0.65, 'rgba(255,59,59,0.35)')
      g.addColorStop(1, 'rgba(255,59,59,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(lx, ly, 18, 0, Math.PI * 2)
      ctx.fill()
    }

    const speaking = now && t < now.start + now.dur
    let lv = level[f] ?? 0
    // no recorded voice for this part: the mouth moves on its own while the captions show
    if (speaking && !now.pcm) lv = 0.3 + Math.abs(Math.sin(t * 11.3)) * 0.35 + Math.abs(Math.sin(t * 7.1)) * 0.2
    // the hand waves at the greeting and whenever the pen starts a mark
    const greeting = timeline.slides[0]?.parts[0]?.start
    const waveSince = last ? last.start : si === 0 ? greeting : null
    if (art?.presenter?.real) drawHost(ctx, art, { t, level: speaking ? lv : 0, waveSince, name: presenterName, side })
    else if (art) {
      drawPresenter(ctx, art, {
        level: speaking ? lv : 0,
        pointing: Boolean(last && t - last.start < POINT),
        blink: t % 5.2 > 5.05,
        talking: Boolean(speaking),
        name: presenterName,
        side,
      })
    }
    if (captions && speaking) drawCaptions(ctx, now.text, (t - now.start) / now.dur, side, Boolean(art?.presenter?.real))
    if (watermark) drawWatermark(ctx)

    const vf = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
    venc.encode(vf, { keyFrame: f % (FPS * 2) === 0 })
    vf.close()
    await drain(venc, () => failure)
    if (f % 15 === 0) {
      onProgress?.({ phase: 'video', done: f, total: frames })
      await new Promise((r) => setTimeout(r, 0)) // let the page breathe (progress bar, cancel button)
    }
  }
  await venc.flush()
  venc.close()
  art?.rig?.dispose()
  if (failure) throw failure
  muxer.finalize()
  onProgress?.({ phase: 'video', done: frames, total: frames })
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), silent: !aconf, voiceFailed: failed }
}
