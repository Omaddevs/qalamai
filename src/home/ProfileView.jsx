import { useEffect, useRef, useState } from 'react'
import {
  UserCircle, MapPin, CheckCircle, IdentificationCard, FileText, PresentationChart, Scroll, Envelope, Sparkle,
  GearSix, ShieldCheck, TelegramLogo, Phone, User, LockSimple, Check, SignOut, Crown, Key, Eye, EyeSlash, WarningCircle,
} from '@phosphor-icons/react'
import { apiUrl, changePassword, currentUser, onUser, setTgAutofill, tgAutofill } from '../api.js'
import { signOut } from '../account.js'
import { QalamNib } from '../components/ui.jsx'
import { initials, loadProfile, profileProgress, saveProfile } from '../profile.js'
import { onSynced } from '../changes.js'
import './titul.css'
import './profile.css'

const SUBTABS = [
  ['info', 'Maʼlumotlar', IdentificationCard],
  ['settings', 'Sozlamalar', GearSix],
]

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`pf-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

function Group({ icon: Icon, title, children }) {
  return (
    <fieldset className="tl-group">
      <legend>
        <Icon size={17} weight="duotone" /> {title}
      </legend>
      <div className="tl-grid">{children}</div>
    </fieldset>
  )
}

/** Password field with a show/hide toggle. */
function Secret({ label, value, onChange, autoComplete, show, onShow }) {
  return (
    <label className="tl-field pf-secret">
      <span className="tl-label">{label}</span>
      <span className="pf-secret-in">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} minLength={8} maxLength={128} />
        <button type="button" onClick={onShow} aria-label={show ? 'Parolni yaşiriş' : 'Parolni körsatiş'}>
          {show ? <EyeSlash size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  )
}

/** Change password — only for accounts that signed up with one. */
function PasswordForm({ notify }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const problem = !cur
    ? 'Joriy parolni kiriting'
    : next.length < 8
      ? 'Yangi parol kamida 8 ta belgi bölsin'
      : next === cur
        ? 'Yangi parol eskisidan farq qilsin'
        : next !== again
          ? 'Yangi parollar bir xil emas'
          : ''

  const submit = async (e) => {
    e.preventDefault()
    if (problem || busy) return
    setBusy(true)
    setErr('')
    try {
      await changePassword(cur, next)
      setCur('')
      setNext('')
      setAgain('')
      setDone(true)
      notify?.('Parol özgartirildi')
    } catch (x) {
      setErr(x.message || 'Parolni özgartirib bölmadi')
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => setShow((v) => !v)
  return (
    <form className="pf-pass wide" onSubmit={submit}>
      <Secret label="Joriy parol" value={cur} onChange={(v) => { setCur(v); setErr(''); setDone(false) }} autoComplete="current-password" show={show} onShow={toggle} />
      <div className="pf-pass-pair">
        <Secret label="Yangi parol" value={next} onChange={(v) => { setNext(v); setDone(false) }} autoComplete="new-password" show={show} onShow={toggle} />
        <Secret label="Yangi parolni takrorlang" value={again} onChange={(v) => { setAgain(v); setDone(false) }} autoComplete="new-password" show={show} onShow={toggle} />
      </div>
      <div className="pf-pass-foot">
        {err ? (
          <span className="pf-pass-msg bad">
            <WarningCircle size={15} weight="fill" /> {err}
          </span>
        ) : done ? (
          <span className="pf-pass-msg ok">
            <CheckCircle size={15} weight="fill" /> Parol özgartirildi. Boşqa qurilmalardagi sessiyalar yopildi.
          </span>
        ) : (
          <span className="pf-pass-msg">{(cur || next || again) && problem}</span>
        )}
        <button type="submit" className="pf-pass-btn" disabled={Boolean(problem) || busy}>
          <Key size={16} weight="bold" /> {busy ? 'Saqlanmoqda…' : 'Parolni özgartiriş'}
        </button>
      </div>
    </form>
  )
}

/** Sozlamalar: sign-in preferences and the account's linked sign-in methods. */
function SettingsView({ notify }) {
  const [auto, setAuto] = useState(tgAutofill)
  const [user, setUser] = useState(currentUser)
  useEffect(() => onUser(setUser), [])
  const real = user && !user.isGuest
  const methods = [
    ['Telegram', TelegramLogo, user?.linked?.telegram],
    ['Google', Envelope, user?.linked?.google],
    ['Parol', ShieldCheck, user?.linked?.password],
  ]
  return (
    <div className="tl-body pf-settings">
      <div className="tl-form">
        <Group icon={ShieldCheck} title="Kiriş va xavfsizlik">
          <div className="pf-set-row wide">
            <span className="pf-set-text">
              <b>Tasdiqlaş kodini avtomatik kiritiş</b>
              <small>Telegram bot raqamingizni tasdiqlagaç, kod saytga özi yoziladi va kiriş yakunlanadi. Öçirsangiz — kodni botdan qölda köçirasiz.</small>
            </span>
            <Switch
              label="Tasdiqlaş kodini avtomatik kiritiş"
              checked={auto}
              onChange={(on) => {
                setAuto(on)
                setTgAutofill(on)
              }}
            />
          </div>
        </Group>

        <Group icon={UserCircle} title="Hisob">
          {real ? (
            <>
              <div className="pf-set-row wide">
                <span className="pf-set-text">
                  <b>{user.phone || user.email || user.name || 'Hisob'}</b>
                  <small>
                    {user.phone ? (user.phoneVerified ? 'Telefon raqam Telegram orqali tasdiqlangan' : 'Telefon raqam tasdiqlanmagan') : 'Telefon raqam qöşilmagan'}
                  </small>
                </span>
                <span className={`pf-badge ${user.phoneVerified ? 'ok' : ''}`}>
                  <Phone size={13} weight="bold" /> {user.phoneVerified ? 'Tasdiqlangan' : 'Tasdiqlanmagan'}
                </span>
              </div>
              <div className="pf-methods wide">
                {methods.map(([label, Icon, on]) => (
                  <span key={label} className={`pf-badge ${on ? 'ok' : ''}`}>
                    <Icon size={13} weight="bold" /> {label} {on ? '— ulangan' : '— ulanmagan'}
                  </span>
                ))}
              </div>
              <div className="pf-set-row wide pf-out-row">
                <span className="pf-set-text">
                  <b>Hisobdan çiqiş</b>
                  <small>Şu brauzerdagi sessiya yopiladi. Loyiha, hujjat va coinlaringiz hisobingizda qoladi.</small>
                </span>
                <button
                  type="button"
                  className="pf-out"
                  onClick={signOut}
                >
                  <SignOut size={16} weight="bold" /> Çiqiş
                </button>
              </div>
            </>
          ) : (
            <div className="pf-guest wide">
              <p>Siz hozir mehmon sifatida işlayapsiz — coin va fayllaringiz hisobingizda saqlanadi.</p>
              <a className="pf-pass-btn" href="#/auth/login">
                Hisobga kiriş
              </a>
              <a className="pf-guest-alt" href="#/auth">
                Hisobim yöq — röyxatdan ötiş
              </a>
            </div>
          )}
        </Group>

        {real && user.linked?.password && (
          <Group icon={Key} title="Parol">
            <PasswordForm notify={notify} />
          </Group>
        )}
      </div>
    </div>
  )
}

// Where the profile is reused — shown so the user sees why filling it pays off.
const USES = [
  { icon: FileText, title: 'Referat va kurs işi titullari', ready: true },
  { icon: PresentationChart, title: 'Taqdimotlar', ready: true },
  { icon: Scroll, title: 'Rasmiy hujjatlar', ready: false },
]

/** Input with a leading icon and a check mark once it holds a value. */
function Input({ icon: Icon, label, value, onChange, wide, ...rest }) {
  const ok = String(value ?? '').trim().length > 0
  return (
    <label className={`pf-field ${wide ? 'wide' : ''}`}>
      <span className="pf-label">{label}</span>
      <span className={`pf-in ${ok ? 'ok' : ''}`}>
        <Icon size={18} weight="duotone" className="pf-in-ic" />
        <input value={value} onChange={onChange} {...rest} />
        <span className="pf-in-ok" aria-hidden="true">
          <Check size={11} weight="bold" />
        </span>
      </span>
    </label>
  )
}

function Section({ n, title, sub, done, total, children }) {
  return (
    <section className="pf-sec" style={{ '--d': `${n * 80}ms` }}>
      <header className="pf-sec-head">
        <span className="pf-sec-n">{String(n).padStart(2, '0')}</span>
        <span className="pf-sec-text">
          <b>{title}</b>
          <small>{sub}</small>
        </span>
        <span className={`pf-sec-count ${done === total ? 'full' : ''}`}>
          {done === total ? <CheckCircle size={14} weight="fill" /> : null}
          {done}/{total}
        </span>
      </header>
      <div className="pf-sec-grid">{children}</div>
    </section>
  )
}

export default function ProfileView({ profile, onProfile, notify }) {
  const [sub, setSub] = useState('info')
  const [p, setP] = useState(profile)
  const [saved, setSaved] = useState(true)
  const [me, setMe] = useState(currentUser)
  useEffect(() => onUser(setMe), [])
  const first = useRef(true)
  const pending = useRef(null)

  // autosave (debounced) + lift to HomePage so the rail card updates
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaved(false)
    pending.current = p
    const t = setTimeout(() => {
      pending.current = null
      saveProfile(p)
      onProfile(p)
      setSaved(true)
    }, 400)
    return () => clearTimeout(t)
  }, [p, onProfile])

  // the profile arrived from another device: show it, unless the user is typing right now
  useEffect(
    () =>
      onSynced((got) => {
        if (!got.profile || pending.current) return
        first.current = true // not a user edit — don't save it back
        setP(loadProfile())
      }),
    [],
  )

  // leaving the page inside the debounce window must not lose the last keystrokes
  useEffect(
    () => () => {
      if (pending.current) saveProfile(pending.current)
    },
    [],
  )

  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }))
  const { done, total } = profileProgress(p)
  const has = (v) => String(v ?? '').trim().length > 0
  const personalDone = [p.fullName, p.phone, p.city].filter(has).length

  return (
    <div className="tl pf">
      {/* ───── Header ───── */}
      <header className="tl-head">
        <div className="tv-bg" aria-hidden="true">
          <span className="pj-wash" />
          <span className="pj-paper" />
        </div>
        <div className="tl-head-text">
          <span className="pj-greet">
            <Sparkle size={14} weight="fill" className="tv-spark" />
            Bir marta töldiring — hamma joyda işlaydi
          </span>
          <h1 className="pj-title">
            Mening{' '}
            <span className="hx-word">
              <em>profilim</em>
              <svg className="hx-stroke" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 15C60 5 118 23 178 12S262 7 296 14" pathLength="1" />
              </svg>
              <span className="hx-pen" aria-hidden="true">
                <QalamNib height={44} />
              </span>
            </span>
          </h1>
          <p className="pj-sub">Ism va aloqa maʼlumotlari titul, taqdimot va hujjatlarga özi qöyiladi.</p>

          <div className="pj-tabs pf-tabs" role="tablist">
            {SUBTABS.map(([id, label, Icon]) => (
              <button key={id} role="tab" aria-selected={sub === id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>
                <Icon size={15} weight={sub === id ? 'duotone' : 'regular'} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="pf-id"
          aria-label={`Töldirilgan: ${done} / ${total}`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
            e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
          }}
        >
          <div className="pf-id-top">
            <span className="pf-id-brand">
              <QalamNib height={16} /> QalamAI ID
            </span>
            <span className={`pf-id-saved ${saved ? 'ok' : ''}`}>
              <span /> {saved ? 'Saqlandi' : 'Saqlanmoqda…'}
            </span>
          </div>
          <div className="pf-id-main">
            <span className="pf-ring" style={{ '--p': done / total }}>
              <span className="pf-avatar">
                {me?.avatarUrl ? <img src={apiUrl(me.avatarUrl)} alt="" /> : initials(p.fullName) || <UserCircle size={26} weight="duotone" />}
              </span>
            </span>
            <span className="pf-card-text">
              <b>{p.fullName.trim() || 'Ismingiz'}</b>
              <small>{me?.telegramUsername ? `@${me.telegramUsername}` : 'Talaba'}</small>
            </span>
          </div>
          <div className="pf-id-chips">
            {me && !me.isGuest && (
              <span className={`pf-tier ${me.tier ? 'paid' : ''}`}>
                <Crown size={12} weight="fill" /> {me.tier ?? 'Bepul'}
              </span>
            )}
            {p.city.trim() && (
              <span>
                <MapPin size={12} weight="bold" /> {p.city.trim()}
              </span>
            )}
          </div>
          <div className="pf-id-prog">
            <span>{done === total ? 'Profil töliq' : 'Töldirilgan'}</span>
            <b>
              {done}
              <i>/{total}</i>
            </b>
          </div>
          <div className="pf-segs">
            {Array.from({ length: total }, (_, k) => (
              <span key={k} className={k < done ? 'on' : ''} style={{ '--k': k }} />
            ))}
          </div>
        </div>
      </header>

      {sub === 'settings' ? (
        <SettingsView notify={notify} />
      ) : (
        <div className="pf-body">
          <form className="pf-form" onSubmit={(e) => e.preventDefault()}>
            <Section n={1} title="Şaxsiy maʼlumotlar" sub="Hujjat va taqdimotlarga avtomatik qöyiladi" done={personalDone} total={3}>
              <Input wide icon={User} label="F.I.Ş." value={p.fullName} onChange={set('fullName')} placeholder="Familiya Ism Otasining ismi" autoComplete="name" />
              <Input icon={Phone} label="Telefon" value={p.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" autoComplete="tel" inputMode="tel" />
              <Input icon={MapPin} label="Şahar" value={p.city} onChange={set('city')} placeholder="Toşkent" />
            </Section>

            <p className="pf-private">
              <LockSimple size={14} weight="duotone" /> Maʼlumotlar hisobingizda saqlanadi — istalgan qurilmadan kirsangiz şu yerda böladi.
            </p>
          </form>

          <aside className="pf-side">
            <div className="pf-uses">
              <h3>
                <MapPin size={15} weight="duotone" /> Qayerda işlatiladi
              </h3>
              {USES.map(({ icon: Icon, title, ready }) => (
                <span key={title} className={`pf-use ${ready ? '' : 'soon'}`}>
                  <Icon size={15} weight="duotone" /> {title}
                  {!ready && <em>tez kunda</em>}
                </span>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
