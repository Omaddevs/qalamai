// Database connection. Production: PostgreSQL (DATABASE_URL). Development and tests:
// embedded PGlite — real Postgres compiled to WASM, so nothing has to be installed.
// The same Drizzle schema and SQL migrations serve both.
import { mkdirSync } from 'node:fs'
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
    const db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: MIGRATIONS })
    log?.info('database: PostgreSQL')
    return { db, driver: 'postgres', close: () => pool.end() }
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  if (cfg.pgliteDir !== 'memory://') mkdirSync(dirname(cfg.pgliteDir), { recursive: true })
  const client = new PGlite(cfg.pgliteDir)
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: MIGRATIONS })
  log?.info(`database: embedded PGlite (${cfg.pgliteDir})`)
  return { db, driver: 'pglite', close: () => client.close() }
}

export { schema }
