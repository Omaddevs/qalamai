import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight, Coins, Download, Phone, Search, ShieldCheck, UserPlus, Users as UsersIc, Zap } from 'lucide-react'
import { admin } from './api.js'
import { AreaChart, BarList, HourBars } from './charts.jsx'
import { DEVICE, METHOD, SOURCE, ago, countryName, dateOnly, dayLabel, fmt, timeOnly } from './format.js'
import { Avatar, Card, ErrorBox, Flag, Kpi, MethodDot, PageHead, RangePicker, RefreshButton, Segmented, useLoad } from './parts.jsx'
import UserDrawer from './UserDrawer.jsx'

const STATUSES = [
  { value: 'registered', label: 'Röyxatdan ötganlar' },
  { value: 'active', label: 'Faol (24 soat)' },
  { value: 'premium', label: 'Coin olganlar' },
  { value: 'guests', label: 'Mehmonlar' },
  { value: 'all', label: 'Hammasi' },
]
const SORTS = [
  { value: 'registered', label: 'Röyxatdan ötgan vaqti' },
  { value: 'seen', label: 'Oxirgi faollik' },
  { value: 'coins', label: 'Coin balansi' },
  { value: 'name', label: 'Ism' },
]
const LIMIT = 25

export default function UsersPage() {
  const [days, setDays] = useState(30)
  const stats = useLoad(() => admin.userStats(days), [days])

  return (
    <div className="ad-page">
      <PageHead title="Foydalanuvçilar" sub="Kim, qaçon, qayerdan va qanday röyxatdan ötgani — hamma maʼlumotlar">
        <RangePicker days={days} onChange={setDays} />
        <RefreshButton onClick={stats.reload} busy={stats.busy} />
      </PageHead>
      {stats.error && !stats.data ? <ErrorBox error={stats.error} onRetry={stats.reload} /> : stats.data ? <Overview u={stats.data} days={days} /> : <div className="ad-card ad-sk ad-sk-chart" />}
      <UserTable />
    </div>
  )
}

function Overview({ u, days }) {
  const t = u.totals
  const chart = u.series.map((d) => ({ label: dayLabel(d.day), value: d.signups }))
  const methodItems = u.methods.map((m) => ({ key: m.key, label: METHOD[m.key] ?? m.key, n: m.n, lead: <MethodDot m={m.key} /> }))
  return (
    <>
      <div className="ad-kpis ad-kpis-6">
        <Kpi accent icon={UsersIc} label="Jami foydalanuvçilar" value={fmt(t.users)} />
        <Kpi icon={UserPlus} label="Bugun qöşildi" value={fmt(t.today)} />
        <Kpi icon={UserPlus} label={`Oxirgi ${days} kunda`} value={fmt(t.period)} />
        <Kpi icon={Zap} label="Faol (24 soat)" value={fmt(t.active24)} />
        <Kpi icon={Phone} label="Telefon tasdiqlangan" value={fmt(t.verified)} />
        <Kpi icon={Coins} label="Coin sotib olgan" value={fmt(t.buyers)} />
      </div>
      <div className="ad-grid-2 ad-grid-wide">
        <Card title="Röyxatdan ötişlar" sub={`Oxirgi ${days} kun, kunlar kesimida`}>
          <AreaChart data={chart} name="ta yangi foydalanuvçi" height={240} id="signups" />
        </Card>
        <Card title="Röyxatdan ötiş usuli">
          <BarList items={methodItems} empty="Bu davrda röyxatdan ötganlar yöq" />
          <div className="ad-sub-title">Qurilma</div>
          <BarList items={u.devices.map((d) => ({ key: d.key, label: DEVICE[d.key] ?? d.key, n: d.n }))} empty="—" />
        </Card>
      </div>
      <div className="ad-grid-3">
        <Card title="Qaysi soatda röyxatdan ötişadi" sub="Toşkent vaqti">
          <HourBars values={u.byHour} unit="ta röyxatdan ötiş" />
        </Card>
        <Card title="Davlatlar">
          <BarList items={u.countries.map((c) => ({ key: c.key, label: countryName(c.key), n: c.n, lead: <Flag cc={c.key} /> }))} empty="—" />
        </Card>
        <Card title="Qayerdan kelib röyxatdan ötdi">
          <BarList items={u.sources.map((c) => ({ key: c.key, label: SOURCE[c.key] ?? c.key, n: c.n }))} empty="—" />
        </Card>
      </div>
    </>
  )
}


function UserTable() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('registered')
  const [method, setMethod] = useState('')
  const [sort, setSort] = useState('registered')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const [exporting, setExporting] = useState(false)

  // search as you type, without a request per key
  useEffect(() => {
    const id = setTimeout(() => (setQuery(q), setPage(1)), 300)
    return () => clearTimeout(id)
  }, [q])

  const params = useMemo(() => ({ q: query, status, method, sort, page, limit: LIMIT }), [query, status, method, sort, page])
  const { data, error, busy, reload } = useLoad(() => admin.users(params), [params])
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await admin.users({ ...params, page: 1, limit: 5000 })
      const cols = [
        ['ID', (u) => u.id],
        ['Ism', (u) => u.name],
        ['Email', (u) => u.email],
        ['Telefon', (u) => u.phone],
        ['Telegram', (u) => (u.telegramUsername ? `@${u.telegramUsername}` : '')],
        ['Usul', (u) => METHOD[u.method] ?? ''],
        ['Röyxatdan ötgan', (u) => (u.registeredAt ? new Date(u.registeredAt).toISOString() : '')],
        ['Oxirgi faollik', (u) => new Date(u.lastSeenAt).toISOString()],
        ['Davlat', (u) => (u.country ? countryName(u.country) : '')],
        ['Qurilma', (u) => DEVICE[u.device] ?? ''],
        ['Brauzer', (u) => u.browser ?? ''],
        ['OS', (u) => u.os ?? ''],
        ['Manba', (u) => SOURCE[u.source] ?? u.source ?? ''],
        ['Havola', (u) => u.referrer ?? ''],
        ['IP', (u) => u.ip ?? ''],
        ['Coin', (u) => u.coins],
        ['Dizaynlar', (u) => u.counts.designs],
        ['Hujjatlar', (u) => u.counts.documents],
      ]
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv = [cols.map(([h]) => esc(h)).join(','), ...all.items.map((u) => cols.map(([, f]) => esc(f(u))).join(','))].join('\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
      a.download = `qalamai-foydalanuvcilar-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="ad-card ad-users">
      <div className="ad-card-head ad-users-head">
        <div>
          <h2>Röyxat</h2>
          <p>{data ? `${fmt(data.total)} ta topildi` : 'Yuklanmoqda…'}</p>
        </div>
        <div className="ad-users-tools">
          <label className="ad-search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email, telefon, @username yoki ID" />
          </label>
          <select className="ad-select" value={method} onChange={(e) => (setMethod(e.target.value), setPage(1))} aria-label="Usul">
            <option value="">Barça usullar</option>
            <option value="google">Google</option>
            <option value="telegram">Telegram</option>
            <option value="password">Email / telefon</option>
          </select>
          <select className="ad-select" value={sort} onChange={(e) => (setSort(e.target.value), setPage(1))} aria-label="Saralaş">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="ad-btn" onClick={exportCsv} disabled={exporting || !data?.total}>
            {exporting ? <span className="ad-spin dark" /> : <Download size={15} />} CSV
          </button>
        </div>
      </div>
      <div className="ad-chips">
        <Segmented value={status} onChange={(v) => (setStatus(v), setPage(1))} options={STATUSES} />
      </div>

      {error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <div className={`ad-table-wrap ${busy ? 'is-busy' : ''}`}>
          <table className="ad-table ad-users-table">
            <thead>
              <tr>
                <th>Foydalanuvçi</th>
                <th>Usul</th>
                <th>Röyxatdan ötgan</th>
                <th>Qayerdan</th>
                <th>Qurilma</th>
                <th>Oxirgi faollik</th>
                <th className="num">Coin</th>
                <th className="num">Işlar</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id} onClick={() => setOpen(u.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(u.id)}>
                  <td>
                    <UserCell u={u} />
                  </td>
                  <td>
                    {u.isGuest ? (
                      <span className="ad-badge muted">Mehmon</span>
                    ) : (
                      <span className={`ad-badge m-${u.method ?? 'password'}`}>
                        <MethodDot m={u.method ?? 'password'} />
                        {METHOD[u.method] ?? 'Email / telefon'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="ad-two">
                      <span>{dateOnly(u.registeredAt ?? u.createdAt)}</span>
                      <small>{timeOnly(u.registeredAt ?? u.createdAt)}</small>
                    </div>
                  </td>
                  <td>
                    <div className="ad-two">
                      <span className="ad-country">
                        <Flag cc={u.country} /> {u.country ? countryName(u.country) : '—'}
                      </span>
                      <small>{u.referrer ?? SOURCE[u.source] ?? '—'}</small>
                    </div>
                  </td>
                  <td>
                    <div className="ad-two">
                      <span>{DEVICE[u.device] ?? '—'}</span>
                      <small>{[u.browser, u.os].filter(Boolean).join(' · ') || '—'}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`ad-seen ${Date.now() - new Date(u.lastSeenAt) < 15 * 60_000 ? 'on' : ''}`}>{ago(u.lastSeenAt)}</span>
                  </td>
                  <td className="num">
                    <b>{fmt(u.coins)}</b>
                    {u.premium && <BadgeCheck size={14} className="ad-prem" />}
                  </td>
                  <td className="num ad-muted">
                    {u.counts.designs + u.counts.documents + u.counts.files}
                  </td>
                </tr>
              ))}
              {data && !data.items.length && (
                <tr className="ad-empty-row">
                  <td colSpan={8}>Heç kim topilmadi</td>
                </tr>
              )}
              {!data &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="ad-sk-row">
                    <td colSpan={8}>
                      <div className="ad-sk ad-sk-line" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > LIMIT && (
        <div className="ad-pager">
          <span>
            {fmt((page - 1) * LIMIT + 1)}–{fmt(Math.min(page * LIMIT, data.total))} / {fmt(data.total)}
          </span>
          <button className="ad-icon ad-icon-line" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Oldingi">
            <ChevronLeft size={16} />
          </button>
          <span className="ad-pager-n">
            {page} / {pages}
          </span>
          <button className="ad-icon ad-icon-line" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Keyingi">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {open && <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </section>
  )
}

function UserCell({ u }) {
  return (
    <div className="ad-user">
      <Avatar u={u} />
      <div className="ad-two">
        <span className="ad-user-name">
          {u.name || <i className="ad-muted">Ismsiz</i>}
          {u.phoneVerified && <ShieldCheck size={13} className="ad-ok" title="Telefon tasdiqlangan" />}
        </span>
        <small>{u.email || u.phone || (u.telegramUsername ? `@${u.telegramUsername}` : u.id)}</small>
      </div>
    </div>
  )
}
