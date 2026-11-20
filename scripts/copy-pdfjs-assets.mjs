// Copies pdf.js font data into public/ so the PDF editor can render PDFs that rely on
// the 14 standard fonts or CJK character maps. Runs after `npm install`.
import { cpSync, existsSync } from 'node:fs'

const from = 'node_modules/pdfjs-dist'
if (!existsSync(from)) process.exit(0)
for (const dir of ['standard_fonts', 'cmaps']) cpSync(`${from}/${dir}`, `public/pdfjs/${dir}`, { recursive: true })
console.log('pdf.js assets → public/pdfjs')
