// Database connection. Production: PostgreSQL (DATABASE_URL). Development and tests:
// embedded PGlite — real Postgres compiled to WASM, so nothing has to be installed.
// The same Drizzle schema and SQL migrations serve both.
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.js'

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

/** @returns {Promise<{ db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema>, close: () => Promise<void>, driver: string }>} */
export async function connectDb(cfg, log) {
  if (cfg.url) {
    const { default: pg } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const pool = new pg.Pool({ connectionString: cfg.url, max: 10, idleTimeoutMillis: 30_000 })
    // An idle connection dropped by the server (Postgres restart, network blip) must not crash the API:
    // the pool discards that client and opens a new one on the next query.
    pool.on('error', (err) => log?.warn({ err }, 'database: idle connection lost'))
    const db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: MIGRATIONS })
    log?.info('database: PostgreSQL')
    return { db, driver: 'postgres', close: () => pool.end() }
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const onDisk = cfg.pgliteDir !== 'memory://'
  if (onDisk) mkdirSync(dirname(cfg.pgliteDir), { recursive: true })
  // PGlite is single-process: a second API started on the same folder (e.g. `npm run server`
  // in two terminals) writes into it concurrently and corrupts it for good. Refuse instead.
  const unlock = onDisk ? lockDir(cfg.pgliteDir) : () => {}
  let client
  try {
    client = new PGlite(cfg.pgliteDir)
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder: MIGRATIONS })
    log?.info(`database: embedded PGlite (${cfg.pgliteDir})`)
    return {
      db,
      driver: 'pglite',
      close: async () => {
        try { await client.close() } finally { unlock() }
      },
    }
  } catch (err) {
    await client?.close().catch(() => {})
    unlock()
    throw err
  }
}

/**
 * Take an exclusive lock on a PGlite data folder for this process (a `<dir>.lock` file
 * holding our pid). A lock left by a process that no longer runs is taken over.
 * @returns {() => void} releases the lock
 */
function lockDir(dir) {
  const file = `${dir.replace(/[\\/]+$/, '')}.lock`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, String(process.pid), { flag: 'wx' })
      let held = true
      const release = () => {
        if (!held) return
        held = false
        process.off('exit', release)
        try { if (readFileSync(file, 'utf8') === String(process.pid)) unlinkSync(file) } catch {}
      }
      process.on('exit', release)
      return release
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
      const pid = Number(readFileSync(file, 'utf8')) || 0
      if (pid && pid !== process.pid && isAlive(pid)) {
        throw new Error(
          `The dev database ${dir} is already in use by another API process (pid ${pid}). ` +
            'Stop it first (only one `npm run server` at a time), or set PGLITE_DIR to another folder.',
        )
      }
      try { unlinkSync(file) } catch {} // stale lock from a process that has exited
    }
  }
  throw new Error(`Could not lock the dev database ${dir}`)
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err.code === 'EPERM'
  }
}

export { schema }
