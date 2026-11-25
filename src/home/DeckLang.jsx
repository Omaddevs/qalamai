// The language a presentation is written in — chosen separately from the interface language.
// Used by the AI taqdimot page and by the home composer (when the type is Prezentatsiya).
import { useState } from 'react'
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react'
import { Dropdown } from '../components/ui.jsx'
import { LANGS, getLang, inLang, t } from '../i18n/index.js'
import './decklang.css'

/* Every interface language can also be the language of a presentation: the 7 languages of the
 * region first, then the most spoken world languages. 'ad.names' (src/i18n/msg/aideck.js) names them
 * in LANGS order, in the interface language; native names are not translated. */

/** Every presentation language, named in the interface language. */
export const deckLangs = () => {
  const names = t('ad.names').split('|')
  return LANGS.map((l, i) => {
    const native = l.note ? `${l.name} · ${l.note}` : l.name
    return { id: l.id, code: l.code, native, rtl: l.dir === 'rtl', site: !l.world, name: names[i] ?? native }
  })
}

const isLangId = (id) => LANGS.some((l) => l.id === id)
/** The interface language, which is always one of the presentation languages. */
export const defaultDeckLang = () => (isLangId(getLang()) ? getLang() : 'uz')

/** Builds a document in `lang` — every presentation language has its own texts. */
export const buildIn = (lang, fn) => inLang(isLangId(lang) ? lang : 'en', fn)
/** True when a document can't be written in `lang` and falls back to English (an unknown id). */
export const fallbackOf = (lang) => !isLangId(lang)

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
