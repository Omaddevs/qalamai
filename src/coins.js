// QalamCoin on the client: the balance (kept on the API user), spending before an AI action,
// and one global "coin shop" that any screen can open.
import { useEffect, useState } from 'react'
import { ApiError, api, currentUser, ensureSession, onUser, updateUser } from './api.js'
import { ACTION_BY_APP, ACTION_BY_TYPE, COIN_COSTS, COIN_PACKS, SIGNUP_BONUS, costOf } from '../shared/coins.js'
import { FREE_FEATURES as FREE, PREMIUM_PERKS as PREMIUM } from '../shared/coins.js'
import { formatNumber, t } from './i18n/index.js'

export { ACTION_BY_APP, ACTION_BY_TYPE, COIN_COSTS, COIN_PACKS, SIGNUP_BONUS, costOf }

// Display texts follow the interface language (src/i18n/msg/coins.js); ids and prices stay in shared/coins.js.
const ACTION_KIND = {
  prezentatsiya: 'presentation', referat: 'essay', 'kurs-ishi': 'coursework', diplom: 'thesis', 'dars-ishlanma': 'lessonPlan',
  'biznes-reja': 'businessPlan', hisobot: 'report', taklifnoma: 'invitation', portfolio: 'portfolio',
  'qayta-yozish': 'rewrite', plagiat: 'plagiarism', tarjima: 'translation', 'pro-shablon': 'proTemplate',
}
const getter = (obj, key, get) => Object.defineProperty(obj, key, { get, enumerable: true, configurable: true })
for (const [id, c] of Object.entries(COIN_COSTS)) {
  getter(c, 'label', () => t(`kind.${ACTION_KIND[id]}`))
  if (c.per) getter(c, 'per', () => t(id === 'tarjima' ? 'coin.per.words' : 'coin.per.page'))
  else getter(c, 'note', () => t(`coin.note.${id}`))
}
for (const p of COIN_PACKS) getter(p, 'label', () => t(`coin.pack.${p.id}`))
/** Translated lists (read at render time). */
export const freeFeatures = () => FREE.map((_, i) => t(`coin.free.${i}`))
export const premiumPerks = () => PREMIUM.map((_, i) => t(`coin.perk.${i}`))
/** Kind label for a coin action id. */
export const actionLabel = (id) => (ACTION_KIND[id] ? t(`kind.${ACTION_KIND[id]}`) : id)

/** 12900 → "12 900" / "12,900" — grouped the way the interface language writes numbers. */
export const som = (n) => formatNumber(n)

/** The signed-in user's wallet; starts the session quietly if there is none yet. */
export function useWallet() {
  const [u, setU] = useState(currentUser)
  useEffect(() => {
    const off = onUser(setU)
    if (!currentUser()) ensureSession().catch(() => {})
    return off
  }, [])
  return {
    ready: Boolean(u),
    coins: u?.coins ?? 0,
    premium: Boolean(u?.premium),
    guest: u ? u.isGuest : true,
  }
}

const SHOP_EVENT = 'qalam:coin-shop'

/** Open the coin shop from anywhere. `reason` explains why (e.g. not enough coins). */
export function openCoinShop(reason = null) {
  window.dispatchEvent(new CustomEvent(SHOP_EVENT, { detail: { reason } }))
}

export function onCoinShop(fn) {
  const h = (e) => fn(e.detail ?? {})
  window.addEventListener(SHOP_EVENT, h)
  return () => window.removeEventListener(SHOP_EVENT, h)
}

const newRef = () => `r-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

/**
 * Pay for an AI action. Resolves to { ref, cost, balance } — or, when it can't be paid,
 * opens the coin shop with the reason and resolves to null.
 */
export async function spendCoins(action, { qty = 1, topic, ref: fixedRef } = {}) {
  // a fixed ref makes the charge one-time: paying again with the same ref costs nothing
  const ref = fixedRef ?? newRef()
  try {
    const r = await api.post('/coins/spend', { action, ref, ...(qty > 1 ? { qty } : {}), ...(topic ? { topic: topic.slice(0, 300) } : {}) })
    updateUser({ coins: r.balance })
    return { ref, cost: r.cost, balance: r.balance }
  } catch (err) {
    if (err instanceof ApiError && ['NOT_ENOUGH_COINS', 'REGISTER_REQUIRED'].includes(err.code)) {
      if (err.details?.balance != null) updateUser({ coins: err.details.balance })
      openCoinShop({ code: err.code, need: err.details?.need ?? costOf(action, qty), action })
      return null
    }
    throw err
  }
}

/** Give coins back when the work they paid for failed. */
export async function refundCoins(ref) {
  const r = await api.post('/coins/refund', { ref }).catch(() => null)
  if (r) updateUser({ coins: r.balance })
}

export async function buyPack(pack) {
  const r = await api.post('/coins/purchase', { pack })
  updateUser({ coins: r.balance, premium: true, ...(r.tier ? { tier: r.tier } : {}) })
  return r
}

export const getWallet = () => api.get('/coins')
