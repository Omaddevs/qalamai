// «Aksiyalar»: Juma sovğasi and Döst taklifi — switch each on/off, set the coins, and see how they
// work (claims per Friday, invites, top inviters, the latest sign-ups through links).
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Coins, Gift, Minus, Plus, Save, Trophy, UserPlus, Users, Undo2 } from 'lucide-react'
import { admin } from './api.js'
import { ago, dateOnly, fmt } from './format.js'
import { Avatar, Card, ErrorBox, Kpi, PageHead, RefreshButton, useLoad } from './parts.jsx'
import UserDrawer from './UserDrawer.jsx'
import { fridayWindow } from '../../shared/promos.js'

const REASONS = { off: 'Aksiya öçiq edi', limit: 'Limitga yetgan', same_device: 'Öziga öziça (bir qurilma)' }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export default function PromosPage() {
  const { data, error, busy, reload } = useLoad(() => admin.promos(), [])
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (data && !draft) setDraft(data.settings)
  }, [data, draft])

  const dirty = draft && data && !same(draft, data.settings)
  const set = (part, patch) => setDraft((d) => ({ ...d, [part]: { ...d[part], ...patch } }))

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const r = await admin.savePromos(draft)
      setDraft(r.settings)
      setMsg({ ok: true, text: 'Saqlandi — özgarişlar darhol kuçga kirdi.' })
      reload()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }
  // a switch saves at once: turning a promotion off should not wait for a second click
  const toggle = async (part) => {
    const next = { ...draft, [part]: { ...draft[part], enabled: !draft[part].enabled } }
    const saved = { ...data.settings, [part]: { ...data.settings[part], enabled: next[part].enabled } }
    setDraft(next)
    try {
      await admin.savePromos(saved)
      setMsg({ ok: true, text: `${part === 'friday' ? 'Juma aksiyasi' : 'Döst taklifi'} ${next[part].enabled ? 'yoqildi' : 'öçirildi'}.` })
      reload()
    } catch (err) {
      setDraft(draft)
      setMsg({ ok: false, text: err.message })
    }
  }

  const s = data?.stats
  const L = data?.limits
  const week = s?.friday.weeks ?? []

  return (
    <div className="ad-page ad-promos">
      <PageHead title="Aksiyalar" sub="Juma sovğasi va döst taklifi: coin miqdori, yoqiş / öçiriş va natijalar">
        <RefreshButton onClick={reload} busy={busy} />
      </PageHead>
      {error && !data && <ErrorBox error={error} onRetry={reload} />}

      {s && (
        <div className="ad-kpis">
          <Kpi label="Bu jumada oldi" icon={Gift} value={fmt(week[0]?.users)} foot={`${fmt(week[0]?.coins)} coin · ${dateOnly(week[0]?.day)}`} spark={[...week].reverse().map((w) => w.users)} accent />
          <Kpi label="Juma sovğasi jami" icon={Coins} value={`${fmt(s.friday.coins)}`} foot={`${fmt(s.friday.claims)} marta · ${fmt(s.friday.users)} foydalanuvçi`} />
          <Kpi label="Taklif bilan kelganlar" icon={UserPlus} value={fmt(s.referral.total)} foot={`oxirgi 7 kun: ${fmt(s.referral.week)} · ${fmt(s.referral.referrers)} taklif qiluvçi`} spark={s.referral.daily.map((d) => d.n)} />
          <Kpi label="Taklif uçun berilgan coin" icon={Trophy} value={fmt(s.referral.coins)} foot={`${fmt(s.referral.rewarded)} ta hisoblandi · ${fmt(s.referral.skipped)} ta hisoblanmadi`} />
        </div>
      )}

      {draft && L && (
        <div className="ad-grid-2">
          <FridayEditor v={draft.friday} saved={data.settings.friday} limits={L} weeks={week} registered={s.registered} onChange={(p) => set('friday', p)} onToggle={() => toggle('friday')} />
          <ReferralEditor v={draft.referral} saved={data.settings.referral} limits={L} daily={s.referral.daily} onChange={(p) => set('referral', p)} onToggle={() => toggle('referral')} />
        </div>
      )}

      {s && (
        <div className="ad-grid-2 ad-grid-wide">
          <Card title="Oxirgi takliflar" sub="Kim kimni taklif qildi va coin berildimi">
            <div className="ad-table-wrap ad-mini-table">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Yangi foydalanuvçi</th>
                    <th>Taklif qilgan</th>
                    <th>Holat</th>
                    <th className="num">Coin</th>
                    <th className="num">Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {s.referral.recent.map((r) => (
                    <tr key={r.friend.id}>
                      <td>
                        <button className="ad-pr-user" onClick={() => setOpen(r.friend.id)}>
                          <b>{r.friend.name || 'Nomsiz'}</b>
                          <small>{r.friend.contact}</small>
                        </button>
                      </td>
                      <td>
                        <button className="ad-pr-user" onClick={() => setOpen(r.referrer.id)}>
                          <b>{r.referrer.name || 'Nomsiz'}</b>
                        </button>
                      </td>
                      <td>{r.status === 'rewarded' ? <span className="ad-badge ok">Hisoblandi</span> : <span className="ad-badge muted" title={REASONS[r.reason] ?? r.reason}>{REASONS[r.reason] ?? 'Hisoblanmadi'}</span>}</td>
                      <td className="num">{r.coins ? `+${fmt(r.coins)}${r.friendCoins ? ` / +${fmt(r.friendCoins)}` : ''}` : '—'}</td>
                      <td className="num ad-muted">{ago(r.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!s.referral.recent.length && <p className="ad-pr-empty">Hali hech kim havola orqali röyxatdan ötmagan</p>}
            </div>
          </Card>

          <Card title="Eñ faol taklif qiluvçilar" sub="Havolasi orqali eñ köp odam kelganlar">
            <ol className="ad-pr-top">
              {s.referral.top.map((u, i) => (
                <li key={u.id}>
                  <span className={`ad-pr-rank r${i + 1}`}>{i + 1}</span>
                  <button className="ad-pr-user row" onClick={() => setOpen(u.id)}>
                    <Avatar u={u} size={34} />
                    <span>
                      <b>{u.name || 'Nomsiz'}</b>
                      <small>{u.contact}</small>
                    </span>
                  </button>
                  <span className="ad-pr-count">
                    <b>{fmt(u.invited)}</b> döst
                    <small>+{fmt(u.coins)} coin</small>
                  </span>
                </li>
              ))}
            </ol>
            {!s.referral.top.length && <p className="ad-pr-empty">Hozirça röyxat böş</p>}
          </Card>
        </div>
      )}

      {(dirty || msg) && (
        <div className={`ad-pr-bar ${dirty ? 'dirty' : msg?.ok ? 'ok' : 'bad'}`} role="status">
          <span>{dirty ? 'Özgarişlar hali saqlanmagan' : msg.text}</span>
          {dirty ? (
            <span className="ad-pr-bar-tools">
              <button className="ad-btn" onClick={() => setDraft(data.settings)} disabled={saving}>
                <Undo2 size={15} /> Bekor qiliş
              </button>
              <button className="ad-btn ad-btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="ad-spin" /> : <Save size={15} />} Saqlaş
              </button>
            </span>
          ) : (
            <button className="ad-btn" onClick={() => setMsg(null)}>
              Yopiş
            </button>
          )}
        </div>
      )}

      {open && <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  )
}

/* ───────── editors ───────── */

function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`ad-pr-switch ${on ? 'on' : ''}`} onClick={onClick}>
      <span />
    </button>
  )
}

function Stepper({ label, hint, value, onChange, min, max, step = 1, presets = [], suffix = 'coin', zero }) {
  const clamp = (n) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)))
  return (
    <div className="ad-pr-field">
      <div className="ad-pr-field-head">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="ad-pr-stepper">
        <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label="Kamaytiriş">
          <Minus size={16} />
        </button>
        <label>
          <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(clamp(e.target.value))} />
          <span>{value === 0 && zero ? zero : suffix}</span>
        </label>
        <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label="Köpaytiriş">
          <Plus size={16} />
        </button>
      </div>
      {presets.length > 0 && (
        <div className="ad-pr-presets">
          {presets.map((p) => (
            <button type="button" key={p} className={p === value ? 'on' : ''} onClick={() => onChange(p)}>
              {p === 0 && zero ? zero : p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditorHead({ icon: Icon, title, sub, on, onToggle, changed }) {
  return (
    <div className="ad-pr-head">
      <span className={`ad-pr-ic ${on ? 'on' : ''}`}>
        <Icon size={20} />
      </span>
      <div>
        <h2>
          {title} {changed && <i className="ad-pr-dot" title="Saqlanmagan özgariş" />}
        </h2>
        <p>{sub}</p>
      </div>
      <span className={`ad-pr-state ${on ? 'on' : ''}`}>{on ? 'Faol' : 'Öçiq'}</span>
      <Switch on={on} onClick={onToggle} label={on ? 'Öçiriş' : 'Yoqiş'} />
    </div>
  )
}

function FridayEditor({ v, saved, limits, weeks, registered, onChange, onToggle }) {
  const w = useMemo(() => fridayWindow(), [])
  const max = Math.max(1, ...weeks.map((x) => x.users))
  return (
    <section className={`ad-card ad-pr-card ${v.enabled ? '' : 'is-off'}`}>
      <EditorHead icon={CalendarDays} title="Juma sovğasi" sub="Har juma (Toşkent vaqti) har bir foydalanuvçi bir marta bepul coin oladi" on={v.enabled} onToggle={onToggle} changed={v.coins !== saved.coins} />

      <div className={`ad-pr-now ${w.today && v.enabled ? 'live' : ''}`}>
        <i />
        {!v.enabled ? 'Aksiya öçiq — foydalanuvçilar sovğa ola olmaydi' : w.today ? 'Bugun juma — aksiya hozir ketyapti' : `Keyingi juma: ${dateOnly(w.nextAt)}`}
      </div>

      <Stepper label="Har bir foydalanuvçiga" hint={`${limits.fridayCoins.min}–${limits.fridayCoins.max}`} value={v.coins} onChange={(coins) => onChange({ coins })} min={limits.fridayCoins.min} max={limits.fridayCoins.max} step={5} presets={[10, 20, 30, 50, 100]} />

      <p className="ad-pr-note">
        Eñ köpi bilan bir jumada <b>{fmt(registered * v.coins)} coin</b> ({fmt(registered)} foydalanuvçi × {v.coins}). Amalda faqat saytga kirib «Oliş»ni bosganlar oladi.
      </p>

      <div className="ad-pr-chart">
        <div className="ad-pr-chart-head">
          <span>Oxirgi 8 juma</span>
          <small>neçta foydalanuvçi oldi</small>
        </div>
        <div className="ad-pr-bars">
          {[...weeks].reverse().map((x) => (
            <div key={x.day} className="ad-pr-bar-col" title={`${dateOnly(x.day)}: ${fmt(x.users)} kişi, ${fmt(x.coins)} coin`}>
              <b>{x.users || ''}</b>
              <span style={{ height: `${Math.max(4, (x.users / max) * 100)}%` }} className={x.users ? '' : 'zero'} />
              <small>{x.day.slice(8)}.{x.day.slice(5, 7)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ReferralEditor({ v, saved, limits, daily, onChange, onToggle }) {
  const changed = v.coins !== saved.coins || v.friendCoins !== saved.friendCoins || v.maxPerUser !== saved.maxPerUser
  const max = Math.max(1, ...daily.map((d) => d.n))
  return (
    <section className={`ad-card ad-pr-card ${v.enabled ? '' : 'is-off'}`}>
      <EditorHead icon={Users} title="Döst taklifi" sub="Foydalanuvçi havolasini ulaşadi; döst röyxatdan ötsa, taklif qilganga coin beriladi" on={v.enabled} onToggle={onToggle} changed={changed} />

      <div className="ad-pr-row">
        <Stepper label="Taklif qilganga" hint="har bir döst uçun" value={v.coins} onChange={(coins) => onChange({ coins })} min={limits.referralCoins.min} max={limits.referralCoins.max} step={5} presets={[10, 20, 30, 50]} />
        <Stepper label="Döstga qöşimça" hint="röyxatdan ötiş bonusi ustiga" value={v.friendCoins} onChange={(friendCoins) => onChange({ friendCoins })} min={limits.friendCoins.min} max={limits.friendCoins.max} step={5} presets={[0, 10, 20]} zero="yöq" />
      </div>
      <Stepper
        label="Bir kişi uçun limit"
        hint="neçta döst uçun coin olişi mumkin"
        value={v.maxPerUser}
        onChange={(maxPerUser) => onChange({ maxPerUser })}
        min={limits.maxPerUser.min}
        max={limits.maxPerUser.max}
        step={5}
        presets={[0, 10, 50, 100]}
        suffix="ta döst"
        zero="çeksiz"
      />

      <p className="ad-pr-note">
        Döst havola orqali röyxatdan ötsa, taklif qilgan <b>+{v.coins} coin</b> oladi{v.friendCoins ? <>, döstning öziga <b>+{v.friendCoins} coin</b> qöşiladi</> : null}.
        {' '}Bir hisob faqat bir marta hisoblanadi; öz havolasi bilan şu qurilmadan ötilsa coin berilmaydi.
      </p>

      <div className="ad-pr-chart">
        <div className="ad-pr-chart-head">
          <span>Oxirgi 30 kun</span>
          <small>havola orqali röyxatdan ötganlar</small>
        </div>
        <div className="ad-pr-bars thin">
          {daily.map((d) => (
            <div key={d.day} className="ad-pr-bar-col" title={`${dateOnly(d.day)}: ${fmt(d.n)}`}>
              <span style={{ height: `${Math.max(4, (d.n / max) * 100)}%` }} className={d.n ? '' : 'zero'} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
