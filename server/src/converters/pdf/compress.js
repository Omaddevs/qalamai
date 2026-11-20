// PDF compression without Ghostscript: re-encode the embedded photos (JPEG and large
// raw RGB/gray images) at a lower quality / resolution, then save with object streams.
// Vector content and text are untouched, so they stay perfectly sharp.
import { copyFile, readFile, stat } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'
import { PDFArray, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib'
import sharp from 'sharp'
import { ToolError } from '../../lib/errors.js'
import { emit, renameExt } from '../lib/util.js'

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

export async function run({ inputs: [input], options, outDir }, { progress }) {
  const level = LEVELS[options.level]
  const before = (await stat(input.path)).size
  let doc
  try {
    doc = await PDFDocument.load(await readFile(input.path), { updateMetadata: false })
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

    let input
    if (fl.length === 1 && fl[0] === '/DCTDecode') input = sharp(Buffer.from(obj.contents))
    else if (level.raw && fl.length === 1 && fl[0] === '/FlateDecode' && bpc === 8 && !dict.get(name('DecodeParms')) && obj.contents.length > 60_000) {
      let rawPixels
      try {
        rawPixels = inflateSync(obj.contents)
      } catch {
        continue
      }
      if (rawPixels.length !== w * h * channels) continue
      input = sharp(rawPixels, { raw: { width: w, height: h, channels } })
    } else continue

    try {
      const { data, info } = await input
        .resize(level.maxSide, level.maxSide, { fit: 'inside', withoutEnlargement: true })
        .toColourspace(channels === 1 ? 'b-w' : 'srgb')
        .jpeg({ quality: level.quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
        .toBuffer({ resolveWithObject: true })
      if (data.length >= obj.contents.length * 0.92) continue
      const next = dict.clone(doc.context)
      next.set(name('Width'), PDFNumber.of(info.width))
      next.set(name('Height'), PDFNumber.of(info.height))
      next.set(name('Filter'), name('DCTDecode'))
      next.set(name('BitsPerComponent'), PDFNumber.of(8))
      next.delete(name('DecodeParms'))
      next.delete(name('Length'))
      doc.context.assign(ref, PDFRawStream.of(next, new Uint8Array(data)))
      recompressed++
    } catch {
      /* an image sharp can't read — keep the original */
    }
  }

  progress(90, 'Saqlanmoqda')
  doc.setProducer('QalamAI')
  const bytes = await doc.save({ useObjectStreams: true })
  const outName = renameExt(input.name, 'pdf', '-siqilgan')
  let out
  let after = bytes.length
  if (after >= before) {
    // nothing to gain — hand back the original rather than a bigger file
    const { join } = await import('node:path')
    const path = join(outDir, outName)
    await copyFile(input.path, path)
    out = { path, name: outName }
    after = before
  } else out = await emit(outDir, outName, bytes)
  return { outputs: [out], summary: { before, after, saved: Math.max(0, Math.round((1 - after / before) * 100)), images: images.length, recompressed } }
}
