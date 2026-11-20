// Test harness: a real server on a random port with an in-memory database and a
// temporary storage dir. Fixtures are generated on the fly (no binary files in git).
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function startServer() {
  const storage = await mkdtemp(join(tmpdir(), 'qalam-test-'))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PGLITE_DIR: 'memory://',
    STORAGE_DIR: storage,
    MODELS_DIR: new URL('../models', import.meta.url).pathname,
    JOB_CONCURRENCY: '2',
    LOG_LEVEL: 'silent',
  })
  const { config } = await import('../src/config.js')
  const { buildApp } = await import('../src/app.js')
  const app = await buildApp(config)
  await app.listen({ port: 0, host: '127.0.0.1' })
  const base = `http://127.0.0.1:${app.server.address().port}`
  return {
    app,
    base,
    async close() {
      await app.close()
      await rm(storage, { recursive: true, force: true })
    },
  }
}

/** Minimal API client that remembers its access token and refresh cookie. */
export function client(base) {
  let token = null
  let cookie = null
  const c = {
    get token() {
      return token
    },
    async req(method, path, { json, form, headers = {} } = {}) {
      const h = { ...headers }
      if (token) h.authorization = `Bearer ${token}`
      if (cookie) h.cookie = cookie
      if (json !== undefined) h['content-type'] = 'application/json'
      const res = await fetch(base + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : form })
      const set = res.headers.getSetCookie?.() ?? []
      for (const s of set) if (s.startsWith('qalam_rt=')) cookie = s.split(';')[0].endsWith('=') ? null : s.split(';')[0]
      const type = res.headers.get('content-type') ?? ''
      const body = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())
      if (body?.accessToken) token = body.accessToken
      return { status: res.status, body, headers: res.headers }
    },
    async upload(files) {
      const form = new FormData()
      for (const { name, data, type = 'application/octet-stream' } of files) form.append('file', new Blob([data], { type }), name)
      return c.req('POST', '/api/v1/files', { form })
    },
    /** Start a tool and wait (long-poll) until it finishes. */
    async runTool(tool, fileIds, options = {}) {
      const start = await c.req('POST', `/api/v1/tools/${tool}/jobs`, { json: { fileIds, options } })
      if (start.status !== 202) return start
      let job = start.body
      const until = Date.now() + 120_000
      while (!['done', 'failed', 'canceled'].includes(job.status) && Date.now() < until) {
        job = (await c.req('GET', `/api/v1/jobs/${job.id}?wait=10000`)).body
      }
      return { status: 200, body: job }
    },
    async download(file) {
      const res = await fetch(base + file.downloadUrl)
      return Buffer.from(await res.arrayBuffer())
    },
  }
  return c
}

/* ───────── fixtures ───────── */

export async function samplePdf({ pages = 3, withImage = true } = {}) {
  const { PDFDocument, rgb } = await import('pdf-lib')
  const { fontSet } = await import('../src/converters/lib/fonts.js')
  const sharp = (await import('sharp')).default
  const doc = await PDFDocument.create()
  const font = fontSet(doc)
  const bold = await font({ family: 'serif', bold: true })
  const regular = await font({ family: 'serif' })
  const jpg = withImage
    ? await doc.embedJpg(await sharp({ create: { width: 400, height: 240, channels: 3, background: '#2a9d8f' } }).jpeg({ quality: 95 }).toBuffer())
    : null
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([595.28, 841.89])
    page.drawText(`${p}-bob. Oʻzbekiston iqtisodiyoti`, { x: 72, y: 770, size: 20, font: bold })
    const lines = [
      'Mamlakatimizda raqamli iqtisodiyotni rivojlantirish boʻyicha keng koʻlamli',
      'islohotlar amalga oshirilmoqda. Ushbu ishda asosiy yoʻnalishlar tahlil qilinadi.',
      'Qoʻqon, Gʻijduvon va Toshkent shaharlari misolida — «yangi» imkoniyatlar.',
    ]
    lines.forEach((l, i) => page.drawText(l, { x: 72, y: 730 - i * 18, size: 12, font: regular }))
    // a small table, one text object per cell — the way Word/Excel export them
    ;[['Yil', 'Soni', 'Summa'], ['2023', '980', '2 750'], ['2024', '1 250', '3 400']].forEach((row, r) =>
      row.forEach((cell, c) => page.drawText(cell, { x: 72 + c * 120, y: 650 - r * 18, size: 12, font: r ? regular : bold })),
    )
    if (jpg) page.drawImage(jpg, { x: 72, y: 380, width: 300, height: 180 })
    page.drawRectangle({ x: 400, y: 380, width: 120, height: 60, color: rgb(0.9, 0.3, 0.3) })
  }
  return Buffer.from(await doc.save())
}

export async function samplePng() {
  const sharp = (await import('sharp')).default
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
    <rect width="100%" height="100%" fill="#dbeafe"/>
    <circle cx="240" cy="190" r="110" fill="#e11d48"/>
    <rect x="200" y="40" width="80" height="60" fill="#0f766e"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function sampleJpg() {
  const sharp = (await import('sharp')).default
  return sharp(await samplePng()).jpeg({ quality: 95 }).toBuffer()
}

export async function sampleDocx() {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell } = await import('docx')
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Kurs ishi')] }),
          new Paragraph({ children: [new TextRun('Bu '), new TextRun({ text: 'qalin', bold: true }), new TextRun(' va '), new TextRun({ text: 'kursiv', italics: true }), new TextRun(' matn. Oʻzbek tilida gʻ, oʻ va ʼ belgilari.')] }),
          new Paragraph({ text: 'Birinchi band', bullet: { level: 0 } }),
          new Paragraph({ text: 'Ikkinchi band', bullet: { level: 0 } }),
          new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('A')] }), new TableCell({ children: [new Paragraph('B')] })] })] }),
          new Paragraph('Кирилл ёзуви: Ўзбекистон, Қўқон, Ғазна, Ҳамза.'),
        ],
      },
    ],
  })
  return Packer.toBuffer(doc)
}
