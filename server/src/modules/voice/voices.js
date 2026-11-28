// Which voice speaks each presentation language (Azure AI Speech neural voices).
// f = a woman's voice, m = a man's. A language missing here (Kyrgyz, Tajik) has no server voice:
// the player falls back to the browser's own speech for it.
import { convert, detectScript } from '../../../../shared/alifbo.js'

export const VOICES = {
  uz: { locale: 'uz-UZ', f: 'uz-UZ-MadinaNeural', m: 'uz-UZ-SardorNeural' },
  'uz-cyrl': { locale: 'uz-UZ', f: 'uz-UZ-MadinaNeural', m: 'uz-UZ-SardorNeural' },
  ru: { locale: 'ru-RU', f: 'ru-RU-SvetlanaNeural', m: 'ru-RU-DmitryNeural' },
  en: { locale: 'en-US', f: 'en-US-AvaNeural', m: 'en-US-AndrewNeural' },
  kk: { locale: 'kk-KZ', f: 'kk-KZ-AigulNeural', m: 'kk-KZ-DauletNeural' },
  zh: { locale: 'zh-CN', f: 'zh-CN-XiaoxiaoNeural', m: 'zh-CN-YunxiNeural' },
  hi: { locale: 'hi-IN', f: 'hi-IN-SwaraNeural', m: 'hi-IN-MadhurNeural' },
  es: { locale: 'es-ES', f: 'es-ES-ElviraNeural', m: 'es-ES-AlvaroNeural' },
  fr: { locale: 'fr-FR', f: 'fr-FR-DeniseNeural', m: 'fr-FR-HenriNeural' },
  ar: { locale: 'ar-SA', f: 'ar-SA-ZariyahNeural', m: 'ar-SA-HamedNeural' },
  bn: { locale: 'bn-BD', f: 'bn-BD-NabanitaNeural', m: 'bn-BD-PradeepNeural' },
  pt: { locale: 'pt-BR', f: 'pt-BR-FranciscaNeural', m: 'pt-BR-AntonioNeural' },
  ur: { locale: 'ur-PK', f: 'ur-PK-UzmaNeural', m: 'ur-PK-AsadNeural' },
  id: { locale: 'id-ID', f: 'id-ID-GadisNeural', m: 'id-ID-ArdiNeural' },
  de: { locale: 'de-DE', f: 'de-DE-KatjaNeural', m: 'de-DE-ConradNeural' },
  ja: { locale: 'ja-JP', f: 'ja-JP-NanamiNeural', m: 'ja-JP-KeitaNeural' },
  tr: { locale: 'tr-TR', f: 'tr-TR-EmelNeural', m: 'tr-TR-AhmetNeural' },
  ko: { locale: 'ko-KR', f: 'ko-KR-SunHiNeural', m: 'ko-KR-InJoonNeural' },
  vi: { locale: 'vi-VN', f: 'vi-VN-HoaiMyNeural', m: 'vi-VN-NamMinhNeural' },
  it: { locale: 'it-IT', f: 'it-IT-ElsaNeural', m: 'it-IT-DiegoNeural' },
  fa: { locale: 'fa-IR', f: 'fa-IR-DilaraNeural', m: 'fa-IR-FaridNeural' },
  pl: { locale: 'pl-PL', f: 'pl-PL-ZofiaNeural', m: 'pl-PL-MarekNeural' },
  uk: { locale: 'uk-UA', f: 'uk-UA-PolinaNeural', m: 'uk-UA-OstapNeural' },
}

/**
 * The text as the voice should read it. The Uzbek voice knows the current Latin spelling
 * (oʻ gʻ sh ch), not the new letters (Ö Ğ Ş Ç) or Cyrillic, so Uzbek is converted to it.
 */
export function spoken(text, lang) {
  const s = String(text).replace(/\s+/g, ' ').trim()
  if (lang !== 'uz' && lang !== 'uz-cyrl') return s
  const from = detectScript(s)
  return from === 'old' ? s : convert(s, from, 'old')
}

const XML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
export const xml = (s) => s.replace(/[&<>"']/g, (c) => XML[c])

/** SSML for one part of the talk. rate: 1 = normal speed. */
export function ssml({ text, locale, voice, rate = 1 }) {
  const pct = Math.round((rate - 1) * 100)
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${xml(text)}</prosody></voice></speak>`
}
