import { useState } from 'react'
import { AppTile, Modal } from './ui.jsx'
import AlifboConverter from './AlifboConverter.jsx'
import { CoinChip, CoinPrice } from './Coins.jsx'
import { ACTION_BY_APP, COIN_COSTS, useWallet } from '../coins.js'
import { t } from '../i18n/index.js'

export function AppModal({ app, initialText = '', onClose, onCreate, onOpenPricing }) {
  const [topic, setTopic] = useState(initialText)
  const isConverter = app.id === 'alifbo'
  const { premium } = useWallet()
  const costInfo = COIN_COSTS[ACTION_BY_APP[app.id]] ?? {}
  const cost = costInfo.cost

  return (
    <Modal
      title={app.name}
      onClose={onClose}
      wide={isConverter}
      header={
        <div className="modal-app">
          <AppTile app={app} size={40} />
          <div>
            <h3>{app.name}</h3>
            <p>{app.desc}</p>
          </div>
        </div>
      }
    >
      <p className="about">{app.about}</p>

      {isConverter ? (
        <AlifboConverter initial={initialText} />
      ) : (
        <form
          className="create-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (app.soon || !topic.trim()) return
            onCreate(app, topic.trim())
          }}
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={app.placeholder ?? t('ui.topicPh')}
            disabled={app.soon}
            autoFocus
          />
          <button className="btn primary" disabled={app.soon || !topic.trim()}>
            {app.soon ? t('ui.soon') : t('ui.create')}
          </button>
        </form>
      )}

      {cost ? (
        <div className="app-cost">
          <span>{t('app.costEach')}{costInfo.per ? ` (${costInfo.per})` : ''}</span>
          <CoinPrice cost={cost} size={16} />
        </div>
      ) : app.soon ? null : (
        <div className="app-cost">
          <span>{t('app.free')}</span>
        </div>
      )}

      <div className="modal-foot">
        <span className="muted">
          {premium ? t('app.premium') : t('app.noWatermark')}
        </span>
        <CoinChip className="light" onClick={onOpenPricing} />
      </div>
    </Modal>
  )
}
