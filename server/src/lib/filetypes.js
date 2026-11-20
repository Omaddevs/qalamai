// File type detection from content (magic bytes), never from the client's claimed MIME.
// The extension only breaks ties inside a container format (ZIP → docx/xlsx/pptx).

export const TYPES = {
  pdf: { mime: 'application/pdf', kind: 'pdf' },
  png: { mime: 'image/png', kind: 'image' },
  jpg: { mime: 'image/jpeg', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  gif: { mime: 'image/gif', kind: 'image' },
  avif: { mime: 'image/avif', kind: 'image' },
  heic: { mime: 'image/heic', kind: 'image' },
  tiff: { mime: 'image/tiff', kind: 'image' },
  bmp: { mime: 'image/bmp', kind: 'image' },
  svg: { mime: 'image/svg+xml', kind: 'image' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'spreadsheet' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'presentation' },
  odt: { mime: 'application/vnd.oasis.opendocument.text', kind: 'document' },
  doc: { mime: 'application/msword', kind: 'document' },
  zip: { mime: 'application/zip', kind: 'archive' },
  txt: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  md: { mime: 'text/markdown; charset=utf-8', kind: 'text' },
  html: { mime: 'text/html; charset=utf-8', kind: 'text' },
  csv: { mime: 'text/csv; charset=utf-8', kind: 'text' },
}

const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b)
const ascii = (buf, start, end) => buf.subarray(start, end).toString('latin1')

function looksLikeUtf8Text(buf) {
  const sample = buf.subarray(0, 4096)
  if (sample.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample.length < buf.length ? sample.subarray(0, lastCharBoundary(sample)) : sample)
    return true
  } catch {
    return false
  }
}

// Don't fail on a multi-byte character cut by the 4 KB sample window.
function lastCharBoundary(buf) {
  let i = buf.length
  for (let k = 1; k <= 3 && i - k >= 0; k++) {
    const b = buf[i - k]
    if ((b & 0xc0) === 0xc0) return i - k // start of a multi-byte sequence
    if ((b & 0x80) === 0) break
  }
  return i
}

/**
 * @param {Buffer} head  first bytes of the file (≥ 4 KB when available)
 * @param {string} filename  original name — only used for container/text disambiguation
 * @returns {{ ext: string, mime: string, kind: string } | null}
 */
export function detectType(head, filename = '') {
  const nameExt = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  const t = (ext) => ({ ext, ...TYPES[ext] })

  // %PDF may be preceded by junk bytes — the spec tolerates up to 1 KB.
  if (ascii(head, 0, 1024).includes('%PDF-')) return t('pdf')
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return t('png')
  if (startsWith(head, [0xff, 0xd8, 0xff])) return t('jpg')
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return t('webp')
  if (ascii(head, 0, 4) === 'GIF8') return t('gif')
  if (ascii(head, 0, 2) === 'BM') return t('bmp')
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) return t('tiff')
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12)
    if (brand === 'avif' || brand === 'avis') return t('avif')
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand)) return t('heic')
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return nameExt === 'doc' ? t('doc') : null
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML / ODF are ZIP containers — peek at the entries listed near the start.
    const s = ascii(head, 0, head.length)
    if (s.includes('word/') || nameExt === 'docx') return t('docx')
    if (s.includes('xl/') || nameExt === 'xlsx') return t('xlsx')
    if (s.includes('ppt/') || nameExt === 'pptx') return t('pptx')
    if (s.includes('opendocument.text')) return t('odt')
    return t('zip')
  }
  if (looksLikeUtf8Text(head)) {
    const text = head.subarray(0, 2048).toString('utf8').trimStart().toLowerCase()
    if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return t('svg')
    if (nameExt === 'md' || nameExt === 'markdown') return t('md')
    if (nameExt === 'csv') return t('csv')
    if (nameExt === 'html' || nameExt === 'htm' || text.startsWith('<!doctype html') || text.startsWith('<html')) return t('html')
    return t('txt')
  }
  return null
}

/** Safe filename for Content-Disposition and zip entries. */
export function cleanName(name, fallback = 'fayl') {
  const base = String(name ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  return base || fallback
}

export const baseName = (name) => cleanName(name).replace(/\.[a-z0-9]{1,5}$/i, '') || 'fayl'

/** RFC 6266 / 5987 Content-Disposition with a UTF-8 filename (Uzbek letters survive). */
export function contentDisposition(name, inline = false) {
  const clean = cleanName(name)
  const fallback = clean.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(clean)}`
}
