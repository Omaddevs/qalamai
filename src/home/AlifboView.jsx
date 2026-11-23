import { HouseSimple, Layout, FolderSimple, TextAa } from '@phosphor-icons/react'
import { CoinChip } from '../components/Coins.jsx'
import AlifboConverter from '../components/AlifboConverter.jsx'
import { APPS } from '../data.js'
// the page header (pj-*, tv-bg) is shared with Loyihalar / Şablonlar: their styles come along, so this page
// looks right even when it is the first one opened
import './projects.css'
import './templates.css'
import './alifbo.css'
import { t } from '../i18n/index.js'

const TABS = [
  ['home', HouseSimple],
  ['templates', Layout],
  ['projects', FolderSimple],
  ['alifbo', TextAa],
]

// Decorative letter pairs: yangi lotin ↔ kirill
const PAIRS = [
  ['Ö', 'Ў'],
  ['Ğ', 'Ғ'],
  ['Ş', 'Ш'],
  ['Ç', 'Ч'],
]

export default function AlifboView({ onTab, onOpenPricing }) {
  const app = APPS.find((a) => a.id === 'alifbo')

  return (
    <div className="av">
      {/* ───── Header ───── */}
      <header className="av-head">
        <div className="tv-bg" aria-hidden="true">
          <span className="pj-wash" />
          <span className="pj-paper" />
        </div>
        <div className="av-head-text">
          <span className="pj-greet">
            <TextAa size={14} weight="duotone" className="av-ic" />
            {t('av.eyebrow')}
          </span>
          <h1 className="pj-title">
            {t('av.title1')} <em>{t('av.title2')}</em>
          </h1>
          <p className="pj-sub av-sub">{app.about}</p>

          <div className="pj-tabs av-tabs" role="tablist">
            {TABS.map(([id, Icon]) => (
              <button key={id} role="tab" aria-selected={id === 'alifbo'} className={id === 'alifbo' ? 'on' : ''} onClick={() => onTab(id)}>
                <Icon size={15} weight={id === 'alifbo' ? 'duotone' : 'regular'} /> {t(`hm.rail.${id}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="av-letters" aria-hidden="true">
          {PAIRS.map(([lat, cyr], i) => (
            <div key={lat} className="av-pair" style={{ '--i': i }}>
              <span>{lat}</span>
              <i>↔</i>
              <span>{cyr}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ───── Converter ───── */}
      <section className="av-card">
        <AlifboConverter />
      </section>

      <div className="modal-foot av-foot">
        <span className="muted">{t('av.free')}</span>
        <CoinChip className="light" onClick={onOpenPricing} />
      </div>
    </div>
  )
}
