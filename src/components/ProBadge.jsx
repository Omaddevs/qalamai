// The premium mark used everywhere a template or feature is "Pro": a gilded crown and PRO
// lettering on a dark lacquer pill, with a slow light sweep. Original artwork (inline SVG).
import { useId } from 'react'
import './pro-badge.css'

/** The crown alone — gold gradient, three gems. */
export function ProCrown({ size = 14, className = '' }) {
  const id = `pc${useId().replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg className={`pro-crown ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".45" stopColor="#f7c948" />
          <stop offset="1" stopColor="#c8860d" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8860d" />
          <stop offset=".5" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#c8860d" />
        </linearGradient>
      </defs>
      <path d="M3.2 8.4 7.6 12l3.6-6.3a.9.9 0 0 1 1.6 0l3.6 6.3 4.4-3.6a.6.6 0 0 1 1 .6l-2.2 9.1H4.4L2.2 9a.6.6 0 0 1 1-.6Z" fill={`url(#${id}g)`} stroke="#8a5a06" strokeWidth=".6" strokeLinejoin="round" />
      <rect x="4.3" y="18.4" width="15.4" height="2.6" rx="1.1" fill={`url(#${id}b)`} stroke="#8a5a06" strokeWidth=".5" />
      <circle cx="12" cy="4.6" r="1.35" fill="#ff5f7e" stroke="#8a5a06" strokeWidth=".4" />
      <circle cx="12" cy="14.2" r="1.25" fill="#3ee0c5" />
      <circle cx="7.4" cy="14.9" r=".85" fill="#fff6d8" opacity=".9" />
      <circle cx="16.6" cy="14.9" r=".85" fill="#fff6d8" opacity=".9" />
    </svg>
  )
}

/**
 * @param {{ size?: 'xs'|'sm'|'md'|'lg', label?: string|false, className?: string, title?: string }} props
 *   label=false → crown only (round gem), for tight corners.
 */
export default function ProBadge({ size = 'sm', label = 'Pro', className = '', title = 'Premium' }) {
  const px = { xs: 10, sm: 12, md: 14, lg: 18 }[size] ?? 12
  return (
    <span className={`pro-badge ${size} ${label === false ? 'icon' : ''} ${className}`} title={title}>
      <ProCrown size={px} />
      {label !== false && <b>{label}</b>}
    </span>
  )
}
