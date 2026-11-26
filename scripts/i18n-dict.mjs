// Reads the whole UI dictionary: src/i18n/msg/<area>.js carries uz, ru, en, kk, ky, tg beside each key;
// src/i18n/locales/<lang>/<area>.json carries one world language (zh, es, ar …) for the same keys.
// Returns key → { uz, ru, …, zh, es, … } — the shape translate() reads. Used by the build
// (vite-i18n-split, prerender) and by `npm run i18n:check`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WORLD_LANGS } from '../shared/i18n.js'

/**
 * Areas written only in the 7 regional languages (uz, uz-cyrl, ru, en, kk, ky, tg): search landing
 * pages for Uzbekistan and its neighbours. They have no locales/<lang>/<area>.json; a world-language
 * interface shows them in Uzbek/English fallback, and they are not prerendered in world languages.
 */
export const REGIONAL_AREAS = ['products']

export const areasOf = (msgDir) => readdirSync(msgDir).filter((f) => f.endsWith('.js')).sort().map((f) => f.slice(0, -3))
export const localeFile = (localesDir, lang, area) => join(localesDir, lang, `${area}.json`)

/**
 * @param {string} msgDir  src/i18n/msg
 * @param {string} localesDir  src/i18n/locales
 * @param {{ fresh?: boolean, onFile?: (file: string) => void, onDuplicate?: (key: string, area: string) => void }} [opts]
 *   fresh: re-import edited msg files (dev server); onFile: every file read (watching).
 */
export async function loadDict(msgDir, localesDir, opts = {}) {
  const dict = {}
  const areas = {}
  for (const area of areasOf(msgDir)) {
    const file = join(msgDir, `${area}.js`)
    opts.onFile?.(file)
    const q = opts.fresh ? `?v=${statSync(file).mtimeMs}` : ''
    const { default: part } = await import(`${pathToFileURL(file).href}${q}`)
    areas[area] = Object.keys(part)
    for (const [key, entry] of Object.entries(part)) {
      if (dict[key]) opts.onDuplicate?.(key, area)
      dict[key] = { ...entry }
    }
    for (const lang of WORLD_LANGS) {
      const jf = localeFile(localesDir, lang, area)
      if (!existsSync(jf)) continue
      opts.onFile?.(jf)
      const texts = JSON.parse(readFileSync(jf, 'utf8'))
      for (const [key, text] of Object.entries(texts)) if (part[key]) dict[key][lang] = text
    }
  }
  return { dict, areas }
}
