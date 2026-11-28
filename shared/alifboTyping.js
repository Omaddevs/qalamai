// Live typing on a Latin-only keyboard: each key is turned into the chosen script as it is typed.
//   new: sh → ş, ch → ç, o' → ö, g' → ğ, other ' after a letter → ʼ
//   cyr: every Latin letter → Cyrillic, plus sh → ш, ch → ч, o' → ў, g' → ғ, ya/yu/yo/ye → я/ю/ё/е,
//        e → э at a word start or after a vowel, ' after a letter → ъ
// typeKey(before, ch, mode) looks at the text before the caret and the typed character and returns
// { del, ins }: remove `del` characters before the caret and insert `ins` instead of the key; or null to let
// the key through unchanged.

export const TYPE_MODES = ['off', 'new', 'cyr']
// localStorage key of the file editor's typing mode (the Alifbo page sets it when it opens a file there)
export const TYPE_KEY = 'qalamai.typeScript'

const APOS = 'ʻ‘\'`’ʼ'
const LETTER = /\p{L}/u
const CYR_VOWELS = 'аеёиоуўэюяАЕЁИОУЎЭЮЯ'

const LAT_CYR = {
  a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о',
  p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц', w: 'в',
  ö: 'ў', ğ: 'ғ', ş: 'ш', ç: 'ч',
}
const Y_VOWEL = { a: 'я', u: 'ю', o: 'ё', e: 'е' }

const isUpper = (c) => c !== c.toLowerCase()
const withCase = (out, upper) => (upper ? out.toUpperCase() : out)

export function typeKey(before, ch, mode) {
  if (mode !== 'new' && mode !== 'cyr') return null
  const prev = before.slice(-1)
  const p = prev.toLowerCase()
  const c = ch.toLowerCase()
  const up = isUpper(ch)

  if (mode === 'new') {
    if (c === 'h' && (p === 's' || p === 'c')) return { del: 1, ins: withCase(p === 's' ? 'ş' : 'ç', isUpper(prev)) }
    if (APOS.includes(ch)) {
      if (p === 'o' || p === 'g') return { del: 1, ins: withCase(p === 'o' ? 'ö' : 'ğ', isUpper(prev)) }
      if (prev && LETTER.test(prev) && ch !== 'ʼ') return { del: 0, ins: 'ʼ' }
    }
    return null
  }

  // cyr
  if (APOS.includes(ch)) {
    if (p === 'о') return { del: 1, ins: withCase('ў', isUpper(prev)) }
    if (p === 'г') return { del: 1, ins: withCase('ғ', isUpper(prev)) }
    if (p === 'ё') return { del: 1, ins: isUpper(prev) ? 'ЙЎ' : 'йў' } // yo'l → йўл
    if (prev && LETTER.test(prev)) return { del: 0, ins: 'ъ' }
    return null
  }
  if (c === 'h' && (p === 'с' || p === 'ц')) return { del: 1, ins: withCase(p === 'с' ? 'ш' : 'ч', isUpper(prev)) }
  if (p === 'й' && Y_VOWEL[c]) return { del: 1, ins: withCase(Y_VOWEL[c], isUpper(prev)) }
  if (c === 'e') {
    const start = !prev || !LETTER.test(prev) || CYR_VOWELS.includes(prev)
    return { del: 0, ins: withCase(start ? 'э' : 'е', up) }
  }
  const out = LAT_CYR[c]
  return out ? { del: 0, ins: withCase(out, up) } : null
}

/** Types a whole string key by key (used by tests and handy for checking rules). */
export function typeString(text, mode) {
  let s = ''
  for (const ch of text) {
    const r = typeKey(s, ch, mode)
    s = r ? s.slice(0, s.length - r.del) + r.ins : s + ch
  }
  return s
}
