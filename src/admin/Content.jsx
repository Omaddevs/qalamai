// «Yaratilganlar» — how many presentations, referats, logos … were made, how many the AI wrote,
// which file tools ran, and who made the most. Every number opens the user behind it.
import { useMemo, useState } from 'react'
import { Layers, Link2, PartyPopper, Presentation, Search, Sparkles, Users, Wrench, X } from 'lucide-react'
import { admin } from './api.js'
import { AreaChart, BarList } from './charts.jsx'
import { dayLabel, fmt, pct } from './format.js'
import { Card, ErrorBox, Kpi, PageHead, RefreshButton, Segmented, useLoad } from './parts.jsx'
import { PageSkeleton } from './AdminApp.jsx'
import { UserCell } from './Users.jsx'
import { KINDS, KindChips } from './kinds.jsx'
import UserDrawer from './UserDrawer.jsx'

const AI_TEXT = { 'qayta-yozish': 'Qayta yoziş', plagiat: 'Plagiat tekşiruvi', tarjima: 'Tarjima' }

const PERIODS = [
  { value: 1, label: 'Bugun' },
  { value: 7, label: '7 kun' },
  { value: 30, label: '30 kun' },
  { value: 90, label: '90 kun' },
  { value: 365, label: '1 yil' },
  { value: 0, label: 'Hammasi' },
]
const periodText = (days) => (days === 0 ? 'butun davr' : days === 1 ? 'bugun' : `oxirgi ${days} kun`)
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return `${['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'][m - 1]} ${y}`
}

export default function Content() {
  const [days, setDays] = useState(30)
  const [kind, setKind] = useState('')
  const { data, error, busy, reload } = useLoad(() => admin.content(days, kind), [days, kind])
  if (!data && error) return <div className="ad-page"><ErrorBox error={error} onRetry={reload} /></div>
  if (!data) return <PageSkeleton />
  return <View s={data} days={days} setDays={setDays} kind={kind} setKind={setKind} busy={busy} reload={reload} />
}

function View({ s, days, setDays, kind, setKind, busy, reload }) {
  const [open, setOpen] = useState(null)
  const [metric, setMetric] = useState('total')
  const [q, setQ] = useState('')
  const k = s.kpi
  const chart = useMemo(
    () => s.series.map((d) => ({ label: s.period.monthly ? monthLabel(d.key) : dayLabel(d.key), sub: s.period.monthly ? monthLabel(d.key) : dayLabel(d.key), value: d[metric] })),
    [s.series, s.period.monthly, metric],
  )
  const kinds = s.kinds.filter((x) => x.total > 0 || !['boshqa', 'hujjat', 'diplom'].includes(x.kind))
  const top = s.top.filter((x) => {
    const n = q.trim().toLowerCase()
    if (!n) return true
    const u = x.user ?? {}
    return [u.name, u.email, u.phone, u.telegramUsername, x.id].some((v) => v?.toLowerCase().includes(n))
  })
  const p = s.published

  return (
    <div className={`ad-page ${busy ? 'is-busy' : ''}`}>
      <PageHead title="Yaratilganlar" sub="Qaysi turdan neçta yaratildi, qançasini AI yozdi va kim eñ köp yaratdi">
        <Segmented value={days} onChange={setDays} options={PERIODS} />
        <RefreshButton onClick={reload} busy={busy} />
      </PageHead>

      <div className="ad-kpis">
        <Kpi accent icon={Layers} label="Jami yaratilgan" value={fmt(k.total)} foot={`${periodText(days)} · öçirilganlari ham hisobda`} />
        <Kpi icon={Sparkles} label="AI yozgani" value={fmt(k.ai)} foot={k.total ? `${pct(k.ai / k.total, 0)} — AI orqali` : 'Hali yöq'} />
        <Kpi icon={Users} label="Yaratgan foydalanuvçilar" value={fmt(k.creators)} foot={k.creators ? `Örtaça ${(k.total / k.creators).toFixed(1).replace('.', ',')} ta / kişi` : '—'} />
        <Kpi icon={Wrench} label="Fayl vositalari" value={fmt(k.tools)} foot="PDF ↔ Word, siqiş, fon öçiriş …" />
      </div>

      <div className="ad-kinds">
        {kinds.map((x) => {
          const meta = KINDS[x.kind] ?? KINDS.boshqa
          const Icon = meta.icon
          const on = kind === x.kind
          return (
            <button key={x.kind} className={`ad-kind ${on ? 'on' : ''} ${x.total ? '' : 'zero'}`} style={{ '--kc': meta.color }} onClick={() => setKind(on ? '' : x.kind)} title="Bosing — şu turni eñ köp yaratganlar">
              <span className="ad-kind-ic">
                <Icon size={17} />
              </span>
              <span className="ad-kind-label">{meta.label}</span>
              <b className="ad-kind-n">{fmt(x.total)}</b>
              <span className="ad-kind-sub">
                {x.ai ? (
                  <>
                    <Sparkles size={11} /> AI {fmt(x.ai)}
                  </>
                ) : (
                  'AI —'
                )}{' '}
                · {fmt(x.users)} kişi
              </span>
              {k.total > 0 && <span className="ad-kind-bar" style={{ width: `${Math.max(3, (x.total / Math.max(...s.kinds.map((y) => y.total), 1)) * 100)}%` }} />}
            </button>
          )
        })}
      </div>

      <Card
        className="ad-chart-card"
        title={metric === 'total' ? 'Yaratilganlar' : 'AI yozganlari'}
        sub={`${periodText(days)}, ${s.period.monthly ? 'oylar' : 'kunlar'} kesimida (Toşkent vaqti)`}
        right={
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'total', label: 'Hammasi' },
              { value: 'ai', label: 'AI' },
            ]}
          />
        }
      >
        <AreaChart data={chart} name={metric === 'total' ? 'yaratilgan' : 'AI yozgan'} id="content" />
      </Card>

      <div className="ad-grid-2">
        <Card title="Fayl vositalari" sub={`${periodText(days)} · serverda va brauzerda`} right={<Wrench size={16} className="ad-muted-ic" />}>
          <BarList
            items={s.tools.map((x) => ({ key: x.tool, label: x.label, n: x.n, lead: <span className="ad-tool-split" title={`Serverda ${x.server} · brauzerda ${x.device}`}>{x.device ? '💻' : '☁️'}</span> }))}
            limit={10}
            empty="Bu davrda vositalar işlatilmagan"
          />
        </Card>
        <Card title="AI matn amallari" sub={periodText(days)} right={<Sparkles size={16} className="ad-muted-ic" />}>
          <BarList items={s.aiText.filter((x) => x.n).map((x) => ({ key: x.item, label: `${AI_TEXT[x.item] ?? x.item} · ${fmt(x.users)} kişi`, n: x.n }))} empty="Bu davrda AI matn amallari bölmagan" />
          <div className="ad-sub-title">Eʼlon qilingan sahifalar (jami)</div>
          <div className="ad-pub">
            <div>
              <PartyPopper size={15} />
              <b>{fmt(p.invites)}</b> taklifnoma <small>{fmt(p.invite_views)} köriş · {fmt(p.rsvps)} javob</small>
            </div>
            <div>
              <Link2 size={15} />
              <b>{fmt(p.bios)}</b> Link in Bio <small>{fmt(p.bio_views)} köriş</small>
            </div>
            <div>
              <Presentation size={15} />
              <b>{fmt(p.shared)}</b> havola bilan ulaşilgan taqdimot
            </div>
          </div>
        </Card>
      </div>

      <section className="ad-card ad-users">
        <div className="ad-card-head ad-users-head">
          <div>
            <h2>
              Eñ köp yaratganlar
              {kind && (
                <button className="ad-kind-filter" onClick={() => setKind('')} title="Filtrni olib taşlaş">
                  {KINDS[kind]?.label} <X size={12} />
                </button>
              )}
            </h2>
            <p>
              {periodText(days)} · {fmt(s.creatorsTotal)} kişi{s.creatorsTotal > s.top.length ? `, birinçi ${s.top.length} tasi` : ''}
            </p>
          </div>
          <div className="ad-users-tools">
            <label className="ad-search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email, telefon yoki ID" />
            </label>
          </div>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table ad-users-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Foydalanuvçi</th>
                <th>Nimalar yaratgan</th>
                <th className="num">AI</th>
                <th className="num">{kind ? KINDS[kind]?.label : 'Jami'}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((x) => (
                <tr key={x.id} onClick={() => setOpen(x.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(x.id)}>
                  <td className="num ad-muted">{s.top.indexOf(x) + 1}</td>
                  <td>{x.user ? <UserCell u={x.user} /> : <span className="ad-mono">{x.id}</span>}</td>
                  <td>
                    <KindChips kinds={x.kinds} />
                  </td>
                  <td className="num">{x.ai ? fmt(x.ai) : <span className="ad-muted">0</span>}</td>
                  <td className="num">
                    <b>{fmt(x.total)}</b>
                  </td>
                </tr>
              ))}
              {!top.length && (
                <tr className="ad-empty-row">
                  <td colSpan={5}>{q ? 'Heç kim topilmadi' : 'Bu davrda heç narsa yaratilmagan'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {open && <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  )
}
