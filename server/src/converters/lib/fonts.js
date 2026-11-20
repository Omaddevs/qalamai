// Unicode fonts for pdf-lib. The 14 standard PDF fonts only cover WinAnsi, which has no
// ʻ ʼ (Uzbek Latin) and no Cyrillic — so we embed Noto Sans / Noto Serif (subset).
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import fontkit from '@pdf-lib/fontkit'

const FONT_DIR = fileURLToPath(new URL('../../../assets/fonts/', import.meta.url))
const cache = new Map()
const bytes = (file) => {
  if (!cache.has(file)) cache.set(file, readFile(FONT_DIR + file))
  return cache.get(file)
}

const fileFor = (family, bold, italic) =>
  `${family === 'serif' ? 'NotoSerif' : 'NotoSans'}-${bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'}.ttf`

/** Lazily embeds the variants a document actually uses. */
export function fontSet(pdfDoc) {
  pdfDoc.registerFontkit(fontkit)
  const embedded = new Map()
  return async function font({ family = 'sans', bold = false, italic = false } = {}) {
    const file = fileFor(family, bold, italic)
    if (!embedded.has(file)) embedded.set(file, bytes(file).then((b) => pdfDoc.embedFont(b, { subset: true })))
    return embedded.get(file)
  }
}

const charsets = new WeakMap()

/** Replace characters the font has no glyph for (drawText would otherwise throw). */
export function printable(font, text) {
  if (!charsets.has(font)) charsets.set(font, new Set(font.getCharacterSet()))
  const set = charsets.get(font)
  let out = ''
  for (const ch of text.replace(/\t/g, '    ').replace(/\r\n?/g, '\n')) {
    const cp = ch.codePointAt(0)
    out += ch === '\n' || set.has(cp) ? ch : cp === 0x2bb || cp === 0x2018 ? '\u2018' : '?'
  }
  return out
}
