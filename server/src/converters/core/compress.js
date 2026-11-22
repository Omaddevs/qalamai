// PDF compression without Ghostscript: re-encode the embedded photos (JPEG and large
// raw RGB/gray images) at a lower quality / resolution, then save with object streams.
// Vector content and text are untouched, so they stay perfectly sharp.
// Portable: the platform re-encodes each image (sharp on the server, OffscreenCanvas in the browser).
import { unzlibSync } from 'fflate'
import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib'
import { ToolError } from '../../lib/errors.js'
import { renameExt } from './util.js'

const LEVELS = {
  low: { quality: 82, maxSide: 3000, raw: false },
  medium: { quality: 68, maxSide: 2000, raw: true },
  high: { quality: 50, maxSide: 1400, raw: true },
}

const name = (n) => PDFName.of(n)

function filters(dict) {
  const f = dict.get(name('Filter'))
  if (!f) return []
  if (f instanceof PDFName) return [f.asString()]
  if (f instanceof PDFArray) return f.asArray().map((x) => x.asString?.() ?? '')
  return ['?']
}

function channelsOf(dict, doc) {
  let cs = dict.get(name('ColorSpace'))
  if (cs && !(cs instanceof PDFName) && !(cs instanceof PDFArray)) cs = doc.context.lookup(cs)
  if (cs instanceof PDFName) return { DeviceRGB: 3, DeviceGray: 1 }[cs.asString().slice(1)] ?? 0
  if (cs instanceof PDFArray && cs.get(0)?.asString?.() === '/ICCBased') {
    const icc = doc.context.lookup(cs.get(1))
    const n = icc?.dict?.get(name('N'))
    return n instanceof PDFNumber && (n.asNumber() === 3 || n.asNumber() === 1) ? n.asNumber() : 0
  }
  return 0
}

export async function run({ inputs: [input], options }, { progress, platform }) {
  const level = LEVELS[options.level]
  const original = await input.read()
  const before = original.length
  let doc
  try {
    doc = await PDFDocument.load(original, { updateMetadata: false })
  } catch (err) {
    if (/encrypted/i.test(err.message)) throw new ToolError('PDF_ENCRYPTED', 'PDF parol bilan himoyalangan. Avval himoyani olib taşlang.')
    throw new ToolError('PDF_INVALID', 'PDF faylni oçib bölmadi.')
  }

  const images = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.get(name('Subtype')) === name('Image') && !obj.dict.get(name('ImageMask')))

  let recompressed = 0
  for (const [i, [ref, obj]] of images.entries()) {
    if (i % 5 === 0) progress(5 + (80 * i) / Math.max(1, images.length), `Rasmlar siqilmoqda: ${i + 1} / ${images.length}`)
    const dict = obj.dict
    const fl = filters(dict)
    const w = dict.get(name('Width'))?.asNumber?.()
    const h = dict.get(name('Height'))?.asNumber?.()
    const bpc = dict.get(name('BitsPerComponent'))?.asNumber?.()
    if (!w || !h || dict.get(name('Decode'))) continue
    const channels = channelsOf(dict, doc)
    if (!channels) continue // CMYK, indexed, separation … — leave as is

    let source
    if (fl.length === 1 && fl[0] === '/DCTDecode') source = { jpeg: obj.contents }
    else if (level.raw && fl.length === 1 && fl[0] === '/FlateDecode' && bpc === 8 && !dict.get(name('DecodeParms')) && obj.contents.length > 60_000) {
      let rawPixels
      try {
        rawPixels = unzlibSync(obj.contents)
      } catch {
        continue
      }
      if (rawPixels.length !== w * h * channels) continue
      source = { raw: { data: rawPixels, width: w, height: h, channels } }
    } else continue

    try {
      const out = await platform.recompress(source, { maxSide: level.maxSide, quality: level.quality, channels })
      if (!out || out.data.length >= obj.contents.length * 0.92) continue
      const next = dict.clone(doc.context)
      next.set(name('Width'), PDFNumber.of(out.width))
      next.set(name('Height'), PDFNumber.of(out.height))
      // a browser writes colour JPEGs only: say so when a gray image became one
      if (channels === 1 && !out.gray) next.set(name('ColorSpace'), name('DeviceRGB'))
      next.set(name('Filter'), name('DCTDecode'))
      next.set(name('BitsPerComponent'), PDFNumber.of(8))
      next.delete(name('DecodeParms'))
      next.delete(name('Length'))
      doc.context.assign(ref, PDFRawStream.of(next, out.data))
      recompressed++
    } catch {
      /* an image the platform can't read — keep the original */
    }
  }

  progress(90, 'Saqlanmoqda')
  doc.setProducer('QalamAI')
  const bytes = await doc.save({ useObjectStreams: true })
  const outName = renameExt(input.name, 'pdf', '-siqilgan')
  // nothing to gain — hand back the original rather than a bigger file
  const smaller = bytes.length < before
  const after = smaller ? bytes.length : before
  return { outputs: [{ name: outName, data: smaller ? bytes : original }], summary: { before, after, saved: Math.max(0, Math.round((1 - after / before) * 100)), images: images.length, recompressed } }
}
