import { readFile } from 'node:fs/promises'
import { and, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { notFound, unsupported } from '../../lib/errors.js'
import { sign, verifySignature } from '../../lib/crypto.js'
import { cleanName, detectType } from '../../lib/filetypes.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { limitsFor } from '../plans/plans.js'

const { files } = schema
const URL_TTL_MS = 2 * 3600_000
const URL_WINDOW_MS = 30 * 60_000

/** Page count without parsing the whole PDF: the root /Pages node carries the largest /Count. */
async function pdfInfo(path, head) {
  const buf = await readFile(path)
  const text = buf.toString('latin1')
  // bounded gaps keep the scan linear on large binary files
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]{0,400}?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]{0,400}?\/Type\s*\/Pages\b/g)].map((m) => Number(m[1] ?? m[2]))
  const encrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(text.slice(-4096)) || /\/Encrypt\s/.test(text.slice(0, 2048))
  let pages = counts.length ? Math.max(...counts) : 0
  if (!pages) {
    // compressed object streams hide the page tree from a byte scan — parse it properly
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false })
      pages = doc.getPageCount()
    } catch {
      pages = 0
    }
  }
  return { pages, encrypted, version: head.toString('latin1').match(/%PDF-(\d\.\d)/)?.[1] }
}

async function imageInfo(path) {
  try {
    const { default: sharp } = await import('sharp')
    const m = await sharp(path, { failOn: 'none', limitInputPixels: 268_402_689 }).metadata()
    const rotated = m.orientation && m.orientation >= 5
    return {
      width: rotated ? m.height : m.width,
      height: rotated ? m.width : m.height,
      hasAlpha: Boolean(m.hasAlpha),
      format: m.format,
      ...(m.pages > 1 ? { frames: m.pages } : {}),
    }
  } catch {
    return {}
  }
}

export function createFileService({ db, storage, config, log }) {
  const secret = `${config.auth.jwtSecret}:files`

  // URLs stay identical within a 30-minute window so browsers can cache thumbnails.
  const signedUrl = (id, variant) => {
    const exp = Math.ceil((Date.now() + URL_TTL_MS) / URL_WINDOW_MS) * URL_WINDOW_MS
    const sig = sign(secret, `${id}:${variant}:${exp}`)
    return `/api/v1/files/${id}/${variant}?exp=${exp}&sig=${sig}`
  }

  const toPublic = (f) => ({
    id: f.id,
    name: f.name,
    ext: f.ext,
    mime: f.mime,
    kind: f.kind,
    size: f.size,
    meta: f.meta,
    source: f.source,
    jobId: f.jobId,
    parentId: f.parentId,
    createdAt: f.createdAt,
    expiresAt: f.expiresAt,
    url: signedUrl(f.id, 'content'),
    downloadUrl: `${signedUrl(f.id, 'content')}&download=1`,
    thumbUrl: f.kind === 'pdf' || (f.kind === 'image' && f.ext !== 'svg') ? signedUrl(f.id, 'thumbnail') : null,
  })

  const expiry = (user) => (limitsFor(user).keepFiles ? null : new Date(Date.now() + config.files.ttlHours * 3600_000))

  async function probe(path, type, head) {
    if (type.kind === 'pdf') return pdfInfo(path, head)
    if (type.kind === 'image' && type.ext !== 'svg') return imageInfo(path)
    return {}
  }

  return {
    toPublic,

    verifyUrl(id, variant, exp, sig) {
      const e = Number(exp)
      return Number.isFinite(e) && e > Date.now() && verifySignature(secret, `${id}:${variant}:${e}`, sig)
    },

    /** Store one multipart file part for a user. */
    async saveUpload(user, part) {
      const limits = limitsFor(user)
      const id = newId(ID_PREFIX.file)
      const tmpKey = `.tmp/${id}`
      const { size, sha256, head } = await storage.putStream(tmpKey, part.file, { maxBytes: limits.maxFileMb * 1048576 })
      const type = detectType(head, part.filename)
      if (!type || size === 0) {
        await storage.remove(tmpKey)
        throw unsupported(`«${cleanName(part.filename)}» — bu fayl turi qöllab-quvvatlanmaydi`)
      }
      const key = `${user.id}/${id}.${type.ext}`
      await storage.putFile(key, storage.pathOf(tmpKey))
      const meta = await probe(storage.pathOf(key), type, head)
      const name = cleanName(part.filename, `fayl.${type.ext}`)
      const [row] = await db
        .insert(files)
        .values({ id, userId: user.id, name, ext: type.ext, mime: type.mime, kind: type.kind, size, sha256, storageKey: key, meta, source: 'upload', expiresAt: expiry(user) })
        .returning()
      return row
    },

    /** Register a file a tool wrote into the storage temp dir. */
    async saveOutput(user, { path, name }, { jobId, parentId }) {
      const buf = await readFile(path)
      const type = detectType(buf.subarray(0, 8192), name)
      if (!type) throw new Error(`tool produced an unrecognised file: ${name}`)
      const id = newId(ID_PREFIX.file)
      const key = `${user.id}/${id}.${type.ext}`
      const { createHash } = await import('node:crypto')
      const sha256 = createHash('sha256').update(buf).digest('hex')
      await storage.putFile(key, path)
      const meta = await probe(storage.pathOf(key), type, buf.subarray(0, 8192))
      const [row] = await db
        .insert(files)
        .values({ id, userId: user.id, name: cleanName(name), ext: type.ext, mime: type.mime, kind: type.kind, size: buf.length, sha256, storageKey: key, meta, source: 'tool', jobId, parentId, expiresAt: expiry(user) })
        .returning()
      return row
    },

    async get(user, id) {
      const [f] = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, user.id))).limit(1)
      if (!f || (f.expiresAt && f.expiresAt < new Date())) throw notFound('Fayl topilmadi yoki muddati tugagan')
      return f
    },

    /** For signed URLs — ownership was proven by the signature. */
    async getById(id) {
      const [f] = await db.select().from(files).where(eq(files.id, id)).limit(1)
      if (!f || (f.expiresAt && f.expiresAt < new Date())) throw notFound('Fayl topilmadi yoki muddati tugagan')
      return f
    },

    async getMany(user, ids) {
      if (!ids.length) return []
      const rows = await db.select().from(files).where(and(eq(files.userId, user.id), inArray(files.id, ids)))
      const now = new Date()
      const byId = new Map(rows.filter((f) => !f.expiresAt || f.expiresAt > now).map((f) => [f.id, f]))
      const missing = ids.filter((id) => !byId.has(id))
      if (missing.length) throw notFound('Ayrim fayllar topilmadi yoki muddati tugagan')
      return ids.map((id) => byId.get(id))
    },

    async list(user, { kind, source, limit = 50, before } = {}) {
      const conds = [eq(files.userId, user.id), sql`(${files.expiresAt} is null or ${files.expiresAt} > now())`]
      if (kind) conds.push(eq(files.kind, kind))
      if (source) conds.push(eq(files.source, source))
      if (before) conds.push(lt(files.createdAt, new Date(before)))
      return db.select().from(files).where(and(...conds)).orderBy(desc(files.createdAt)).limit(limit)
    },

    async update(user, id, { name, keep }) {
      const f = await this.get(user, id)
      const set = {}
      if (name) set.name = cleanName(name.endsWith(`.${f.ext}`) ? name : `${name}.${f.ext}`)
      if (keep !== undefined) set.expiresAt = keep && limitsFor(user).keepFiles ? null : (f.expiresAt ?? expiry(user))
      if (!Object.keys(set).length) return f
      const [row] = await db.update(files).set(set).where(eq(files.id, id)).returning()
      return row
    },

    async remove(user, id) {
      const f = await this.get(user, id)
      await db.delete(files).where(eq(files.id, f.id))
      await storage.remove(f.storageKey)
    },

    async removeAllFor(userId) {
      const rows = await db.select({ key: files.storageKey }).from(files).where(eq(files.userId, userId))
      await Promise.all(rows.map((r) => storage.remove(r.key)))
    },

    /** Delete expired files from disk and DB. Returns how many were removed. */
    async sweepExpired() {
      const rows = await db.delete(files).where(and(isNotNull(files.expiresAt), lt(files.expiresAt, new Date()))).returning({ key: files.storageKey })
      for (const r of rows) await storage.remove(r.key).catch((err) => log.warn({ err }, 'could not delete expired file'))
      return rows.length
    },
  }
}
