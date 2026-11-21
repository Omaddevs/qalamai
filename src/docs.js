import { markChanged } from './changes.js'
import { t } from './i18n/index.js'
// Text documents for the file editor (Fayl muharriri). HTML bodies are small enough for localStorage.
const KEY = 'qalamai.docs.v1'

export const newDocId = () => `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function loadDocs() {
  try {
    const xs = JSON.parse(localStorage.getItem(KEY)) || []
    return xs.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

/** Returns false when the browser refused to store (quota / private mode). */
export function saveDocs(docs, { silent = false } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify(docs))
    if (!silent) markChanged('docs')
    return true
  } catch {
    return false
  }
}

export const blankDoc = (name = t('fe.untitled'), html = `<h1>${t('fe.heading')}</h1><p><br></p>`) => ({
  id: newDocId(),
  name,
  html,
  updatedAt: Date.now(),
})

/* ───────────── Import ───────────── */

const ALLOWED = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'UL', 'OL', 'LI', 'A',
  'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'SUB', 'SUP', 'SPAN', 'DIV', 'IMG', 'HR',
])

/** Keep only harmless structure: no scripts, no event handlers, no javascript: links. */
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node) => {
    ;[...node.children].forEach((el) => {
      if (!ALLOWED.has(el.tagName)) {
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|TITLE|NOSCRIPT|FORM|INPUT|BUTTON|SVG)$/.test(el.tagName)) {
          el.remove()
          return
        }
        walk(el)
        el.replaceWith(...el.childNodes) // unwrap unknown tags, keep their text
        return
      }
      ;[...el.attributes].forEach((a) => {
        const n = a.name.toLowerCase()
        const keep =
          (n === 'href' && el.tagName === 'A' && /^(https?:|mailto:|#)/i.test(a.value.trim())) ||
          (n === 'src' && el.tagName === 'IMG' && /^data:image\//i.test(a.value.trim())) ||
          ((n === 'colspan' || n === 'rowspan') && /^\d+$/.test(a.value)) ||
          (n === 'style' && /^text-align:\s*(left|center|right|justify);?$/i.test(a.value.trim()))
        if (!keep) el.removeAttribute(a.name)
      })
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }
      walk(el)
    })
  }
  walk(doc.body)
  return doc.body.innerHTML.trim() || '<p><br></p>'
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const textToHtml = (t) =>
  t
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('')

/** Minimal Markdown: headings, bold/italic, lists, paragraphs. */
function mdToHtml(md) {
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
  const out = []
  let list = null
  const close = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  md.replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((line) => {
      const h = line.match(/^(#{1,3})\s+(.*)$/)
      const ul = line.match(/^\s*[-*]\s+(.*)$/)
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
      if (h) {
        close()
        out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
      } else if (ul || ol) {
        const want = ul ? 'ul' : 'ol'
        if (list !== want) {
          close()
          out.push(`<${want}>`)
          list = want
        }
        out.push(`<li>${inline((ul || ol)[1])}</li>`)
      } else if (!line.trim()) {
        close()
      } else {
        close()
        out.push(`<p>${inline(line)}</p>`)
      }
    })
  close()
  return out.join('')
}

export const IMPORT_ACCEPT = '.docx,.txt,.md,.html,.htm'

/** File → { name, html } */
export async function importFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '') || 'Hujjat'
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'docx') {
    const { default: mammoth } = await import('mammoth/mammoth.browser.js')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return { name, html: sanitize(value) }
  }
  const text = await file.text()
  if (ext === 'html' || ext === 'htm') return { name, html: sanitize(text) }
  if (ext === 'md') return { name, html: sanitize(mdToHtml(text)) }
  if (ext === 'txt') return { name, html: textToHtml(text) }
  throw new Error('unsupported')
}

/* ───────────── Export ───────────── */

// University standard: Times New Roman 14pt, 1.5 spacing, margins 2/1.5/2/3 cm.
export const PAGE_CSS = `
@page{size:A4;margin:2cm 1.5cm 2cm 3cm}
body{font-family:'Times New Roman',Times,serif;font-size:14pt;line-height:1.5;color:#000}
h1{font-size:16pt;text-align:center;text-transform:uppercase;margin:0 0 12pt}
h2{font-size:14pt;margin:12pt 0 6pt}
h3{font-size:14pt;font-style:italic;margin:10pt 0 6pt}
p{margin:0;text-indent:1.25cm;text-align:justify}
li p{text-indent:0}
table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #000;padding:4pt 6pt;vertical-align:top}
img{max-width:100%}
.titul{display:flex;flex-direction:column;min-height:25cm;text-align:center}
.titul p{margin:0;text-indent:0;text-align:center}
.t-top p{font-weight:bold;text-transform:uppercase}
.t-top p.t-fac{font-weight:normal;text-transform:none;margin-top:6pt}
.t-mid{margin:auto 0}
.t-type{font-size:28pt;font-weight:bold;letter-spacing:3pt}
.t-subj{font-style:italic;margin-top:6pt}
.t-topic{font-weight:bold;margin-top:18pt}
.t-who{margin-left:auto;width:55%}
.titul .t-who p{text-align:left;margin-top:10pt}
.t-city{margin-top:36pt;font-weight:bold}
.hint{color:#6b7280;font-style:italic}
p.hint{text-indent:0}
.toc td{border:0;padding:2pt 0}.toc td.pg{width:40pt;text-align:right}.toc td.l2{padding-left:1cm}
.info td:first-child{width:30%}.swot{table-layout:fixed}
.pb{page-break-after:always;break-after:page;height:0;margin:0;border:0}
`

// Word ignores flexbox, so its title page gets fixed spacing instead.
const WORD_CSS = '.t-mid{margin-top:150pt}.t-who{margin-top:90pt}.t-city{margin-top:60pt}'

/** Generated documents mark pages with <hr class="pb">; print/Word need a real page break. */
const forExport = (html) => html.replace(/<hr class="pb"[^>]*>/g, '<div class="pb" style="page-break-after:always;break-after:page"></div>')

const fileSafe = (s) => s.replace(/[\\/:*?"<>|]/g, '').trim() || 'hujjat'

function save(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportDoc(doc, format) {
  const base = fileSafe(doc.name)
  const body = forExport(doc.html)
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.name)}</title><style>${PAGE_CSS}</style></head><body>${body}</body></html>`
  if (format === 'html') return save(new Blob([page], { type: 'text/html' }), `${base}.html`)
  if (format === 'txt') {
    const div = document.createElement('div')
    div.innerHTML = doc.html.replace(/<\/(p|h\d|li|div)>/g, '</$1>\n').replace(/<br\s*\/?>/g, '\n')
    return save(new Blob([div.textContent.replace(/\n{3,}/g, '\n\n').trim()], { type: 'text/plain' }), `${base}.txt`)
  }
  if (format === 'word') {
    // HTML in Word's own namespace — opens in Microsoft Word / LibreOffice with styles intact.
    const word = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(doc.name)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${PAGE_CSS}${WORD_CSS}@page Section1{size:21cm 29.7cm;margin:2cm 1.5cm 2cm 3cm}div.Section1{page:Section1}</style></head><body><div class="Section1">${body}</div></body></html>`
    return save(new Blob(['﻿', word], { type: 'application/msword' }), `${base}.doc`)
  }
  if (format === 'pdf') {
    const w = window.open('', '_blank')
    if (!w) return false
    w.document.write(page.replace('</body>', '<script>window.onload=()=>{window.print()}</script></body>'))
    w.document.close()
  }
  return true
}
