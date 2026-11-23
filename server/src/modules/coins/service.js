// QalamCoin wallet. The balance lives on users.coins; every change is one transaction that
// moves the balance and appends a coin_ledger row, so the history always adds up.
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { schema } from '../../db/index.js'
import { AppError, badRequest } from '../../lib/errors.js'
import { ID_PREFIX, newId } from '../../lib/ids.js'
import { COIN_PACKS, SIGNUP_BONUS, costOf, tierOf } from '../../../../shared/coins.js'

const { users, coinLedger } = schema

export const notEnoughCoins = (need, balance) =>
  new AppError(402, 'NOT_ENOUGH_COINS', `Coin yetmaydi: kerak ${need}, sizda ${balance}. Coin sotib oling.`, { need, balance })

const isUniqueViolation = (err) => String(err.code ?? err.cause?.code) === '23505' || /unique/i.test(err.message)

export function createCoinService({ db, notifier = null }) {
  /** Add (delta > 0) or take (delta < 0) coins. Taking never drives the balance below zero. */
  async function move(userId, delta, reason, { item = null, ref = null, meta = {}, purchased = false } = {}) {
    return db.transaction(async (tx) => {
      if (ref) {
        const [seen] = await tx.select().from(coinLedger).where(and(eq(coinLedger.userId, userId), eq(coinLedger.ref, ref))).limit(1)
        if (seen) return { entry: seen, balance: seen.balance, repeated: true }
      }
      const set = { coins: sql`${users.coins} + ${delta}` }
      if (purchased) set.coinsPurchasedAt = sql`coalesce(${users.coinsPurchasedAt}, now())`
      const where = delta < 0 ? and(eq(users.id, userId), gte(users.coins, -delta)) : eq(users.id, userId)
      const [u] = await tx.update(users).set(set).where(where).returning({ coins: users.coins })
      if (!u) {
        const [cur] = await tx.select({ coins: users.coins }).from(users).where(eq(users.id, userId)).limit(1)
        throw notEnoughCoins(-delta, cur?.coins ?? 0)
      }
      const [entry] = await tx
        .insert(coinLedger)
        .values({ id: newId(ID_PREFIX.coin), userId, delta, balance: u.coins, reason, item, ref, meta })
        .returning()
      return { entry, balance: u.coins, repeated: false }
    })
  }

  /** Same ref twice in parallel: the loser hits the unique index — answer with the winner's row. */
  async function moveOnce(userId, delta, reason, opts) {
    try {
      return await move(userId, delta, reason, opts)
    } catch (err) {
      if (!opts?.ref || !isUniqueViolation(err)) throw err
      const [seen] = await db.select().from(coinLedger).where(and(eq(coinLedger.userId, userId), eq(coinLedger.ref, opts.ref))).limit(1)
      return { entry: seen, balance: seen.balance, repeated: true }
    }
  }

  return {
    async balance(userId) {
      const [u] = await db.select({ coins: users.coins, purchasedAt: users.coinsPurchasedAt }).from(users).where(eq(users.id, userId)).limit(1)
      return { balance: u?.coins ?? 0, premium: Boolean(u?.purchasedAt) }
    },

    history: (userId, limit = 50) =>
      db.select().from(coinLedger).where(eq(coinLedger.userId, userId)).orderBy(desc(coinLedger.createdAt)).limit(limit),

    /** Charge for an AI action. `ref` (e.g. a client request id) makes retries free. */
    async spend(user, action, { qty = 1, ref = null, meta = {} } = {}) {
      if (user.isGuest) throw new AppError(403, 'REGISTER_REQUIRED', `AI imkoniyatlari uçun röyxatdan öting — sovğa sifatida ${SIGNUP_BONUS} coin beriladi.`)
      const cost = costOf(action, qty)
      if (cost == null) throw badRequest('Bunday amal yöq', { action })
      const r = await moveOnce(user.id, -cost, 'spend', { item: action, ref, meta: { ...meta, qty } })
      return { ...r, cost }
    },

    /** Give back what a failed generation took. Refunding the same spend twice does nothing. */
    async refund(user, spendRef) {
      const [spent] = await db
        .select()
        .from(coinLedger)
        .where(and(eq(coinLedger.userId, user.id), eq(coinLedger.ref, spendRef), eq(coinLedger.reason, 'spend')))
        .limit(1)
      if (!spent) throw badRequest('Bunday yeçiş topilmadi')
      return moveOnce(user.id, -spent.delta, 'refund', { item: spent.item, ref: `refund:${spendRef}` })
    },

    /** Start / Pro / Max — from the packs the account has bought; null when it bought none. */
    async tier(userId) {
      const rows = await db
        .selectDistinct({ item: coinLedger.item })
        .from(coinLedger)
        .where(and(eq(coinLedger.userId, userId), eq(coinLedger.reason, 'purchase')))
      return tierOf(rows.map((r) => r.item))
    },
    async signupBonus(userId) {
      const res = await moveOnce(userId, SIGNUP_BONUS, 'signup', { ref: 'signup' })
      if (!res.repeated) await notifier?.send(userId, 'welcome', { coins: SIGNUP_BONUS })
      return res
    },

    /** Credit a paid pack. `ref` is the payment provider's transaction id. */
    async purchase(userId, packId, ref, meta = {}) {
      const pack = COIN_PACKS.find((p) => p.id === packId)
      if (!pack) throw badRequest('Bunday paket yöq', { pack: packId })
      const res = await moveOnce(userId, pack.coins, 'purchase', { item: pack.id, ref, meta: { ...meta, price: pack.price }, purchased: true })
      if (!res.repeated) await notifier?.send(userId, 'coins.purchase', { coins: pack.coins, balance: res.balance })
      return res
    },

    /**
     * Credit coins that were paid for by any other way than a pack id (a checked card transfer).
     * `ref` (the payment's id) makes it one-time: approving the same payment twice adds nothing.
     */
    async credit(userId, amount, { item, ref, meta = {} }) {
      const res = await moveOnce(userId, amount, 'purchase', { item, ref, meta, purchased: true })
      if (!res.repeated) await notifier?.send(userId, 'coins.purchase', { coins: amount, balance: res.balance })
      return res
    },

    async grant(userId, amount, by, note) {
      const res = await moveOnce(userId, amount, 'grant', { meta: { by, note } })
      if (amount > 0) await notifier?.send(userId, 'coins.grant', { coins: amount, balance: res.balance })
      return res
    },
  }
}
