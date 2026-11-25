// Splits the UI dictionary (src/i18n/msg/*.js, every entry carries all languages) into one
// module per language: `virtual:qalam-messages/<lang>`. The browser then downloads only the
// language it shows (plus its fallback: Uzbek, or English for a world language) instead of all of them.
import { DEFAULT_LANG, WORLD_LANGS } from '../shared/i18n.js'
import { loadDict } from './i18n-dict.mjs'

const PREFIX = 'virtual:qalam-messages/'

/** The fields translate() can read for `lang`: its own text and the first fallback it has. */
function pick(entry, lang) {
  const out = {}
  if (entry[lang] != null) out[lang] = entry[lang]
  // uz-cyrl is derived from uz; a world language falls back to English, the others to Uzbek
  const order = lang === 'uz-cyrl' ? [DEFAULT_LANG] : WORLD_LANGS.includes(lang) ? ['en', DEFAULT_LANG] : [DEFAULT_LANG, 'en']
  const f = order.find((l) => entry[l] != null)
  if (f) out[f] = entry[f]
  return out
}

/** @param {string} dir src/i18n/msg  @param {string} localesDir src/i18n/locales */
export default function i18nSplit(dir, localesDir) {
  return {
    name: 'qalam-i18n-split',
    // addWatchFile() only covers files that already exist: a new (or deleted) msg/*.js must
    // also rebuild the dictionaries, or its keys show up raw until the dev server restarts.
    configureServer(server) {
      server.watcher.add(dir)
      server.watcher.add(localesDir)
      const onChange = (file) => {
        if (!(file.startsWith(dir) && file.endsWith('.js')) && !(file.startsWith(localesDir) && file.endsWith('.json'))) return
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          if (mod.id?.startsWith(`\0${PREFIX}`)) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    },
    resolveId(id) {
      if (id.startsWith(PREFIX)) return `\0${id}`
    },
    async load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return
      const lang = id.slice(PREFIX.length + 1)
      const { dict: all } = await loadDict(dir, localesDir, {
        fresh: true,
        onFile: (f) => this.addWatchFile(f),
        onDuplicate: (key, area) => this.warn(`duplicate key "${key}" in ${area}.js`),
      })
      const dict = {}
      for (const [key, entry] of Object.entries(all)) dict[key] = pick(entry, lang)
      return `export default ${JSON.stringify(dict)}`
    },
  }
}
