// Tool catalog — what each tool accepts, produces and which options it takes.
// Shared by the API (validation, GET /tools) and documented for the frontend.
// The heavy implementations live in src/converters and only load inside worker threads.
import { z } from 'zod'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Rang #RRGGBB körinişida bölişi kerak')
const num = z.number().finite()
const pageIdx = z.number().int().min(0).max(9999)
/** "1-3, 5, 8-10" — 1-based, as people write it */
const pageRange = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\s*\d+\s*(-\s*\d+\s*)?)(,\s*\d+\s*(-\s*\d+\s*)?)*$/, 'Sahifalar: masalan «1-3, 5, 8-10»')
const rect = z.tuple([num, num, num, num]) // x, y, width, height — PDF points, origin bottom-left
const point = z.tuple([num, num])
const opacity = z.number().min(0).max(1)

const textStyle = {
  size: z.number().min(4).max(300).default(12),
  color: hex.default('#111111'),
  font: z.enum(['sans', 'serif']).default('sans'),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  opacity: opacity.default(1),
}

export const editOperation = z.discriminatedUnion('type', [
  // x, y = baseline start of the first line; angle defaults to the page rotation (upright text)
  z.object({
    type: z.literal('text'),
    page: pageIdx,
    x: num,
    y: num,
    angle: num.optional(),
    text: z.string().min(1).max(10_000),
    lineHeight: z.number().min(0.8).max(3).default(1.25),
    // lines line up against the block's longest line; x stays the block's left edge
    align: z.enum(['left', 'center', 'right']).default('left'),
    ...textStyle,
  }),
  // edit existing text: paint `cover` over `rect`, then draw the new text at the original baseline
  z.object({
    type: z.literal('replace'),
    page: pageIdx,
    rect,
    x: num,
    y: num,
    angle: num.optional(),
    text: z.string().max(10_000),
    cover: hex.default('#ffffff'),
    lineHeight: z.number().min(0.8).max(3).default(1.2),
    ...textStyle,
  }),
  z.object({ type: z.literal('whiteout'), page: pageIdx, rect, color: hex.default('#ffffff') }),
  z.object({ type: z.literal('highlight'), page: pageIdx, rect, color: hex.default('#fde047'), opacity: opacity.default(0.4) }),
  z.object({
    type: z.enum(['rect', 'ellipse']),
    page: pageIdx,
    rect,
    fill: hex.nullable().default(null),
    stroke: hex.nullable().default('#111111'),
    strokeWidth: z.number().min(0).max(40).default(1.5),
    opacity: opacity.default(1),
  }),
  z.object({ type: z.literal('line'), page: pageIdx, from: point, to: point, color: hex.default('#111111'), width: z.number().min(0.2).max(40).default(1.5), opacity: opacity.default(1), arrow: z.boolean().default(false) }),
  z.object({ type: z.literal('ink'), page: pageIdx, points: z.array(point).min(2).max(10_000), color: hex.default('#111111'), width: z.number().min(0.2).max(40).default(2), opacity: opacity.default(1) }),
  // a clickable area that opens a web address (or mail / phone)
  z.object({ type: z.literal('link'), page: pageIdx, rect, url: z.string().trim().max(2000).regex(/^(https?:\/\/|mailto:|tel:)\S+$/i, 'Havola https://, mailto: yoki tel: bilan boşlanişi kerak') }),
  // a sticky-note comment (PDF text annotation) whose corner sits at x, y
  z.object({ type: z.literal('note'), page: pageIdx, x: num, y: num, text: z.string().max(5000), color: hex.default('#facc15') }),
  z.object({
    type: z.literal('image'),
    page: pageIdx,
    rect,
    src: z.string().max(12_000_000).regex(/^data:image\/(png|jpeg);base64,/, 'Rasm PNG yoki JPEG data URL bölişi kerak'),
    opacity: opacity.default(1),
  }),
])

const TOOLS = [
  /* ───────── PDF → boshqa formatlar ───────── */
  {
    id: 'pdf-to-docx',
    category: 'pdf',
    title: 'PDF → Word',
    description: 'Matn, sarlavhalar va rasmlar tahrirlanadigan DOCX hujjatga aylanadi.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'docx',
    options: z.object({ pages: pageRange.optional() }),
  },
  {
    id: 'pdf-to-images',
    category: 'pdf',
    title: 'PDF → Rasm',
    description: 'Har bir sahifa yuqori sifatli JPG, PNG yoki WebP rasmga.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'jpg|png|webp|zip',
    options: z.object({
      format: z.enum(['jpg', 'png', 'webp']).default('jpg'),
      dpi: z.number().int().min(50).max(300).default(150),
      pages: pageRange.optional(),
    }),
  },
  {
    id: 'pdf-to-text',
    category: 'pdf',
    title: 'PDF → Matn',
    description: 'Butun matnni TXT faylga — nusxalaş va tahlil uçun.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'txt',
    options: z.object({ pages: pageRange.optional(), layout: z.boolean().default(false) }),
  },
  {
    id: 'pdf-to-xlsx',
    category: 'pdf',
    title: 'PDF → Excel',
    description: 'Jadvallar ustun va qatorlari bilan XLSX faylga.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'xlsx',
    options: z.object({ pages: pageRange.optional() }),
  },
  {
    id: 'pdf-to-pptx',
    category: 'pdf',
    title: 'PDF → PowerPoint',
    description: 'Har bir sahifa alohida slayd — taqdimotga tayyor.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'pptx',
    options: z.object({ pages: pageRange.optional() }),
  },

  /* ───────── PDF bilan ishlash ───────── */
  {
    id: 'pdf-edit',
    category: 'edit',
    title: 'PDF muharriri',
    description: 'Mavjud matnni tahrirlang, matn, rasm, imzo, şakl qöşing; sahifalarni aylantiring va tartiblang.',
    // the first file is the PDF being edited; more PDFs / images can supply pages to insert
    accepts: ['pdf', 'image'],
    maxFiles: 20,
    output: 'pdf',
    editor: true,
    options: z.object({
      // pages added after the document's own (their indices go on from its page count), so
      // operations and the page plan can use them: blank pages, or a page of another input file
      append: z
        .array(
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('blank'), width: z.number().min(72).max(5000), height: z.number().min(72).max(5000) }),
            z.object({ type: z.literal('file'), file: z.number().int().min(1).max(19), page: z.number().int().min(0).max(9999).default(0) }),
          ]),
        )
        .max(2000)
        .default([]),
      pages: z.array(z.object({ src: pageIdx, rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0) })).min(1).max(10_000).optional(),
      operations: z.array(editOperation).max(5000).default([]),
    }),
  },
  {
    id: 'pdf-merge',
    category: 'edit',
    title: 'PDF birlaştiriş',
    description: 'Bir neçta PDF va rasmlarni kerakli tartibda bitta faylga.',
    accepts: ['pdf', 'image'],
    minFiles: 2,
    maxFiles: 50,
    output: 'pdf',
    options: z.object({}),
  },
  {
    id: 'pdf-split',
    category: 'edit',
    title: 'PDF ajratiş',
    description: 'Har sahifani alohida, oraliqlar böyiça yoki tanlangan sahifalarni ajrating.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'pdf|zip',
    options: z.object({ mode: z.enum(['every', 'ranges', 'extract']).default('every'), ranges: pageRange.optional() }),
  },
  {
    id: 'pdf-rotate',
    category: 'edit',
    title: 'Sahifalarni aylantiriş',
    description: 'Barça yoki tanlangan sahifalarni 90°, 180°, 270° ga.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'pdf',
    options: z.object({ angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).default(90), pages: pageRange.optional() }),
  },
  {
    id: 'pdf-compress',
    category: 'edit',
    title: 'PDF siqiş',
    description: 'Rasmlarni qayta siqib, fayl hajmini sifatni saqlagan holda kamaytiradi.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'pdf',
    options: z.object({ level: z.enum(['low', 'medium', 'high']).default('medium') }),
  },
  {
    id: 'pdf-watermark',
    category: 'edit',
    title: 'Suv belgisi',
    description: 'Har sahifaga matnli suv belgisi: diagonal, markazda yoki takroriy.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'pdf',
    options: z.object({
      text: z.string().trim().min(1).max(80).default('QalamAI'),
      position: z.enum(['diagonal', 'center', 'tile']).default('diagonal'),
      size: z.number().min(8).max(200).default(56),
      color: hex.default('#6b7280'),
      opacity: z.number().min(0.03).max(1).default(0.18),
      pages: pageRange.optional(),
    }),
  },
  {
    id: 'pdf-page-numbers',
    category: 'edit',
    title: 'Sahifa raqamlari',
    description: 'Kurs işi va referat talablariga mos sahifa raqamlaş.',
    accepts: ['pdf'],
    maxFiles: 1,
    output: 'pdf',
    options: z.object({
      position: z.enum(['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left']).default('bottom-center'),
      format: z.enum(['n', 'n-of-total', 'page-n']).default('n'),
      start: z.number().int().min(0).max(9999).default(1),
      skipFirst: z.boolean().default(true),
      size: z.number().min(6).max(36).default(11),
    }),
  },

  /* ───────── Rasmlar ───────── */
  {
    id: 'image-remove-bg',
    category: 'image',
    title: 'Fonni olib taşlaş',
    description: 'Sunʼiy intellekt obyektni ajratadi — şaffof PNG yoki istalgan rangli fon.',
    accepts: ['image'],
    maxFiles: 10,
    output: 'png|webp|jpg',
    ai: true,
    options: z.object({
      background: z.enum(['transparent', 'color']).default('transparent'),
      color: hex.default('#ffffff'),
      crop: z.boolean().default(false),
      format: z.enum(['png', 'webp', 'jpg']).default('png'),
    }),
  },
  {
    id: 'image-convert',
    category: 'image',
    title: 'Rasm formatini özgartiriş',
    description: 'JPG, PNG, WebP, AVIF, GIF, TIFF — istalgan yönalişda.',
    accepts: ['image'],
    maxFiles: 30,
    output: 'jpg|png|webp|avif|gif|tiff',
    options: z.object({
      format: z.enum(['jpg', 'png', 'webp', 'avif', 'gif', 'tiff']).default('png'),
      quality: z.number().int().min(1).max(100).default(90),
      background: hex.default('#ffffff'),
    }),
  },
  {
    id: 'image-compress',
    category: 'image',
    title: 'Rasmni siqiş',
    description: 'Közga bilinmaydigan farq bilan hajmni 50–90% kamaytiradi.',
    accepts: ['image'],
    maxFiles: 30,
    output: 'same',
    options: z.object({ level: z.enum(['low', 'medium', 'high']).default('medium'), maxSide: z.number().int().min(64).max(16384).optional() }),
  },
  {
    id: 'image-resize',
    category: 'image',
    title: 'Ölçamni özgartiriş',
    description: 'Foiz yoki aniq piksel böyiça — nisbatni saqlab.',
    accepts: ['image'],
    maxFiles: 30,
    output: 'same',
    options: z.object({
      mode: z.enum(['percent', 'size']).default('percent'),
      percent: z.number().min(1).max(400).default(50),
      width: z.number().int().min(1).max(16384).optional(),
      height: z.number().int().min(1).max(16384).optional(),
      fit: z.enum(['inside', 'cover', 'fill']).default('inside'),
    }),
  },
  /* Popular conversions, each its own tile and page (people search for the pair, not "convert").
     They run image-convert with the output format fixed. */
  ...[
    ['heic-to-jpg', 'HEIC → JPG', 'iPhone suratlarini (HEIC/HEIF) istalgan qurilmada oçiladigan JPG ga.', ['heic'], 'jpg'],
    ['webp-to-jpg', 'WebP → JPG', 'Saytlardan olingan WebP rasmlarni oddiy JPG ga.', ['webp'], 'jpg'],
    ['webp-to-png', 'WebP → PNG', 'WebP rasmlarni şaffofligini saqlagan holda PNG ga.', ['webp'], 'png'],
    ['png-to-jpg', 'PNG → JPG', 'PNG rasmlarni yengil JPG ga — şaffof joylar oq fon bilan.', ['png'], 'jpg'],
    ['jpg-to-png', 'JPG → PNG', 'JPG rasmlarni sifat yöqotmaydigan PNG formatiga.', ['jpg'], 'png'],
  ].map(([id, title, description, exts, format]) => ({
    id,
    impl: 'image-convert',
    category: 'image',
    title,
    description,
    accepts: ['image'],
    exts,
    maxFiles: 30,
    output: format,
    options:
      format === 'jpg'
        ? z.object({ format: z.literal('jpg').default('jpg'), quality: z.number().int().min(1).max(100).default(90), background: hex.default('#ffffff') })
        : z.object({ format: z.literal('png').default('png') }),
  })),
  {
    id: 'images-to-pdf',
    category: 'image',
    title: 'Rasmlardan PDF',
    description: 'Telefon suratlari va skanlarni bitta tartibli PDF hujjatga.',
    accepts: ['image'],
    maxFiles: 100,
    output: 'pdf',
    options: z.object({
      pageSize: z.enum(['a4', 'letter', 'fit']).default('a4'),
      orientation: z.enum(['auto', 'portrait', 'landscape']).default('auto'),
      margin: z.enum(['none', 'small', 'large']).default('small'),
    }),
  },

  /* ───────── Hujjatlar ───────── */
  {
    id: 'doc-to-pdf',
    category: 'document',
    title: 'Word → PDF',
    description: 'DOCX, TXT, Markdown va HTML — akademik talablarga mos PDF.',
    accepts: ['document', 'text'],
    exts: ['docx', 'txt', 'md', 'html', 'csv'],
    maxFiles: 10,
    output: 'pdf',
    options: z.object({
      font: z.enum(['serif', 'sans']).default('serif'),
      size: z.number().min(9).max(18).default(14),
      academic: z.boolean().default(true),
    }),
  },
  {
    id: 'xlsx-to-pdf',
    category: 'document',
    title: 'Excel → PDF',
    description: 'XLSX va CSV jadvallar — ustun kengliklari, ranglar va birlaştirilgan kataklar bilan.',
    accepts: ['spreadsheet', 'text'],
    exts: ['xlsx', 'csv'],
    maxFiles: 10,
    output: 'pdf',
    options: z.object({
      orientation: z.enum(['auto', 'portrait', 'landscape']).default('auto'),
      fitWidth: z.boolean().default(true),
      gridlines: z.boolean().default(true),
      pageSize: z.enum(['a4', 'letter']).default('a4'),
    }),
  },
  {
    id: 'pptx-to-pdf',
    category: 'document',
    title: 'PowerPoint → PDF',
    description: 'PPTX taqdimotning har bir slaydi — fon, matn, rasm va jadvallari bilan PDF sahifaga.',
    accepts: ['presentation'],
    exts: ['pptx'],
    maxFiles: 10,
    output: 'pdf',
    options: z.object({}),
  },
].map((t) => ({ minFiles: 1, ...t }))

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.id, t]))

/** Optional native engines: a tool whose engine isn't installed is listed as unavailable. */
const ENGINES = { 'image-remove-bg': 'onnxruntime-node' }
const installed = (pkg) => {
  try {
    import.meta.resolve(pkg)
    return true
  } catch {
    return false
  }
}

/** Public catalog (options as JSON Schema so clients can render forms). */
export const publicCatalog = () =>
  TOOLS.map(({ options, ...t }) => ({
    ...t,
    available: !ENGINES[t.id] || installed(ENGINES[t.id]),
    options: z.toJSONSchema(options, { io: 'input', unrepresentable: 'any' }),
  }))

export { parsePageRange, parseRangeGroups } from '../../converters/core/ranges.js'
