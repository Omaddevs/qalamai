// Every UI text, by area: each file in ./msg maps key → { uz, ru, en, kk, ky, tg } (uz-cyrl is derived).
// `npm run i18n:check` verifies that every key has every language and the same {placeholders}.
// The build splits them per language (scripts/vite-i18n-split.mjs), so only the shown language is downloaded.
const LOADERS = {
  uz: () => import('virtual:qalam-messages/uz'),
  'uz-cyrl': () => import('virtual:qalam-messages/uz-cyrl'),
  ru: () => import('virtual:qalam-messages/ru'),
  en: () => import('virtual:qalam-messages/en'),
  kk: () => import('virtual:qalam-messages/kk'),
  ky: () => import('virtual:qalam-messages/ky'),
  tg: () => import('virtual:qalam-messages/tg'),
}

/** The dictionary for `lang` (key → entry holding that language and the Uzbek fallback). */
export const loadMessages = (lang) => (LOADERS[lang] ?? LOADERS.uz)().then((m) => m.default)
