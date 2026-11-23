// The font menu of the text toolbar: search, categories, a Cyrillic filter, the template's own
// fonts and the recently used ones on top. Each font loads when its row scrolls into view.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { t } from '../i18n/index.js'
import { FONT_CATS, FONTS, familyOf, fontOf, loadFonts, recentFonts, rememberFont } from './fonts.js'

function Row({ css, label, note, on, onPick, observe }) {
  const ref = useRef(null)
  useEffect(() => observe(ref.current, css), [observe, css])
  return (
    <button ref={ref} type="button" role="option" aria-selected={on} className={`fp-row ${on ? 'on' : ''}`} onClick={() => onPick(css)}>
      <span className="fp-name" style={{ fontFamily: css }}>
        {label}
      </span>
      {note && <small className="fp-note">{note}</small>}
      {on && <Check size={15} className="fp-check" />}
    </button>
  )
}

/**
 * @param {{ value: string, theme: object, onPick: (css: string) => void }} p
 */
export default function FontPicker({ value, theme, onPick }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cyr, setCyr] = useState(false)
  const list = useRef(null)
  const current = familyOf(value).toLowerCase()

  // load a font once its row is (nearly) in view
  const io = useRef(null)
  const watched = useRef(new Map()) // node → css
  useEffect(() => {
    io.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          loadFonts([watched.current.get(e.target)])
          io.current.unobserve(e.target)
        }
      },
      { root: list.current, rootMargin: '200px 0px' },
    )
    for (const n of watched.current.keys()) io.current.observe(n)
    return () => io.current.disconnect()
  }, [])
  const observe = useMemo(
    () => (node, css) => {
      if (!node) return undefined
      watched.current.set(node, css)
      io.current?.observe(node)
      return () => {
        watched.current.delete(node)
        io.current?.unobserve(node)
      }
    },
    [],
  )

  const pick = (css) => {
    const f = fontOf(css)
    if (f) {
      rememberFont(f.family)
      loadFonts([css])
    }
    onPick(css)
  }

  const needle = q.trim().toLowerCase()
  const shown = FONTS.filter((f) => (cat === 'all' || f.cat === cat) && (!cyr || f.cyr) && (!needle || f.family.toLowerCase().includes(needle)))
  const browsing = !needle && cat === 'all' && !cyr
  const doc = [...new Map([[theme.titleFont, t('fp.titleFont')], [theme.bodyFont, t('fp.bodyFont')]].filter(([c]) => c)).entries()]
  const recent = browsing ? recentFonts().map(fontOf).filter(Boolean) : []

  return (
    <div className="fp">
      <label className="fp-search">
        <Search size={15} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('fp.search', { n: FONTS.length })} />
      </label>
      <div className="fp-cats">
        {['all', ...FONT_CATS].map((c) => (
          <button key={c} type="button" className={`fp-cat ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {t(`fp.cat.${c}`)}
          </button>
        ))}
        <button type="button" className={`fp-cat ${cyr ? 'on' : ''}`} onClick={() => setCyr((v) => !v)} title={t('fp.cyrHint')}>
          {t('fp.cyr')}
        </button>
      </div>
      <div className="fp-list" ref={list} role="listbox">
        {browsing && (
          <>
            <span className="fp-head">{t('fp.doc')}</span>
            {doc.map(([css, note]) => (
              <Row key={note} css={css} label={familyOf(css)} note={note} on={familyOf(css).toLowerCase() === current} onPick={pick} observe={observe} />
            ))}
            {recent.length > 0 && <span className="fp-head">{t('fp.recent')}</span>}
            {recent.map((f) => (
              <Row key={`r-${f.family}`} css={f.css} label={f.family} on={f.family.toLowerCase() === current} onPick={pick} observe={observe} />
            ))}
            <span className="fp-head">{t('fp.all')}</span>
          </>
        )}
        {shown.map((f) => (
          <Row key={f.family} css={f.css} label={f.family} note={f.cyr ? t('fp.cyrShort') : null} on={f.family.toLowerCase() === current} onPick={pick} observe={observe} />
        ))}
        {!shown.length && <p className="fp-empty">{t('fp.none')}</p>}
      </div>
    </div>
  )
}
