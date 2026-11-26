// «Harakat»: the deck's page transition and the entrance preset for pages without their own
// animations (motion.js). Choosing a preset also picks the transition that suits it; both can be
// changed separately afterwards. They play while presenting and in the «Körish» preview.
import { Sparkles } from 'lucide-react'
import { t } from '../i18n/index.js'
import { Pop } from './Toolbar.jsx'
import { MOTIONS, MOTION_IDS, TRANSITIONS, reducedMotion, transitionOf } from './motion.js'

/** @param {{ deck: object, onChange: (patch: object) => void, onPreview: () => void }} p */
export default function MotionPanel({ deck, onChange, onPreview }) {
  const motion = MOTIONS[deck.motion] ? deck.motion : 'none'
  const tr = transitionOf(deck)
  return (
    <Pop title={t('mo.title')} button={<span className="tb-wide"><Sparkles size={15} /> {t('mo.button')}</span>} align="right">
      <div className="mo-panel">
        <span className="tb-label">{t('mo.preset')}</span>
        <div className="mo-grid">
          {MOTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={motion === id ? 'on' : ''}
              onClick={() => {
                onChange({ motion: id === 'none' ? undefined : id, ...(MOTIONS[id] ? { transition: MOTIONS[id].transition } : {}) })
                onPreview()
              }}
            >
              <span className={`mo-demo m-${id}`}><i /><i /><i /></span>
              {t(`mo.preset.${id}`)}
            </button>
          ))}
        </div>
        <p className="mo-note">{t('mo.presetNote')}</p>
        <span className="tb-label">{t('mo.transition')}</span>
        <div className="mo-tr">
          {TRANSITIONS.map((id) => (
            <button key={id} type="button" className={tr === id ? 'on' : ''} onClick={() => onChange({ transition: id })}>
              {t(`mo.tr.${id}`)}
            </button>
          ))}
        </div>
        {reducedMotion() && <p className="mo-note warn">{t('mo.reduced')}</p>}
        <p className="mo-note">{t('mo.exportNote')}</p>
      </div>
    </Pop>
  )
}
