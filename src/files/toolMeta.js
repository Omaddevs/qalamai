// Presentation layer for the server's tool catalog: icons, colours, format badges,
// labels for option values (in the interface language), and which options depend on others.
import {
  FileDoc, FileImage, FileTxt, FileXls, FilePpt, NotePencil, ArrowsMerge, Scissors, ArrowClockwise, ArrowsInSimple,
  Stamp, ListNumbers, MagicWand, ArrowsLeftRight, ArrowsIn, CornersOut, FilePdf, FileText, UserFocus,
} from '@phosphor-icons/react'
import { has, t } from '../i18n/index.js'

export const CATEGORIES = ['all', 'pdf', 'edit', 'image', 'document'].map((id) => ({ id, get label() { return t(`fs.cat.${id}`) } }))

export const TOOL_UI = {
  'image-portrait': { icon: UserFocus, color: 'blue', from: 'JPG', to: '3×4', tag: 'AI', hero: true },
  'image-remove-bg': { icon: MagicWand, color: 'purple', from: 'JPG', to: 'PNG', tag: 'AI', hero: true },
  'pdf-edit': { icon: NotePencil, color: 'indigo', from: 'PDF', to: 'PDF', get tag() { return t('fs.tagNew') }, hero: true },
  'pdf-to-docx': { icon: FileDoc, color: 'sky', from: 'PDF', to: 'DOCX', hero: true },
  'doc-to-pdf': { icon: FilePdf, color: 'red', from: 'DOCX', to: 'PDF' },
  'pdf-to-images': { icon: FileImage, color: 'amber', from: 'PDF', to: 'JPG' },
  'pdf-to-xlsx': { icon: FileXls, color: 'green', from: 'PDF', to: 'XLSX' },
  'pdf-to-pptx': { icon: FilePpt, color: 'orange', from: 'PDF', to: 'PPTX' },
  'pdf-to-text': { icon: FileTxt, color: 'indigo', from: 'PDF', to: 'TXT' },
  'pdf-merge': { icon: ArrowsMerge, color: 'red', from: 'PDF+', to: 'PDF' },
  'pdf-split': { icon: Scissors, color: 'pink', from: 'PDF', to: 'PDF×' },
  'pdf-compress': { icon: ArrowsInSimple, color: 'emerald', from: 'PDF', to: '−70%' },
  'pdf-rotate': { icon: ArrowClockwise, color: 'teal', from: 'PDF', to: '90°' },
  'pdf-watermark': { icon: Stamp, color: 'sky', from: 'PDF', to: 'PDF' },
  'pdf-page-numbers': { icon: ListNumbers, color: 'indigo', from: 'PDF', to: '1·2·3' },
  'image-convert': { icon: ArrowsLeftRight, color: 'amber', from: 'JPG', to: 'PNG' },
  'image-compress': { icon: ArrowsIn, color: 'green', from: 'IMG', to: '−80%' },
  'image-resize': { icon: CornersOut, color: 'orange', from: 'IMG', to: 'px' },
  'images-to-pdf': { icon: FileText, color: 'red', from: 'JPG', to: 'PDF' },
}

/**
 * The portrait studio runs only in the browser (src/portrait), so it isn't in the server's
 * catalog: the file studio adds it to the list itself.
 */
export function portraitTool() {
  const [title, description] = t('fs.tool.image-portrait').split('|')
  return { id: 'image-portrait', category: 'image', title, description, accepts: ['image'], minFiles: 1, maxFiles: 1, studio: true, available: true, options: {} }
}

/** Display order in the grid. */
export const TOOL_ORDER = Object.keys(TOOL_UI)

/** Which tools to suggest first for a set of files. */
export function suggest(tools, files) {
  if (!files.length) return []
  const kinds = new Set(files.map((f) => f.kind))
  const exts = new Set(files.map((f) => f.ext))
  const fits = (t) => files.every((f) => t.accepts.includes(f.kind) && (!t.exts || t.exts.includes(f.ext))) && files.length >= t.minFiles && files.length <= t.maxFiles
  const priority = kinds.has('pdf')
    ? files.length > 1
      ? ['pdf-merge', 'pdf-compress']
      : ['pdf-to-docx', 'pdf-edit', 'pdf-compress', 'pdf-to-images', 'pdf-to-xlsx', 'pdf-to-pptx', 'pdf-split', 'pdf-watermark', 'pdf-page-numbers', 'pdf-rotate', 'pdf-to-text']
    : kinds.has('image')
      ? ['image-portrait', 'image-remove-bg', 'image-convert', 'image-compress', 'images-to-pdf', 'image-resize', 'pdf-merge']
      : exts.has('docx') || kinds.has('text')
        ? ['doc-to-pdf']
        : []
  const byId = new Map(tools.map((t) => [t.id, t]))
  return priority.map((id) => byId.get(id)).filter((t) => t && fits(t))
}

const FIELDS = ['format', 'dpi', 'pages', 'layout', 'mode', 'ranges', 'angle', 'level', 'text', 'position', 'size', 'color', 'opacity', 'start', 'skipFirst', 'background', 'crop', 'quality', 'maxSide', 'percent', 'width', 'height', 'fit', 'pageSize', 'orientation', 'margin', 'font', 'academic']
/** Option labels in the interface language (src/i18n/msg/files.js). */
export const FIELD_LABELS = Object.fromEntries(FIELDS.map((f) => [f, null]))
for (const f of FIELDS) Object.defineProperty(FIELD_LABELS, f, { get: () => t(`fs.f.${f}`), enumerable: true })

export const FIELD_HINTS = {}
for (const f of ['pages', 'ranges', 'dpi', 'academic', 'crop', 'skipFirst']) Object.defineProperty(FIELD_HINTS, f, { get: () => t(`fs.h.${f}`), enumerable: true })

// Option values: formats and sizes stay as they are; words come from the dictionary (fs.v.<field>.<value>).
const FIXED = {
  format: { jpg: 'JPG', png: 'PNG', webp: 'WebP', avif: 'AVIF', gif: 'GIF', tiff: 'TIFF' },
  pageSize: { a4: 'A4', letter: 'Letter' },
  font: { sans: 'Sans' },
}
const PER_TOOL = {
  'pdf-page-numbers': { format: { n: '1, 2, 3', 'n-of-total': '1 / 12', 'page-n': () => t('fs.v.pageN') } },
  'image-remove-bg': { format: { png: 'PNG', webp: 'WebP', jpg: 'JPG' } },
}

export const valueLabel = (tool, field, value) => {
  const own = PER_TOOL[tool]?.[field]?.[value]
  if (own != null) return typeof own === 'function' ? own() : own
  if (FIXED[field]?.[value] != null) return FIXED[field][value]
  const key = `fs.v.${field}.${value}`
  return has(key) ? t(key) : String(value)
}

/** Options shown only when another option has a given value. */
export const VISIBLE_IF = {
  'pdf-split': { ranges: (o) => o.mode !== 'every' },
  'image-remove-bg': { color: (o) => o.background === 'color' },
  'image-resize': { percent: (o) => o.mode === 'percent', width: (o) => o.mode === 'size', height: (o) => o.mode === 'size', fit: (o) => o.mode === 'size' },
  'image-convert': { background: (o) => o.format === 'jpg' },
  'pdf-to-images': {},
}

/** Default option values from a JSON schema. */
export function defaultsOf(schema) {
  const out = {}
  for (const [k, p] of Object.entries(schema?.properties ?? {})) if (p.default !== undefined) out[k] = p.default
  return out
}

export const SWATCHES = ['#ffffff', '#000000', '#f1f5f9', '#fde68a', '#bbf7d0', '#bae6fd', '#fecaca', '#e9d5ff', '#14b8a6', '#ef4444', '#6b7280', '#2563eb']
