// Bildirişnomalar. Personal rows (userId set) come from the system — welcome bonus, coin
// purchases, admin grants, an answered QalamChat message — and keep only `kind` + `data`, so the
// web app words them in the reader's language. Announcements (userId null) are written by an
// admin, in their own words, for everyone. One read table serves both.
import { and, count, desc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'

const { notifications: n, notificationReads: r } = schema

/** Announcements older than this before the account was made are not shown to it. */
const ANNOUNCE_BACKLOG_MS = 30 * 24 * 3600_000

export const NOTIFICATION_KINDS = ['welcome', 'coins.purchase', 'coins.grant', 'payment.rejected', 'payment.cancelled', 'support.done', 'announce']

const out = (row, readAt) => ({
  id: row.id,
  kind: row.kind,
  data: row.data ?? {},
  title: row.title,
  body: row.body,
  link: row.link,
  read: Boolean(readAt),
  createdAt: row.createdAt,
})

export function createNotifier({ db, log }) {
  /** What `user` may see: their own rows and announcements from around their sign-up on. */
  const visible = (user) =>
    or(eq(n.userId, user.id), and(isNull(n.userId), gte(n.createdAt, new Date(user.createdAt.getTime() - ANNOUNCE_BACKLOG_MS))))
  const readJoin = (user) => and(eq(r.notificationId, n.id), eq(r.userId, user.id))

  async function unread(user) {
    const [{ total }] = await db.select({ total: count() }).from(n).leftJoin(r, readJoin(user)).where(and(visible(user), isNull(r.userId)))
    return Number(total)
  }

  return {
    unread,

    /**
     * A personal notification. Never throws: a failed notice must not undo what caused it
     * (a purchase, a grant …), so errors are only logged.
     */
    async send(userId, kind, data = {}, link = null) {
      // userId null means "everyone" in this table: a personal notice must never become one
      if (!userId) return null
      try {
        const [row] = await db.insert(n).values({ id: newId(ID_PREFIX.notification), userId, kind, data, link }).returning()
        return row
      } catch (err) {
        log?.warn({ err, kind }, 'notifications: send failed')
        return null
      }
    },

    async announce({ title, body, link = null }) {
      const [row] = await db.insert(n).values({ id: newId(ID_PREFIX.notification), userId: null, kind: 'announce', title, body, link }).returning()
      return row
    },

    /** Newest first; `before` (a createdAt) pages further back. */
    async list(user, { limit = 30, before = null } = {}) {
      const rows = await db
        .select({ n, readAt: r.readAt })
        .from(n)
        .leftJoin(r, readJoin(user))
        .where(and(visible(user), before ? lt(n.createdAt, before) : undefined))
        .orderBy(desc(n.createdAt), desc(n.id))
        .limit(limit + 1)
      return {
        items: rows.slice(0, limit).map((x) => out(x.n, x.readAt)),
        more: rows.length > limit,
        unread: await unread(user),
      }
    },

    /** false when the notification is not one the user can see. */
    async markRead(user, id) {
      const [row] = await db.select({ id: n.id }).from(n).where(and(eq(n.id, id), visible(user))).limit(1)
      if (!row) return false
      await db.insert(r).values({ notificationId: id, userId: user.id }).onConflictDoNothing()
      return true
    },

    async markAllRead(user) {
      await db
        .insert(r)
        .select(
          db
            .select({ notificationId: n.id, userId: sql`${user.id}`.as('user_id'), readAt: sql`now()`.as('read_at') })
            .from(n)
            .leftJoin(r, readJoin(user))
            .where(and(visible(user), isNull(r.userId))),
        )
        .onConflictDoNothing()
    },
  }
}
