// Every UI text, by area: each file in ./msg maps key → { uz, ru, en, kk, ky, tg } (uz-cyrl is derived);
// ./locales/<lang>/<area>.json holds the same keys in a world language (zh, es, ar …).
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
  zh: () => import('virtual:qalam-messages/zh'),
  hi: () => import('virtual:qalam-messages/hi'),
  es: () => import('virtual:qalam-messages/es'),
  fr: () => import('virtual:qalam-messages/fr'),
  ar: () => import('virtual:qalam-messages/ar'),
  bn: () => import('virtual:qalam-messages/bn'),
  pt: () => import('virtual:qalam-messages/pt'),
  ur: () => import('virtual:qalam-messages/ur'),
  id: () => import('virtual:qalam-messages/id'),
  de: () => import('virtual:qalam-messages/de'),
  ja: () => import('virtual:qalam-messages/ja'),
  tr: () => import('virtual:qalam-messages/tr'),
  ko: () => import('virtual:qalam-messages/ko'),
  vi: () => import('virtual:qalam-messages/vi'),
  it: () => import('virtual:qalam-messages/it'),
  fa: () => import('virtual:qalam-messages/fa'),
  pl: () => import('virtual:qalam-messages/pl'),
  uk: () => import('virtual:qalam-messages/uk'),
}

/** The dictionary for `lang` (key → entry holding that language and the Uzbek fallback). */
export const loadMessages = (lang) => (LOADERS[lang] ?? LOADERS.uz)().then((m) => m.default)
