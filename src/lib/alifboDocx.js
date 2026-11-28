// Word (.docx) alphabet conversion, done entirely in the browser: the file is never uploaded.
// Only the text inside <w:t> runs changes, so fonts, styles, tables, pictures and page layout stay as they were.
import { WORD, convert, detectScript } from './alifbo.js'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
// body, headers, footers, footnotes, endnotes and comments
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/

export const MAX_DOCX_BYTES = 50 * 1024 * 1024

export class DocxError extends Error {
  constructor(code) {
    super(code)
    this.code = code // 'type' | 'size' | 'read'
  }
}

/** Reads the file once; the result can be converted many times (switching the target script is instant). */
export async function readDocx(file) {
  if (!/\.docx$/i.test(file.name)) throw new DocxError('type')
  if (file.size > MAX_DOCX_BYTES) throw new DocxError('size')
  const { unzipSync, strFromU8 } = await import('fflate')
  let files
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new DocxError('read')
  }
  if (!files['word/document.xml']) throw new DocxError('read')

  const parts = {}
  for (const name of Object.keys(files)) if (TEXT_PARTS.test(name)) parts[name] = strFromU8(files[name])

  // Script detection looks at the main body text only.
  const body = parse(parts['word/document.xml'])
  const sample = Array.from(body.getElementsByTagNameNS(W_NS, 't')).map((n) => n.textContent).join(' ')
  return { name: file.name, files, parts, detected: detectScript(sample) }
}

/** Returns { blob, fileName, words } — words is how many words actually changed. */
export async function convertDocx(doc, from, to, label) {
  const { zipSync, strToU8 } = await import('fflate')
  const out = { ...doc.files }
  let words = 0
  for (const [name, xml] of Object.entries(doc.parts)) {
    const dom = parse(xml)
    const changed = convertDom(dom, from, to)
    if (!changed) continue
    words += changed
    out[name] = strToU8(serialize(dom, xml))
  }
  const bytes = zipSync(out, { level: 6 })
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  return { blob, fileName: outName(doc.name, from, to, label), words }
}

function parse(xml) {
  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  if (dom.getElementsByTagName('parsererror').length) throw new DocxError('read')
  return dom
}

// XMLSerializer drops the <?xml … standalone="yes"?> declaration; Word expects it, so put the original back.
function serialize(dom, original) {
  const decl = original.match(/^﻿?<\?xml[^>]*\?>/)
  const body = new XMLSerializer().serializeToString(dom)
  return decl && !body.startsWith('<?xml') ? `${decl[0].replace(/^﻿/, '')}\r\n${body}` : body
}

/**
 * Word often splits one word across several runs (spell-check marks, revision ids): "To" + "shkent".
 * Converting each run alone would miss "sh"/"ch"/"oʻ", so the text of a whole paragraph is converted word by word,
 * and each converted word goes back into the run where it started.
 */
function convertDom(dom, from, to) {
  const groups = new Map()
  for (const t of Array.from(dom.getElementsByTagNameNS(W_NS, 't'))) {
    const p = closestParagraph(t)
    if (!groups.has(p)) groups.set(p, [])
    groups.get(p).push(t)
  }
  let words = 0
  for (const nodes of groups.values()) words += convertRuns(nodes, from, to)
  return words
}

function closestParagraph(node) {
  for (let n = node.parentNode; n; n = n.parentNode) if (n.namespaceURI === W_NS && n.localName === 'p') return n
  return null
}

function convertRuns(nodes, from, to) {
  const texts = nodes.map((n) => n.textContent)
  const full = texts.join('')
  if (!full) return 0
  const owner = new Array(full.length)
  let k = 0
  texts.forEach((s, i) => {
    for (let j = 0; j < s.length; j++) owner[k++] = i
  })

  const res = texts.map(() => '')
  let pos = 0
  let words = 0
  for (const m of full.matchAll(new RegExp(WORD.source, WORD.flags))) {
    for (; pos < m.index; pos++) res[owner[pos]] += full[pos]
    const conv = convert(m[0], from, to)
    if (conv !== m[0]) words++
    res[owner[m.index]] += conv
    pos = m.index + m[0].length
  }
  for (; pos < full.length; pos++) res[owner[pos]] += full[pos]

  nodes.forEach((n, i) => {
    if (res[i] === texts[i]) return
    n.textContent = res[i]
    if (/^\s|\s$/.test(res[i])) n.setAttributeNS(XML_NS, 'xml:space', 'preserve')
  })
  return words
}

// The file name is converted too; if it has nothing to convert, the target script's name is added instead.
function outName(name, from, to, label) {
  const base = name.replace(/\.docx$/i, '')
  const conv = convert(base, from, to)
  return `${conv === base ? `${base} (${label})` : conv}.docx`
}
