import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest, notFound, quotaExceeded, unsupported } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { limitsFor, tashkentDay } from '../plans/plans.js'
import { TOOL_MAP } from '../tools/catalog.js'

const { jobs, usage, users } = schema
const TOOL_RUNS = 'tool_runs'
const KIND_LABEL = { pdf: 'PDF', image: 'rasm', document: 'Word hujjat', text: 'matn fayl', spreadsheet: 'Excel', presentation: 'PowerPoint' }

export function createJobService({ db, pool, files, storage, log }) {
  const waiters = new Map() // jobId → Set<() => void>
  const live = new Map() // jobId → { progress, stage } — fresher than the DB between throttled writes
  const controllers = new Map() // jobId → AbortController

  const notify = (id) => {
    const set = waiters.get(id)
    if (!set) return
    waiters.delete(id)
    for (const fn of set) fn()
  }

  const update = async (id, set) => {
    await db.update(jobs).set(set).where(eq(jobs.id, id))
    notify(id)
  }

  async function consumeRun(user) {
    const { dailyToolRuns, label } = limitsFor(user)
    const rows = await db
      .insert(usage)
      .values({ userId: user.id, day: tashkentDay(), metric: TOOL_RUNS, count: 1 })
      .onConflictDoUpdate({ target: [usage.userId, usage.day, usage.metric], set: { count: sql`${usage.count} + 1` }, setWhere: sql`${usage.count} < ${dailyToolRuns}` })
      .returning({ count: usage.count })
    if (!rows.length) {
      throw quotaExceeded(`«${label}» hisobda kuniga ${dailyToolRuns} ta amal mumkin. Ertaga davom eting yoki coin sotib oling — limitlar oçiladi.`, { limit: dailyToolRuns })
    }
  }

  const refundRun = (userId, day) =>
    db
      .update(usage)
      .set({ count: sql`greatest(${usage.count} - 1, 0)` })
      .where(and(eq(usage.userId, userId), eq(usage.day, day), eq(usage.metric, TOOL_RUNS)))
      .catch(() => {})

  async function execute(job, user) {
    const ac = new AbortController()
    controllers.set(job.id, ac)
    const outDir = join(storage.tmpDir, job.id)
    try {
      await update(job.id, { status: 'running', startedAt: new Date(), stage: 'Tayyorlanmoqda', progress: 1 })
      const inputs = (await files.getMany(user, job.inputIds)).map((f) => ({
        id: f.id,
        path: storage.pathOf(f.storageKey),
        name: f.name,
        ext: f.ext,
        kind: f.kind,
        meta: f.meta,
      }))
      await mkdir(outDir, { recursive: true })

      let lastWrite = 0
      const result = await pool.run(
        { kind: 'tool', tool: job.tool, inputs, options: job.options, outDir },
        {
          signal: ac.signal,
          onProgress: (progress, stage) => {
            live.set(job.id, { progress, stage })
            notify(job.id)
            if (Date.now() - lastWrite > 750) {
              lastWrite = Date.now()
              db.update(jobs).set({ progress, stage }).where(eq(jobs.id, job.id)).catch(() => {})
            }
          },
        },
      )

      const saved = []
      for (const out of result.outputs) saved.push(await files.saveOutput(user, out, { jobId: job.id, parentId: job.inputIds[0] }))
      live.delete(job.id)
      await update(job.id, { status: 'done', progress: 100, stage: 'Tayyor', outputIds: saved.map((f) => f.id), result: result.summary ?? null, finishedAt: new Date() })
    } catch (err) {
      live.delete(job.id)
      const canceled = err.code === 'CANCELED'
      if (!canceled && !err.code) log.error({ err, jobId: job.id, tool: job.tool }, 'job failed')
      else if (!canceled) log.warn({ code: err.code, jobId: job.id, tool: job.tool, stack: err.stack }, 'job failed')
      // a failure that isn't the user's fault shouldn't cost them a daily run
      if (!canceled) refundRun(user.id, tashkentDay(job.createdAt))
      await update(job.id, {
        status: canceled ? 'canceled' : 'failed',
        stage: null,
        error: { code: err.code ?? 'TOOL_FAILED', message: err.code ? err.message : 'Faylni qayta işlab bölmadi. Qayta urinib köring.' },
        finishedAt: new Date(),
      })
    } finally {
      controllers.delete(job.id)
      rm(outDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  return {
    async create(user, toolId, { fileIds, options }) {
      const tool = TOOL_MAP.get(toolId)
      if (!tool) throw notFound('Bunday vosita yöq')
      const parsed = tool.options.safeParse(options ?? {})
      if (!parsed.success) {
        throw badRequest(
          parsed.error.issues[0]?.message ?? 'Sozlamalar notöğri',
          parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
        )
      }
      const limits = limitsFor(user)
      const ids = [...new Set(fileIds)]
      if (ids.length < tool.minFiles) throw badRequest(tool.minFiles > 1 ? `Kamida ${tool.minFiles} ta fayl tanlang` : 'Fayl tanlang')
      if (ids.length > Math.min(tool.maxFiles, limits.maxFilesPerJob)) {
        throw badRequest(`Bir martada köpi bilan ${Math.min(tool.maxFiles, limits.maxFilesPerJob)} ta fayl`, { max: Math.min(tool.maxFiles, limits.maxFilesPerJob) })
      }
      const inputs = await files.getMany(user, ids)
      for (const f of inputs) {
        if (!tool.accepts.includes(f.kind) || (tool.exts && !tool.exts.includes(f.ext))) {
          const want = tool.accepts.map((k) => KIND_LABEL[k] ?? k).join(' yoki ')
          throw unsupported(`«${f.name}» bu vosita uçun mos emas — ${want} kerak`)
        }
        if (f.kind === 'pdf' && f.meta?.encrypted && tool.id !== 'pdf-to-images' && tool.id !== 'pdf-to-text') {
          throw new AppError(422, 'PDF_ENCRYPTED', `«${f.name}» parol bilan himoyalangan. Avval himoyani olib taşlang.`)
        }
      }
      const pages = inputs.reduce((n, f) => n + (f.meta?.pages ?? 0), 0)
      if (pages > limits.maxPdfPages) {
        throw quotaExceeded(`«${limits.label}» hisobda bir martada ${limits.maxPdfPages} sahifagaça. Bu fayllarda ${pages} sahifa bor.`, { limit: limits.maxPdfPages })
      }
      await consumeRun(user)

      const [job] = await db
        .insert(jobs)
        .values({ id: newId(ID_PREFIX.job), userId: user.id, tool: tool.id, inputIds: ids, options: parsed.data, stage: 'Navbatda' })
        .returning()
      // runs in the background; clients poll GET /jobs/:id
      execute(job, user).catch((err) => log.error({ err, jobId: job.id }, 'job bookkeeping failed'))
      return job
    },

    async get(user, id) {
      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).limit(1)
      if (!job) throw notFound('Vazifa topilmadi')
      return { ...job, ...(live.get(id) ?? {}) }
    },

    async list(user, limit = 30) {
      return db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(desc(jobs.createdAt)).limit(limit)
    },

    /** Long-poll: resolve on the next change of this job, or after `ms`. */
    waitForChange(id, ms) {
      return new Promise((resolve) => {
        const set = waiters.get(id) ?? new Set()
        waiters.set(id, set)
        const done = () => {
          clearTimeout(timer)
          set.delete(done)
          resolve()
        }
        const timer = setTimeout(done, ms)
        set.add(done)
      })
    },

    async cancel(user, id) {
      const job = await this.get(user, id)
      if (job.status !== 'queued' && job.status !== 'running') return job
      const ac = controllers.get(id)
      if (ac) ac.abort()
      else await update(id, { status: 'canceled', finishedAt: new Date() })
      return this.get(user, id)
    },

    async publicJob(job) {
      const outputs = job.outputIds?.length ? await db.select().from(schema.files).where(inArray(schema.files.id, job.outputIds)) : []
      const order = new Map(job.outputIds.map((id, i) => [id, i]))
      outputs.sort((a, b) => order.get(a.id) - order.get(b.id))
      return {
        id: job.id,
        tool: job.tool,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        inputIds: job.inputIds,
        outputs: outputs.map(files.toPublic),
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      }
    },

    /** After a restart: running jobs were interrupted; queued ones start again. */
    async recover() {
      await db
        .update(jobs)
        .set({ status: 'failed', error: { code: 'INTERRUPTED', message: 'Server qayta işga tuşdi — amalni qayta bajaring' }, finishedAt: new Date() })
        .where(eq(jobs.status, 'running'))
      const queued = await db.select().from(jobs).where(eq(jobs.status, 'queued'))
      for (const job of queued) {
        const [user] = await db.select().from(users).where(eq(users.id, job.userId)).limit(1)
        if (user) execute(job, user).catch((err) => log.error({ err, jobId: job.id }, 'job bookkeeping failed'))
      }
      return queued.length
    },

    async sweepOld(days = 7) {
      const rows = await db
        .delete(jobs)
        .where(and(lt(jobs.createdAt, new Date(Date.now() - days * 86400_000)), inArray(jobs.status, ['done', 'failed', 'canceled'])))
        .returning({ id: jobs.id })
      return rows.length
    },
  }
}
