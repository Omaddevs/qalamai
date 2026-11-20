// Small form controls shared by the logo, link-in-bio and resume studios.
import { useRef, useState } from 'react'
import { CaretDown, Plus, Trash, ArrowUp, ArrowDown, UploadSimple, X } from '@phosphor-icons/react'

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`cs-field ${wide ? 'wide' : ''}`}>
      {label && <span className="cs-label">{label}</span>}
      {children}
      {hint && <small className="cs-hint">{hint}</small>}
    </label>
  )
}

export function Input({ value, onChange, ...rest }) {
  return <input className="cs-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function Area({ value, onChange, rows = 3, ...rest }) {
  return <textarea className="cs-input area" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function Seg({ value, options, onChange, small }) {
  return (
    <div className={`cs-seg ${small ? 'small' : ''}`} role="radiogroup">
      {Object.entries(options).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="cs-toggle">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

export function Swatches({ value, colors, onChange, custom = true }) {
  return (
    <div className="cs-swatches">
      {colors.map((c) => (
        <button key={c} type="button" className={`cs-swatch ${value?.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
      ))}
      {custom && (
        <label className="cs-swatch custom" title="Boşqa rang" style={{ '--c': value }}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        </label>
      )}
    </div>
  )
}

/** Collapsible panel section. */
export function Panel({ title, icon: Icon, children, open: initial = false, extra }) {
  const [open, setOpen] = useState(initial)
  return (
    <section className={`cs-panel ${open ? 'open' : ''}`}>
      <button type="button" className="cs-panel-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {Icon && <Icon size={18} weight="duotone" />}
        <b>{title}</b>
        {extra}
        <CaretDown size={14} weight="bold" className="cs-caret" />
      </button>
      {open && <div className="cs-panel-body">{children}</div>}
    </section>
  )
}

/** Pick an image and downscale it into a data URL. */
export function ImagePick({ value, onChange, size = 400, shape = 'circle', label = 'Rasm yuklaş', notify }) {
  const input = useRef(null)
  const pick = (file) => {
    if (!file) return
    if (!/^image\//.test(file.type)) return notify?.('Rasm faylini tanlang')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // centre-crop to a square, then scale down
      const s = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = Math.min(size, s)
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height)
      onChange(c.toDataURL('image/jpeg', 0.86))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => notify?.('Rasmni oçib bölmadi')
    img.src = url
  }
  return (
    <div className="cs-pick">
      <button type="button" className={`cs-pick-img ${shape}`} onClick={() => input.current?.click()}>
        {value ? <img src={value} alt="" /> : <UploadSimple size={22} />}
      </button>
      <div className="cs-pick-actions">
        <button type="button" className="cs-btn" onClick={() => input.current?.click()}>
          {label}
        </button>
        {value && (
          <button type="button" className="cs-btn ghost" onClick={() => onChange(null)}>
            <X size={13} weight="bold" /> Olib taşlaş
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

/** Editable list of records (experience, education, links …). */
export function Repeater({ items, onChange, make, addLabel, render, titleOf, max = 30 }) {
  const [openId, setOpenId] = useState(null)
  const set = (id, patch) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const copy = [...items]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy)
  }
  return (
    <div className="cs-rep">
      {items.map((it, i) => (
        <div key={it.id} className={`cs-rep-item ${openId === it.id ? 'open' : ''}`}>
          <div className="cs-rep-head">
            <button type="button" className="cs-rep-title" onClick={() => setOpenId(openId === it.id ? null : it.id)}>
              <b>{titleOf(it) || 'Yangi yozuv'}</b>
              <CaretDown size={12} weight="bold" />
            </button>
            <button type="button" className="cs-mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga">
              <ArrowUp size={13} weight="bold" />
            </button>
            <button type="button" className="cs-mini" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Pastga">
              <ArrowDown size={13} weight="bold" />
            </button>
            <button type="button" className="cs-mini danger" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label="Öçiriş">
              <Trash size={13} weight="bold" />
            </button>
          </div>
          {openId === it.id && <div className="cs-rep-body">{render(it, (patch) => set(it.id, patch))}</div>}
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          className="cs-add"
          onClick={() => {
            const it = make()
            onChange([...items, it])
            setOpenId(it.id)
          }}
        >
          <Plus size={15} weight="bold" /> {addLabel}
        </button>
      )}
    </div>
  )
}
