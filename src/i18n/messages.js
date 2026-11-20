// Every UI text, by area: each file in ./msg maps key → { uz, ru, en, kk, ky, tg } (uz-cyrl is derived).
// `npm run i18n:check` verifies that every key has every language and the same {placeholders}.
const files = import.meta.glob('./msg/*.js', { eager: true, import: 'default' })

const MESSAGES = {}
for (const [file, part] of Object.entries(files)) {
  for (const [k, v] of Object.entries(part)) {
    if (MESSAGES[k] && import.meta.env?.DEV) console.warn(`[i18n] duplicate key "${k}" in ${file}`)
    MESSAGES[k] = v
  }
}
export default MESSAGES
