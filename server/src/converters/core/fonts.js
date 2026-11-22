// Unicode fonts for pdf-lib. The 14 standard PDF fonts only cover WinAnsi, which has no
// ʻ ʼ (Uzbek Latin) and no Cyrillic — so we embed Noto Sans / Noto Serif (subset).
// Where the font bytes come from is the platform's business (disk on the server, a fetch in the browser).
import fontkit from '@pdf-lib/fontkit'

export const FONT_FILES = [
  'NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSans-Italic.ttf', 'NotoSans-BoldItalic.ttf',
  'NotoSerif-Regular.ttf', 'NotoSerif-Bold.ttf', 'NotoSerif-Italic.ttf', 'NotoSerif-BoldItalic.ttf',
]

const fileFor = (family, bold, italic) =>
  `${family === 'serif' ? 'NotoSerif' : 'NotoSans'}-${bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'}.ttf`

/**
 * Lazily embeds the variants a document actually uses.
 * @param {(file: string) => Promise<Uint8Array>} loadFont
 */
export function fontSet(pdfDoc, loadFont) {
  pdfDoc.registerFontkit(fontkit)
  const embedded = new Map()
  return async function font({ family = 'sans', bold = false, italic = false } = {}) {
    const file = fileFor(family, bold, italic)
    if (!embedded.has(file)) embedded.set(file, loadFont(file).then((b) => pdfDoc.embedFont(b, { subset: true })))
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
    out += ch === '\n' || set.has(cp) ? ch : cp === 0x2bb || cp === 0x2018 ? '‘' : '?'
  }
  return out
}
