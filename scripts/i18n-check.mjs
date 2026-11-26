// npm run i18n:check — keeps the translations complete.
//  1. every key has every language (uz, ru, en, kk, ky, tg in msg/*.js; the world languages in
//     locales/<lang>/<area>.json), non-empty unless uz is empty too; no unknown keys in the JSON files
//  2. no language uses a {placeholder} the Uzbek text doesn't have (it would show up raw)
//  3. a plural text gives every form the language has (Intl.PluralRules: ru one/few/many, ar zero…other)
//  4. every literal key used in t('…') / tr('…') exists (web app and server)
//  5. no Uzbek UI text left hard-coded in src/ outside the dictionaries
//
//  --lang zh    report only that language's dictionary problems (for a translator)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_SOURCE_LANGS, SOURCE_LANGS, WORLD_LANGS, localeOf, placeholdersOf } from '../shared/i18n.js'
import { REGIONAL_AREAS, loadDict, localeFile } from './i18n-dict.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const problems = []
const argLang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : null
const LANGS_TO_CHECK = argLang ? [argLang] : ALL_SOURCE_LANGS
const categoriesOf = (lang) => new Intl.PluralRules(localeOf(lang)).resolvedOptions().pluralCategories
const warn = (msg) => problems.push(msg)

async function loadDir(dir) {
  const dict = {}
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const mod = await import(pathToFileURL(join(dir, f)).href)
    for (const [k, v] of Object.entries(mod.default)) {
      if (dict[k]) warn(`duplicate key ${k} (${f})`)
      dict[k] = v
    }
  }
  return dict
}

let regionalKeys = new Set() // keys of REGIONAL_AREAS: no world languages

function checkDict(name, dict) {
  for (const [key, entry] of Object.entries(dict)) {
    const uz = entry.uz
    // `_vars` lists placeholders some languages use although Uzbek doesn't (e.g. digits vs number words)
    const allowed = new Set([...placeholdersOf(uz ?? ''), ...(entry._vars ?? [])])
    for (const lang of name === 'web' ? LANGS_TO_CHECK : SOURCE_LANGS) {
      if (regionalKeys.has(key) && WORLD_LANGS.includes(lang)) continue
      const v = entry[lang]
      if (v == null) { warn(`${name}: ${key} has no ${lang}`); continue }
      const empty = typeof v === 'string' ? v === '' : !Object.keys(v).length
      if (empty && uz !== '') {
        // an empty part is fine when the sentence is split differently in that language
        if (!/\.(l2a|l2b|title2|guest2|titleEm)$/.test(key)) warn(`${name}: ${key} is empty in ${lang}`)
      }
      for (const ph of placeholdersOf(v)) if (!allowed.has(ph)) warn(`${name}: ${key} [${lang}] uses {${ph}} which uz doesn't`)
      if (typeof v === 'object') {
        if (lang === 'ru' && !(v.one && v.few && v.many)) warn(`${name}: ${key} [ru] plural needs one/few/many`)
        if (lang === 'en' && !(v.one && v.other)) warn(`${name}: ${key} [en] plural needs one/other`)
        if (WORLD_LANGS.includes(lang)) {
          const need = categoriesOf(lang).filter((c) => !v[c])
          if (need.length) warn(`${name}: ${key} [${lang}] plural needs ${need.join('/')}`)
        }
      } else if (WORLD_LANGS.includes(lang) && typeof uz === 'object' && categoriesOf(lang).length > 1) {
        warn(`${name}: ${key} [${lang}] must be a plural object { ${categoriesOf(lang).join(', ')} } like uz`)
      }
      if (WORLD_LANGS.includes(lang) && typeof v === 'string' && typeof entry.en === 'string') {
        // "|"-separated lists must keep their length
        const want = entry.en.split('|').length
        if (want > 1 && v.split('|').length !== want) warn(`${name}: ${key} [${lang}] list has ${v.split('|').length} items, en has ${want}`)
        // <b>…</b> rich tags must survive
        const tags = (x) => (x.match(/<\/?(?:b|strong|em|i|br)\s*\/?>/g) ?? []).length
        if (tags(v) !== tags(entry.en)) warn(`${name}: ${key} [${lang}] has ${tags(v)} rich tags, en has ${tags(entry.en)}`)
      }
    }
  }
}

const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (f === 'node_modules' || f === 'msg' || f === 'i18n' && dir.endsWith('server/src')) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|mjs)$/.test(f)) out.push(p)
  }
  return out
}

function checkUsage(files, dict, label) {
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?<![\w.])(t|tr|L|LL)\(\s*'([a-zA-Z][\w.-]*)'/g)) {
      // blueprints.js reads its texts through L()/LL(), which prefix 'bp.'
      const key = m[1] === 'L' || m[1] === 'LL' ? `bp.${m[2]}` : m[2]
      if ((m[1] === 'L' || m[1] === 'LL') && !file.endsWith('blueprints.js')) continue
      if (!dict[key]) warn(`${label}: unknown key '${key}' in ${relative(root, file)}`)
    }
  }
}

// Uzbek words that only appear in UI copy (new alphabet letters, or common function words).
const UZ = /[ÖöĞğŞşÇç]|\b(?:va|uçun|bilan|yoki|emas|kerak|qiliş|yöq|bölmadi|tanlang|kiriting|yuklab|saqlaş|öçiriş|yangi|hammasi|topilmadi|tayyor|nomsiz|sahifa|bet|slayd|şablon|fayl|matn|rasm|rang)\b/i
// The admin panel (src/admin, server/src/modules/admin, payments/admin.js, site/admin.js) is owner-only and Uzbek-only on purpose.
const SKIP_FILES = /(?:src[\\/]admin[\\/]|modules[\\/]admin[\\/]|modules[\\/]payments[\\/]admin\.js|modules[\\/]site[\\/]admin\.js|src[\\/]track\.js|src[\\/]lib[\\/]alifbo|shared[\\/]alifbo|src[\\/]i18n[\\/]|scripts[\\/]|server[\\/]test[\\/]|migrations)/

function leftovers(files) {
  for (const file of files) {
    if (SKIP_FILES.test(file)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
      if (/^\s*(\*|\/\/|\/\*)/.test(line) || /i18n-ignore/.test(line)) return
      // JSX text between tags, or quoted strings
      const texts = [
        ...[...code.matchAll(/>([^<>{}]*[\p{L}][^<>{}]*)</gu)].map((m) => m[1]),
        ...[...code.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*?)\1/g)].map((m) => m[2]),
      ]
      const hit = texts.find((s) => UZ.test(s) && /\p{L}{3,}/u.test(s) && !/^[a-z0-9_\-\s.:/]+$/.test(s.trim()))
      if (hit) warn(`hard-coded text ${relative(root, file)}:${i + 1}  ${hit.trim().slice(0, 70)}`)
    })
  }
}

const MSG_DIR = join(root, 'src/i18n/msg')
const LOCALES_DIR = join(root, 'src/i18n/locales')
const { dict: web, areas } = await loadDict(MSG_DIR, LOCALES_DIR, { onDuplicate: (k, a) => warn(`duplicate key ${k} (${a}.js)`) })
regionalKeys = new Set(REGIONAL_AREAS.flatMap((a) => areas[a] ?? []))
checkDict('web', web)
// a world-language file may only carry keys its area has
for (const lang of LANGS_TO_CHECK.filter((l) => WORLD_LANGS.includes(l))) {
  for (const [area, keys] of Object.entries(areas)) {
    if (REGIONAL_AREAS.includes(area)) continue
    const f = localeFile(LOCALES_DIR, lang, area)
    if (!existsSync(f)) { warn(`web: missing ${relative(root, f)}`); continue }
    const known = new Set(keys)
    for (const k of Object.keys(JSON.parse(readFileSync(f, 'utf8')))) if (!known.has(k)) warn(`web: ${relative(root, f)} has unknown key ${k}`)
  }
}
if (argLang) {
  console.log(problems.length ? `${problems.join('\n')}\n\n✗ ${problems.length} problem(s) in ${argLang}` : `✓ ${argLang} complete`)
  process.exit(problems.length ? 1 : 0)
}
const webFiles = walk(join(root, 'src'))
checkUsage(webFiles, web, 'web')

let serverDict = {}
try {
  serverDict = await loadDir(join(root, 'server/src/i18n/msg'))
  checkDict('server', serverDict)
  checkUsage(walk(join(root, 'server/src')), serverDict, 'server')
} catch {
  /* server dictionary not there yet */
}

if (!process.argv.includes('--no-leftovers')) leftovers([...webFiles, ...walk(join(root, 'server/src')), ...walk(join(root, 'shared'))])

const keys = Object.keys(web).length + Object.keys(serverDict).length
if (problems.length) {
  console.log(problems.join('\n'))
  console.log(`\n✗ ${problems.length} problem(s) · ${keys} keys × ${ALL_SOURCE_LANGS.length} languages (+ uz-cyrl derived)`)
  process.exit(1)
}
console.log(`✓ i18n OK — ${keys} keys × ${ALL_SOURCE_LANGS.length} languages (+ uz-cyrl derived)`)
