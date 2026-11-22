import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { unzipSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { client, sampleDocx, sampleJpg, samplePdf, samplePng, startServer } from './helpers.js'

let srv
let c
let pdf
let png
let jpg

const textOf = async (buf) => {
  const { openPdf, pageText, closePdf } = await import('../src/converters/lib/pdfjs.js')
  const doc = await openPdf(buf)
  let out = ''
  for (let i = 1; i <= doc.numPages; i++) out += (await pageText(await doc.getPage(i), { withFonts: false })).items.map((x) => x.str).join(' ') + '\n'
  await closePdf(doc)
  return out
}

const ok = (res) => {
  assert.equal(res.body.status, 'done', JSON.stringify(res.body.error ?? res.body))
  return res.body
}

before(async () => {
  srv = await startServer()
  c = client(srv.base)
  const { body: guest } = await c.req('POST', '/api/v1/auth/guest')
  // run the suite as a Pro user so daily limits don't interfere (they're tested separately)
  const { eq } = await import('drizzle-orm')
  const { schema } = await import('../src/db/index.js')
  await srv.app.ctx.db.update(schema.users).set({ isGuest: false, plan: 'pro' }).where(eq(schema.users.id, guest.user.id))
  const up = await c.upload([
    { name: 'kurs ishi.pdf', data: await samplePdf() },
    { name: 'rasm.png', data: await samplePng() },
    { name: 'foto.jpg', data: await sampleJpg() },
  ])
  assert.equal(up.status, 201, JSON.stringify(up.body))
  ;[pdf, png, jpg] = up.body.files
})
after(() => srv.close())

describe('uploads', () => {
  test('types are detected from content and probed', () => {
    assert.equal(pdf.kind, 'pdf')
    assert.equal(pdf.meta.pages, 3)
    assert.equal(png.kind, 'image')
    assert.deepEqual([png.meta.width, png.meta.height], [480, 360])
    assert.equal(jpg.ext, 'jpg')
  })

  test('unknown binary is rejected', async () => {
    const res = await c.upload([{ name: 'x.pdf', data: Buffer.from([0, 1, 2, 3, 0, 0, 0, 9]) }])
    assert.equal(res.status, 415)
  })

  test('catalog lists every tool with JSON-schema options', async () => {
    const res = await c.req('GET', '/api/v1/tools')
    const ids = res.body.tools.map((t) => t.id)
    for (const id of ['pdf-to-docx', 'pdf-edit', 'image-remove-bg', 'doc-to-pdf']) assert.ok(ids.includes(id), id)
    assert.equal(res.body.tools.find((t) => t.id === 'pdf-to-images').options.properties.format.default, 'jpg')
  })

  test('wrong input kind and bad options are explained', async () => {
    const wrong = await c.req('POST', '/api/v1/tools/pdf-to-docx/jobs', { json: { fileIds: [png.id] } })
    assert.equal(wrong.status, 415)
    const bad = await c.req('POST', '/api/v1/tools/pdf-to-images/jobs', { json: { fileIds: [pdf.id], options: { dpi: 5000 } } })
    assert.equal(bad.status, 400)
  })
})

describe('PDF → formats', () => {
  test('pdf-to-docx keeps Uzbek text', async () => {
    const job = ok(await c.runTool('pdf-to-docx', [pdf.id]))
    const out = job.outputs[0]
    assert.equal(out.ext, 'docx')
    const mammoth = (await import('mammoth')).default
    const { value } = await mammoth.extractRawText({ buffer: await c.download(out) })
    assert.match(value, /Oʻzbekiston iqtisodiyoti/)
    assert.match(value, /Qoʻqon, Gʻijduvon/)
    const html = (await mammoth.convertToHtml({ buffer: await c.download(out) })).value
    assert.match(html, /<h\d>/, 'title detected as heading')
    assert.match(html, /<img/, 'embedded picture carried over')
  })

  test('pdf-to-images → zip + pages at the requested dpi', async () => {
    const job = ok(await c.runTool('pdf-to-images', [pdf.id], { format: 'png', dpi: 100 }))
    assert.equal(job.outputs[0].ext, 'zip')
    assert.equal(job.outputs.length, 4)
    const meta = await sharp(await c.download(job.outputs[1])).metadata()
    assert.equal(meta.width, Math.round(595.28 * (100 / 72)))
    assert.equal(Object.keys(unzipSync(new Uint8Array(await c.download(job.outputs[0])))).length, 3)
  })

  test('pdf-to-text', async () => {
    const job = ok(await c.runTool('pdf-to-text', [pdf.id], { pages: '2' }))
    const text = (await c.download(job.outputs[0])).toString('utf8')
    assert.match(text, /2-bob/)
    assert.doesNotMatch(text, /1-bob/)
  })

  test('pdf-to-xlsx makes a sheet per page with numbers as numbers', async () => {
    const job = ok(await c.runTool('pdf-to-xlsx', [pdf.id]))
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await c.download(job.outputs[0]))
    assert.equal(wb.worksheets.length, 3)
    const values = []
    wb.worksheets[0].eachRow((r) => r.eachCell((cell) => values.push(cell.value)))
    assert.ok(values.includes(2024) && values.includes(1250) && values.includes(3400), `numbers parsed: ${JSON.stringify(values)}`)
    let header = null
    wb.worksheets[0].eachRow((r) => {
      if (r.getCell(1).value === 'Yil') header = [1, 2, 3].map((i) => r.getCell(i).value)
    })
    assert.deepEqual(header, ['Yil', 'Soni', 'Summa'], 'table cells land in separate columns')
  })

  test('pdf-to-pptx makes one slide per page', async () => {
    const job = ok(await c.runTool('pdf-to-pptx', [pdf.id]))
    const entries = Object.keys(unzipSync(new Uint8Array(await c.download(job.outputs[0]))))
    assert.equal(entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e)).length, 3)
  })
})

describe('PDF editing and organising', () => {
  test('pdf-edit: replace text, add Uzbek text, shapes, image, ink, reorder + rotate pages', async () => {
    const sig = `data:image/png;base64,${(await samplePng()).toString('base64')}`
    const job = ok(
      await c.runTool('pdf-edit', [pdf.id], {
        operations: [
          { type: 'replace', page: 0, rect: [70, 765, 330, 28], x: 72, y: 770, text: 'Yangi sarlavha: Gʻalaba', size: 20, font: 'serif', bold: true },
          { type: 'text', page: 1, x: 72, y: 100, text: 'Imzo: Oʻqituvchi ʼ\nIkkinchi qator', size: 12 },
          { type: 'highlight', page: 0, rect: [72, 725, 200, 14] },
          { type: 'whiteout', page: 2, rect: [72, 630, 200, 20] },
          { type: 'rect', page: 1, rect: [300, 300, 100, 50], stroke: '#ff0000' },
          { type: 'ellipse', page: 1, rect: [300, 200, 100, 50], fill: '#00ff00', stroke: null },
          { type: 'line', page: 1, from: [72, 150], to: [300, 150], arrow: true },
          { type: 'ink', page: 1, points: [[100, 300], [120, 320], [140, 300], [160, 330]] },
          { type: 'image', page: 1, rect: [350, 80, 120, 90], src: sig },
        ],
        pages: [{ src: 1 }, { src: 0, rotate: 90 }],
      }),
    )
    const buf = await c.download(job.outputs[0])
    const doc = await PDFDocument.load(buf)
    assert.equal(doc.getPageCount(), 2)
    assert.equal(doc.getPage(1).getRotation().angle, 90)
    const text = await textOf(buf)
    assert.match(text, /Yangi sarlavha: Gʻalaba/)
    assert.match(text, /Imzo: Oʻqituvchi/)
    assert.match(text, /Ikkinchi qator/)
  })

  test('pdf-edit: moving a PDF image (cover + redraw) with a small JPEG', async () => {
    // a tiny JPEG decodes into Node's shared Buffer pool (non-zero byteOffset) — pdf-lib used to
    // fail on it with "SOI not found in JPEG"
    const tiny = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#2a9d8f' } }).jpeg().toBuffer()
    assert.ok(tiny.length < 4096)
    const job = ok(
      await c.runTool('pdf-edit', [pdf.id], {
        operations: [
          { type: 'whiteout', page: 0, rect: [71, 379, 302, 182], color: '#ffffff' },
          { type: 'image', page: 0, rect: [122, 425, 270, 162], src: `data:image/jpeg;base64,${tiny.toString('base64')}`, opacity: 1 },
        ],
      }),
    )
    const doc = await PDFDocument.load(await c.download(job.outputs[0]))
    assert.equal(doc.getPageCount(), 3)
  })

  test('pdf-edit: links, notes, aligned text, and pages inserted from blank / other PDF / image', async () => {
    const { PDFName } = await import('pdf-lib')
    const job = ok(
      await c.runTool('pdf-edit', [pdf.id, pdf.id === png.id ? jpg.id : png.id], {
        // src 3 = blank A4, src 4 = page 1 of the image (file 1)
        append: [{ type: 'blank', width: 595, height: 842 }, { type: 'file', file: 1 }],
        operations: [
          { type: 'link', page: 0, rect: [72, 700, 200, 20], url: 'https://qalamai.uz/narxlar' },
          { type: 'note', page: 0, x: 500, y: 800, text: 'Bu yerni tekşiring — Oʻzbekiston' },
          { type: 'text', page: 3, x: 72, y: 700, text: 'Markaz\nIkkinçi uzunroq qator', size: 14, align: 'center' },
        ],
        pages: [{ src: 0 }, { src: 3 }, { src: 4 }, { src: 1 }],
      }),
    )
    const buf = await c.download(job.outputs[0])
    const doc = await PDFDocument.load(buf)
    assert.equal(doc.getPageCount(), 4)
    const annots = doc.getPage(0).node.Annots()
    const subtypes = annots.asArray().map((ref) => doc.context.lookup(ref).get(PDFName.of('Subtype')).toString())
    assert.deepEqual(subtypes.sort(), ['/Link', '/Text'])
    const text = await textOf(buf)
    assert.match(text, /Markaz/)
    assert.match(text, /Ikkinçi uzunroq qator/)
    // a bad link is refused before the job runs
    const bad = await c.req('POST', '/api/v1/tools/pdf-edit/jobs', { json: { fileIds: [pdf.id], options: { operations: [{ type: 'link', page: 0, rect: [0, 0, 10, 10], url: 'javascript:alert(1)' }] } } })
    assert.equal(bad.status, 400)
  })

  test('pdf-merge mixes PDFs and images', async () => {
    const job = ok(await c.runTool('pdf-merge', [pdf.id, png.id, jpg.id]))
    assert.equal((await PDFDocument.load(await c.download(job.outputs[0]))).getPageCount(), 5)
  })

  test('pdf-split modes', async () => {
    const every = ok(await c.runTool('pdf-split', [pdf.id], { mode: 'every' }))
    assert.equal(every.outputs.length, 4)
    const ranges = ok(await c.runTool('pdf-split', [pdf.id], { mode: 'ranges', ranges: '1-2, 3' }))
    assert.equal(ranges.outputs.length, 3)
    const extract = ok(await c.runTool('pdf-split', [pdf.id], { mode: 'extract', ranges: '1,3' }))
    assert.equal(extract.outputs.length, 1)
    assert.equal((await PDFDocument.load(await c.download(extract.outputs[0]))).getPageCount(), 2)
  })

  test('pdf-rotate, watermark and page numbers', async () => {
    const rot = ok(await c.runTool('pdf-rotate', [pdf.id], { angle: 180, pages: '2' }))
    const r = await PDFDocument.load(await c.download(rot.outputs[0]))
    assert.deepEqual(r.getPages().map((p) => p.getRotation().angle), [0, 180, 0])

    const wm = ok(await c.runTool('pdf-watermark', [pdf.id], { text: 'NUSXA — Oʻzbekiston', position: 'center' }))
    assert.match(await textOf(await c.download(wm.outputs[0])), /NUSXA — Oʻzbekiston/)
    const tiled = ok(await c.runTool('pdf-watermark', [pdf.id], { text: 'QalamAI', position: 'tile', opacity: 0.1 }))
    assert.match(await textOf(await c.download(tiled.outputs[0])), /QalamAI/)

    const pn = ok(await c.runTool('pdf-page-numbers', [pdf.id], { format: 'page-n', skipFirst: true }))
    const t = await textOf(await c.download(pn.outputs[0]))
    assert.match(t, /2-bet/)
    assert.match(t, /3-bet/)
    assert.doesNotMatch(t, /1-bet/)
  })

  test('pdf-compress shrinks a photo-heavy PDF', async () => {
    const noise = await sharp(Buffer.from(Array.from({ length: 1600 * 1200 * 3 }, () => Math.floor(Math.random() * 255))), { raw: { width: 1600, height: 1200, channels: 3 } })
      .blur(1.2)
      .jpeg({ quality: 98 })
      .toBuffer()
    const doc = await PDFDocument.create()
    const img = await doc.embedJpg(noise)
    doc.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 446 })
    const { body } = await c.upload([{ name: 'foto.pdf', data: Buffer.from(await doc.save()) }])
    const job = ok(await c.runTool('pdf-compress', [body.files[0].id], { level: 'high' }))
    assert.ok(job.result.after < job.result.before * 0.6, JSON.stringify(job.result))
    assert.equal(job.result.recompressed, 1)
  })
})

describe('images', () => {
  test('convert, compress, resize', async () => {
    const conv = ok(await c.runTool('image-convert', [png.id, jpg.id], { format: 'webp' }))
    assert.deepEqual(conv.outputs.map((o) => o.ext), ['webp', 'webp'])

    const jpgOut = ok(await c.runTool('image-convert', [png.id], { format: 'jpg', background: '#000000' }))
    assert.equal((await sharp(await c.download(jpgOut.outputs[0])).metadata()).hasAlpha, false)

    const comp = ok(await c.runTool('image-compress', [png.id], { level: 'high' }))
    assert.ok(comp.result.after <= comp.result.before)

    const rs = ok(await c.runTool('image-resize', [png.id], { mode: 'percent', percent: 50 }))
    const m = await sharp(await c.download(rs.outputs[0])).metadata()
    assert.deepEqual([m.width, m.height], [240, 180])
  })

  test('images-to-pdf', async () => {
    const job = ok(await c.runTool('images-to-pdf', [png.id, jpg.id], { pageSize: 'a4' }))
    const doc = await PDFDocument.load(await c.download(job.outputs[0]))
    assert.equal(doc.getPageCount(), 2)
    assert.ok(doc.getPage(0).getWidth() > doc.getPage(0).getHeight(), 'landscape image → landscape page')
  })

  test('image-remove-bg: transparent background, opaque subject', { timeout: 180_000 }, async () => {
    const job = ok(await c.runTool('image-remove-bg', [png.id]))
    const out = await c.download(job.outputs[0])
    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.deepEqual([info.width, info.height], [480, 360])
    const alpha = (x, y) => data[(y * info.width + x) * 4 + 3]
    // samplePng: red circle (centre 240,190 r110) + green block (200..280 × 40..100) on pale blue
    for (const [x, y] of [[240, 190], [150, 190], [330, 190], [240, 290], [240, 70]]) assert.ok(alpha(x, y) > 200, `subject alpha at ${x},${y}: ${alpha(x, y)}`)
    for (const [x, y] of [[5, 5], [470, 350], [60, 300], [420, 60], [100, 40]]) assert.ok(alpha(x, y) < 60, `background alpha at ${x},${y}: ${alpha(x, y)}`)

    const white = ok(await c.runTool('image-remove-bg', [jpg.id], { background: 'color', color: '#ffffff', format: 'jpg', crop: true }))
    const out2 = await c.download(white.outputs[0])
    const m = await sharp(out2).metadata()
    assert.equal(m.format, 'jpeg')
    // subject spans ~220×260 px; crop adds 2% (10 px) padding per side
    assert.ok(m.width > 215 && m.width < 260, `cropped width ${m.width}`)
    assert.ok(m.height > 255 && m.height < 300, `cropped height ${m.height}`)
    const { data: px, info: pi } = await sharp(out2).raw().toBuffer({ resolveWithObject: true })
    assert.ok(px.subarray(0, 3).every((v) => v > 235), `corner filled white: ${[...px.subarray(0, 3)]}`)
    assert.equal(pi.channels, 3)
  })
})

describe('fonts', () => {
  test('embedded (subset) Uzbek fonts render every glyph', async () => {
    const { readFile } = await import('node:fs/promises')
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const { fontSet } = await import('../src/converters/lib/fonts.js')
    const { openPdf, renderPage, closePdf } = await import('../src/converters/lib/pdfjs.js')
    const text = 'Oʻzbekiston iqtisodiyoti — Ўзбекистон, Қўқон 2024'
    const ink = async (subset) => {
      const doc = await PDFDocument.create()
      doc.registerFontkit(fontkit)
      const font = subset ? await fontSet(doc)({ family: 'serif' }) : await doc.embedFont(await readFile(new URL('../assets/fonts/NotoSerif-Regular.ttf', import.meta.url)), { subset: false })
      doc.addPage([520, 80]).drawText(text, { x: 10, y: 40, size: 18, font })
      const pdf = await openPdf(await doc.save())
      const canvas = await renderPage(pdf, 1, 1)
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let dark = 0
      for (let i = 0; i < data.length; i += 4) if (data[i] < 128) dark++
      await closePdf(pdf)
      return dark
    }
    const full = await ink(false)
    const sub = await ink(true)
    assert.ok(full > 1000, `reference rendering has ink (${full})`)
    assert.ok(Math.abs(sub - full) / full < 0.05, `subset font draws all glyphs: ${sub} vs ${full} dark pixels`)
  })
})

describe('documents → PDF', () => {
  test('docx → academic PDF with Uzbek Latin and Cyrillic', async () => {
    const { body } = await c.upload([{ name: 'kurs.docx', data: await sampleDocx() }])
    const job = ok(await c.runTool('doc-to-pdf', [body.files[0].id]))
    const text = await textOf(await c.download(job.outputs[0]))
    assert.match(text, /KURS ISHI/)
    assert.match(text, /gʻ, oʻ va ʼ/)
    assert.match(text, /Ўзбекистон, Қўқон, Ғазна, Ҳамза/)
  })

  test('markdown → PDF', async () => {
    const md = '# Reja\n\n1. Kirish\n2. Asosiy qism\n\n**Xulosa:** hammasi *yaxshi*.\n\n| Yil | Soni |\n|---|---|\n| 2024 | 15 |\n'
    const { body } = await c.upload([{ name: 'reja.md', data: Buffer.from(md) }])
    const job = ok(await c.runTool('doc-to-pdf', [body.files[0].id], { academic: false, font: 'sans' }))
    const text = await textOf(await c.download(job.outputs[0]))
    for (const s of ['Reja', 'Kirish', 'Xulosa:', '2024']) assert.match(text, new RegExp(s))
  })
})

describe('limits', () => {
  test('daily run quota is enforced per plan', async () => {
    const g = client(srv.base)
    await g.req('POST', '/api/v1/auth/guest')
    const { body } = await g.upload([{ name: 'a.png', data: await samplePng() }])
    const id = body.files[0].id
    let last
    for (let i = 0; i < 11; i++) last = await g.req('POST', '/api/v1/tools/image-convert/jobs', { json: { fileIds: [id], options: { format: 'webp' } } })
    assert.equal(last.status, 429)
    assert.equal(last.body.error.code, 'QUOTA_EXCEEDED')
  })

  test('runs on the device check the same limits without sending files', async () => {
    const g = client(srv.base)
    await g.req('POST', '/api/v1/auth/guest')
    const one = { kind: 'pdf', ext: 'pdf', size: 1000, pages: 3 }
    const ok = await g.req('POST', '/api/v1/tools/pdf-rotate/local-runs', { json: { files: [one] } })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    // too big for the plan, too many pages, too many files, unknown tool
    const big = await g.req('POST', '/api/v1/tools/pdf-rotate/local-runs', { json: { files: [{ ...one, size: 900 * 1048576 }] } })
    assert.equal(big.status, 413)
    const pages = await g.req('POST', '/api/v1/tools/pdf-rotate/local-runs', { json: { files: [{ ...one, pages: 5000 }] } })
    assert.equal(pages.body.error.code, 'QUOTA_EXCEEDED')
    const many = await g.req('POST', '/api/v1/tools/pdf-rotate/local-runs', { json: { files: [one, one] } })
    assert.equal(many.status, 400)
    assert.equal((await g.req('POST', '/api/v1/tools/nope/local-runs', { json: { files: [one] } })).status, 404)
    // the daily quota is shared with server runs
    let last
    for (let i = 0; i < 11; i++) last = await g.req('POST', '/api/v1/tools/pdf-merge/local-runs', { json: { files: [one, one] } })
    assert.equal(last.status, 429)
    assert.equal(last.body.error.code, 'QUOTA_EXCEEDED')
  })
})
