// QalamCoin — narxlar bitta joyda. Server (yeçiş, sotib oliş) va frontend (körsatiş) şu faylni öqiydi.
// 1 coin ≈ 100 söm. Har bir amal narxi AI xarajatidan taxminan 2–3 baravar köp qilib tanlangan.

/** Röyxatdan ötganda bir marta beriladi. */
export const SIGNUP_BONUS = 50

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

/** The account's tier: the biggest pack it has ever bought (Start → Pro → Max), or null. */
export function tierOf(packIds) {
  const best = COIN_PACKS.reduce((top, p, i) => (packIds.includes(p.id) ? i : top), -1)
  return best < 0 ? null : COIN_PACKS[best].tier
}

/** Bepul işlar: AI talab qilmaydi, coin yemaydi. */
export const FREE_FEATURES = ['Fayl studiyasi (PDF ↔ Word, siqiş, fon öçiriş …)', 'Alifbo konvertori', 'Vizual muharrir va bepul şablonlar']

/** Bir marta coin sotib olganlarga doimiy oçiladi. */
export const PREMIUM_PERKS = ['Watermarksiz yuklab oliş', 'Barça Pro şablonlar va Brend töplami', 'Katta fayllar (200 MB gaça), fayllar saqlanadi']

export const costOf = (action, qty = 1) => {
  const c = COIN_COSTS[action]
  return c ? c.cost * Math.max(1, Math.ceil(qty)) : null
}
