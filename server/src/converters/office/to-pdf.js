// DOCX / TXT / Markdown / HTML / CSV → PDF.
// With GOTENBERG_URL set, DOCX goes through LibreOffice for pixel-perfect layout;
// otherwise the built-in typesetter is used (no external software needed).
import { readFile } from 'node:fs/promises'
import mammoth from 'mammoth'
import { ToolError } from '../../lib/errors.js'
import { baseName } from '../../lib/filetypes.js'
import { emit } from '../lib/util.js'
import { typeset } from './typeset.js'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function textToHtml(t) {
  return t
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Markdown subset: headings, emphasis, lists, quotes, code blocks, tables, rules. */
export function mdToHtml(md) {
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)|(^|\W)_(?!\s)(.+?)_(?!\w)/g, (_, a, b, c, d) => `${a ?? c}<em>${b ?? d}</em>`)
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
  const out = []
  let list = null
  let para = []
  let code = null
  let table = null
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join(' ')}</p>`)
    para = []
  }
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  const flushTable = () => {
    if (table) out.push(`<table>${table.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join('')}</tr>`).join('')}</table>`)
    table = null
  }
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (code !== null) {
      if (/^```/.test(line)) {
        out.push(`<pre>${esc(code.join('\n'))}</pre>`)
        code = null
      } else code.push(line)
      continue
    }
    if (/^```/.test(line)) {
      flushPara(), closeList(), flushTable()
      code = []
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara(), closeList()
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue // separator row
      table ??= []
      table.push(line.trim().slice(1, -1).split('|').map((c) => c.trim()))
      continue
    }
    flushTable()
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const q = line.match(/^>\s?(.*)$/)
    if (h) {
      flushPara(), closeList()
      const n = Math.min(3, h[1].length)
      out.push(`<h${n}>${inline(h[2])}</h${n}>`)
    } else if (ul || ol) {
      flushPara()
      const want = ul ? 'ul' : 'ol'
      if (list !== want) {
        closeList()
        out.push(`<${want}>`)
        list = want
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`)
    } else if (q) {
      flushPara(), closeList()
      out.push(`<blockquote><p>${inline(q[1])}</p></blockquote>`)
    } else if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara(), closeList()
      out.push('<hr>')
    } else if (!line.trim()) {
      flushPara(), closeList()
    } else {
      closeList()
      para.push(line.trim())
    }
  }
  if (code !== null) out.push(`<pre>${esc(code.join('\n'))}</pre>`)
  flushPara(), closeList(), flushTable()
  return out.join('')
}

function csvToHtml(text) {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = []
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"'
          i++
        } else q = !q
      } else if (ch === sep && !q) {
        cells.push(cur)
        cur = ''
      } else cur += ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  return `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>`
}

async function viaGotenberg(url, input) {
  const form = new FormData()
  form.append('files', new Blob([await readFile(input.path)]), `document.${input.ext}`)
  const res = await fetch(`${url.replace(/\/$/, '')}/forms/libreoffice/convert`, { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`gotenberg ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function toHtml(input) {
  if (input.ext === 'docx') {
    const { value } = await mammoth.convertToHtml({ path: input.path })
    return value
  }
  const text = (await readFile(input.path, 'utf8')).replace(/^﻿/, '')
  if (input.ext === 'md') return mdToHtml(text)
  if (input.ext === 'html') return text
  if (input.ext === 'csv') return csvToHtml(text)
  return textToHtml(text)
}

export async function run({ inputs, options, outDir }, { progress, env }) {
  const outputs = []
  for (const [i, input] of inputs.entries()) {
    progress(5 + (88 * i) / inputs.length, inputs.length > 1 ? `${i + 1} / ${inputs.length}: ${input.name}` : 'Hujjat sahifalanmoqda')
    let bytes = null
    if (env.gotenbergUrl && input.ext === 'docx') {
      bytes = await viaGotenberg(env.gotenbergUrl, input).catch(() => null) // fall back to the built-in engine
    }
    if (!bytes) {
      let html
      try {
        html = await toHtml(input)
      } catch {
        throw new ToolError('UNSUPPORTED_FILE', `«${input.name}» ni öqib bölmadi — fayl şikastlangan bölişi mumkin.`)
      }
      bytes = await typeset(html, { family: options.font, size: options.size, preset: options.academic ? 'academic' : 'plain', title: baseName(input.name) })
    }
    outputs.push(await emit(outDir, `${baseName(input.name)}.pdf`, bytes))
  }
  return { outputs, summary: { files: outputs.length, engine: env.gotenbergUrl ? 'gotenberg' : 'builtin' } }
}
