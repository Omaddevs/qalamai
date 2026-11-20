// Renders a tool's options from its JSON Schema (served by GET /tools).
import { t } from '../i18n/index.js'
import { FIELD_HINTS, FIELD_LABELS, SWATCHES, VISIBLE_IF, valueLabel } from './toolMeta.js'

const isColor = (p) => p.type === 'string' && /#\[0-9a-fA-F\]\{6\}/.test(p.pattern ?? '')
const isPages = (key) => key === 'pages' || key === 'ranges'

function Segmented({ tool, field, values, value, onChange }) {
  return (
    <div className="of-seg" role="radiogroup">
      {values.map((v) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {field === 'angle' ? `${v}°` : valueLabel(tool, field, v)}
        </button>
      ))}
    </div>
  )
}

function ColorField({ value, onChange }) {
  return (
    <div className="of-colors">
      {SWATCHES.map((c) => (
        <button key={c} type="button" className={`of-swatch ${value?.toLowerCase() === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
      ))}
      <label className="of-swatch custom" title={t('fs.otherColor')}>
        <input type="color" value={value ?? '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

function Field({ tool, name, prop, value, onChange }) {
  const label = FIELD_LABELS[name] ?? name
  const hint = FIELD_HINTS[name]

  if (prop.type === 'boolean') {
    return (
      <label className="of-row of-toggle">
        <span>
          <b>{label}</b>
          {hint && <small>{hint}</small>}
        </span>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <i aria-hidden="true" />
      </label>
    )
  }

  let control
  const consts = prop.anyOf?.map((x) => x.const).filter((x) => x !== undefined)
  if (prop.enum || consts?.length) {
    const values = prop.enum ?? consts
    control =
      values.length <= 4 || name === 'position' ? (
        <Segmented tool={tool} field={name} values={values} value={value} onChange={onChange} />
      ) : (
        <select className="of-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {values.map((v) => (
            <option key={v} value={v}>
              {valueLabel(tool, name, v)}
            </option>
          ))}
        </select>
      )
  } else if (isColor(prop)) {
    control = <ColorField value={value} onChange={onChange} />
  } else if ((prop.type === 'number' || prop.type === 'integer') && prop.maximum !== undefined && prop.maximum - (prop.minimum ?? 0) <= 400 && name !== 'start') {
    const pct = name === 'opacity'
    const step = prop.type === 'integer' ? 1 : pct ? 0.01 : 1
    control = (
      <div className="of-range">
        <input type="range" min={prop.minimum ?? 0} max={prop.maximum} step={step} value={value ?? prop.default ?? prop.minimum ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
        <output>{pct ? `${Math.round((value ?? 0) * 100)}%` : name === 'dpi' ? `${value} dpi` : name === 'percent' ? `${value}%` : value}</output>
      </div>
    )
  } else if (prop.type === 'number' || prop.type === 'integer') {
    control = (
      <input
        className="of-input"
        type="number"
        min={prop.minimum}
        max={prop.maximum}
        value={value ?? ''}
        placeholder={name === 'width' || name === 'height' ? t('fs.auto') : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    )
  } else {
    control = (
      <input
        className="of-input"
        type="text"
        value={value ?? ''}
        maxLength={prop.maxLength}
        placeholder={isPages(name) ? (name === 'pages' ? t('fs.allPages') : '1-3, 5') : ''}
        onChange={(e) => onChange(e.target.value === '' && isPages(name) ? undefined : e.target.value)}
      />
    )
  }

  return (
    <div className="of-row">
      <span className="of-label">
        <b>{label}</b>
      </span>
      {control}
      {hint && <small className="of-hint">{hint}</small>}
    </div>
  )
}

export default function OptionsForm({ tool, schema, value, onChange }) {
  const props = Object.entries(schema?.properties ?? {})
  const rules = VISIBLE_IF[tool] ?? {}
  const shown = props.filter(([k]) => !rules[k] || rules[k](value))
  if (!shown.length) return <p className="of-none">{t('fs.noOptions')}</p>
  return (
    <div className="of">
      {shown.map(([k, p]) => (
        <Field key={k} tool={tool} name={k} prop={p} value={value[k]} onChange={(v) => onChange({ ...value, [k]: v })} />
      ))}
    </div>
  )
}
