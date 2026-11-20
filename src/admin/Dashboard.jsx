import { useMemo, useState } from 'react'
import { Activity, ExternalLink, Eye, Info, MousePointerClick, Search, UserPlus, Users } from 'lucide-react'
import { admin } from './api.js'
import { AreaChart, BarList, Heatmap } from './charts.jsx'
import { DEVICE, SOURCE, countryName, dayLabel, fmt, langName, pageLabel, pct } from './format.js'
import { Card, Code, Delta, ErrorBox, Flag, Kpi, PageHead, RangePicker, RefreshButton, Segmented, useLoad } from './parts.jsx'
import { PageSkeleton } from './AdminApp.jsx'

const METRICS = [
  { value: 'visitors', label: 'Tashrif buyuruvçilar' },
  { value: 'views', label: 'Sahifa körişlari' },
  { value: 'signups', label: 'Röyxatdan ötişlar' },
]

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const { data, error, busy, reload } = useLoad(() => admin.stats(days), [days])
  if (!data && error) return <div className="ad-page"><ErrorBox error={error} onRetry={reload} /></div>
  if (!data) return <PageSkeleton />
  return <Stats s={data} days={days} setDays={setDays} busy={busy} reload={reload} />
}

function Stats({ s, days, setDays, busy, reload }) {
  const [metric, setMetric] = useState('visitors')
  const [table, setTable] = useState(false)
  const [pagesTab, setPagesTab] = useState('all')
  const k = s.kpi
  const chart = useMemo(() => s.series.map((d) => ({ label: dayLabel(d.day), sub: dayLabel(d.day), value: d[metric] })), [s.series, metric])
  const spark = (key) => s.series.slice(-Math.min(s.series.length, 30)).map((d) => d[key])
  const topDevice = s.devices[0]
  const sourceItems = s.sources.map((x) => ({ key: x.key, label: SOURCE[x.key] ?? x.key, n: x.n }))
  const signupsOfVisitors = k.visitors ? k.signups / k.visitors : 0

  return (
    <div className={`ad-page ${busy ? 'is-busy' : ''}`}>
      <PageHead title="Statistika" sub="Saytga kim, qayerdan va qanday kirayotgani — real vaqtda">
        <span className="ad-live" title="Oxirgi 5 daqiqada faol">
          <i /> {fmt(k.online)} kişi hozir saytda
        </span>
        <RangePicker days={days} onChange={setDays} />
        <RefreshButton onClick={reload} busy={busy} />
      </PageHead>

      <div className="ad-kpis">
        <Kpi
          accent
          icon={Users}
          label="Tashrif buyuruvçilar"
          value={fmt(k.visitors)}
          delta={<Delta now={k.visitors} prev={k.prev.visitors} />}
          spark={spark('visitors')}
          foot={`Bugun: ${fmt(k.today.visitors)} kişi`}
        />
        <Kpi
          icon={Eye}
          label="Sahifa körişlari"
          value={fmt(k.views)}
          delta={<Delta now={k.views} prev={k.prev.views} />}
          spark={spark('views')}
          foot={`Bugun: ${fmt(k.today.views)} · ${k.viewsPerVisit.toFixed(1).replace('.', ',')} sahifa / tashrif`}
        />
        <Kpi
          icon={UserPlus}
          label="Röyxatdan ötganlar"
          value={fmt(k.signups)}
          delta={<Delta now={k.signups} prev={k.prev.signups} />}
          spark={spark('signups')}
          foot={`Bugun: ${fmt(k.today.signups)} · jami ${fmt(k.users)} foydalanuvçi`}
        />
        <Kpi
          icon={MousePointerClick}
          label="Konversiya"
          value={pct(signupsOfVisitors)}
          foot={`Tashrifdan röyxatga · ${topDevice ? `asosan ${(DEVICE[topDevice.key] ?? topDevice.key).toLowerCase()}` : 'qurilma yöq'}`}
        />
      </div>

      <div className="ad-strip">
        <StripItem label="Sessiyalar" value={fmt(k.sessions)} />
        <StripItem label="Bir sahifada çiqib ketiş" value={pct(k.bounce, 0)} />
        <StripItem label="Faol (24 soat)" value={fmt(k.active24)} />
        <StripItem label="Faol (7 kun)" value={fmt(k.active7)} />
        <StripItem label="Coin sotib olganlar" value={fmt(k.buyers)} />
        <StripItem label="Mehmon sessiyalari" value={fmt(k.guests)} />
      </div>

      <Card
        className="ad-chart-card"
        title={METRICS.find((m) => m.value === metric).label}
        sub={`Oxirgi ${days} kun, kunlar kesimida (Toşkent vaqti)`}
        right={<Segmented value={metric} onChange={setMetric} options={METRICS} />}
      >
        <AreaChart data={chart} name={METRICS.find((m) => m.value === metric).label.toLowerCase()} id="main" />
        <button className="ad-link-btn" onClick={() => setTable((v) => !v)}>
          {table ? '▾' : '▸'} Jadval körinişida
        </button>
        {table && (
          <div className="ad-table-wrap ad-mini-table">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Kun</th>
                  <th className="num">Tashrif buyuruvçilar</th>
                  <th className="num">Sahifa körişlari</th>
                  <th className="num">Röyxatdan ötişlar</th>
                </tr>
              </thead>
              <tbody>
                {[...s.series].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{dayLabel(d.day)}</td>
                    <td className="num">{fmt(d.visitors)}</td>
                    <td className="num">{fmt(d.views)}</td>
                    <td className="num">{fmt(d.signups)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="ad-grid-2">
        <Card title="Top davlatlar" sub="Tashrif buyuruvçilar soni böyiça">
          <BarList items={s.countries.map((c) => ({ key: c.key, label: countryName(c.key), n: c.n, lead: <Flag cc={c.key} /> }))} limit={10} />
        </Card>
        <Card title="Qayerdan kelişmoqda" sub="Tashrifning birinçi sahifasi böyiça">
          <BarList items={sourceItems} empty="Hozirça tashrif yöq" />
          <div className="ad-sub-title">Havolalar</div>
          <BarList items={s.referrers.map((r) => ({ key: r.key, label: r.key, n: r.n, lead: <Favicon host={r.key} /> }))} empty="Boşqa saytlardan ötiş hali yöq" />
          {s.utm.length > 0 && (
            <>
              <div className="ad-sub-title">UTM kampaniyalar</div>
              <BarList items={s.utm.map((r) => ({ key: r.key, label: r.key, n: r.n }))} />
            </>
          )}
        </Card>
      </div>

      <div className="ad-grid-2">
        <Card title="Qidiruv tizimlari" right={<Search size={16} className="ad-muted-ic" />}>
          <BarList items={s.searchEngines.map((r) => ({ key: r.key, label: r.key, n: r.n }))} empty="Qidiruvdan kelganlar hali yöq" />
          <div className="ad-sub-title">Qidirilgan sözlar</div>
          {s.searchTerms.length ? (
            <BarList items={s.searchTerms.map((r) => ({ key: r.key, label: `“${r.key}”`, n: r.n }))} />
          ) : (
            <p className="ad-empty">Hozirça sözlar yöq.</p>
          )}
          <div className="ad-note">
            <Info size={16} />
            <p>
              Google va köp qidiruv tizimlari qidirilgan sözni saytga bermaydi. Bu yerda faqat söz yetib kelgan holatlar körinadi.{' '}
              <a href="https://search.google.com/search-console/performance/search-analytics" target="_blank" rel="noreferrer">
                Töliq röyxatni Search Console'da köring <ExternalLink size={12} />
              </a>
            </p>
          </div>
        </Card>
        <Card
          title="Ommabop sahifalar"
          right={
            <Segmented
              value={pagesTab}
              onChange={setPagesTab}
              options={[
                { value: 'all', label: 'Barçasi' },
                { value: 'entry', label: 'Kiriş sahifalari' },
              ]}
            />
          }
        >
          <BarList
            items={(pagesTab === 'all' ? s.pages : s.entryPages).map((p) => ({ key: p.key, label: <PageName path={p.key} />, n: p.n }))}
            limit={10}
          />
        </Card>
      </div>

      <div className="ad-grid-3">
        <Card title="Qurilmalar">
          <BarList items={s.devices.map((d) => ({ key: d.key, label: DEVICE[d.key] ?? d.key, n: d.n }))} />
        </Card>
        <Card title="Brauzerlar">
          <BarList items={s.browsers.map((d) => ({ key: d.key, label: d.key, n: d.n }))} />
        </Card>
        <Card title="Operatsion tizimlar">
          <BarList items={s.os.map((d) => ({ key: d.key, label: d.key, n: d.n }))} />
        </Card>
      </div>

      <div className="ad-grid-2 ad-grid-wide">
        <Card title="Faollik vaqti" sub="Hafta kuni va soat böyiça sahifa körişlari (Toşkent vaqti)" right={<Activity size={16} className="ad-muted-ic" />}>
          <Heatmap cells={s.heatmap} />
        </Card>
        <Card title="Brauzer tili">
          <BarList items={s.langs.map((d) => ({ key: d.key, label: langName(d.key), n: d.n }))} />
        </Card>
      </div>
    </div>
  )
}

function StripItem({ label, value }) {
  return (
    <div className="ad-strip-item">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function PageName({ path }) {
  const label = pageLabel(path)
  return label === path ? <span className="ad-mono">{path}</span> : (
    <>
      {label} <Code>{path}</Code>
    </>
  )
}

function Favicon({ host }) {
  const [ok, setOk] = useState(true)
  return ok ? (
    <img className="ad-fav" src={`https://icons.duckduckgo.com/ip3/${host}.ico`} alt="" width="16" height="16" loading="lazy" onError={() => setOk(false)} />
  ) : (
    <span className="ad-fav ad-fav-x" />
  )
}
