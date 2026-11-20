import { useEffect, useState } from 'react'
import { CircleNotch, CloudCheck, CloudSlash, WarningCircle } from '@phosphor-icons/react'
import { t } from '../i18n/index.js'
import { onSyncStatus, syncNow } from '../sync.js'
import './sync-badge.css'

/** Top-bar chip: is my work on the server? Click retries when it isn't. */
export default function SyncBadge() {
  const [s, setS] = useState(null)
  useEffect(() => onSyncStatus(setS), [])
  if (!s) return null

  const busy = s.state === 'syncing' || (s.state === 'idle' && s.pending > 0)
  const view =
    s.state === 'offline'
      ? { cls: 'off', Icon: CloudSlash, label: t('sync.offline'), hint: t('sync.offlineHint', { n: s.pending }) }
      : s.state === 'error'
        ? { cls: 'bad', Icon: WarningCircle, label: t('sync.error'), hint: t('sync.errorHint', { names: s.rejected.map((r) => r.name || r.id).join(', ') }) }
        : busy
          ? { cls: 'busy', Icon: CircleNotch, label: t('sync.saving'), hint: t('sync.saving') }
          : { cls: 'ok', Icon: CloudCheck, label: t('sync.saved'), hint: t('sync.savedHint') }
  const canRetry = s.state === 'offline' || s.state === 'error'

  return (
    <button
      type="button"
      className={`sync-badge ${view.cls}`}
      title={canRetry ? `${view.hint}\n${t('sync.retry')}` : view.hint}
      aria-label={view.hint}
      aria-live="polite"
      onClick={canRetry ? () => syncNow() : undefined}
      disabled={!canRetry}
    >
      <view.Icon size={16} weight={view.cls === 'busy' ? 'bold' : 'duotone'} />
      <span>{view.label}</span>
    </button>
  )
}
