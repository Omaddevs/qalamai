import { useMemo, useRef, useState } from 'react'
import { Sparkle, TextAa, Shapes, Palette, DownloadSimple, CaretDown, ArrowsClockwise, CheckCircle } from '@phosphor-icons/react'
import { Dropdown } from '../components/ui.jsx'
import LogoArt from './LogoArt.jsx'
import { Field, Input, Panel, Seg, Swatches, Toggle } from './controls.jsx'
import { ICONS, INDUSTRIES, LAYOUTS, LOGO_FONTS, PALETTES, SHAPES, generateConcepts, initialsOf, inverted, logoPng, logoSvgString, paletteOf, saveBlob } from './logo.js'

const fileBase = (m) => (m.name || 'logo').replace(/[\\/:*?"<>|]/g, '').trim() || 'logo'

export function LogoExport({ model, notify }) {
  const art = useRef(null)
  const darkArt = useRef(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn) => {
    setBusy(true)
    try {
      await fn()
    } catch {
      notify('Eksport qilib bölmadi — internet aloqasini tekşiring (şriftlar yuklanadi)')
    } finally {
      setBusy(false)
    }
  }
  const items = [
    ['PNG — şaffof fon', 'Saytlar va dizayn uçun', () => logoSvgString(art.current, model, { background: false }).then(logoPng).then((b) => saveBlob(b, `${fileBase(model)}.png`))],
    ['PNG — fon bilan', 'Ijtimoiy tarmoqlar uçun', () => logoSvgString(art.current, model, { background: true }).then(logoPng).then((b) => saveBlob(b, `${fileBase(model)}-fon.png`))],
    ['PNG — qora fonda', 'Qoronği sahifalar uçun', () => logoSvgString(darkArt.current, inverted(model), { background: true }).then(logoPng).then((b) => saveBlob(b, `${fileBase(model)}-qora.png`))],
    ['SVG — vektor', 'Çop etiş, istalgan ölçam', () => logoSvgString(art.current, model, { background: false }).then((s) => saveBlob(new Blob([s], { type: 'image/svg+xml' }), `${fileBase(model)}.svg`))],
  ]
  return (
    <>
      <Dropdown
        align="right"
        button={({ toggle }) => (
          <button className="cs-btn dark" onClick={toggle} disabled={busy}>
            {busy ? <ArrowsClockwise size={16} className="spin" /> : <DownloadSimple size={16} weight="bold" />} Yuklab oliş <CaretDown size={12} />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="pop-label">Format</div>
            {items.map(([label, hint, fn]) => (
              <button key={label} className="menu-item col" onClick={() => { close(); run(fn) }}>
                <b>{label}</b>
                <span className="menu-hint">{hint}</span>
              </button>
            ))}
          </>
        )}
      </Dropdown>
      {/* hidden full-size renders used for export */}
      <div className="cs-offscreen" aria-hidden="true">
        <LogoArt model={model} svgRef={art} />
        <LogoArt model={inverted(model)} svgRef={darkArt} />
      </div>
    </>
  )
}

function Mockups({ m }) {
  const p = paletteOf(m)
  return (
    <div className="lg-mocks">
      <figure className="lg-mock card">
        <div className="lg-card front" style={{ background: p.bg }}>
          <LogoArt model={m} background={false} />
        </div>
        <div className="lg-card back" style={{ background: p.primary === '#ffffff' ? p.text : p.primary }}>
          <b>{m.name}</b>
          <span>+998 90 123 45 67 · info@{(m.name || 'brend').toLowerCase().replace(/[^a-z0-9]+/g, '')}.uz</span>
        </div>
        <figcaption>Vizitka</figcaption>
      </figure>
      <figure className="lg-mock phone">
        <div className="lg-phone">
          <div className="lg-app" style={{ background: m.shape === 'none' ? p.bg : p.primary }}>
            {m.layout === 'monogram' || m.layout === 'wordmark' ? (
              <span style={{ color: m.shape === 'none' ? p.primary : '#fff', fontFamily: LOGO_FONTS[m.font]?.css, fontWeight: LOGO_FONTS[m.font]?.weight }}>{initialsOf(m.name)}</span>
            ) : (
              (() => {
                const Icon = ICONS[m.icon] ?? ICONS.Star
                return <Icon size={40} weight={m.iconWeight} color={m.shape === 'none' ? p.primary : '#fff'} />
              })()
            )}
          </div>
          <small>{m.name}</small>
        </div>
        <figcaption>Ilova ikonkasi</figcaption>
      </figure>
      <figure className="lg-mock dark">
        <div className="lg-dark" style={{ background: inverted(m).colors?.bg ?? p.bg }}>
          <LogoArt model={inverted(m)} background={false} />
        </div>
        <figcaption>Qoronği fonda</figcaption>
      </figure>
    </div>
  )
}

/** Logo editor parts: { left: panel, stage: canvas } — called as a hook by CreatorStudio. */
export default function useLogoStudio({ data: m, setData, notify }) {
  const [concepts, setConcepts] = useState(null)
  const [brief, setBrief] = useState({ name: m.name, tagline: m.tagline, industry: m.industry })
  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const iconSet = useMemo(() => Object.keys(INDUSTRIES[m.industry]?.icons ?? {}), [m.industry])
  const p = paletteOf(m)

  const generate = () => {
    if (!brief.name.trim()) return notify('Brend nomini yozing')
    setConcepts(generateConcepts({ ...brief, name: brief.name.trim() }))
  }

  const left = (
    <>
      <Panel title="AI konsepsiyalar" icon={Sparkle} open>
        <Field label="Brend nomi">
          <Input value={brief.name} onChange={(v) => setBrief((b) => ({ ...b, name: v }))} maxLength={40} placeholder="Masalan: Bahor Café" />
        </Field>
        <Field label="Şior (ixtiyoriy)">
          <Input value={brief.tagline} onChange={(v) => setBrief((b) => ({ ...b, tagline: v }))} maxLength={40} placeholder="Masalan: Toşkent · 2026" />
        </Field>
        <Field label="Soha">
          <div className="cs-chips">
            {Object.entries(INDUSTRIES).map(([id, ind]) => (
              <button key={id} type="button" className={brief.industry === id ? 'on' : ''} onClick={() => setBrief((b) => ({ ...b, industry: id }))}>
                {ind.label}
              </button>
            ))}
          </div>
        </Field>
        <button className="cs-btn dark block lg" onClick={generate}>
          <Sparkle size={16} weight="fill" className="gold" /> 12 ta konsepsiya yaratiş
        </button>
      </Panel>

      <Panel title="Matn" icon={TextAa} open={!concepts}>
        <Field label="Nomi">
          <Input value={m.name} onChange={(v) => set({ name: v })} maxLength={40} />
        </Field>
        <Field label="Şior">
          <Input value={m.tagline} onChange={(v) => set({ tagline: v })} maxLength={40} />
        </Field>
        <Field label="Şrift">
          <div className="lg-fonts">
            {Object.entries(LOGO_FONTS).map(([id, f]) => (
              <button key={id} type="button" className={m.font === id ? 'on' : ''} onClick={() => set({ font: id })} style={{ fontFamily: f.css, fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal' }}>
                {f.upper ? 'AA' : 'Aa'}
                <small>{f.label}</small>
              </button>
            ))}
          </div>
        </Field>
        <Toggle label="Boş harflar bilan" checked={m.upper} onChange={(v) => set({ upper: v })} />
        <Field label={`Harf oraliği: ${m.spacing}`}>
          <input className="cs-range" type="range" min={-2} max={8} step={1} value={m.spacing} onChange={(e) => set({ spacing: Number(e.target.value) })} />
        </Field>
      </Panel>

      <Panel title="Belgi" icon={Shapes}>
        <Field label="Kompozitsiya">
          <Seg value={m.layout} options={LAYOUTS} onChange={(v) => set({ layout: v })} small />
        </Field>
        <Field label="Şakl">
          <Seg value={m.shape} options={SHAPES} onChange={(v) => set({ shape: v })} small />
        </Field>
        <Field label="Ikonka">
          <select className="cs-input" value={m.industry} onChange={(e) => set({ industry: e.target.value })}>
            {Object.entries(INDUSTRIES).map(([id, ind]) => (
              <option key={id} value={id}>
                {ind.label}
              </option>
            ))}
          </select>
          <div className="lg-icons">
            {iconSet.map((name) => {
              const Icon = ICONS[name]
              return (
                <button key={name} type="button" className={m.icon === name ? 'on' : ''} onClick={() => set({ icon: name })} title={name}>
                  <Icon size={22} weight={m.iconWeight} />
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Ikonka uslubi">
          <Seg value={m.iconWeight} options={{ fill: 'Töla', duotone: 'Ikki rang', bold: 'Çiziqli' }} onChange={(v) => set({ iconWeight: v })} small />
        </Field>
      </Panel>

      <Panel title="Ranglar" icon={Palette}>
        <div className="lg-palettes">
          {PALETTES.map((pal) => (
            <button key={pal.id} type="button" className={!m.colors && m.palette === pal.id ? 'on' : ''} onClick={() => set({ palette: pal.id, colors: null })} title={pal.id} style={{ background: pal.bg }}>
              <i style={{ background: pal.primary }} />
              <i style={{ background: pal.secondary }} />
              <i style={{ background: pal.text }} />
            </button>
          ))}
        </div>
        {[
          ['primary', 'Asosiy rang'],
          ['text', 'Nom rangi'],
          ['secondary', 'Şior rangi'],
          ['bg', 'Fon'],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <Swatches value={p[k]} colors={[]} onChange={(c) => set({ colors: { ...p, [k]: c } })} />
          </Field>
        ))}
      </Panel>
    </>
  )

  const stage = concepts ? (
    <div className="lg-concepts">
      <div className="cs-stage-head">
        <div>
          <h3>«{brief.name}» uçun 12 ta konsepsiya</h3>
          <p>Yoqqanini tanlang — keyin rang, şrift va belgini bemalol özgartirasiz.</p>
        </div>
        <button className="cs-btn" onClick={() => setConcepts(null)}>
          Tanlangan logoga qaytiş
        </button>
      </div>
      <div className="lg-grid">
        {concepts.map((c, i) => (
          <button
            key={i}
            className="lg-concept"
            style={{ background: paletteOf(c).bg, '--i': i }}
            onClick={() => {
              setData(() => ({ ...c }))
              setConcepts(null)
              notify('Konsepsiya tanlandi — endi uni sozlang')
            }}
          >
            <LogoArt model={c} background={false} />
            <span className="lg-pick">
              <CheckCircle size={15} weight="fill" /> Tanlaş
            </span>
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="lg-preview">
      <div className="lg-hero" style={{ background: p.bg }}>
        <LogoArt model={m} background={false} />
      </div>
      <Mockups m={m} />
    </div>
  )

  return { left, stage }
}

