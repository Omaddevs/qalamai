import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  X, ArrowLeft, ArrowRight, PaperPlaneRight, Question, Handshake, WarningCircle, Lightbulb, Wrench, CreditCard,
  CircleNotch, CaretDown, Check, Checks, ShieldCheck, ChatTeardropText, UserCircle, PencilSimple,
} from '@phosphor-icons/react'
import { CONTACT_LIMITS, EMAIL_RE, PHONE_RE, SUPPORT_MESSAGE_MAX, SUPPORT_TOPICS } from '../../shared/support.js'
import { peekUser, sendSupport, supportMessages } from '../api.js'
import { formatDate, t } from '../i18n/index.js'
import { QalamNib } from './ui.jsx'
import { QALAMCHAT_OPEN } from './qalamChatBus.js'
import guyUrl from './qalam-chat-guy.png'

// Twinkling dots in the home hero, same look as the landing CTA card: [left %, top %, delay s].
const QC_STARS = [[12, 22, 0], [84, 18, 1.2], [70, 62, 2.1], [28, 74, 0.6], [52, 30, 2.8], [92, 70, 1.7]]
import './qalam-chat.css'

const ICONS = { question: Question, partnership: Handshake, complaint: WarningCircle, idea: Lightbulb, support: Wrench, payment: CreditCard }
// A message written before signing up waits here and comes back after registration.
const DRAFT_KEY = 'qalamchat.draft'
// "How do we reach you?" — asked once, then reused for every message.
const CONTACT_KEY = 'qalamchat.contact'
const TYPING_MS = 750

const readDraft = () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    return d && typeof d.text === 'string' && SUPPORT_TOPICS.includes(d.topic) ? d : null
  } catch {
    return null
  }
}
const writeDraft = (d) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable */
  }
}
const readContact = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? 'null')
    return c && typeof c.name === 'string' ? c : null
  } catch {
    return null
  }
}
const writeContact = (c) => {
  try {
    localStorage.setItem(CONTACT_KEY, JSON.stringify(c))
  } catch {
    /* storage unavailable */
  }
}
/** Errors by field ({} = fine): a name, and a phone or an email. */
function checkContact(c) {
  const e = {}
  if ((c.name ?? '').trim().length < 2) e.name = t('chat.contact.err.name')
  const phone = (c.phone ?? '').trim()
  const email = (c.email ?? '').trim()
  const phoneSet = phone.replace(/\D/g, '').length > 3 // "+998 " alone counts as empty
  if (phoneSet && (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 9)) e.phone = t('chat.contact.err.phone')
  if (email && !EMAIL_RE.test(email)) e.email = t('chat.contact.err.email')
  if (!phoneSet && !email) e.phone = t('chat.contact.err.reach')
  return e
}
const tidyContact = (c) => {
  const phone = (c.phone ?? '').trim()
  return { name: c.name.trim().replace(/\s+/g, ' '), phone: phone.replace(/\D/g, '').length > 3 ? phone : '', email: (c.email ?? '').trim() }
}
const registered = (u) => !!u && !u.isGuest
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const sameDay = (a, b) => a.toDateString() === b.toDateString()
const dayLabel = (d) => (sameDay(d, new Date()) ? t('chat.today') : formatDate(d, { day: 'numeric', month: 'long' }))

/* ───────── pieces ───────── */

function Avatar({ size = 'sm', online }) {
  return (
    <span className={`qc-av ${size}`}>
      <QalamNib height={size === 'lg' ? 22 : 15} />
      {online && <i />}
    </span>
  )
}

function BotLine({ children, last = true }) {
  return (
    <div className={`qc-msg bot${last ? ' last' : ''}`}>
      {last ? <Avatar /> : <span className="qc-av-gap" />}
      <div className="qc-bubble">{children}</div>
    </div>
  )
}

function MyLine({ m, faded, waiting }) {
  const Icon = ICONS[m.topic] ?? Question
  const at = m.createdAt ? new Date(m.createdAt) : null
  return (
    <div className={`qc-msg me${faded ? ' faded' : ''}`}>
      <div className="qc-bubble">
        <span className={`qc-tag t-${m.topic}`}><Icon size={11} weight="bold" /> {t(`chat.topic.${m.topic}`)}</span>
        <p>{m.message}</p>
      </div>
      {faded && <small className="qc-meta">{t(waiting ? 'chat.waitContact' : 'chat.notSent')}</small>}
      {at && (
        <small className="qc-meta">
          {hhmm(at)}
          <span className={`qc-ticks ${m.status}`} title={t(`chat.status.${m.status}`)}>
            {m.status === 'done' ? <Checks size={13} weight="bold" /> : <Check size={13} weight="bold" />}
          </span>
        </small>
      )}
    </div>
  )
}

function Typing() {
  return (
    <div className="qc-msg bot last" aria-label={t('chat.typing')}>
      <Avatar />
      <div className="qc-bubble qc-typing"><i /><i /><i /></div>
    </div>
  )
}

/** "How do we reach you?" — a small form inside a bot bubble, prefilled from the account. */
function ContactCard({ initial, mode, busy, onSave, onCancel }) {
  const [f, setF] = useState(() => ({ name: initial?.name ?? '', phone: initial?.phone || '+998 ', email: initial?.email ?? '' }))
  const [errors, setErrors] = useState({})
  const first = useRef(null)
  useEffect(() => {
    requestAnimationFrame(() => first.current?.focus())
  }, [])
  const set = (k) => (e) => {
    const v = e.target.value
    setF((x) => ({ ...x, [k]: v }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const submit = (e) => {
    e.preventDefault()
    const errs = checkContact(f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave(tidyContact(f))
  }
  const field = (k, label, props) => (
    <label className={`qc-cf${errors[k] ? ' bad' : ''}`}>
      <span>{label}</span>
      <input {...props} value={f[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} />
      {errors[k] && <em>{errors[k]}</em>}
    </label>
  )
  return (
    <form className="qc-contact" onSubmit={submit} noValidate>
      <b className="qc-contact-title"><UserCircle size={16} weight="fill" /> {t('chat.contact.title')}</b>
      <p>{t('chat.contact.lead')}</p>
      {field('name', t('chat.contact.name'), { ref: first, autoComplete: 'name', maxLength: CONTACT_LIMITS.name, placeholder: t('chat.contact.namePh') })}
      {field('phone', t('chat.contact.phone'), { type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: CONTACT_LIMITS.phone, placeholder: '+998 90 123 45 67' })}
      {field('email', t('chat.contact.email'), { type: 'email', autoComplete: 'email', maxLength: CONTACT_LIMITS.email, placeholder: 'name@example.com' })}
      <small className="qc-contact-note">{t('chat.contact.or')}</small>
      <div className="qc-actions">
        <button type="submit" className="qc-btn dark" disabled={busy}>
          {busy ? <CircleNotch size={13} weight="bold" className="qc-spin" /> : null}
          {mode === 'send' ? t('chat.contact.saveSend') : t('chat.contact.save')}
          {!busy && mode === 'send' && <PaperPlaneRight size={13} weight="fill" />}
        </button>
        {mode === 'edit' && <button type="button" className="qc-btn" onClick={onCancel}>{t('chat.contact.cancel')}</button>}
      </div>
    </form>
  )
}

/** Topic selector inside the composer: a compact pill that opens a menu. */
function TopicPicker({ topic, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const off = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])
  const Icon = ICONS[topic]
  return (
    <div className="qc-picker" ref={ref}>
      <button type="button" className={`qc-picker-btn t-${topic}`} aria-haspopup="listbox" aria-expanded={open} aria-label={t('chat.topic')} onClick={() => setOpen((o) => !o)}>
        <Icon size={13} weight="fill" /> {t(`chat.topic.${topic}`)} <CaretDown size={11} weight="bold" className="caret" />
      </button>
      {open && (
        <ul className="qc-menu" role="listbox" aria-label={t('chat.topic')}>
          {SUPPORT_TOPICS.map((id) => {
            const I = ICONS[id]
            return (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={topic === id}
                  className={`t-${id}${topic === id ? ' on' : ''}`}
                  onClick={() => {
                    onPick(id)
                    setOpen(false)
                  }}
                >
                  <span className="ic"><I size={14} weight="duotone" /></span>
                  {t(`chat.topic.${id}`)}
                  {topic === id && <Check size={13} weight="bold" className="tick" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Floating chat in the bottom-right corner: registered users write to the team (partnership, complaint …).
 * Guests and visitors may type, but sending asks them to sign up first — the draft survives the trip.
 */
export default function QalamChat({ onSignup, onLogin }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('home') // home | chat
  const [user, setUser] = useState(null)
  const [history, setHistory] = useState([]) // messages already on the server
  const [notes, setNotes] = useState([]) // bot lines added during this visit
  const [typing, setTyping] = useState(false)
  const [topic, setTopic] = useState('question')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null) // a message not sent yet: before signing up, or before contact details
  const [contact, setContact] = useState(readContact)
  const [askContact, setAskContact] = useState(null) // null | 'send' | 'edit'
  const body = useRef(null)
  const input = useRef(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const load = useCallback(async () => {
    const u = await peekUser()
    setUser(u)
    if (registered(u)) setHistory(await supportMessages().catch(() => []))
    return u
  }, [])

  // Back from sign-up with a draft: open the chat with the text ready to send.
  useEffect(() => {
    const d = readDraft()
    if (!d) return
    load().then((u) => {
      if (!registered(u)) return
      setTopic(d.topic)
      setText(d.text)
      setNotes([{ key: 'chat.draftBack', id: 'draft' }])
      setView('chat')
      setOpen(true)
    })
  }, [load])

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(QALAMCHAT_OPEN, show)
    return () => window.removeEventListener(QALAMCHAT_OPEN, show)
  }, [])

  useEffect(() => {
    if (!open) return
    load()
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, load])

  useEffect(() => {
    if (open && view === 'chat') requestAnimationFrame(() => input.current?.focus())
  }, [open, view])

  // keep the newest line in view
  useLayoutEffect(() => {
    const el = body.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [history, notes, pending, typing, view])

  // grow the composer with its text (up to 5 lines)
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text, open, view])

  /** A bot line, after a short "typing…" pause so the reply feels alive. */
  const note = (key) => {
    setTyping(true)
    timers.current.push(
      setTimeout(() => {
        setTyping(false)
        setNotes((n) => [...n, { key, id: `${key}-${Date.now()}` }])
      }, TYPING_MS),
    )
  }

  const startChat = (id) => {
    if (id) setTopic(id)
    setView('chat')
  }

  const holdForSignup = (msg) => {
    writeDraft({ topic, text: msg })
    setPending({ topic, message: msg })
    setText('')
    note('chat.needAccount')
  }

  /** Deliver one message with the contact details; false when it could not be sent. */
  const deliver = async (msgTopic, msg, who) => {
    try {
      const saved = await sendSupport(msgTopic, msg, who)
      writeDraft(null)
      setPending(null)
      setHistory((h) => [...h, saved])
      note('chat.sent')
      return true
    } catch (err) {
      if (err?.code === 'REGISTER_REQUIRED') {
        setText('')
        holdForSignup(msg)
      } else if (err?.code?.startsWith('CONTACT_')) {
        setPending({ topic: msgTopic, message: msg, waiting: true })
        setAskContact('send')
      } else note(err?.status === 429 ? 'chat.err.tooMany' : 'chat.err.send')
      return false
    }
  }

  const send = async () => {
    const msg = text.trim()
    if (msg.length < 2 || busy) return
    setBusy(true)
    try {
      const u = registered(user) ? user : await load()
      if (!registered(u)) return holdForSignup(msg)
      setText('')
      // first message from this browser: ask how to reach the sender, then send
      if (!contact || Object.keys(checkContact(contact)).length) {
        setPending({ topic, message: msg, waiting: true })
        setAskContact('send')
        return
      }
      await deliver(topic, msg, contact)
    } catch {
      note('chat.err.send')
    } finally {
      setBusy(false)
    }
  }

  const saveContact = async (c) => {
    writeContact(c)
    setContact(c)
    const mode = askContact
    setAskContact(null)
    if (mode === 'send' && pending) {
      setBusy(true)
      await deliver(pending.topic, pending.message, c)
      setBusy(false)
    }
  }
  const contactSeed = contact ?? (user ? { name: user.name, phone: user.phone, email: user.email } : null)

  const go = (fn) => {
    setOpen(false)
    fn?.()
  }

  const last = history[history.length - 1]
  const ready = text.trim().length >= 2

  // conversation lines with day separators
  const lines = []
  let prevDay = null
  const dayOf = (iso) => {
    const d = iso ? new Date(iso) : new Date()
    if (!prevDay || !sameDay(prevDay, d)) lines.push(<div key={`day-${d.toDateString()}`} className="qc-day"><span>{dayLabel(d)}</span></div>)
    prevDay = d
  }
  dayOf(history[0]?.createdAt)
  lines.push(<BotLine key="hello"><p>{t('chat.hello')}</p></BotLine>)
  history.forEach((m) => {
    dayOf(m.createdAt)
    lines.push(<MyLine key={m.id} m={m} />)
  })
  if (pending) lines.push(<MyLine key="pending" m={pending} faded waiting={pending.waiting} />)
  notes.forEach((n) =>
    lines.push(
      <BotLine key={n.id}>
        <p>{t(n.key)}</p>
        {n.key === 'chat.needAccount' && !registered(user) && (
          <div className="qc-actions">
            <button className="qc-btn dark" onClick={() => go(onSignup)}>{t('chat.signup')} <ArrowRight size={13} weight="bold" /></button>
            <button className="qc-btn" onClick={() => go(onLogin)}>{t('chat.login')}</button>
          </div>
        )}
      </BotLine>,
    ),
  )

  return (
    <div className={`qc${open ? ' open' : ''}`}>
      {open && (
        <section className={`qc-panel v-${view}`} role="dialog" aria-label="QalamChat">
          {view === 'home' ? (
            <>
              <header className="qc-hero">
                <span className="qc-bg" aria-hidden="true">
                  <span className="qc-bg-grid" />
                  <span className="qc-bg-beam" />
                  <span className="qc-bg-rings"><i /><i /></span>
                  {QC_STARS.map(([x, y, d], i) => <i key={i} className="qc-bg-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />)}
                </span>
                <div className="qc-hero-top">
                  <span className="qc-brand"><Avatar size="lg" /> QalamChat</span>
                  <button className="qc-x" onClick={() => setOpen(false)} aria-label={t('chat.close')}><X size={16} weight="bold" /></button>
                </div>
                <h2>
                  <span>{t('chat.hi')}</span>
                  <span className="dim">{t('chat.help')}</span>
                </h2>
                <span className="qc-online"><i />{t('chat.online')} · {t('chat.status')}</span>
              </header>

              <div className="qc-home">
                <button className="qc-start" onClick={() => startChat()}>
                  <span className="qc-start-ic"><ChatTeardropText size={20} weight="fill" /></span>
                  <span className="qc-start-txt">
                    <b>{t('chat.writeUs')}</b>
                    <small>{t('chat.status')}</small>
                  </span>
                  <span className="qc-start-go"><PaperPlaneRight size={16} weight="fill" /></span>
                </button>

                {last && (
                  <button className="qc-last" onClick={() => startChat()}>
                    <small>{t('chat.last')}</small>
                    <span className="qc-last-row">
                      <span className="qc-last-msg">{last.message}</span>
                      <span className={`qc-ticks ${last.status}`}>{last.status === 'done' ? <Checks size={13} weight="bold" /> : <Check size={13} weight="bold" />}</span>
                    </span>
                  </button>
                )}

                <p className="qc-label">{t('chat.pickTopic')}</p>
                <div className="qc-cards">
                  {SUPPORT_TOPICS.map((id, i) => {
                    const Icon = ICONS[id]
                    return (
                      <button key={id} className={`qc-card t-${id}`} style={{ '--i': i }} onClick={() => startChat(id)}>
                        <span className="ic"><Icon size={18} weight="duotone" /></span>
                        <b>{t(`chat.topic.${id}`)}</b>
                        <small>{t(`chat.desc.${id}`)}</small>
                      </button>
                    )
                  })}
                </div>

                <p className="qc-secure"><ShieldCheck size={13} weight="fill" /> {t('chat.secure')}</p>
              </div>
            </>
          ) : (
            <>
              <header className="qc-head">
                <button className="qc-x" onClick={() => setView('home')} aria-label={t('chat.back')}><ArrowLeft size={16} weight="bold" /></button>
                <Avatar size="lg" online />
                <div className="qc-head-txt">
                  <b>QalamChat</b>
                  <small><i />{t('chat.online')}</small>
                </div>
                <button className="qc-x" onClick={() => setOpen(false)} aria-label={t('chat.close')}><X size={16} weight="bold" /></button>
              </header>

              <div className="qc-body" ref={body} aria-live="polite">
                {lines}
                {typing && <Typing />}
                {askContact && !typing && (
                  <BotLine>
                    <ContactCard initial={contactSeed} mode={askContact} busy={busy} onSave={saveContact} onCancel={() => setAskContact(null)} />
                  </BotLine>
                )}
              </div>

              <form
                className="qc-foot"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                {contact && registered(user) && !askContact && (
                  <div className="qc-as">
                    <UserCircle size={14} weight="fill" />
                    <span>{t('chat.contact.as')} <b>{contact.name}</b> · {contact.phone || contact.email}</span>
                    <button type="button" onClick={() => setAskContact('edit')} aria-label={t('chat.contact.edit')} title={t('chat.contact.edit')}>
                      <PencilSimple size={13} weight="bold" />
                    </button>
                  </div>
                )}
                <div className="qc-compose">
                  <textarea
                    ref={input}
                    rows={1}
                    value={text}
                    maxLength={SUPPORT_MESSAGE_MAX}
                    placeholder={t('chat.placeholder')}
                    aria-label={t('chat.placeholder')}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        send()
                      }
                    }}
                  />
                  <div className="qc-compose-bar">
                    <TopicPicker topic={topic} onPick={setTopic} />
                    {text.length > SUPPORT_MESSAGE_MAX - 200 && <span className="qc-count">{SUPPORT_MESSAGE_MAX - text.length}</span>}
                    <button type="submit" className={`qc-send${ready ? ' ready' : ''}`} disabled={busy || !ready} aria-label={t('chat.send')}>
                      {busy ? <CircleNotch size={16} weight="bold" className="qc-spin" /> : <PaperPlaneRight size={16} weight="fill" />}
                    </button>
                  </div>
                </div>
                <p className="qc-hint">{t('chat.hint')}</p>
              </form>
            </>
          )}
        </section>
      )}

      <button className="qc-launch" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t('chat.close') : t('chat.open')}>
        {open ? (
          <X size={20} weight="bold" />
        ) : (
          <>
            <img className="qc-guy" src={guyUrl} alt="" width={107} height={61} draggable={false} />
            <span className="qc-pill">{t('chat.launch')}</span>
          </>
        )}
      </button>
    </div>
  )
}
