// npm run i18n:check — keeps the translations complete.
//  1. every key has every source language (uz, ru, en, kk, ky, tg), non-empty unless uz is empty too
//  2. no language uses a {placeholder} the Uzbek text doesn't have (it would show up raw)
//  3. Russian plural texts give one/few/many, English ones one/other
//  4. every literal key used in t('…') / tr('…') exists (web app and server)
//  5. no Uzbek UI text left hard-coded in src/ outside the dictionaries
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SOURCE_LANGS, placeholdersOf } from '../shared/i18n.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const problems = []
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

function checkDict(name, dict) {
  for (const [key, entry] of Object.entries(dict)) {
    const uz = entry.uz
    // `_vars` lists placeholders some languages use although Uzbek doesn't (e.g. digits vs number words)
    const allowed = new Set([...placeholdersOf(uz ?? ''), ...(entry._vars ?? [])])
    for (const lang of SOURCE_LANGS) {
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
// The admin panel (src/admin, server/src/modules/admin) is owner-only and Uzbek-only on purpose.
const SKIP_FILES = /(?:src[\\/]admin[\\/]|modules[\\/]admin[\\/]|src[\\/]track\.js|src[\\/]lib[\\/]alifbo|shared[\\/]alifbo|src[\\/]i18n[\\/]|scripts[\\/]|server[\\/]test[\\/]|migrations)/

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

const web = await loadDir(join(root, 'src/i18n/msg'))
checkDict('web', web)
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
  console.log(`\n✗ ${problems.length} problem(s) · ${keys} keys × ${SOURCE_LANGS.length} languages (+ uz-cyrl derived)`)
  process.exit(1)
}
console.log(`✓ i18n OK — ${keys} keys × ${SOURCE_LANGS.length} languages (+ uz-cyrl derived)`)
