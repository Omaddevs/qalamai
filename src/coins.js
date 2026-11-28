// QalamCoin on the client: the balance (kept on the API user), spending before an AI action,
// and one global "coin shop" that any screen can open.
import { useEffect, useState } from 'react'
import { AI_PAGE_TYPES } from '../shared/slideIcons.js'
import { ApiError, api, currentUser, ensureSession, onUser, request, streamLines, updateUser } from './api.js'
import { ACTION_BY_APP, ACTION_BY_TYPE, COIN_COSTS, COIN_PACKS, CUSTOM_COINS, RECEIPT_MAX_MB, SIGNUP_BONUS, coinRate, costOf, priceFor } from '../shared/coins.js'
import { FREE_FEATURES as FREE, PREMIUM_PERKS as PREMIUM } from '../shared/coins.js'
import { formatNumber, t } from './i18n/index.js'

export { ACTION_BY_APP, ACTION_BY_TYPE, COIN_COSTS, COIN_PACKS, CUSTOM_COINS, RECEIPT_MAX_MB, SIGNUP_BONUS, coinRate, costOf, priceFor }

// Display texts follow the interface language (src/i18n/msg/coins.js); ids and prices stay in shared/coins.js.
const ACTION_KIND = {
  prezentatsiya: 'presentation', 'prezentatsiya-fayl': 'presentationFile', referat: 'essay', 'kurs-ishi': 'coursework', diplom: 'thesis', 'mustaqil-ish': 'independent', 'dars-ishlanma': 'lessonPlan',
  'biznes-reja': 'businessPlan', hisobot: 'report', taklifnoma: 'invitation', portfolio: 'portfolio',
  'qayta-yozish': 'rewrite', plagiat: 'plagiarism', tarjima: 'translation', 'pro-shablon': 'proTemplate', taqdimotchi: 'presenter',
}
const getter = (obj, key, get) => Object.defineProperty(obj, key, { get, enumerable: true, configurable: true })
for (const [id, c] of Object.entries(COIN_COSTS)) {
  getter(c, 'label', () => t(`kind.${ACTION_KIND[id]}`))
  if (c.per) getter(c, 'per', () => t(id === 'tarjima' ? 'coin.per.words' : id === 'taqdimotchi' ? 'coin.per.slides' : 'coin.per.page'))
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
export function openCoinShop(reason = null, intent = null) {
  window.dispatchEvent(new CustomEvent(SHOP_EVENT, { detail: { reason, intent } }))
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

/**
 * An AI presentation, paid and written on the server and streamed slide by slide (onEvent gets
 * start · outline · slide · image · done · error). Resolves true when it ran; null when it couldn't
 * be paid (the coin shop opens) — the server gives the coins back itself if the writing fails.
 */
export function aiDeck({ topic, plans, slides, lang, source = null, prefer = [] }, opts = {}) {
  const action = source ? 'prezentatsiya-fayl' : 'prezentatsiya'
  return aiStream('/ai/deck', { topic: topic.slice(0, 300), plans, slides, lang, ...(source ? { source } : {}), ...(prefer.length ? { prefer: prefer.filter((x) => AI_PAGE_TYPES.includes(x)).slice(0, 12) } : {}) }, action, opts)
}

/**
 * A document type written by the AI (/ai/fill): { kind, topic, lang, pages?, extra?, tasks | slides }.
 * Events: start · fill (doc piece) · card (slide rewrite) · done · error. Same answers as aiDeck.
 */
export function aiFill(body, opts = {}) {
  return aiStream('/ai/fill', { ...body, topic: body.topic.slice(0, 300) }, ACTION_BY_TYPE[body.kind], opts)
}

/**
 * «AI taqdimotçi»: the spoken script of a deck, paid per 10 slides. Events: start · narration
 * ({ slide, say }) · done · error. Same answers as aiDeck.
 */
export function aiNarrate(body, opts = {}) {
  return aiStream('/ai/narrate', body, 'taqdimotchi', { ...opts, qty: Math.ceil(body.slides.length / 10) })
}

/** Streams an AI endpoint; true when it ran, null when it couldn't be paid (the coin shop opens). */
async function aiStream(path, body, action, { onEvent, signal, qty = 1 } = {}) {
  try {
    await streamLines(path, { ...body, ref: newRef() }, {
      signal,
      onEvent: (ev) => {
        if (ev.balance != null) updateUser({ coins: ev.balance })
        onEvent?.(ev)
      },
    })
    return true
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

/* ───────── card payments (HUMO / UZCARD / VISA, checked by the team) ───────── */

/** The cards to pay to and the limits: { methods: [{ id, number, holder }], custom, receiptMaxMb }. */
export const getPayMethods = () => api.get('/payments/methods')
/** The signed-in user's payments, newest first. */
export const myPayments = () => api.get('/payments/orders').then((r) => r.orders)
/** Send a receipt: { coins } or { pack }, method, note, receipt (File). */
export function sendPayment({ coins, pack, method, note, receipt }) {
  const form = new FormData()
  if (pack) form.append('pack', pack)
  else form.append('coins', String(coins))
  form.append('method', method)
  if (note?.trim()) form.append('note', note.trim())
  form.append('receipt', receipt, receipt.name || 'chek')
  return request('POST', '/payments/orders', { form }).then((r) => r.order)
}

// A purchase picked on the landing page before signing in: the shop opens with it in the app.
const INTENT_KEY = 'qalam.buy.intent'
export function rememberPurchase(intent) {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, at: Date.now() }))
  } catch {
    /* storage unavailable */
  }
}
export function takePurchase() {
  try {
    const v = JSON.parse(sessionStorage.getItem(INTENT_KEY) ?? 'null')
    sessionStorage.removeItem(INTENT_KEY)
    return v && Date.now() - v.at < 3600_000 ? v : null
  } catch {
    return null
  }
}
