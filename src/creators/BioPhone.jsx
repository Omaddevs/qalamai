// Live Link-in-Bio page. Drawn by the SAME renderer as the public page (shared/bio2.js), so the
// preview is exactly what gets published. In the editor, elements are clickable (data-el) and
// decorations can be dragged.
import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react'
import {
  TelegramLogo, InstagramLogo, YoutubeLogo, TiktokLogo, FacebookLogo, LinkedinLogo, XLogo, WhatsappLogo, GithubLogo, Envelope, Phone, Globe,
} from '@phosphor-icons/react'
import { fontsHref, renderBio } from '../../shared/bio2.js'

export const SOCIAL_ICONS = {
  telegram: TelegramLogo, instagram: InstagramLogo, youtube: YoutubeLogo, tiktok: TiktokLogo, facebook: FacebookLogo, linkedin: LinkedinLogo,
  x: XLogo, whatsapp: WhatsappLogo, github: GithubLogo, email: Envelope, phone: Phone, website: Globe,
}

/** Make sure a Google Fonts stylesheet is on the page (once per URL). */
export function useFonts(fonts) {
  const href = fontsHref(fonts)
  useEffect(() => {
    if (!href || document.querySelector(`link[data-bio-fonts="${CSS.escape(href)}"]`)) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = href
    l.dataset.bioFonts = href
    document.head.appendChild(l)
  }, [href])
}

/**
 * @param {{ data: object, compact?: boolean, editor?: boolean, selected?: string|null,
 *   onSelect?: (el: string) => void, onMoveDeco?: (id: string, x: number, y: number, done: boolean) => void }} props
 */
export function BioPage({ data, compact = false, editor = false, selected = null, onSelect, onMoveDeco }) {
  const scope = `qb${useId().replace(/[^a-z0-9]/gi, '')}`
  const { html, css, fonts } = useMemo(() => renderBio(data, { scope, editor, href: () => null }), [data, scope, editor])
  useFonts(fonts)
  const root = useRef(null)

  // outline the selected element
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    el.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'))
    if (selected) el.querySelector(`[data-el="${CSS.escape(selected)}"]`)?.classList.add('sel')
  }, [selected, html])

  const onPointerDown = (e) => {
    if (!editor) return
    const hit = e.target.closest('[data-el]')
    if (!hit || !root.current.contains(hit)) return
    e.preventDefault()
    const key = hit.dataset.el
    onSelect?.(key)
    // drag decorations around the page
    if (key.startsWith('deco:') && onMoveDeco) {
      const page = root.current.querySelector(`.${scope}`)
      const box = page.getBoundingClientRect()
      const move = (ev) => onMoveDeco(key.slice(5), ((ev.clientX - box.left) / box.width) * 100, ((ev.clientY - box.top) / box.height) * 100, false)
      const up = (ev) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        onMoveDeco(key.slice(5), ((ev.clientX - box.left) / box.width) * 100, ((ev.clientY - box.top) / box.height) * 100, true)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }

  return (
    <div
      ref={root}
      className={`bp2 ${compact ? 'compact' : ''}`}
      onPointerDown={onPointerDown}
      onClick={(e) => (editor || compact) && e.target.closest('a') && e.preventDefault()}
      dangerouslySetInnerHTML={{ __html: `<style>${css}</style>${html}` }}
    />
  )
}

export default function BioPhone(props) {
  return (
    <div className="bphone">
      <div className="bphone-notch" />
      <div className="bphone-screen">
        <BioPage {...props} />
      </div>
    </div>
  )
}
