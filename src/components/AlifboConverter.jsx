import { useMemo, useState } from 'react'
import { ArrowLeftRight, Copy, Check } from 'lucide-react'
import { SCRIPTS, convert, detectScript } from '../lib/alifbo.js'
import { t } from '../i18n/index.js'

// An old-script Uzbek sample, so the converter has something to convert on first open.
const SAMPLE = () => t('av.sample')

export default function AlifboConverter({ initial = '' }) {
  const [input, setInput] = useState(() => initial || SAMPLE())
  const [from, setFrom] = useState('auto')
  const [to, setTo] = useState('new')
  const [copied, setCopied] = useState(false)

  const source = from === 'auto' ? detectScript(input) : from
  const output = useMemo(() => convert(input, source, to), [input, source, to])

  const swap = () => {
    setFrom(to)
    setTo(source)
    setInput(output)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="conv">
      <div className="conv-bar">
        <div className="seg">
          <button className={from === 'auto' ? 'on' : ''} onClick={() => setFrom('auto')}>
            {t('av.auto')}
          </button>
          {SCRIPTS.map((s) => (
            <button key={s.id} className={from === s.id ? 'on' : ''} onClick={() => setFrom(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={swap} aria-label={t('av.swap')}>
          <ArrowLeftRight size={16} />
        </button>
        <div className="seg">
          {SCRIPTS.map((s) => (
            <button key={s.id} className={to === s.id ? 'on' : ''} onClick={() => setTo(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="conv-panes">
        <div className="pane">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} aria-label={t('av.input')} />
          <div className="pane-foot">
            {from === 'auto' && <span>{t('av.detected', { name: SCRIPTS.find((s) => s.id === source).label })}</span>}
            <span>{t('av.chars', { n: input.length })}</span>
          </div>
        </div>
        <div className="pane out">
          <textarea value={output} readOnly aria-label={t('av.output')} />
          <div className="pane-foot">
            <span>{SCRIPTS.find((s) => s.id === to).label}</span>
            <button className="chip" onClick={copy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t('av.copied') : t('av.copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
