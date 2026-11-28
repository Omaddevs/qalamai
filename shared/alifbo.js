// Uzbek script converter: joriy lotin (old) ↔ yangi lotin (new: Ö Ğ Ş Ç) ↔ kirill (cyr).
// Every conversion goes through the "new" Latin form internally.

const APOS = 'ʻ‘\'`’ʼ'
export const WORD = new RegExp(`[\\p{L}]+(?:[${APOS}][\\p{L}]*)*`, 'gu')
const CYR_VOWELS = 'аеёиоуўэюя'
const LAT_VOWELS = 'aeiouö'

export const SCRIPTS = [
  { id: 'old', label: 'Lotin (joriy)' },
  { id: 'new', label: 'Yangi lotin' },
  { id: 'cyr', label: 'Kirill' },
]

export function detectScript(text) {
  if (/[Ѐ-ӿ]/.test(text)) return 'cyr'
  if (/[ÖöĞğŞşÇç]/.test(text)) return 'new'
  return 'old'
}

const oldToNew = (w) =>
  w
    .replace(new RegExp(`o[${APOS}]`, 'g'), 'ö')
    .replace(new RegExp(`g[${APOS}]`, 'g'), 'ğ')
    .replace(/sh/g, 'ş')
    .replace(/ch/g, 'ç')
    .replace(new RegExp(`[${APOS}]`, 'g'), 'ʼ')

const newToOld = (w) =>
  w.replace(/ö/g, 'oʻ').replace(/ğ/g, 'gʻ').replace(/ş/g, 'sh').replace(/ç/g, 'ch')

const LAT_CYR = {
  a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й',
  z: 'з', c: 'с', w: 'в', ö: 'ў', ğ: 'ғ', ş: 'ш', ç: 'ч', ʼ: 'ъ',
}
const Y_PAIRS = { ye: 'е', yo: 'ё', yu: 'ю', ya: 'я' }

function newToCyr(w) {
  let out = ''
  for (let i = 0; i < w.length; i++) {
    const pair = w.slice(i, i + 2)
    if (Y_PAIRS[pair]) {
      out += Y_PAIRS[pair]
      i++
      continue
    }
    const ch = w[i]
    if (ch === 'e') {
      out += i === 0 || LAT_VOWELS.includes(w[i - 1]) ? 'э' : 'е'
      continue
    }
    out += LAT_CYR[ch] ?? ch
  }
  return out
}

const CYR_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x',
  ц: 'ts', ч: 'ç', ш: 'ş', щ: 'şç', ъ: 'ʼ', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'ö', қ: 'q', ғ: 'ğ', ҳ: 'h',
}

function cyrToNew(w) {
  let out = ''
  for (let i = 0; i < w.length; i++) {
    const ch = w[i]
    if (ch === 'е') {
      const prev = w[i - 1]
      out += i === 0 || CYR_VOWELS.includes(prev) || prev === 'ъ' || prev === 'ь' ? 'ye' : 'e'
      continue
    }
    out += CYR_LAT[ch] ?? ch
  }
  return out
}

const TO_NEW = { old: oldToNew, new: (w) => w, cyr: cyrToNew }
const FROM_NEW = { old: newToOld, new: (w) => w, cyr: newToCyr }

function restoreCase(src, out) {
  if (!out) return out
  const hasCase = src !== src.toLowerCase()
  if (!hasCase) return out
  const letters = src.replace(new RegExp(`[${APOS}]`, 'g'), '')
  if (letters.length > 1 && letters === letters.toUpperCase()) return out.toUpperCase()
  if (src[0] !== src[0].toLowerCase()) return out[0].toUpperCase() + out.slice(1)
  return out
}

export function convert(text, from, to) {
  if (!text || from === to) return text
  return text.replace(WORD, (word) => {
    const lower = word.toLowerCase()
    const converted = FROM_NEW[to](TO_NEW[from](lower))
    return restoreCase(word, converted)
  })
}
