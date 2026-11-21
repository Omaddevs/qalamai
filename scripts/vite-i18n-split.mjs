// Splits the UI dictionary (src/i18n/msg/*.js, every entry carries all languages) into one
// module per language: `virtual:qalam-messages/<lang>`. The browser then downloads only the
// language it shows (plus the Uzbek fallback) instead of all seven.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_LANG } from '../shared/i18n.js'

const PREFIX = 'virtual:qalam-messages/'

/** The fields translate() can read for `lang`: its own text, the uz fallback (uz-cyrl derives from uz), en if uz is missing. */
function pick(entry, lang) {
  const out = {}
  if (entry[lang] != null) out[lang] = entry[lang]
  if (entry[DEFAULT_LANG] != null) out[DEFAULT_LANG] = entry[DEFAULT_LANG]
  else if (entry.en != null) out.en = entry.en
  return out
}

export default function i18nSplit(dir) {
  return {
    name: 'qalam-i18n-split',
    // addWatchFile() only covers files that already exist: a new (or deleted) msg/*.js must
    // also rebuild the dictionaries, or its keys show up raw until the dev server restarts.
    configureServer(server) {
      server.watcher.add(dir)
      const onChange = (file) => {
        if (!file.startsWith(dir) || !file.endsWith('.js')) return
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
      const dict = {}
      for (const name of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
        const file = join(dir, name)
        this.addWatchFile(file)
        // the mtime query makes a dev-server reload read the edited file, not Node's cached copy
        const { default: part } = await import(`${pathToFileURL(file).href}?v=${statSync(file).mtimeMs}`)
        for (const [key, entry] of Object.entries(part)) {
          if (dict[key]) this.warn(`duplicate key "${key}" in ${name}`)
          dict[key] = pick(entry, lang)
        }
      }
      return `export default ${JSON.stringify(dict)}`
    },
  }
}
