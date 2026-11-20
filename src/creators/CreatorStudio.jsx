// Full-screen studio for kit designs (logo, link in bio, resume). Autosaves into the
// same design store as slide decks, so the work also shows up in Loyihalar.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle, CircleNotch, PenNib, LinkSimple, IdentificationCard } from '@phosphor-icons/react'
import { KIT_TYPES, kitName } from './kits.js'
import useLogoStudio, { LogoExport } from './LogoStudio.jsx'
import useBioStudio from './BioStudio.jsx'
import useCvStudio, { CvExport } from './CvStudio.jsx'
import './creators.css'

const ICON = { logo: PenNib, bio: LinkSimple, cv: IdentificationCard }
const HOOK = { logo: useLogoStudio, bio: useBioStudio, cv: useCvStudio }

export default function CreatorStudio({ design, onBack, onSave, notify }) {
  const [d, setD] = useState(design)
  const [saved, setSaved] = useState(true)
  const timer = useRef(null)
  const latest = useRef(design)

  const persist = useCallback(
    (next) => {
      latest.current = next
      setSaved(false)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        onSave(latest.current)
        setSaved(true)
      }, 500)
    },
    [onSave],
  )
  // flush on leave
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      onSave(latest.current)
    },
    [onSave],
  )

  const setData = useCallback(
    (fn) =>
      setD((prev) => {
        const data = typeof fn === 'function' ? fn(prev.data) : fn
        // keep the name in step with the content until the user renames it
        const name = prev.autoName === false ? prev.name : kitName(prev.type, data)
        const next = { ...prev, data, name, updatedAt: Date.now() }
        persist(next)
        return next
      }),
    [persist],
  )
  const rename = (name) =>
    setD((prev) => {
      const next = { ...prev, name, autoName: false, updatedAt: Date.now() }
      persist(next)
      return next
    })

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !e.target.closest?.('input,textarea,select') && onBack()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])

  const { left, stage } = HOOK[d.type]({ design: d, data: d.data, setData, notify })
  const Icon = ICON[d.type]

  return (
    <div className={`cs cs-${d.type}`}>
      <header className="cs-top">
        <button className="cs-btn ghost" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" /> Orqaga
        </button>
        <span className={`cs-kind k-${d.type}`}>
          <Icon size={15} weight="duotone" /> {KIT_TYPES[d.type].label}
        </span>
        <input className="cs-name" value={d.name} onChange={(e) => rename(e.target.value)} onBlur={(e) => !e.target.value.trim() && rename(kitName(d.type, d.data))} aria-label="Nomi" />
        <span className={`cs-saved ${saved ? 'ok' : ''}`}>
          {saved ? <CheckCircle size={14} weight="fill" /> : <CircleNotch size={14} className="spin" />} {saved ? 'Saqlandi' : 'Saqlanmoqda'}
        </span>
        <div className="cs-top-right">
          {d.type === 'logo' && <LogoExport model={d.data} notify={notify} />}
          {d.type === 'cv' && <CvExport cv={d.data} notify={notify} />}
        </div>
      </header>
      <div className="cs-body">
        <aside className="cs-left">{left}</aside>
        <main className="cs-stage">{stage}</main>
      </div>
    </div>
  )
}
