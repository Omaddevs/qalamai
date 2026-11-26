// "Haqimizda" in the landing header: a dropdown on wide screens (hover, click or keyboard), a group of
// links in the mobile menu. The items are real <a href> links, so crawlers follow them too.
import { useEffect, useRef, useState } from 'react'
import { CaretDown, Info, UsersThree, Newspaper, Handshake } from '@phosphor-icons/react'
import { t } from '../../i18n/index.js'
import { go, linkClick } from '../../nav.js'
import { pathOf } from '../pages.js'
import './about.css'

const ITEMS = [
  { id: 'about', key: 'about', Icon: Info },
  { id: 'team', key: 'team', Icon: UsersThree },
  { id: 'news', key: 'news', Icon: Newspaper },
  { id: 'partners', key: 'partners', Icon: Handshake },
]

const ABOUT_PATHS = new Set(ITEMS.map((i) => pathOf(i.id)))
const onAboutPage = () => ABOUT_PATHS.has(location.pathname.replace(/\/+$/, '')) || location.pathname.startsWith('/yangiliklar/')

export function AboutMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = (e) => !root.current?.contains(e.target) && setOpen(false)
    const key = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  // hover opens at once and closes a moment later, so moving onto the panel doesn't drop it
  const enter = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    setOpen(true)
  }
  const leave = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 160)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className={`lp-about${open ? ' open' : ''}`} ref={root} onPointerEnter={enter} onPointerLeave={leave}>
      <button
        type="button"
        className={`lp-about-btn${onAboutPage() ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        {t('ab.nav.about')} <CaretDown size={13} weight="bold" aria-hidden="true" />
      </button>
      <div className="lp-about-pop" role="menu" aria-label={t('ab.nav.about')}>
        {ITEMS.map(({ id, key, Icon }) => (
          <a
            key={id}
            role="menuitem"
            href={pathOf(id)}
            tabIndex={open ? 0 : -1}
            onClick={linkClick(() => {
              setOpen(false)
              go(pathOf(id))
            })}
          >
            <span className="ic" aria-hidden="true"><Icon size={20} weight="duotone" /></span>
            <span>
              <b>{t(`ab.nav.${key}`)}</b>
              <small>{t(`ab.nav.${key}Desc`)}</small>
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

/** The same links as a group in the mobile menu. */
export function AboutMobileGroup({ onNav }) {
  return (
    <div className="lp-mobile-group">
      <span>{t('ab.nav.about')}</span>
      {ITEMS.map(({ id, key, Icon }) => (
        <a key={id} href={pathOf(id)} onClick={linkClick(() => { onNav?.(); go(pathOf(id)) })}>
          <Icon size={18} weight="duotone" aria-hidden="true" /> {t(`ab.nav.${key}`)}
        </a>
      ))}
    </div>
  )
}
