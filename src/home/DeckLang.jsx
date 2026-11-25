// The language a presentation is written in — chosen separately from the interface language.
// Used by the AI taqdimot page and by the home composer (when the type is Prezentatsiya).
import { useState } from 'react'
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react'
import { Dropdown } from '../components/ui.jsx'
import { LANGS, getLang, inLang, t } from '../i18n/index.js'
import './decklang.css'

/* The 7 site languages, then the most spoken world languages.
 * The order matches 'ad.names' (src/i18n/msg/aideck.js); native names are not translated. */
const WORLD = [
  ['zh', '中文'],
  ['hi', 'हिन्दी'],
  ['es', 'Español'],
  ['fr', 'Français'], // i18n-ignore
  ['ar', 'العربية', true],
  ['bn', 'বাংলা'],
  ['pt', 'Português'],
  ['ur', 'اردو', true],
  ['id', 'Bahasa Indonesia'],
  ['de', 'Deutsch'],
  ['ja', '日本語'],
  ['tr', 'Türkçe'], // i18n-ignore
  ['ko', '한국어'],
  ['vi', 'Tiếng Việt'],
  ['it', 'Italiano'],
  ['fa', 'فارسی', true],
  ['pl', 'Polski'],
  ['uk', 'Українська'],
]

/** Every presentation language, named in the interface language. */
export const deckLangs = () => {
  const names = t('ad.names').split('|')
  const site = LANGS.map((l) => ({ id: l.id, code: l.code, native: l.note ? `${l.name} · ${l.note}` : l.name, site: true }))
  const world = WORLD.map(([id, native, rtl]) => ({ id, code: id.toUpperCase(), native, rtl }))
  return [...site, ...world].map((l, i) => ({ ...l, name: names[i] ?? l.native }))
}

const isSite = (id) => LANGS.some((l) => l.id === id)
/** The interface language, which is always one of the presentation languages. */
export const defaultDeckLang = () => (isSite(getLang()) ? getLang() : 'uz')

/**
 * Builds a document in `lang`. Site languages have their own texts; until the AI backend writes
 * the other languages, their decks get the English texts (`fallback` says so).
 */
export const buildIn = (lang, fn) => inLang(isSite(lang) ? lang : 'en', fn)
export const fallbackOf = (lang) => !isSite(lang)

export function DeckLangPicker({ langs, value, onChange, variant = 'field' }) {
  const [q, setQ] = useState('')
  const cur = langs.find((l) => l.id === value) ?? langs[0]
  const query = q.trim().toLowerCase()
  const found = query ? langs.filter((l) => `${l.name} ${l.native} ${l.code}`.toLowerCase().includes(query)) : langs
  const groups = [
    [t('ad.langSite'), found.filter((l) => l.site)],
    [t('ad.langWorld'), found.filter((l) => !l.site)],
  ].filter(([, list]) => list.length)

  return (
    <div className={`ad-langdd ${variant}`}>
      <Dropdown
        className="ad-lang-pop"
        button={({ toggle, open }) => (
          <button
            type="button"
            className={`ad-lang-btn ${variant} ${open ? 'open' : ''}`}
            onClick={() => {
              setQ('')
              toggle()
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`${t('ad.lang')}: ${cur.name}`}
            title={variant === 'pill' ? t('ad.lang') : undefined}
          >
            <span className="ad-code">{cur.code}</span>
            <span className="ad-lang-text">
              <b dir={cur.rtl ? 'rtl' : undefined}>{variant === 'pill' ? cur.native.split(' · ')[0] : cur.native}</b>
              {cur.name !== cur.native && <small>{cur.name}</small>}
            </span>
            <CaretDown size={variant === 'pill' ? 11 : 14} weight="bold" className="ad-caret" />
          </button>
        )}
      >
        {(close) => (
          <>
            <label className="ad-lang-search">
              <MagnifyingGlass size={15} weight="bold" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ad.langSearch')} aria-label={t('ad.langSearch')} />
            </label>
            <div className="ad-lang-list" role="listbox">
              {groups.map(([label, list]) => (
                <div key={label} className="ad-lang-group">
                  <div className="pop-label">
                    {label} <span>{list.length}</span>
                  </div>
                  {list.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="option"
                      aria-selected={l.id === value}
                      className={`ad-lang-item ${l.id === value ? 'on' : ''}`}
                      onClick={() => {
                        onChange(l.id)
                        close()
                      }}
                    >
                      <span className="ad-code sm">{l.code}</span>
                      <span className="ad-lang-text">
                        <b dir={l.rtl ? 'rtl' : undefined}>{l.native}</b>
                        {l.name !== l.native && <small>{l.name}</small>}
                      </span>
                      {l.id === value && <Check size={15} weight="bold" className="ad-check" />}
                    </button>
                  ))}
                </div>
              ))}
              {!groups.length && <p className="ad-lang-none">{t('ad.langNone')}</p>}
            </div>
          </>
        )}
      </Dropdown>
    </div>
  )
}
