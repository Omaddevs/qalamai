import { useEffect, useRef } from 'react'

/** Inline-editable text: contentEditable while `editable`, committed on blur, Esc leaves. */
export function Text({ as: Tag = 'div', value, editable, onCommit, style, className, autoFocus, path }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!autoFocus || !editable || !ref.current) return
    const el = ref.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }, [autoFocus, editable])

  return (
    <Tag
      ref={ref}
      key={value}
      className={className}
      style={style}
      data-path={path}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.trim()
        if (v !== value) onCommit?.(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.blur()
      }}
    >
      {value}
    </Tag>
  )
}
