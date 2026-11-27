// What users create — counts for the admin panel.
//   creations   one row per design / document ever made (kept after deletion): totals by kind
//   coin_ledger AI spends minus refunds: how much of it the AI wrote
//   jobs, usage file tools run on the server, and in the browser (usage metric "tool:<id>")
import { sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AI_ACTION_KIND, AI_TEXT_ACTIONS, CREATION_KINDS, creationKind } from '../../../../shared/creations.js'
import { TOOL_MAP } from '../tools/catalog.js'
import { avatarUrlOf } from '../../lib/avatars.js'

const { creations } = schema
const rowsOf = (r) => r.rows ?? r
const DAY = 86_400_000
const TZ = 5 * 3_600_000 // Asia/Tashkent, no daylight saving

/** Metric name of one browser-side run of a tool (usage table). */
export const toolMetric = (toolId) => `tool:${toolId}`

/** Record a new design or document. Repeated calls for the same item do nothing. */
export function recordCreation(db, { userId, itemId, kind, source }) {
  return db
    .insert(creations)
    .values({ userId, itemId, kind: creationKind(kind, source), source })
    .onConflictDoNothing()
    .catch(() => {})
}

/** Designs and documents made before the log existed (or synced without it) go into the log. */
export async function backfillCreations(db, log) {
  let added = 0
  for (const [table, source] of [
    ['designs', 'design'],
    ['documents', 'document'],
  ]) {
    for (;;) {
      const rows = rowsOf(
        await db.execute(sql`
          SELECT t.id, t.user_id, t.kind, t.created_at FROM ${sql.raw(table)} t
          WHERE NOT EXISTS (SELECT 1 FROM creations c WHERE c.user_id = t.user_id AND c.item_id = t.id)
          LIMIT 500`),
      )
      if (!rows.length) break
      await db
        .insert(creations)
        .values(rows.map((r) => ({ userId: r.user_id, itemId: r.id, kind: creationKind(r.kind, source), source, createdAt: new Date(r.created_at) })))
        .onConflictDoNothing()
      added += rows.length
      if (rows.length < 500) break
    }
  }
  if (added) log?.info({ added }, 'creations: backfilled')
  return added
}

/** Start of the period: Tashkent midnight `days - 1` days ago; null = all time. */
function sinceOf(days) {
  if (!days) return null
  const now = Date.now()
  return new Date(Math.floor((now + TZ) / DAY) * DAY - TZ - (days - 1) * DAY)
}
const dayOf = (d) => new Date(d.getTime() + TZ).toISOString().slice(0, 10)

const AI_ITEMS = Object.keys(AI_ACTION_KIND)
const aiNet = sql`sum(CASE WHEN reason = 'spend' THEN 1 WHEN reason = 'refund' THEN -1 ELSE 0 END)`

export function createContentStats(db) {
  /** Per user and kind: { userId: { kind: { total, ai } } } for the period (optionally one user). */
  async function perUser(since, userId = null) {
    const cw = [sql`true`]
    const lw = [sql`reason IN ('spend', 'refund')`, sql`item IN (${sql.join(AI_ITEMS.map((x) => sql`${x}`), sql`, `)})`]
    if (since) (cw.push(sql`created_at >= ${since}`), lw.push(sql`created_at >= ${since}`))
    if (userId) (cw.push(sql`user_id = ${userId}`), lw.push(sql`user_id = ${userId}`))
    const [made, ai] = await Promise.all([
      db.execute(sql`SELECT user_id, kind, count(*)::int AS n FROM creations WHERE ${sql.join(cw, sql` AND `)} GROUP BY 1, 2`),
      db.execute(sql`SELECT user_id, item, ${aiNet}::int AS n FROM coin_ledger WHERE ${sql.join(lw, sql` AND `)} GROUP BY 1, 2`),
    ])
    const out = {}
    const at = (u, k) => ((out[u] ??= {})[k] ??= { total: 0, ai: 0 })
    for (const r of rowsOf(made)) at(r.user_id, r.kind).total += Number(r.n)
    for (const r of rowsOf(ai)) if (Number(r.n) > 0) at(r.user_id, AI_ACTION_KIND[r.item]).ai += Number(r.n)
    // an AI piece whose design/document never reached the server still counts as made
    for (const kinds of Object.values(out)) for (const c of Object.values(kinds)) c.total = Math.max(c.total, c.ai)
    return out
  }

  const sumKinds = (kinds) => Object.values(kinds).reduce((a, c) => ({ total: a.total + c.total, ai: a.ai + c.ai }), { total: 0, ai: 0 })

  /** File tools: server jobs that finished + runs in the browser. */
  async function tools(since, userId = null) {
    const jw = [sql`status = 'done'`]
    const uw = [sql`(metric LIKE 'tool:%' OR metric = 'local_runs')`]
    if (since) (jw.push(sql`created_at >= ${since}`), uw.push(sql`day >= ${dayOf(since)}`))
    if (userId) (jw.push(sql`user_id = ${userId}`), uw.push(sql`user_id = ${userId}`))
    const [server, device] = await Promise.all([
      db.execute(sql`SELECT tool, count(*)::int AS n FROM jobs WHERE ${sql.join(jw, sql` AND `)} GROUP BY 1`),
      db.execute(sql`SELECT metric, sum(count)::int AS n FROM usage WHERE ${sql.join(uw, sql` AND `)} GROUP BY 1`),
    ])
    const by = {}
    const at = (id) => (by[id] ??= { tool: id, label: TOOL_MAP.get(id)?.title ?? id, server: 0, device: 0 })
    for (const r of rowsOf(server)) at(r.tool).server += Number(r.n)
    let deviceAll = 0
    let deviceKnown = 0
    for (const r of rowsOf(device)) {
      if (r.metric === 'local_runs') deviceAll += Number(r.n)
      else (at(r.metric.slice(5)).device += Number(r.n), (deviceKnown += Number(r.n)))
    }
    // browser runs from before tools were told apart
    if (deviceAll > deviceKnown) at('other').device += deviceAll - deviceKnown
    if (by.other) by.other.label = 'Boşqa (vosita nomi yozilmagan)'
    const list = Object.values(by).map((x) => ({ ...x, n: x.server + x.device })).sort((a, b) => b.n - a.n)
    return { list, total: list.reduce((n, x) => n + x.n, 0) }
  }

  return {
    async stats(days, { kind = null, limit = 100 } = {}) {
      const since = sinceOf(days)
      const monthly = !days || days > 120
      const bucket = monthly ? 'YYYY-MM' : 'YYYY-MM-DD'
      const cw = since ? sql`created_at >= ${since}` : sql`true`
      const lw = sql`reason IN ('spend', 'refund') AND ${since ? sql`created_at >= ${since}` : sql`true`}`

      const [users, series, aiSeries, aiText, toolStats, published] = await Promise.all([
        perUser(since),
        db.execute(sql`SELECT to_char(created_at AT TIME ZONE 'Asia/Tashkent', ${bucket}) AS b, count(*)::int AS n FROM creations WHERE ${cw} GROUP BY 1 ORDER BY 1`),
        db.execute(sql`SELECT to_char(created_at AT TIME ZONE 'Asia/Tashkent', ${bucket}) AS b, ${aiNet}::int AS n FROM coin_ledger
          WHERE ${lw} AND item IN (${sql.join(AI_ITEMS.map((x) => sql`${x}`), sql`, `)}) GROUP BY 1 ORDER BY 1`),
        db.execute(sql`SELECT item, ${aiNet}::int AS n, count(DISTINCT user_id)::int AS users FROM coin_ledger
          WHERE ${lw} AND item IN (${sql.join(AI_TEXT_ACTIONS.map((x) => sql`${x}`), sql`, `)}) GROUP BY 1`),
        tools(since),
        db.execute(sql`SELECT
          (SELECT count(*) FROM invite_pages)::int AS invites,
          (SELECT coalesce(sum(views), 0) FROM invite_pages)::int AS invite_views,
          (SELECT count(*) FROM invite_rsvps)::int AS rsvps,
          (SELECT count(*) FROM bio_pages)::int AS bios,
          (SELECT coalesce(sum(views), 0) FROM bio_pages)::int AS bio_views,
          (SELECT count(*) FROM designs WHERE share_id IS NOT NULL)::int AS shared`),
      ])

      // totals by kind
      const kinds = Object.fromEntries(CREATION_KINDS.map((k) => [k, { kind: k, total: 0, ai: 0, users: 0 }]))
      for (const byKind of Object.values(users)) {
        for (const [k, c] of Object.entries(byKind)) {
          const row = (kinds[k] ??= { kind: k, total: 0, ai: 0, users: 0 })
          row.total += c.total
          row.ai += c.ai
          if (c.total) row.users += 1
        }
      }
      const totals = sumKinds(Object.fromEntries(Object.entries(kinds)))

      // series: every bucket of the period, empty ones as zero
      const made = Object.fromEntries(rowsOf(series).map((r) => [r.b, Number(r.n)]))
      const byAi = Object.fromEntries(rowsOf(aiSeries).map((r) => [r.b, Number(r.n)]))
      const keys = new Set([...Object.keys(made), ...Object.keys(byAi)])
      if (!monthly) for (let t = since.getTime(); t <= Date.now(); t += DAY) keys.add(dayOf(new Date(t)))
      const seriesOut = [...keys].sort().map((b) => ({ key: b, total: Math.max(made[b] ?? 0, byAi[b] ?? 0), ai: Math.max(byAi[b] ?? 0, 0) }))

      // the people who made the most (optionally of one kind)
      const ranked = Object.entries(users)
        .map(([id, byKind]) => {
          const t = kind ? (byKind[kind] ?? { total: 0, ai: 0 }) : sumKinds(byKind)
          return { id, total: t.total, ai: t.ai, kinds: byKind }
        })
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total || b.ai - a.ai)
      const top = ranked.slice(0, limit)
      const info = top.length
        ? rowsOf(
            await db.execute(sql`SELECT id, name, email, phone, telegram_username, avatar_key, avatar_at, is_guest, coins_purchased_at, signup_method
              FROM users WHERE id IN (${sql.join(top.map((x) => sql`${x.id}`), sql`, `)})`),
          )
        : []
      const byId = Object.fromEntries(info.map((u) => [u.id, u]))

      return {
        period: { days: days || 0, since, monthly },
        kpi: { total: totals.total, ai: totals.ai, creators: Object.values(users).filter((k) => sumKinds(k).total > 0).length, tools: toolStats.total },
        kinds: Object.values(kinds),
        series: seriesOut,
        aiText: AI_TEXT_ACTIONS.map((item) => {
          const r = rowsOf(aiText).find((x) => x.item === item)
          return { item, n: Math.max(Number(r?.n ?? 0), 0), users: Number(r?.users ?? 0) }
        }),
        tools: toolStats.list,
        published: rowsOf(published)[0],
        creatorsTotal: ranked.length,
        top: top.map((x) => {
          const u = byId[x.id]
          return {
            ...x,
            user: u && {
              id: u.id,
              name: u.name,
              email: u.email,
              phone: u.phone,
              telegramUsername: u.telegram_username,
              avatarUrl: avatarUrlOf(u.id, u.avatar_key, u.avatar_at),
              isGuest: u.is_guest,
              premium: Boolean(u.coins_purchased_at),
              method: u.signup_method,
            },
          }
        }),
      }
    },

    /** One user's work, all time: by kind, AI share, file tools. */
    async forUser(userId) {
      const [byUser, toolStats] = await Promise.all([perUser(null, userId), tools(null, userId)])
      const kinds = byUser[userId] ?? {}
      return { ...sumKinds(kinds), kinds: CREATION_KINDS.filter((k) => kinds[k]).map((k) => ({ kind: k, ...kinds[k] })), tools: toolStats.list, toolsTotal: toolStats.total }
    },
  }
}
