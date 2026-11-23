// QalamCoin — narxlar bitta joyda. Server (yeçiş, sotib oliş) va frontend (körsatiş) şu faylni öqiydi.
// 1 coin ≈ 100 söm. Har bir amal narxi AI xarajatidan taxminan 2–3 baravar köp qilib tanlangan.

/** Röyxatdan ötganda bir marta beriladi. */
export const SIGNUP_BONUS = 30

/** AI amallari. `per` bölsa, narx şu birlik uçun (masalan, 1 bet yoki 1 000 söz). */
export const COIN_COSTS = {
  prezentatsiya: { label: 'Prezentatsiya', cost: 20, note: '10–40 slayd' },
  referat: { label: 'Referat', cost: 50, note: '12–15 bet' },
  'kurs-ishi': { label: 'Kurs işi', cost: 150, note: '30–40 bet' },
  diplom: { label: 'Diplom işi', cost: 400, note: '70–80 bet' },
  'dars-ishlanma': { label: 'Dars işlanma', cost: 20, note: '1 dars' },
  'biznes-reja': { label: 'Biznes reja', cost: 50, note: '10–15 bet' },
  hisobot: { label: 'Hisobot', cost: 20, note: 'slaydlar' },
  taklifnoma: { label: 'Taklifnoma', cost: 10, note: '1 karta' },
  portfolio: { label: 'Portfolio', cost: 20, note: 'slaydlar' },
  'qayta-yozish': { label: 'Qayta yoziş', cost: 5, per: '1 bet' },
  plagiat: { label: 'Plagiat tekşiruvi', cost: 5, per: '1 bet' },
  tarjima: { label: 'Tarjima', cost: 10, per: '1 000 söz' },
  // a design made from a Pro template: editing is free, the first download of that design costs this once
  'pro-shablon': { label: 'Pro şablon', cost: 30, note: '1 dizayn' },
}

/** Bosh sahifadagi yaratiş turlari (src/home/create.jsx CREATE.label) → amal. */
export const ACTION_BY_TYPE = {
  Prezentatsiya: 'prezentatsiya',
  Referat: 'referat',
  'Kurs işi': 'kurs-ishi',
  'Dars işlanma': 'dars-ishlanma',
  'Biznes reja': 'biznes-reja',
  Hisobot: 'hisobot',
  Taklifnoma: 'taklifnoma',
  Portfolio: 'portfolio',
}

/** Ilovalar (src/data.js APPS.id) → amal. Röyxatda yöq ilovalar bepul. */
export const ACTION_BY_APP = {
  prezentatsiya: 'prezentatsiya',
  referat: 'referat',
  kursishi: 'kurs-ishi',
  tarjima: 'tarjima',
  plagiat: 'plagiat',
  qaytayozish: 'qayta-yozish',
}

/** Sotiladigan paketlar. Coin muddatsiz, obuna yöq. */
export const COIN_PACKS = [
  { id: 'c100', coins: 100, price: 12_900, label: 'Boşlanğiç', tier: 'Start' },
  { id: 'c300', coins: 300, price: 34_900, label: 'Ommabop', tier: 'Pro', featured: true },
  { id: 'c1000', coins: 1000, price: 99_000, label: 'Katta paket', tier: 'Max' },
]

/**
 * Any number of coins (not only a pack): at least `min`. The price per coin falls with the amount,
 * at the same steps as the packs; a count equal to a pack costs exactly that pack, and no count
 * costs more than a bigger pack.
 */
export const CUSTOM_COINS = { min: 10, max: 100_000 }
const RATES = [
  { from: 1000, rate: 99 },
  { from: 300, rate: 116 },
  { from: 0, rate: 129 },
]
/** Söm per coin for an amount of coins. */
export const coinRate = (coins) => RATES.find((r) => coins >= r.from).rate
/** What `coins` coins cost in söm (rounded up to 100 söm, so it is easy to transfer). */
export function priceFor(coins) {
  const n = Math.floor(Number(coins))
  if (!Number.isFinite(n) || n < CUSTOM_COINS.min || n > CUSTOM_COINS.max) return null
  const pack = COIN_PACKS.find((p) => p.coins === n)
  if (pack) return pack.price
  const raw = Math.ceil((n * coinRate(n)) / 100) * 100
  // never more than a bigger pack costs (299 coins are not dearer than the 300 pack)
  return Math.min(raw, ...COIN_PACKS.filter((p) => p.coins >= n).map((p) => p.price))
}

/** Paid by card transfer until Click / Payme are connected: the team checks each receipt. */
export const PAY_METHODS = ['humo', 'uzcard', 'visa']
/** A receipt: a photo / screenshot or a PDF, up to this size. */
export const RECEIPT_MAX_MB = 10
/** How many payments one account may have waiting for a check at once. */
export const MAX_PENDING_PAYMENTS = 3

/** The account's tier: the biggest pack it has ever bought (Start → Pro → Max), or null. */
export function tierOf(packIds) {
  const best = COIN_PACKS.reduce((top, p, i) => (packIds.includes(p.id) ? i : top), -1)
  return best < 0 ? null : COIN_PACKS[best].tier
}

/** Bepul işlar: AI talab qilmaydi, coin yemaydi. */
export const FREE_FEATURES = ['Fayl studiyasi (PDF ↔ Word, siqiş, fon öçiriş …)', 'Alifbo konvertori', 'Vizual muharrir va bepul şablonlar']

/** Bir marta coin sotib olganlarga doimiy oçiladi. */
export const PREMIUM_PERKS = ['Watermarksiz yuklab oliş', 'Barça Pro şablonlar va Brend töplami', 'Katta fayllar (200 MB gaça)']

export const costOf = (action, qty = 1) => {
  const c = COIN_COSTS[action]
  return c ? c.cost * Math.max(1, Math.ceil(qty)) : null
}
