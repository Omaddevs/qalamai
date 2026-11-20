// Entry point: start the API, recover interrupted jobs, run periodic cleanup,
// and shut down gracefully on SIGINT / SIGTERM.
import { and, eq, lt, or, isNotNull, notExists, sql } from 'drizzle-orm'
import { config } from './config.js'
import { buildApp } from './app.js'
import { schema } from './db/index.js'

const app = await buildApp(config)
const { db, files, jobs } = app.ctx

async function sweep() {
  try {
    const removedFiles = await files.sweepExpired()
    const removedJobs = await jobs.sweepOld()
    await db.delete(schema.sessions).where(or(lt(schema.sessions.expiresAt, new Date()), and(isNotNull(schema.sessions.revokedAt), lt(schema.sessions.revokedAt, new Date(Date.now() - 7 * 86400_000)))))
    const staleGuests = await db
      .delete(schema.users)
      .where(
        and(
          eq(schema.users.isGuest, true),
          lt(schema.users.lastSeenAt, new Date(Date.now() - config.files.guestTtlDays * 86400_000)),
          // a guest's published Link-in-Bio page keeps the account alive
          notExists(db.select({ one: sql`1` }).from(schema.bioPages).where(eq(schema.bioPages.userId, schema.users.id))),
        ),
      )
      .returning({ id: schema.users.id })
    for (const g of staleGuests) await files.removeAllFor(g.id)
    await db.delete(schema.telegramLogins).where(lt(schema.telegramLogins.expiresAt, new Date(Date.now() - 86400_000)))
    if (removedFiles || removedJobs || staleGuests.length) app.log.info({ removedFiles, removedJobs, staleGuests: staleGuests.length }, 'cleanup')
  } catch (err) {
    app.log.error({ err }, 'cleanup failed')
  }
}

try {
  await app.listen({ host: config.host, port: config.port })
  const resumed = await jobs.recover()
  if (resumed) app.log.info(`resumed ${resumed} queued job(s)`)
  app.log.info(`API docs: http://localhost:${config.port}/docs`)
  const { bot, telegram } = app.ctx
  if (bot && config.telegram.polling) bot.startPolling((u) => telegram.handleUpdate(u))
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

await sweep()
const timer = setInterval(sweep, 10 * 60_000)
timer.unref()

let closing = false
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (closing) return
    closing = true
    app.log.info(`${signal} — shutting down`)
    clearInterval(timer)
    const force = setTimeout(() => process.exit(1), 15_000)
    force.unref()
    await app.close()
    process.exit(0)
  })
}
