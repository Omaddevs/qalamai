import { useEffect, useMemo, useRef, useState } from 'react'
import AssetImg from '../components/AssetImg.jsx'
import ProBadge from '../components/ProBadge.jsx'
import { Search, SlidersHorizontal, Play, CloudUpload, Wand2, X, Check } from 'lucide-react'
import { CoinPrice } from '../components/Coins.jsx'
import { COIN_COSTS } from '../coins.js'
import { APPS } from '../data.js'
import { AppTile, Dropdown } from '../components/ui.jsx'
import { SCRIPTS } from '../lib/alifbo.js'
import Slide from './Slide.jsx'
import { BRAND_COLORS, CATEGORIES, TEMPLATES, deckTheme, getTemplate } from './templates.js'
import { loadDesigns, timeAgo } from '../store.js'
import { t } from '../i18n/index.js'
import { fontCss, loadFonts } from './fonts.js'
import { COMBOS } from './fontCombos.js'

const sampleSlide = (tpl) => ({ id: tpl.id, type: 'title', ...tpl.sample, elements: [] })

export function TemplateCard({ tpl, active, onClick }) {
  const slide = useMemo(() => sampleSlide(tpl), [tpl])
  return (
    <button className={`tpl-card ${active ? 'active' : ''}`} onClick={onClick} title={`${tpl.name}${tpl.pro ? ' · Pro' : ''}`}>
      <Slide slide={slide} theme={tpl.theme} preview />
      {tpl.video && (
        <span className="tpl-play">
          <Play size={11} fill="currentColor" />
        </span>
      )}
      {tpl.pro && (
        <ProBadge size="xs" className="tpl-pro" />
      )}
      {active && (
        <span className="tpl-check">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

function PanelHead({ title, children }) {
  return (
    <div className="pn-head">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

/* ───────── Shablonlar ───────── */
export function TemplatesPanel({ currentId, recent, onApply }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [proOnly, setProOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const filtering = q.trim() || cat !== 'all' || proOnly || showAll
  const results = TEMPLATES.filter((t) => {
    const hay = `${t.name} ${t.sample.title} ${t.sample.subtitle}`.toLowerCase()
    return (
      (cat === 'all' || t.cat === cat) &&
      (!proOnly || t.pro) &&
      (!q.trim() || hay.includes(q.trim().toLowerCase()))
    )
  })

  const grid = (list) => (
    <div className="tpl-grid">
      {list.map((t) => (
        <TemplateCard key={t.id} tpl={t} active={t.id === currentId} onClick={() => onApply(t.id)} />
      ))}
    </div>
  )

  return (
    <>
      <div className="pn-search">
        <Search size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Şablonlarni qidiring" />
        {q && (
          <button className="pn-icon" onClick={() => setQ('')} aria-label="Tozalaş">
            <X size={15} />
          </button>
        )}
        <Dropdown
          align="right"
          button={({ toggle, open }) => (
            <button className={`pn-icon ${open || proOnly ? 'on' : ''}`} onClick={toggle} aria-label="Filtr">
              <SlidersHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="pop-label">Filtr</div>
              <button className="menu-item" onClick={() => { setProOnly(false); close() }}>
                Barça şablonlar {!proOnly && <Check size={15} />}
              </button>
              <button className="menu-item" onClick={() => { setProOnly(true); close() }}>
                Faqat Premium {proOnly && <Check size={15} />}
              </button>
            </>
          )}
        </Dropdown>
      </div>

      <div className="pn-chips">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`pn-chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="pn-scroll">
        {filtering ? (
          <>
            <PanelHead title={showAll && !q.trim() && cat === 'all' && !proOnly ? 'Barça şablonlar' : `Natijalar · ${results.length}`}>
              <button
                className="pn-link"
                onClick={() => {
                  setShowAll(false)
                  setQ('')
                  setCat('all')
                  setProOnly(false)
                }}
              >
                Orqaga
              </button>
            </PanelHead>
            {results.length ? grid(results) : <p className="pn-empty">Heç narsa topilmadi. Boşqa söz bilan qidiring.</p>}
          </>
        ) : (
          <>
            <PanelHead title="Yaqinda işlatilgan">
              <button className="pn-link" onClick={() => setShowAll(true)}>
                Hammasi
              </button>
            </PanelHead>
            {grid(recent.map(getTemplate))}
            <PanelHead title="Siz uçun şablonlar" />
            {grid(TEMPLATES.filter((t) => !recent.includes(t.id)))}
          </>
        )}
      </div>
    </>
  )
}

/* ───────── Qalam AI ───────── */
const IDEAS = ['Özbekistonda turizm', 'Iqlim özgarişi', 'Kiberxavfsizlik asoslari', 'Amir Temur davri']

export function AiPanel({ onGenerate }) {
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(6)
  return (
    <div className="pn-scroll">
      <div className="ai-hero">
        <Wand2 size={18} />
        <div>
          <b>Mavzuni yozing — qolganini Qalam qiladi</b>
          <p>Taqdimot tuzilmasi va matni avtomatik yaratiladi. Dizayn joriy şablondan olinadi.</p>
        </div>
      </div>
      <textarea
        className="pn-textarea"
        rows={4}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Masalan: Özbekistonda yaşil energetikaning rivojlanişi"
      />
      <div className="pn-label">Ideyalar</div>
      <div className="pn-chips wrap">
        {IDEAS.map((i) => (
          <button key={i} className="pn-chip" onClick={() => setTopic(i)}>
            {i}
          </button>
        ))}
      </div>
      <div className="pn-label">Slaydlar soni</div>
      <div className="seg full">
        {[6, 10, 15].map((n) => (
          <button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>
            {n} ta
          </button>
        ))}
      </div>
      <button className="btn primary block" disabled={!topic.trim()} onClick={() => onGenerate(topic, count)}>
        <Wand2 size={15} /> Taqdimot yaratiş · <CoinPrice cost={COIN_COSTS.prezentatsiya.cost} size={14} />
      </button>
      <p className="pn-note">Demo rejim: matn namunaviy, AI backend hali ulanmagan.</p>
    </div>
  )
}

/* ───────── Matn ───────── */
const TEXT_PRESETS = [
  { text: 'Sarlavha qöşiş', size: 5, weight: 700, cls: 'big' },
  { text: 'Kiçik sarlavha qöşiş', size: 3, weight: 600, cls: 'mid' },
  { text: 'Oddiy matn qöşiş', size: 1.8, weight: 400, cls: 'small' },
]
const QUICK = ['Eʼtiboringiz uçun rahmat!', 'Savollar?', '1-bob', 'Xulosa', 'Manba: stat.uz']

/** One font pairing: its two fonts load when the card comes into view. */
function ComboCard({ combo, onAdd }) {
  const ref = useRef(null)
  const { head, sub } = combo
  useEffect(() => {
    const n = ref.current
    if (!n) return undefined
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      loadFonts([head.family, sub.family])
      io.disconnect()
    }, { rootMargin: '150px 0px' })
    io.observe(n)
    return () => io.disconnect()
  }, [head.family, sub.family])
  const style = (p) => ({
    fontFamily: fontCss(p.family),
    fontWeight: p.weight,
    fontStyle: p.italic ? 'italic' : 'normal',
    textTransform: p.upper ? 'uppercase' : 'none',
    letterSpacing: `${p.ls ?? 0}em`,
  })
  const h = t(`fp.c.h${combo.h}`)
  const s = t(`fp.c.s${combo.s}`)
  return (
    <button ref={ref} type="button" className="combo" onClick={() => onAdd(combo, h, s)} title={`${head.family} + ${sub.family}`}>
      <span className="combo-h" style={style(head)}>{h}</span>
      <span className="combo-s" style={style(sub)}>{s}</span>
    </button>
  )
}

/** A pairing → two centred text elements, the line under the heading. */
function comboEls({ head, sub }, h, s) {
  const el = (p, text, size, y) => ({
    kind: 'text',
    text,
    font: fontCss(p.family),
    weight: p.weight,
    size,
    align: 'center',
    x: 15,
    y,
    w: 70,
    ...(p.italic ? { italic: true } : {}),
    ...(p.upper ? { upper: true } : {}),
    ...(p.ls ? { ls: p.ls } : {}),
  })
  return [el(head, h, 5.2, 36), el(sub, s, 1.9, 54)]
}

export function TextPanel({ onAdd, onAddMany }) {
  return (
    <div className="pn-scroll">
      <div className="text-presets">
        {TEXT_PRESETS.map((p) => (
          <button key={p.cls} className={`text-preset ${p.cls}`} onClick={() => onAdd({ text: p.text.replace(' qöşiş', ''), size: p.size, weight: p.weight })}>
            {p.text}
          </button>
        ))}
      </div>
      <PanelHead title={t('fp.combos')} />
      <div className="combos">
        {COMBOS.map((c, i) => (
          <ComboCard key={i} combo={c} onAdd={(combo, h, s) => onAddMany(comboEls(combo, h, s))} />
        ))}
      </div>
      <PanelHead title="Tezkor matnlar" />
      <div className="pn-chips wrap">
        {QUICK.map((t) => (
          <button key={t} className="pn-chip" onClick={() => onAdd({ text: t, size: 2.6, weight: 600 })}>
            {t}
          </button>
        ))}
      </div>
      <p className="pn-note">Qöşilgan matnni tahrirlaş uçun ustiga ikki marta bosing.</p>
    </div>
  )
}

/* ───────── Brend ───────── */
export function BrandPanel({ accent, defaultAccent, onAccent }) {
  return (
    <div className="pn-scroll">
      <div className="pro-banner">
        <ProBadge size="md" label={false} />
        <div>
          <b>Brend töplami — Premium</b>
          <p>Bir marta coin sotib olganlarga oçiq: ranglar, logotip va şriftlaringizni saqlang. Demo rejimda ranglar oçiq.</p>
        </div>
      </div>
      <PanelHead title="Brend ranglari" />
      <div className="swatches">
        {BRAND_COLORS.map((c) => (
          <button key={c} className={`swatch ${accent === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onAccent(c)} aria-label={c} />
        ))}
      </div>
      <button className="pn-link" onClick={() => onAccent(null)}>
        Şablon rangiga qaytariş
        <span className="swatch xs" style={{ background: defaultAccent }} />
      </button>
    </div>
  )
}

/* ───────── Yuklash ───────── */
export function UploadsPanel({ uploads, onUpload, onAdd }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const take = (files) => [...files].filter((f) => f.type.startsWith('image/')).forEach(onUpload)
  return (
    <div className="pn-scroll">
      <button
        className={`dropzone ${drag ? 'drag' : ''}`}
        onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files) }}
      >
        <CloudUpload size={22} />
        <b>Rasm yuklaş</b>
        <span>PNG, JPG yoki SVG — bosing yoki şu yerga taşlang</span>
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      {uploads.length > 0 && (
        <>
          <PanelHead title="Yuklanganlar" />
          <div className="upl-grid">
            {uploads.map((u) => (
              <button key={u.id} className="upl" onClick={() => onAdd(u)}>
                <AssetImg src={u.src} alt={u.name} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ───────── Alifbo ───────── */
export function AlifboPanel({ onConvert }) {
  return (
    <div className="pn-scroll">
      <p className="pn-text">
        Butun taqdimotdagi matnlarni bir tugmada boşqa alifboga ötkazing. Har bir matn alifbosi avtomatik aniqlanadi.
      </p>
      <div className="alifbo-btns">
        {SCRIPTS.map((s) => (
          <button key={s.id} className="alifbo-btn" onClick={() => onConvert(s.id)}>
            <span className="alifbo-sample">{s.id === 'old' ? 'Oʻ gʻ sh ch' : s.id === 'new' ? 'Ö Ğ Ş Ç' : 'Ў Ғ Ш Ч'}</span>
            {s.label}
          </button>
        ))}
      </div>
      <p className="pn-note">Bekor qiliş uçun Ctrl/⌘ + Z.</p>
    </div>
  )
}

/* ───────── Loyihalar ───────── */
export function ProjectsPanel({ currentId, onOpen }) {
  const designs = useMemo(() => loadDesigns().filter((d) => d.id !== currentId), [currentId])
  return (
    <div className="pn-scroll">
      {designs.length === 0 && <p className="pn-empty">Boşqa loyiha yöq.</p>}
      <div className="proj-list">
        {designs.map((d) => (
          <button key={d.id} className="proj" onClick={() => onOpen(d.id)}>
            <span className="proj-thumb">
              <Slide slide={d.slides[0]} theme={deckTheme(d)} preview />
            </span>
            <span className="proj-meta">
              <b>{d.name}</b>
              <span>
                {d.kind} · {timeAgo(d.updatedAt)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ───────── Ilovalar ───────── */
export function AppsPanel({ onOpenApp }) {
  return (
    <div className="pn-scroll">
      <div className="app-rows">
        {APPS.filter((a) => a.id !== 'muharrir').map((a) => (
          <button key={a.id} className="app-row" onClick={() => onOpenApp(a.id)}>
            <AppTile app={a} size={32} />
            <span>
              <b>{a.name}</b>
              <span>{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
