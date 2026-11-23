// Bildirişnomalar: the user's notices as a day-by-day timeline. System notices come as kind +
// data and are worded in the interface language; announcements carry the team's own text.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Checks, Check, Gift, Coins, ChatCircleText, Megaphone, ArrowRight, ArrowsClockwise, XCircle } from '@phosphor-icons/react'
import { listNotifications, markAllRead, markRead, onUnread } from '../notifications.js'
import { formatDate, t } from '../i18n/index.js'
import { timeAgo } from '../store.js'
import './notifications.css'

/** Look of each kind: icon + tint. */
const KIND = {
  welcome: { icon: Gift, tone: 'teal' },
  'coins.purchase': { icon: Coins, tone: 'amber' },
  'coins.grant': { icon: Gift, tone: 'violet' },
  'payment.rejected': { icon: XCircle, tone: 'red' },
  'payment.cancelled': { icon: XCircle, tone: 'red' },
  'support.done': { icon: ChatCircleText, tone: 'green' },
  announce: { icon: Megaphone, tone: 'blue' },
}

/** Title, text and action of one notice, in the interface language. */
function words(n, { onCreate, onOpenPricing }) {
  const d = n.data ?? {}
  switch (n.kind) {
    case 'welcome':
      return { title: t('nt.welcome.title'), body: t('nt.welcome.body', { coins: d.coins }), action: { label: t('nt.welcome.action'), run: onCreate } }
    case 'coins.purchase':
    case 'coins.grant':
      return {
        title: t(`nt.${n.kind}.title`, { coins: d.coins }),
        body: t(`nt.${n.kind}.body`, { balance: d.balance }),
        action: { label: t('nt.coins.action'), run: onOpenPricing },
      }
    case 'payment.rejected':
      return {
        title: t('nt.payment.rejected.title'),
        body: t('nt.payment.rejected.body', { coins: d.coins, reason: d.reason ?? '' }),
        action: { label: t('nt.payment.rejected.action'), run: onOpenPricing },
      }
    case 'payment.cancelled':
      return {
        title: t('nt.payment.cancelled.title'),
        body: t(d.taken ? 'nt.payment.cancelled.body' : 'nt.payment.cancelled.bodyNone', { coins: d.coins, taken: d.taken ?? 0, reason: d.reason ?? '' }),
      }
    case 'support.done':
      return { title: t('nt.support.done.title'), body: t('nt.support.done.body', { topic: d.topic ? t(`chat.topic.${d.topic}`) : '' }) }
    case 'announce':
      return {
        badge: t('nt.announce.badge'),
        title: n.title,
        body: n.body,
        action: n.link ? { label: t('nt.announce.open'), run: () => openLink(n.link) } : null,
      }
    default:
      return null // a kind this version of the app does not know yet
  }
}

function openLink(link) {
  if (link.startsWith('#/')) window.location.hash = link.slice(1)
  else if (link.startsWith('https://')) window.open(link, '_blank', 'noopener,noreferrer')
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
function dayLabel(d) {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dayKey(d) === dayKey(today)) return t('nt.today')
  if (dayKey(d) === dayKey(yesterday)) return t('nt.yesterday')
  return formatDate(d, { day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}
const timeOf = (d) => (Date.now() - d.getTime() < 6 * 3600_000 ? timeAgo(d.getTime()) : formatDate(d, { hour: '2-digit', minute: '2-digit' }))

function Item({ n, w, onRead, i }) {
  const { icon: Icon, tone } = KIND[n.kind] ?? KIND.announce
  const at = new Date(n.createdAt)
  const open = () => !n.read && onRead(n.id)
  return (
    <article className={`nt-item tone-${tone} ${n.read ? 'read' : 'unread'}`} style={{ '--i': i }} onClick={open}>
      <span className="nt-tile">
        <Icon size={20} weight="duotone" />
      </span>
      <div className="nt-text">
        <div className="nt-top">
          {w.badge && <span className="nt-badge">{w.badge}</span>}
          <h3>{w.title}</h3>
          <time dateTime={n.createdAt} title={formatDate(at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}>
            {timeOf(at)}
          </time>
        </div>
        {w.body && <p>{w.body}</p>}
        {(w.action || !n.read) && (
          <div className="nt-acts">
            {w.action && (
              <button
                className="nt-go"
                onClick={(e) => {
                  e.stopPropagation()
                  open()
                  w.action.run()
                }}
              >
                {w.action.label} <ArrowRight size={13} weight="bold" />
              </button>
            )}
            {!n.read && (
              <button
                className="nt-mark"
                onClick={(e) => {
                  e.stopPropagation()
                  open()
                }}
              >
                <Check size={13} weight="bold" /> {t('nt.markRead')}
              </button>
            )}
          </div>
        )}
      </div>
      {!n.read && <span className="nt-dot" aria-label={t('nt.new')} />}
    </article>
  )
}

export default function NotificationsView({ onCreate, onOpenPricing }) {
  const [items, setItems] = useState([])
  const [more, setMore] = useState(false)
  const [state, setState] = useState('loading') // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all')
  const [unread, setUnread] = useState(0)
  useEffect(() => onUnread(setUnread), [])

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await listNotifications()
      setItems(res.items)
      setMore(res.more)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await listNotifications(items.at(-1)?.createdAt)
      setItems((list) => [...list, ...res.items.filter((x) => !list.some((y) => y.id === x.id))])
      setMore(res.more)
    } catch {
      /* the button stays for another try */
    } finally {
      setLoadingMore(false)
    }
  }

  const read = (id) => {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, read: true } : x)))
    markRead(id)
  }
  const readAll = () => {
    setItems((list) => list.map((x) => ({ ...x, read: true })))
    markAllRead()
  }

  // known kinds only, grouped by day (newest first, as the server sends them)
  const days = useMemo(() => {
    const out = []
    for (const n of items) {
      if (filter === 'unread' && n.read) continue
      const w = words(n, { onCreate, onOpenPricing })
      if (!w) continue
      const at = new Date(n.createdAt)
      const key = dayKey(at)
      if (out.at(-1)?.key !== key) out.push({ key, label: dayLabel(at), list: [] })
      out.at(-1).list.push({ n, w })
    }
    return out
  }, [items, filter, onCreate, onOpenPricing])

  let index = 0
  return (
    <div className="nt">
      <header className="nt-head">
        <span className="nt-head-tile">
          <Bell size={24} weight="duotone" />
          {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
        </span>
        <div className="nt-head-text">
          <h1>{t('hm.notifs')}</h1>
          <p>{t('nt.sub')}</p>
        </div>
        <div className="nt-head-acts">
          <div className="nt-seg" role="tablist">
            <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
              {t('nt.all')}
            </button>
            <button role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>
              {t('nt.unread')}
              {unread > 0 && <span className="nt-count">{unread}</span>}
            </button>
          </div>
          <button className="nt-readall" onClick={readAll} disabled={unread === 0}>
            <Checks size={16} weight="bold" /> {t('nt.readAll')}
          </button>
        </div>
      </header>

      {state === 'loading' ? (
        <div className="nt-skel" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
      ) : state === 'error' ? (
        <div className="nt-empty">
          <span className="nt-empty-art">
            <Bell size={30} weight="duotone" />
          </span>
          <b>{t('nt.error')}</b>
          <button className="nt-go" onClick={load}>
            <ArrowsClockwise size={14} weight="bold" /> {t('sync.retry')}
          </button>
        </div>
      ) : days.length === 0 ? (
        <div className="nt-empty">
          <span className="nt-empty-art">
            <Bell size={30} weight="duotone" />
          </span>
          <b>{filter === 'unread' && items.length ? t('nt.emptyUnread') : t('nt.empty')}</b>
          <p>{t('nt.emptyHint')}</p>
        </div>
      ) : (
        <div className="nt-line">
          {days.map((day) => (
            <section key={day.key} className="nt-day">
              <h2 className="nt-day-label">
                <span>{day.label}</span>
              </h2>
              <div className="nt-list">
                {day.list.map(({ n, w }) => (
                  <Item key={n.id} n={n} w={w} onRead={read} i={index++} />
                ))}
              </div>
            </section>
          ))}
          {more && filter === 'all' && (
            <button className="nt-more" onClick={loadMore} disabled={loadingMore}>
              {t('nt.more')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
