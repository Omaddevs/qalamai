// Database schema (PostgreSQL). Runs unchanged on embedded PGlite in development.
// After editing: `npm run db:generate` writes a new SQL migration to src/db/migrations.
import { sql } from 'drizzle-orm'
import { bigint, bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const ts = (name) => timestamp(name, { withTimezone: true, mode: 'date' })
const createdAt = () => ts('created_at').notNull().defaultNow()

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email'),
    phone: text('phone'),
    /** Google account id ("sub") once the user has signed in with Google. */
    googleId: text('google_id'),
    /** Telegram user id once the phone was confirmed through the bot. */
    telegramId: text('telegram_id'),
    /** @username in Telegram (without @), refreshed on each Telegram sign-in. */
    telegramUsername: text('telegram_username'),
    /** Storage key of the profile picture (taken from Telegram on sign-in). */
    avatarKey: text('avatar_key'),
    avatarAt: ts('avatar_at'),
    /** When the phone number was proven to belong to this user (Telegram contact). */
    phoneVerifiedAt: ts('phone_verified_at'),
    passwordHash: text('password_hash'),
    name: text('name').notNull().default(''),
    role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
    plan: text('plan', { enum: ['free', 'pro', 'edu'] }).notNull().default('free'),
    planExpiresAt: ts('plan_expires_at'),
    /** QalamCoin balance. Changed only through the coin service, which also writes coin_ledger. */
    coins: integer('coins').notNull().default(0),
    /** First coin purchase — unlocks watermark-free export, Pro templates and bigger file limits. */
    coinsPurchasedAt: ts('coins_purchased_at'),
    isGuest: boolean('is_guest').notNull().default(false),
    /** When the account stopped being a guest (guests are upgraded in place, so createdAt is the first visit). */
    registeredAt: ts('registered_at'),
    /** How and from where the account signed up — shown in the admin panel. */
    signupMethod: text('signup_method', { enum: ['password', 'google', 'telegram'] }),
    signupIp: text('signup_ip'),
    signupCountry: text('signup_country'),
    signupDevice: text('signup_device'),
    signupBrowser: text('signup_browser'),
    signupOs: text('signup_os'),
    /** direct / search / social / referral, the referring host and utm tags of the visitor's first visit. */
    signupSource: text('signup_source'),
    signupReferrer: text('signup_referrer'),
    signupUtm: jsonb('signup_utm'),
    signupLanding: text('signup_landing'),
    /** Anonymous visitor id (analytics) the account signed up from. */
    visitorId: text('visitor_id'),
    /** Titul varagʻi profile: university, faculty, group, supervisor … (see frontend profile.js). */
    profile: jsonb('profile').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_uq').on(sql`lower(${t.email})`),
    uniqueIndex('users_phone_uq').on(t.phone),
    uniqueIndex('users_google_uq').on(t.googleId),
    uniqueIndex('users_telegram_uq').on(t.telegramId),
    index('users_guest_seen_idx').on(t.isGuest, t.lastSeenAt),
    index('users_registered_idx').on(t.registeredAt),
  ],
)

/**
 * "Telegram orqali kiriş" requests. The id is the bot deep-link payload (t.me/bot?start=<id>);
 * only the browser holding `browserSecret` may read the code or finish the sign-in.
 */
export const telegramLogins = pgTable(
  'telegram_logins',
  {
    id: text('id').primaryKey(),
    phone: text('phone').notNull(),
    browserSecretHash: text('browser_secret_hash').notNull(),
    /** Telegram user who opened the link — the contact they share must be their own. */
    telegramUserId: text('telegram_user_id'),
    telegramName: text('telegram_name'),
    telegramUsername: text('telegram_username'),
    verifiedAt: ts('verified_at'),
    attempts: integer('attempts').notNull().default(0),
    usedAt: ts('used_at'),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('telegram_logins_phone_idx').on(t.phone, t.createdAt), index('telegram_logins_tg_idx').on(t.telegramUserId)],
)

/** Refresh-token sessions. Tokens rotate on every refresh; reuse of an old one revokes the family. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    family: text('family').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('sessions_token_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId), index('sessions_family_idx').on(t.family)],
)

export const files = pgTable(
  'files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ext: text('ext').notNull(),
    mime: text('mime').notNull(),
    kind: text('kind', { enum: ['pdf', 'image', 'document', 'spreadsheet', 'presentation', 'text', 'archive', 'other'] }).notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    storageKey: text('storage_key').notNull(),
    /** pages, width, height, hasAlpha … */
    meta: jsonb('meta').notNull().default({}),
    source: text('source', { enum: ['upload', 'tool'] }).notNull().default('upload'),
    /** Tool results point at the job that produced them and its first input. */
    jobId: text('job_id'),
    parentId: text('parent_id'),
    /** null = kept until the user deletes it. */
    expiresAt: ts('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [index('files_user_created_idx').on(t.userId, t.createdAt), index('files_expires_idx').on(t.expiresAt), index('files_job_idx').on(t.jobId)],
)

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),
    status: text('status', { enum: ['queued', 'running', 'done', 'failed', 'canceled'] }).notNull().default('queued'),
    progress: integer('progress').notNull().default(0),
    stage: text('stage'),
    inputIds: jsonb('input_ids').$type().notNull().default([]),
    options: jsonb('options').notNull().default({}),
    outputIds: jsonb('output_ids').$type().notNull().default([]),
    /** Tool-specific summary, e.g. { before, after } bytes for compression. */
    result: jsonb('result'),
    error: jsonb('error'),
    createdAt: createdAt(),
    startedAt: ts('started_at'),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('jobs_user_created_idx').on(t.userId, t.createdAt), index('jobs_status_idx').on(t.status)],
)

/** Rich-text documents from the file editor (referat, kurs ishi …). */
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    html: text('html').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('documents_user_updated_idx').on(t.userId, t.updatedAt)],
)

/** Slide designs from the visual editor; the whole deck is one JSON value. */
export const designs = pgTable(
  'designs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('Taqdimot'),
    templateId: text('template_id'),
    data: jsonb('data').notNull(),
    // set when the owner shares a view-only link (/v/<shareId>); null = not shared
    shareId: text('share_id'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('designs_user_updated_idx').on(t.userId, t.updatedAt), uniqueIndex('designs_share_id_idx').on(t.shareId)],
)

/** Daily counters for plan limits (tool runs, AI generations …). */
export const usage = pgTable(
  'usage',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(), // YYYY-MM-DD, Asia/Tashkent
    metric: text('metric').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.metric] })],
)

/** Published Link-in-Bio pages: public at /b/:slug. One page per design. */
export const bioPages = pgTable(
  'bio_pages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    designId: text('design_id').notNull(),
    data: jsonb('data').notNull(),
    views: integer('views').notNull().default(0),
    clicks: jsonb('clicks').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bio_slug_uq').on(t.slug), uniqueIndex('bio_user_design_uq').on(t.userId, t.designId)],
)

/** Every QalamCoin movement. `ref` makes a spend idempotent (a retried request is not charged twice). */
export const coinLedger = pgTable(
  'coin_ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    balance: integer('balance').notNull(),
    reason: text('reason', { enum: ['signup', 'purchase', 'spend', 'refund', 'grant'] }).notNull(),
    /** spend: the action id (referat, kurs-ishi …); purchase: the pack id. */
    item: text('item'),
    ref: text('ref'),
    meta: jsonb('meta').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('coin_ledger_user_idx').on(t.userId, t.createdAt), uniqueIndex('coin_ledger_ref_uq').on(t.userId, t.ref)],
)

/** Site analytics: one row per page view, sent by the web app (src/track.js). No IPs are kept. */
export const pageViews = pgTable(
  'page_views',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id').notNull(),
    path: text('path').notNull(),
    /** First view of the session — sources are counted on these. */
    entry: boolean('entry').notNull().default(false),
    source: text('source', { enum: ['direct', 'search', 'social', 'referral'] }),
    referrer: text('referrer'),
    searchEngine: text('search_engine'),
    searchTerm: text('search_term'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    country: text('country'),
    timezone: text('timezone'),
    lang: text('lang'),
    device: text('device'),
    browser: text('browser'),
    os: text('os'),
    screen: text('screen'),
    createdAt: createdAt(),
  },
  (t) => [index('page_views_created_idx').on(t.createdAt), index('page_views_visitor_idx').on(t.visitorId, t.createdAt)],
)

/** Admin panel settings: password hash, Google Search Console / Analytics ids … */
export const adminSettings = pgTable('admin_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** QalamChat: messages a registered user sends to the team (partnership, complaint …). Forwarded to CONTACT_CHAT_ID in Telegram. */
export const supportMessages = pgTable(
  'support_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** One of SUPPORT_TOPICS (shared/support.js). */
    topic: text('topic').notNull(),
    message: text('message').notNull(),
    /** How the team gets back to the sender — typed in the chat, prefilled from the account. */
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    lang: text('lang'),
    status: text('status', { enum: ['new', 'done'] }).notNull().default('new'),
    /** When an admin marked it done. */
    doneAt: ts('done_at'),
    createdAt: createdAt(),
  },
  (t) => [index('support_messages_user_idx').on(t.userId, t.createdAt), index('support_messages_created_idx').on(t.createdAt)],
)

/**
 * In-app notifications (Bildirişnomalar). A row with `userId` is for that user; `userId = null`
 * is an announcement for everyone, written by an admin. System notifications keep a `kind` +
 * `data`, so the web app shows them in the reader's language; announcements carry their own text.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** welcome · coins.purchase · coins.grant · support.done · announce */
    kind: text('kind').notNull(),
    data: jsonb('data').notNull().default({}),
    title: text('title'),
    body: text('body'),
    /** Where "open" leads in the web app (an in-app hash such as #/ or a full https link). */
    link: text('link'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt), index('notifications_created_idx').on(t.createdAt)],
)

/** Who has read which notification (one table for personal ones and announcements alike). */
export const notificationReads = pgTable(
  'notification_reads',
  {
    notificationId: text('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    readAt: ts('read_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] }), index('notification_reads_user_idx').on(t.userId)],
)
