// Right-hand inspector of the Link-in-Bio studio: every setting of the selected element.
import { useRef } from 'react'
import { ArrowUp, ArrowDown, Copy, Trash, EyeSlash, UploadSimple, X, Plus } from '@phosphor-icons/react'
import {
  AVATAR_SHAPES, BUTTON_ARROWS, BUTTON_FILLS, BUTTON_SHADOWS, BUTTON_SHAPES, DECO_KINDS, decoSvg, FONTS2, LINK_ICONS, PATTERNS, SOCIAL_STYLES, STYLE_DEFAULT, icon,
} from '../../shared/bio2.js'
import { Area, Field, Input, Seg, Toggle } from './controls.jsx'

/* ───────── small controls ───────── */

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i

export function ColorField({ label, value, onChange, allowNone = false }) {
  const v = value ?? 'transparent'
  const base = HEX.test(v) ? v.slice(0, 7) : '#000000'
  const alpha = HEX.test(v) && v.length === 9 ? parseInt(v.slice(7), 16) / 255 : v === 'transparent' ? 0 : 1
  const withAlpha = (hex, a) => (a >= 0.999 ? hex : `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`)
  return (
    <div className="bi-color">
      <span className="bi-label">{label}</span>
      <label className="bi-swatch" style={{ '--c': v }}>
        <input type="color" value={base} onChange={(e) => onChange(withAlpha(e.target.value, alpha || 1))} />
      </label>
      <input
        className="bi-hex"
        maxLength={11}
        onChange={(e) => {
          const t = e.target.value.trim()
          if (HEX.test(t) || t === 'transparent') onChange(t)
        }}
        key={v}
        defaultValue={v}
      />
      <input
        className="bi-alpha"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={alpha}
        title="Şaffoflik"
        onChange={(e) => onChange(Number(e.target.value) === 0 && allowNone ? 'transparent' : withAlpha(base, Number(e.target.value)))}
      />
    </div>
  )
}

export function Range({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <label className="bi-range">
      <span className="bi-label">
        {label} <b>{Math.round(value * 100) / 100}{unit}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function FontSelect({ label = 'Şrift', value, onChange, inherit }) {
  return (
    <Field label={label}>
      <select className="cs-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} style={{ fontFamily: FONTS2[value]?.css }}>
        {inherit && <option value="">{inherit}</option>}
        {Object.entries(FONTS2).map(([id, f]) => (
          <option key={id} value={id} style={{ fontFamily: f.css }}>
            {f.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function Chips({ value, options, onChange, render }) {
  return (
    <div className="bi-chips">
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? 'on' : ''} onClick={() => onChange(o)} title={o}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

const svg = (markup) => <span className="bi-ico" dangerouslySetInnerHTML={{ __html: markup }} />

function ImageField({ label, value, onChange, max = 1280, notify }) {
  const input = useRef(null)
  const pick = (file) => {
    if (!file) return
    if (!/^image\//.test(file.type)) return notify?.('Rasm faylini tanlang')
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height))
      const c = document.createElement('canvas')
      c.width = Math.round(im.width * k)
      c.height = Math.round(im.height * k)
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
      onChange(c.toDataURL('image/jpeg', 0.84))
      URL.revokeObjectURL(url)
    }
    im.onerror = () => notify?.('Rasmni oçib bölmadi')
    im.src = url
  }
  return (
    <div className="bi-img">
      <span className="bi-label">{label}</span>
      <div className="bi-img-row">
        <button type="button" className="bi-img-box" onClick={() => input.current?.click()}>
          {value ? <img src={value} alt="" /> : <UploadSimple size={20} />}
        </button>
        <div className="bi-img-actions">
          <button type="button" className="cs-btn" onClick={() => input.current?.click()}>
            {value ? 'Almaştiriş' : 'Yuklaş'}
          </button>
          {value && (
            <button type="button" className="cs-btn ghost danger" onClick={() => onChange(null)}>
              <X size={13} weight="bold" /> Öçiriş
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

const ALIGN = { left: 'Chap', center: 'Örta', right: 'Öng' }
const LABEL = {
  page: 'Sahifa', card: 'Karta', brand: 'Brend nomi', headline: 'Katta sarlavha', avatar: 'Rasm', name: 'Ism', role: 'Kasb', bio: 'Tavsif',
  socials: 'Ijtimoiy tarmoqlar', buttons: 'Tugmalar', stats: 'Raqamlar', cta: 'Obuna bloki', footer: 'Pastki yozuv',
}
const SHAPE_LABEL = { circle: 'Doira', oval: 'Oval', arch: 'Arka', rounded: 'Yumaloq', square: 'Kvadrat', wavy: 'Töl-qinli', blob: 'Dog‘', portrait: 'Portret', banner: 'Banner', window: 'Oyna', hidden: 'Yaşirin' }

/* ───────── inspector ───────── */

/**
 * @param {{ data, sel: string, setSel, patch: (fn) => void, notify }} p
 *   patch(fn) — fn(draft) mutates a deep copy of data
 */
export default function Inspector({ data, sel, setSel, patch, notify }) {
  const s = data.style
  const [kind, id] = sel.includes(':') ? sel.split(':') : [sel, null]
  const setStyle = (group, key, value) => patch((d) => (d.style[group] = { ...d.style[group], [key]: value }))
  const S = (group) => (key) => (value) => setStyle(group, key, value)
  const setData = (key) => (value) => patch((d) => (d[key] = value))

  // block order / visibility (for the content blocks of the page)
  const block = ['brand', 'headline', 'avatar', 'name', 'role', 'bio', 'socials', 'buttons', 'stats', 'cta'].includes(kind) ? kind : null
  const order = s.order
  const moveBlock = (dir) =>
    patch((d) => {
      const o = [...d.style.order]
      const i = o.indexOf(block)
      const j = i + dir
      if (i < 0 || j < 0 || j >= o.length) return
      ;[o[i], o[j]] = [o[j], o[i]]
      d.style.order = o
    })
  const hideBlock = () => {
    patch((d) => (d.style.order = d.style.order.filter((b) => b !== block)))
    setSel('page')
    notify?.(`«${LABEL[block]}» yaşirildi — «Element qöşiş» orqali qaytariş mumkin`)
  }

  const head = (title) => (
    <div className="bi-head">
      <b>{title}</b>
      {block && (
        <span className="bi-head-tools">
          <button type="button" onClick={() => moveBlock(-1)} disabled={order.indexOf(block) <= 0} title="Yuqoriga">
            <ArrowUp size={14} weight="bold" />
          </button>
          <button type="button" onClick={() => moveBlock(1)} disabled={order.indexOf(block) >= order.length - 1} title="Pastga">
            <ArrowDown size={14} weight="bold" />
          </button>
          <button type="button" onClick={hideBlock} title="Yaşiriş">
            <EyeSlash size={14} weight="bold" />
          </button>
        </span>
      )}
    </div>
  )

  const textBlock = (group, field, { area = false, max = 80, size = [10, 60], weight = false, italic = false, upper = false, font = false, extra = null } = {}) => {
    const g = s[group]
    const set = S(group)
    return (
      <>
        <Field label="Matn">{area ? <Area value={data[field]} onChange={(v) => setData(field)(v.slice(0, max))} rows={3} /> : <Input value={data[field]} onChange={(v) => setData(field)(v.slice(0, max))} />}</Field>
        <ColorField label="Rang" value={g.color} onChange={set('color')} />
        <Range label="Ölçam" value={g.size} min={size[0]} max={size[1]} onChange={set('size')} unit="px" />
        {font && <FontSelect value={g.font} onChange={set('font')} inherit="Sarlavha şrifti" />}
        {weight && <Range label="Qalinlik" value={g.weight} min={300} max={900} step={100} onChange={set('weight')} />}
        <Field label="Tekislaş">
          <Seg value={g.align} options={ALIGN} onChange={set('align')} small />
        </Field>
        <div className="bi-toggles">
          {italic && <Toggle label="Kursiv" checked={g.italic} onChange={set('italic')} />}
          {upper && <Toggle label="KATTA HARFLAR" checked={g.upper} onChange={set('upper')} />}
        </div>
        {extra}
      </>
    )
  }

  let body
  switch (kind) {
    case 'page': {
      const p = s.page
      const set = S('page')
      const c = s.card
      const sc = S('card')
      body = (
        <>
          {head('Sahifa foni')}
          <ColorField label="Fon rangi" value={p.bg} onChange={set('bg')} />
          <Toggle label="Gradient" checked={Boolean(p.bg2)} onChange={(on) => set('bg2')(on ? '#000000' : null)} />
          {p.bg2 && (
            <>
              <ColorField label="Ikkinçi rang" value={p.bg2} onChange={set('bg2')} />
              <Range label="Burçak" value={p.angle} min={0} max={360} onChange={set('angle')} unit="°" />
            </>
          )}
          <ImageField label="Fon rasmi" value={p.image} onChange={set('image')} notify={notify} />
          {p.image && <Range label="Rasm körinişi" value={p.imageOpacity} min={0} max={1} step={0.05} onChange={set('imageOpacity')} />}
          <ColorField label="Ustki qatlam" value={p.overlay} onChange={set('overlay')} />
          <Range label="Qatlam quyuqligi" value={p.overlayOpacity} min={0} max={0.9} step={0.05} onChange={set('overlayOpacity')} />
          <Field label="Naqş">
            <Chips value={p.pattern} options={PATTERNS} onChange={set('pattern')} />
          </Field>
          {p.pattern !== 'none' && <ColorField label="Naqş rangi" value={p.patternColor} onChange={set('patternColor')} />}
          <ColorField label="Sahifa ramkasi" value={p.frame} onChange={set('frame')} allowNone />
          <Range label="Ramka qalinligi" value={p.frameWidth} min={0} max={24} onChange={set('frameWidth')} unit="px" />
          <Range label="Yuqori boşliq" value={p.padTop} min={0} max={160} onChange={set('padTop')} unit="px" />
          <FontSelect label="Sarlavhalar şrifti" value={s.font.heading} onChange={(v) => setStyle('font', 'heading', v || 'inter')} />
          <FontSelect label="Matn şrifti" value={s.font.body} onChange={(v) => setStyle('font', 'body', v || 'inter')} />
          <div className="bi-sep">Karta (kontent orqasidagi panel)</div>
          <Toggle label="Karta" checked={c.on} onChange={sc('on')} />
          {c.on && (
            <>
              <ColorField label="Karta rangi" value={c.bg} onChange={sc('bg')} />
              <ColorField label="Çegara" value={c.border} onChange={sc('border')} allowNone />
              <Range label="Burçak radiusi" value={c.radius} min={0} max={60} onChange={sc('radius')} unit="px" />
              <Range label="Çetdan masofa" value={c.margin} min={0} max={60} onChange={sc('margin')} unit="px" />
              <div className="bi-toggles">
                <Toggle label="Arka shakli" checked={c.arch} onChange={sc('arch')} />
                <Toggle label="Soya" checked={c.shadow} onChange={sc('shadow')} />
              </div>
            </>
          )}
        </>
      )
      break
    }
    case 'card':
      body = <>{head('Karta')}<p className="bi-note">Karta sozlamalari «Sahifa» bölimida.</p></>
      break
    case 'brand':
      body = (
        <>
          {head(LABEL.brand)}
          {textBlock('brand', 'brand', { max: 40, size: [10, 60], upper: true, font: true })}
          <Toggle label="Menyu belgisi" checked={s.brand.menu} onChange={S('brand')('menu')} />
        </>
      )
      break
    case 'headline':
      body = (
        <>
          {head(LABEL.headline)}
          {textBlock('headline', 'headline', { area: true, max: 120, size: [16, 140], upper: true, italic: true, font: true })}
          <Range label="Qator orasi" value={s.headline.lineHeight} min={0.7} max={1.6} step={0.02} onChange={S('headline')('lineHeight')} />
          <ColorField label="Sarlavha foni" value={s.headline.bg} onChange={S('headline')('bg')} allowNone />
          <ColorField label="Sarlavha ramkasi" value={s.headline.border} onChange={S('headline')('border')} allowNone />
          <Range label="Rasm sarlavha ustiga" value={s.headline.overlap} min={0} max={200} onChange={S('headline')('overlap')} unit="px" />
        </>
      )
      break
    case 'avatar': {
      const a = s.avatar
      const set = S('avatar')
      body = (
        <>
          {head(LABEL.avatar)}
          <ImageField label="Rasm" value={data.avatar} onChange={setData('avatar')} max={720} notify={notify} />
          <Field label="Shakl">
            <Chips value={a.shape} options={AVATAR_SHAPES} onChange={set('shape')} render={(o) => SHAPE_LABEL[o] ?? o} />
          </Field>
          <Range label="Ölçam" value={a.size} min={48} max={360} onChange={set('size')} unit="px" />
          <ColorField label="Ramka" value={a.border} onChange={set('border')} allowNone />
          <Range label="Ramka qalinligi" value={a.borderWidth} min={0} max={12} onChange={set('borderWidth')} unit="px" />
          <ColorField label="Orqa doira" value={a.backdrop} onChange={set('backdrop')} allowNone />
          {a.backdrop !== 'transparent' && <Range label="Orqa doira ölçami" value={a.backdropSize} min={1} max={2.2} step={0.02} onChange={set('backdropSize')} />}
          <ColorField label="Rasm yöqligidagi fon" value={a.phBg} onChange={set('phBg')} />
          <Field label="Joylaşuv">
            <Seg value={a.align} options={ALIGN} onChange={set('align')} small />
          </Field>
          <Toggle label="Soya" checked={a.shadow} onChange={set('shadow')} />
          {a.shape === 'window' && (
            <>
              <Field label="Oyna sarlavhasi">
                <Input value={a.title} onChange={set('title')} maxLength={40} />
              </Field>
              <ColorField label="Sarlavha foni" value={a.titleBg} onChange={set('titleBg')} />
              <ColorField label="Sarlavha matni" value={a.titleColor} onChange={set('titleColor')} />
            </>
          )}
        </>
      )
      break
    }
    case 'name':
      body = (
        <>
          {head(LABEL.name)}
          {textBlock('name', 'name', { max: 60, size: [12, 90], weight: true, italic: true, upper: true, font: true })}
          <Toggle label="Tasdiq belgisi" checked={s.name.badge} onChange={S('name')('badge')} />
          {s.name.badge && <ColorField label="Belgi rangi" value={s.name.badgeColor} onChange={S('name')('badgeColor')} />}
        </>
      )
      break
    case 'role':
      body = (
        <>
          {head(LABEL.role)}
          {textBlock('role', 'role', { max: 80, size: [9, 40], weight: true, upper: true })}
          <Range label="Harf orasi" value={s.role.spacing} min={0} max={0.6} step={0.02} onChange={S('role')('spacing')} unit="em" />
        </>
      )
      break
    case 'bio':
      body = <>{head(LABEL.bio)}{textBlock('bio', 'bio', { area: true, max: 300, size: [10, 30] })}</>
      break
    case 'socials': {
      const so = s.socials
      const set = S('socials')
      body = (
        <>
          {head(LABEL.socials)}
          <p className="bi-note">Manzillarni chap paneldagi «Ijtimoiy tarmoqlar» bölimida yozing.</p>
          <Field label="Uslub">
            <Chips value={so.style} options={SOCIAL_STYLES} onChange={set('style')} render={(o) => ({ plain: 'Oddiy', circle: 'Doira', square: 'Kvadrat', outline: 'Çiziqli' })[o]} />
          </Field>
          <ColorField label="Ikonka rangi" value={so.color} onChange={set('color')} />
          {(so.style === 'circle' || so.style === 'square') && <ColorField label="Fon" value={so.bg} onChange={set('bg')} />}
          <Range label="Ölçam" value={so.size} min={24} max={64} onChange={set('size')} unit="px" />
          <Field label="Tekislaş">
            <Seg value={so.align} options={ALIGN} onChange={set('align')} small />
          </Field>
        </>
      )
      break
    }
    case 'buttons': {
      const b = s.buttons
      const set = S('buttons')
      body = (
        <>
          {head(LABEL.buttons)}
          <Field label="Shakl">
            <Chips value={b.shape} options={BUTTON_SHAPES} onChange={set('shape')} render={(o) => ({ pill: 'Kapsula', rounded: 'Yumaloq', square: 'Tögri' })[o]} />
          </Field>
          <Field label="Töldiriş">
            <Chips value={b.fill} options={BUTTON_FILLS} onChange={set('fill')} render={(o) => ({ solid: 'Töla', outline: 'Çiziqli', soft: 'Yumşoq', glass: 'Şişa' })[o]} />
          </Field>
          <ColorField label="Asosiy rang" value={b.bg} onChange={set('bg')} />
          <Toggle label="Navbatma-navbat ikkinçi rang" checked={Boolean(b.bg2)} onChange={(on) => set('bg2')(on ? '#ffffff' : null)} />
          {b.bg2 && <ColorField label="Ikkinçi rang" value={b.bg2} onChange={set('bg2')} />}
          <ColorField label="Matn rangi" value={b.color} onChange={set('color')} />
          <ColorField label="Çegara" value={b.border} onChange={set('border')} allowNone />
          <Range label="Çegara qalinligi" value={b.borderWidth} min={0} max={6} onChange={set('borderWidth')} unit="px" />
          <Field label="Soya">
            <Chips value={b.shadow} options={BUTTON_SHADOWS} onChange={set('shadow')} render={(o) => ({ none: 'Yöq', soft: 'Yumşoq', hard: 'Qattiq', glow: 'Nur' })[o]} />
          </Field>
          {b.shadow !== 'none' && <ColorField label="Soya rangi" value={b.shadowColor} onChange={set('shadowColor')} />}
          <Range label="Balandlik" value={b.height} min={36} max={110} onChange={set('height')} unit="px" />
          <Range label="Kenglik" value={b.width} min={50} max={100} onChange={set('width')} unit="%" />
          <Range label="Oraliq" value={b.gap} min={4} max={30} onChange={set('gap')} unit="px" />
          <Range label="Matn ölçami" value={b.size} min={11} max={26} step={0.5} onChange={set('size')} unit="px" />
          <Range label="Qalinlik" value={b.weight} min={300} max={900} step={100} onChange={set('weight')} />
          <FontSelect value={b.font} onChange={set('font')} inherit="Matn şrifti" />
          <Field label="Matn joylaşuvi">
            <Seg value={b.align} options={ALIGN} onChange={set('align')} small />
          </Field>
          <Field label="Ustunlar">
            <Seg value={String(b.columns)} options={{ 1: '1 ta', 2: '2 ta' }} onChange={(v) => set('columns')(Number(v))} small />
          </Field>
          <Field label="Strelka">
            <Chips value={b.arrow} options={BUTTON_ARROWS} onChange={set('arrow')} render={(o) => ({ none: 'Yöq', arrow: '↗', caret: '›', circle: '→ doira' })[o]} />
          </Field>
          <div className="bi-toggles">
            <Toggle label="Ikonkalar" checked={b.icon} onChange={set('icon')} />
            <Toggle label="Raqamlar (01, 02…)" checked={b.numbered} onChange={set('numbered')} />
            <Toggle label="KATTA HARFLAR" checked={b.upper} onChange={set('upper')} />
          </div>
          {b.icon && <ColorField label="Ikonka foni" value={b.iconBg} onChange={set('iconBg')} allowNone />}
          {b.icon && <Toggle label="Tarmoq ranglari (WhatsApp, Instagram…)" checked={b.iconBrand} onChange={set('iconBrand')} />}
          <p className="bi-note">Bitta tugmani tahrirlaş uçun telefondagi tugmaning özini bosing.</p>
        </>
      )
      break
    }
    case 'link': {
      const i = data.links.findIndex((l) => l.id === id)
      const l = data.links[i]
      if (!l) {
        body = null
        break
      }
      const setL = (key) => (value) => patch((d) => (d.links[i] = { ...d.links[i], [key]: value }))
      body = (
        <>
          <div className="bi-head">
            <b>Tugma</b>
            <span className="bi-head-tools">
              <button type="button" disabled={i === 0} onClick={() => patch((d) => ([d.links[i - 1], d.links[i]] = [d.links[i], d.links[i - 1]]))} title="Yuqoriga">
                <ArrowUp size={14} weight="bold" />
              </button>
              <button type="button" disabled={i === data.links.length - 1} onClick={() => patch((d) => ([d.links[i + 1], d.links[i]] = [d.links[i], d.links[i + 1]]))} title="Pastga">
                <ArrowDown size={14} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => {
                  patch((d) => d.links.splice(i, 1))
                  setSel('buttons')
                }}
                title="Öçiriş"
              >
                <Trash size={14} weight="bold" />
              </button>
            </span>
          </div>
          <Field label="Matn">
            <Input value={l.title} onChange={setL('title')} maxLength={80} />
          </Field>
          <Field label="Izoh qatori (ixtiyoriy)">
            <Input value={l.sub ?? ''} onChange={setL('sub')} maxLength={80} />
          </Field>
          <Field label="Havola">
            <Input value={l.url} onChange={setL('url')} maxLength={500} placeholder="https://… yoki t.me/…" />
          </Field>
          <Field label="Ikonka">
            <div className="bi-icons">
              <button type="button" className={!l.icon ? 'on' : ''} onClick={() => setL('icon')(null)} title="Yöq">
                <X size={14} />
              </button>
              {LINK_ICONS.map((k) => (
                <button key={k} type="button" className={l.icon === k ? 'on' : ''} onClick={() => setL('icon')(k)} title={k}>
                  {svg(icon(k === 'globe' ? 'website' : k, 18))}
                </button>
              ))}
            </div>
          </Field>
          <ColorField label="Özining rangi" value={l.bg ?? 'transparent'} onChange={(v) => setL('bg')(v === 'transparent' ? null : v)} allowNone />
          <ColorField label="Özining matn rangi" value={l.color ?? 'transparent'} onChange={(v) => setL('color')(v === 'transparent' ? null : v)} allowNone />
          <div className="bi-toggles">
            <Toggle label="Ajratib körsatiş" checked={l.highlight} onChange={setL('highlight')} />
            <Toggle label="Körinadi" checked={l.enabled !== false} onChange={setL('enabled')} />
          </div>
        </>
      )
      break
    }
    case 'stats': {
      const set = S('stats')
      body = (
        <>
          {head(LABEL.stats)}
          {data.stats.map((x, i) => (
            <div key={x.id} className="bi-stat">
              <Input value={x.value} onChange={(v) => patch((d) => (d.stats[i] = { ...d.stats[i], value: v.slice(0, 16) }))} placeholder="500+" />
              <Input value={x.label} onChange={(v) => patch((d) => (d.stats[i] = { ...d.stats[i], label: v.slice(0, 30) }))} placeholder="Mijozlar" />
              <button type="button" className="cs-mini danger" onClick={() => patch((d) => d.stats.splice(i, 1))} aria-label="Öçiriş">
                <Trash size={13} weight="bold" />
              </button>
            </div>
          ))}
          {data.stats.length < 4 && (
            <button type="button" className="cs-add" onClick={() => patch((d) => d.stats.push({ id: Math.random().toString(36).slice(2, 10), value: '100+', label: 'Yangi' }))}>
              <Plus size={14} weight="bold" /> Raqam qöşiş
            </button>
          )}
          <ColorField label="Fon" value={s.stats.bg} onChange={set('bg')} allowNone />
          <ColorField label="Raqam rangi" value={s.stats.color} onChange={set('color')} />
          <ColorField label="Izoh rangi" value={s.stats.muted} onChange={set('muted')} />
          <ColorField label="Çegara" value={s.stats.border} onChange={set('border')} allowNone />
        </>
      )
      break
    }
    case 'cta': {
      const set = S('cta')
      const c = data.cta ?? {}
      const setC = (key) => (value) => patch((d) => (d.cta = { ...(d.cta ?? {}), [key]: value }))
      body = (
        <>
          {head(LABEL.cta)}
          <Field label="Sarlavha">
            <Input value={c.title} onChange={setC('title')} maxLength={60} />
          </Field>
          <Field label="Matn">
            <Input value={c.text ?? ''} onChange={setC('text')} maxLength={120} />
          </Field>
          <Field label="Tugma">
            <Input value={c.button ?? ''} onChange={setC('button')} maxLength={30} />
          </Field>
          <Field label="Tugma havolasi">
            <Input value={c.url ?? ''} onChange={setC('url')} maxLength={500} />
          </Field>
          <Toggle label="Kiritiş maydoni" checked={s.cta.input} onChange={set('input')} />
          <ColorField label="Fon" value={s.cta.bg} onChange={set('bg')} allowNone />
          <ColorField label="Matn" value={s.cta.color} onChange={set('color')} />
          <ColorField label="Tugma foni" value={s.cta.btnBg} onChange={set('btnBg')} />
          <ColorField label="Tugma matni" value={s.cta.btnColor} onChange={set('btnColor')} />
        </>
      )
      break
    }
    case 'footer':
      body = (
        <>
          <div className="bi-head">
            <b>{LABEL.footer}</b>
          </div>
          <Field label="Matn">
            <Input value={data.footer} onChange={(v) => setData('footer')(v.slice(0, 120))} />
          </Field>
          <ColorField label="Rang" value={s.footer.color} onChange={S('footer')('color')} />
        </>
      )
      break
    case 'deco': {
      const i = s.deco.findIndex((x) => x.id === id)
      const x = s.deco[i]
      if (!x) {
        body = null
        break
      }
      const setD = (key) => (value) => patch((d) => (d.style.deco[i] = { ...d.style.deco[i], [key]: value }))
      body = (
        <>
          <div className="bi-head">
            <b>Bezak</b>
            <span className="bi-head-tools">
              <button
                type="button"
                title="Nusxa"
                onClick={() => {
                  const copy = { ...x, id: Math.random().toString(36).slice(2, 10), x: Math.min(95, x.x + 6), y: Math.min(95, x.y + 4) }
                  patch((d) => d.style.deco.push(copy))
                  setSel(`deco:${copy.id}`)
                }}
              >
                <Copy size={14} weight="bold" />
              </button>
              <button
                type="button"
                title="Öçiriş"
                onClick={() => {
                  patch((d) => d.style.deco.splice(i, 1))
                  setSel('page')
                }}
              >
                <Trash size={14} weight="bold" />
              </button>
            </span>
          </div>
          <p className="bi-note">Telefonda bezakni sichqonça bilan surib joylaştiring.</p>
          <Field label="Shakl">
            <Chips value={x.kind} options={DECO_KINDS} onChange={setD('kind')} />
          </Field>
          <ColorField label="Rang" value={x.color} onChange={setD('color')} />
          <ColorField label="Ikkinçi rang" value={x.color2} onChange={setD('color2')} />
          <Range label="Ölçam" value={x.size} min={2} max={120} onChange={setD('size')} unit="%" />
          <Range label="Burilish" value={x.rotate} min={-180} max={180} onChange={setD('rotate')} unit="°" />
          <Range label="Körinish" value={x.opacity} min={0} max={1} step={0.05} onChange={setD('opacity')} />
          <Field label="Qatlam">
            <Seg value={x.layer === 'front' ? 'front' : 'back'} options={{ back: 'Kontent orqasida', front: 'Kontent oldida' }} onChange={setD('layer')} small />
          </Field>
        </>
      )
      break
    }
    default:
      body = null
  }

  return <div className="bi">{body ?? <p className="bi-note">Telefondagi istalgan elementni bosing — uning barça sozlamalari şu yerda çiqadi.</p>}</div>
}

/* ───────── "add element" menu ───────── */

export function AddMenu({ data, patch, setSel, onClose }) {
  const hidden = STYLE_DEFAULT.order.filter((b) => b !== 'footer' && !data.style.order.includes(b))
  const addBlock = (b) => {
    patch((d) => {
      d.style.order = [...d.style.order, b]
      if (b === 'headline' && !d.headline) d.headline = 'Sarlavha'
      if (b === 'role' && !d.role) d.role = 'Kasbingiz'
      if (b === 'brand' && !d.brand) d.brand = 'Brend'
      if (b === 'bio' && !d.bio) d.bio = 'Özingiz haqingizda qisqaça'
      if (b === 'stats' && !d.stats.length) d.stats = [{ id: 's1', value: '500+', label: 'Mijozlar' }, { id: 's2', value: '98%', label: 'Mamnun' }, { id: 's3', value: '5', label: 'Yil tajriba' }]
      if (b === 'cta' && !d.cta) d.cta = { title: 'Yangiliklarga obuna', text: 'Haftalik maslahatlar', button: 'Obuna', url: '' }
    })
    setSel(b)
    onClose()
  }
  const addText = (b) => {
    patch((d) => {
      if (!d.style.order.includes(b)) d.style.order = [...d.style.order, b]
      if (b === 'headline' && !d.headline) d.headline = 'Sarlavha'
      if (b === 'role' && !d.role) d.role = 'Kasbingiz'
      if (b === 'brand' && !d.brand) d.brand = 'Brend'
      if (b === 'bio' && !d.bio) d.bio = 'Özingiz haqingizda qisqaça'
    })
    setSel(b)
    onClose()
  }
  const addDeco = (kind) => {
    const deco = { id: Math.random().toString(36).slice(2, 10), kind, x: 50, y: 30, size: 16, rotate: 0, opacity: 1, layer: 'front', color: '#f472b6', color2: '#ffffff' }
    patch((d) => d.style.deco.push(deco))
    setSel(`deco:${deco.id}`)
    onClose()
  }
  const addLink = () => {
    const l = { id: Math.random().toString(36).slice(2, 10), title: 'Yangi tugma', url: '', enabled: true, highlight: false }
    patch((d) => {
      d.links.push(l)
      if (!d.style.order.includes('buttons')) d.style.order = [...d.style.order, 'buttons']
    })
    setSel(`link:${l.id}`)
    onClose()
  }
  const textBlocks = ['headline', 'brand', 'role', 'bio'].filter((b) => !data.style.order.includes(b) || !data[b])
  return (
    <div className="bi-add">
      <div className="bi-sep">Bloklar</div>
      <div className="bi-add-row">
        <button type="button" onClick={addLink}>
          <Plus size={13} weight="bold" /> Tugma
        </button>
        {[...new Set([...hidden, ...textBlocks])].map((b) => (
          <button key={b} type="button" onClick={() => (['headline', 'brand', 'role', 'bio'].includes(b) ? addText(b) : addBlock(b))}>
            <Plus size={13} weight="bold" /> {LABEL[b]}
          </button>
        ))}
      </div>
      <div className="bi-sep">Bezaklar</div>
      <div className="bi-add-decos">
        {DECO_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => addDeco(k)} title={k} dangerouslySetInnerHTML={{ __html: decoPreview(k) }} />
        ))}
      </div>
    </div>
  )
}

const decoPreview = (k) => decoSvg(k, '#f472b6', '#7c3aed')
