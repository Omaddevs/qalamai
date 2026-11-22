// Copies pdf.js data into public/ so PDFs that rely on the 14 standard fonts, CJK character maps,
// JPEG 2000 / JBIG2 images (wasm decoders) or ICC colour profiles render — in the PDF editor and
// in the browser tool worker. Runs after `npm install`.
import { cpSync, existsSync } from 'node:fs'

const from = 'node_modules/pdfjs-dist'
if (!existsSync(from)) process.exit(0)
for (const dir of ['standard_fonts', 'cmaps', 'wasm', 'iccs']) cpSync(`${from}/${dir}`, `public/pdfjs/${dir}`, { recursive: true })
console.log('pdf.js assets → public/pdfjs')
