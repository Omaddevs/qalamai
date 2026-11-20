// Environment configuration — parsed and validated once at startup.
// Every setting has a safe development default; production refuses to start
// without the secrets it needs.
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())))

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Comma-separated list of browser origins allowed to call the API. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  /** Set when the API runs behind a reverse proxy (nginx, Caddy, a load balancer). */
  TRUST_PROXY: bool.default(false),

  /** postgres://user:pass@host:5432/db — leave empty to use the embedded PGlite database. */
  DATABASE_URL: z.string().optional(),
  /** Where PGlite keeps its data when DATABASE_URL is empty. "memory://" keeps it in RAM. */
  PGLITE_DIR: z.string().default('./data/db'),

  STORAGE_DIR: z.string().default('./data/storage'),
  MODELS_DIR: z.string().default('./models'),

  JWT_SECRET: z.string().optional(),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  /** Secure cookies need HTTPS; turn off only for plain-HTTP local setups. */
  COOKIE_SECURE: bool.optional(),

  /** Uploaded files and tool results are deleted after this many hours unless kept. */
  FILE_TTL_HOURS: z.coerce.number().positive().default(24),
  /** Guest accounts with no activity are removed after this many days. */
  GUEST_TTL_DAYS: z.coerce.number().positive().default(30),

  /** Parallel tool runs (worker threads). Defaults to CPU count − 1. */
  JOB_CONCURRENCY: z.coerce.number().int().positive().default(Math.max(1, Math.min(4, availableParallelism() - 1))),
  /** A single tool run is stopped after this many seconds. */
  JOB_TIMEOUT_SEC: z.coerce.number().int().positive().default(300),

  /** Background-removal model: small & fast (u2netp) … large & precise (isnet-general-use). */
  BG_MODEL: z.enum(['u2netp', 'silueta', 'u2net', 'isnet-general-use']).default('u2netp'),
  /** Download missing models automatically on first use. */
  MODELS_AUTO_DOWNLOAD: bool.default(true),

  /** Optional Gotenberg service (LibreOffice + Chromium) for pixel-perfect Office → PDF. */
  GOTENBERG_URL: z.string().url().optional(),

  /** Lets users buy coin packs without paying (demo). Defaults to on everywhere except production. */
  COIN_DEMO_PURCHASE: bool.optional(),

  /** Public address of the web app (where the browser opens QalamAI). OAuth redirects come back here. */
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** "Google bilan kiriş" — OAuth client from Google Cloud Console (Web application). */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** "Telegram orqali kiriş" — bot token from @BotFather. The bot confirms the user's own phone number. */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  /** The server reads bot updates by long polling (no public HTTPS needed). Turn off to run the bot elsewhere. */
  TELEGRAM_POLLING: bool.default(true),
  /** Bot API address — change only to go through a proxy / self-hosted Bot API server. */
  TELEGRAM_API_URL: z.string().url().default('https://api.telegram.org'),
  /** Connect to this IP instead of what DNS says (TLS still checks api.telegram.org) — for networks that block the usual address. */
  TELEGRAM_API_IP: z.ipv4().optional(),
})

function load() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`)
  }
  const env = parsed.data
  const isProd = env.NODE_ENV === 'production'

  if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be set to at least 32 random characters in production')
  }
  // Development: a stable per-machine secret so tokens survive restarts.
  const jwtSecret = env.JWT_SECRET ?? createHash('sha256').update(`qalam-dev:${resolve('.')}`).digest('hex')

  return {
    env: env.NODE_ENV,
    isProd,
    isTest: env.NODE_ENV === 'test',
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY,
    db: {
      url: env.DATABASE_URL || null,
      pgliteDir: env.PGLITE_DIR === 'memory://' ? 'memory://' : resolve(env.PGLITE_DIR),
    },
    storageDir: resolve(env.STORAGE_DIR),
    modelsDir: resolve(env.MODELS_DIR),
    auth: {
      jwtSecret,
      accessTtlMin: env.ACCESS_TOKEN_TTL_MIN,
      refreshDays: env.REFRESH_TOKEN_DAYS,
      cookieSecure: env.COOKIE_SECURE ?? isProd,
    },
    files: {
      ttlHours: env.FILE_TTL_HOURS,
      guestTtlDays: env.GUEST_TTL_DAYS,
    },
    jobs: {
      concurrency: env.JOB_CONCURRENCY,
      timeoutMs: env.JOB_TIMEOUT_SEC * 1000,
    },
    bg: {
      model: env.BG_MODEL,
      autoDownload: env.MODELS_AUTO_DOWNLOAD,
    },
    gotenbergUrl: env.GOTENBERG_URL ?? null,
    appUrl: env.APP_URL.replace(/\/$/, ''),
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    telegram: env.TELEGRAM_BOT_TOKEN ? { token: env.TELEGRAM_BOT_TOKEN, polling: env.TELEGRAM_POLLING, apiUrl: env.TELEGRAM_API_URL.replace(/\/$/, ''), apiIp: env.TELEGRAM_API_IP ?? null } : null,
    coins: {
      demoPurchase: env.COIN_DEMO_PURCHASE ?? !isProd,
    },
  }
}

export const config = load()
