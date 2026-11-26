// «Sifat»: the deck's quality check (quality.js). Opening it measures the deck; each finding names
// its page and jumps there; «Avto-tuzatish» scales down the type of pages whose text runs over —
// the only fix made automatically, since it never changes words or data.
import { useState } from 'react'
import { ShieldCheck, Loader2, Wand2 } from 'lucide-react'
import { t } from '../i18n/index.js'
import { Pop } from './Toolbar.jsx'
import { checkDeck, fitDeck } from './quality.js'

/** @param {{ deck: object, theme: object, onGo: (index: number) => void, onApply: (slides: object[]) => void }} p */
export default function QualityPanel({ deck, theme, onGo, onApply }) {
  const [report, setReport] = useState(null) // { issues, score } of the deck as it was checked
  const [busy, setBusy] = useState(false)
  const [fixedN, setFixedN] = useState(null)

  const run = async () => {
    setBusy(true)
    setFixedN(null)
    try {
      setReport(await checkDeck(deck.slides, theme))
    } finally {
      setBusy(false)
    }
  }
  const fix = async () => {
    setBusy(true)
    try {
      const { slides, fixed } = await fitDeck(deck.slides, theme)
      onApply(slides)
      setFixedN(fixed.length)
      setReport(await checkDeck(slides, theme))
    } finally {
      setBusy(false)
    }
  }

  const score = report?.score
  const tone = score == null ? '' : score >= 85 ? 'good' : score >= 65 ? 'ok' : 'bad'
  const canFix = report?.issues.some((x) => x.code === 'overflow')
  return (
    <span onClickCapture={(e) => e.target.closest('.tb-btn') && !busy && run()}>
      <Pop title={t('q.title')} button={<span className="tb-wide"><ShieldCheck size={15} /> {t('q.button')}{score != null && <b className={`q-chip ${tone}`}>{score}</b>}</span>} align="right">
        <div className="q-panel">
          <div className="q-head">
            <span className={`q-score ${tone}`}>{busy && score == null ? <Loader2 size={18} className="spin" /> : score ?? '—'}</span>
            <div>
              <b>{t('q.title')}</b>
              <small>{busy ? t('q.checking') : report ? t('q.found', { n: report.issues.length }) : ''}</small>
            </div>
          </div>
          {fixedN != null && <p className="q-note">{t('q.fixed', { n: fixedN })}</p>}
          {report && report.issues.length === 0 && <p className="q-note good">{t('q.none')}</p>}
          <ul className="q-list">
            {report?.issues.map((x, k) => (
              <li key={k}>
                <button type="button" onClick={() => onGo(x.index)}>
                  <span className="q-page">{x.index + 1}</span>
                  <span>{t(`q.${x.code}`, { n: x.n ?? '' })}</span>
                </button>
              </li>
            ))}
          </ul>
          {canFix && (
            <button type="button" className="tb-btn wide q-fix" disabled={busy} onClick={fix}>
              <Wand2 size={14} /> {t('q.fix')}
            </button>
          )}
          <p className="q-note">{t('q.hint')}</p>
        </div>
      </Pop>
    </span>
  )
}
