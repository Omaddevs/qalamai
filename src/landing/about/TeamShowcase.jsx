// One team member on /jamoa, shown as a little editing studio: the text on one side; on the other the photo
// in a selection frame with a tool rail, a player bar and a timeline whose tracks are the person's directions
// (Mobil ilovalar → Flutter, React Native …). Everything comes from the admin panel (badge, role, bio, tracks,
// stats, links); a member without tracks gets the frame and text only.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkle, DeviceMobile, Globe, Robot, PenNib, Database, Brain, Megaphone, Code, MagicWand, CaretDown, SkipBack, Play, Pause,
  Repeat, TelegramLogo, ArrowUpRight, SpeakerHigh, LockSimple, NavigationArrow, Plus,
} from '@phosphor-icons/react'
import { t } from '../../i18n/index.js'
import { teamProfile } from '../../../shared/siteContent.js'
import { textOf } from './site.js'
import { CONTACT_TG } from './contact.js'
import './team-showcase.css'

/** An icon for a direction, from its name in any of our languages. */
function iconOf(name) {
  const n = name.toLowerCase()
  if (/mobil|mobile|моб|ios|android|ilova|прилож/.test(n)) return DeviceMobile
  if (/veb|web|sayt|site|сайт|веб|frontend|front/.test(n)) return Globe
  if (/bot|бот/.test(n)) return Robot
  if (/dizayn|design|дизайн|ui|ux|figma|brend|brand|бренд|logo/.test(n)) return PenNib
  if (/backend|server|сервер|api|baza|database|баз/.test(n)) return Database
  if (/\bai\b|ии|ml|data|ma[ʼ']?lumot|сунъий|sun[ʼ']?iy/.test(n)) return Brain
  if (/marketing|smm|маркет|reklama|реклам/.test(n)) return Megaphone
  return Code
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const LOOP_MS = 12000 // the playhead crosses the ruler (0–40 s) in 12 s
const STEP_MS = 3200 // a new direction lights up every 3.2 s while playing
const RULER = [0, 5, 10, 15, 20, 25, 30, 35, 40]

export default function TeamShowcase({ m, flip }) {
  const x = textOf(m)
  const { tracks, stats } = useMemo(() => teamProfile(x), [x])
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [visible, setVisible] = useState(false)
  const root = useRef(null)
  const head = useRef(null)
  const clock = useRef(null)
  const start = useRef(performance.now())

  // only animate while the block is on screen
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return setVisible(true)
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // playhead and time code, straight on the DOM (no re-render per frame)
  useEffect(() => {
    if (!playing || !visible) return
    let raf
    const tick = (now) => {
      const p = ((now - start.current) % LOOP_MS) / LOOP_MS
      if (head.current) head.current.style.setProperty('--p', p.toFixed(4))
      if (clock.current) {
        const ms = Math.floor(p * 40000)
        clock.current.textContent = `00:${String(Math.floor(ms / 1000)).padStart(2, '0')}:${String(ms % 1000).padStart(3, '0')}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, visible])

  // the lit direction moves on by itself while playing
  useEffect(() => {
    if (!playing || !visible || tracks.length < 2) return
    const id = setInterval(() => setActive((a) => (a + 1) % tracks.length), STEP_MS)
    return () => clearInterval(id)
  }, [playing, visible, tracks.length])

  const pick = (i) => {
    setActive(i)
    setPlaying(false)
  }
  const restart = () => {
    start.current = performance.now()
    setActive(0)
    setPlaying(true)
  }

  const contact = m.links?.telegram ?? CONTACT_TG
  const more = m.links?.site ?? m.links?.linkedin ?? m.links?.github ?? m.links?.instagram ?? null
  const track = tracks[active]
  const TrackIcon = track ? iconOf(track.name) : Sparkle
  const firstName = m.name.split(/\s+/)[0]

  return (
    <article className={`crew-show${flip ? ' flip' : ''}${tracks.length ? '' : ' no-tracks'}`} ref={root} aria-labelledby={`tm-${m.id}`}>
      <div className="crew-info">
        {x.badge && <span className="crew-badge"><Sparkle size={14} weight="fill" /> {x.badge}</span>}
        <h2 className="crew-name" id={`tm-${m.id}`}>{m.name}</h2>
        {x.role && <p className="crew-role">{x.role}</p>}
        {x.bio && <p className="crew-bio">{x.bio}</p>}

        {tracks.length > 0 && (
          <>
            <div className="crew-tabs" role="tablist" aria-label={t('ab.team.tracks')}>
              {tracks.map((tr, i) => {
                const I = iconOf(tr.name)
                return (
                  <button key={tr.name} role="tab" aria-selected={i === active} className={i === active ? 'on' : ''} onClick={() => pick(i)}>
                    <I size={18} weight={i === active ? 'fill' : 'regular'} /> {tr.name}
                  </button>
                )
              })}
            </div>
            {track?.skills.length > 0 && (
              <ul className="crew-skills" key={active} aria-label={track.name}>
                {track.skills.map((s, i) => <li key={s} style={{ '--i': i }}>{s}</li>)}
              </ul>
            )}
          </>
        )}

        {stats.length > 0 && (
          <dl className={`crew-stats n${stats.length}`}>
            {stats.map((s) => (
              <div key={s.value + s.label}>
                <dt>{s.value}</dt>
                {s.label && <dd>{s.label}</dd>}
              </div>
            ))}
          </dl>
        )}

        <div className="crew-actions">
          <a className="crew-btn primary" href={contact} target="_blank" rel="noopener noreferrer">
            <TelegramLogo size={19} weight="fill" /> {t('ab.team.contact')}
          </a>
          {more && (
            <a className="crew-btn" href={more} target="_blank" rel="noopener noreferrer">
              {t('ab.team.more')} <ArrowUpRight size={16} weight="bold" />
            </a>
          )}
        </div>
      </div>

      <div className={`crew-stage${playing && visible ? ' live' : ''}`}>
        <div className="crew-canvas">
          {tracks.length > 0 && (
            <div className="crew-rail" aria-hidden="true">
              <Code size={18} />
              {tracks.slice(0, 4).map((tr, i) => {
                const I = iconOf(tr.name)
                return <span key={tr.name} className={i === active ? 'on' : ''}><I size={18} weight={i === active ? 'fill' : 'regular'} /></span>
              })}
              <MagicWand size={18} />
              <NavigationArrow className="crew-rail-cursor" size={16} weight="fill" />
            </div>
          )}

          <div className="crew-frame">
            {m.photo ? <img src={m.photo} alt="" loading="lazy" decoding="async" /> : <span className="crew-frame-init">{initials(m.name)}</span>}
            <span className="crew-guides" aria-hidden="true" />
            <span aria-hidden="true">
              <i className="h tl" /><i className="h tr" /><i className="h bl" /><i className="h br" />
              <i className="e t" /><i className="e b" /><i className="e l" /><i className="e r" />
            </span>
            <span className="crew-spark" aria-hidden="true"><Sparkle size={26} weight="fill" /><NavigationArrow size={18} weight="fill" /></span>

            <div className="crew-player">
              <span className="crew-clock" aria-hidden="true"><span ref={clock}>00:00:000</span> <CaretDown size={12} weight="bold" /></span>
              <span className="crew-player-btns">
                <button type="button" onClick={restart} aria-label={t('ab.team.restart')}><SkipBack size={17} weight="bold" /></button>
                <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('ab.team.pause') : t('ab.team.play')}>
                  {playing ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" />}
                </button>
                <button type="button" onClick={restart} aria-label={t('ab.team.restart')} className="crew-hide-sm"><Repeat size={17} weight="bold" /></button>
              </span>
              <a className="crew-player-cta" href={contact} target="_blank" rel="noopener noreferrer" tabIndex={-1}><TelegramLogo size={16} weight="fill" /> {t('ab.team.contact')}</a>
            </div>
          </div>

          {m.photo && (
            <span className="crew-mini" aria-hidden="true">
              <img src={m.photo} alt="" loading="lazy" className="a" />
              <img src={m.photo} alt="" loading="lazy" className="b" />
            </span>
          )}
          {track && (
            <span className="crew-chip" key={active} aria-hidden="true">
              <TrackIcon size={18} weight="fill" /> {track.name}
              <NavigationArrow className="crew-chip-cursor" size={16} weight="fill" />
            </span>
          )}
          <span className="crew-hi" aria-hidden="true">
            {m.photo ? <img src={m.photo} alt="" loading="lazy" /> : <b>{initials(m.name)}</b>}
            {t('ab.team.hi')} ✌️
          </span>
        </div>

        {tracks.length > 0 && (
          <div className="crew-timeline" aria-hidden="true">
            <div className="crew-ruler">
              {RULER.map((s) => <span key={s}>{s ? `${s}s` : '0'}</span>)}
            </div>
            <div className="crew-rows">
              {tracks.map((tr, i) => {
                const I = iconOf(tr.name)
                return (
                  <div key={tr.name} className={`crew-row${i === active ? ' on' : ''}`}>
                    <span className="crew-row-head">
                      <CaretDown size={12} weight="bold" />
                      <I size={16} />
                      <b>{tr.name}</b>
                      <SpeakerHigh size={14} />
                      <LockSimple size={14} />
                    </span>
                    <span className="crew-clips">
                      {(tr.skills.length ? tr.skills : [firstName]).slice(0, 4).map((s) => <span key={s} className="crew-clip">{s}</span>)}
                    </span>
                  </div>
                )
              })}
              <div className="crew-keys">
                <span className="k on"><i /> {t('ab.team.plan')} <em /></span>
                <span className="k"><i /> {t('ab.team.ship')} <em /></span>
              </div>
              <span className="crew-head" ref={head}><i /></span>
            </div>
            <span className="crew-drag"><Code size={30} weight="bold" /><NavigationArrow className="c" size={18} weight="fill" /><Plus className="p" size={20} weight="bold" /></span>
          </div>
        )}
      </div>

    </article>
  )
}
