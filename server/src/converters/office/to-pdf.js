// DOCX / TXT / Markdown / HTML / CSV → PDF.
// With GOTENBERG_URL set, DOCX goes through LibreOffice for pixel-perfect layout;
// otherwise the built-in typesetter is used (core/office.js — the same code the browser runs).
import { readFile } from 'node:fs/promises'
import { baseName } from '../../lib/filetypes.js'
import { toPdf } from '../core/office.js'
import { emit } from '../lib/util.js'
import { nodePlatform } from '../lib/node-platform.js'

export { textToHtml, mdToHtml } from '../core/office.js'

async function viaGotenberg(url, input) {
  const form = new FormData()
  form.append('files', new Blob([await readFile(input.path)]), `document.${input.ext}`)
  const res = await fetch(`${url.replace(/\/$/, '')}/forms/libreoffice/convert`, { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`gotenberg ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
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
      const local = { ...input, read: async () => new Uint8Array(await readFile(input.path)) }
      bytes = await toPdf(local, options, nodePlatform)
    }
    outputs.push(await emit(outDir, `${baseName(input.name)}.pdf`, bytes))
  }
  return { outputs, summary: { files: outputs.length, engine: env.gotenbergUrl ? 'gotenberg' : 'builtin' } }
}
