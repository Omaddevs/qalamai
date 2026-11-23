import { useRef } from 'react'
import { Text } from './Text.jsx'
import { LayoutBody, themeVars } from './layouts.jsx'
import { NewDecor } from './decors.jsx'
import FreeLayer from './FreeLayer.jsx'
import './canva.css'

// Page backgrounds live in decors.jsx, structured page layouts in layouts.jsx.

/* ───────────── Slide ───────────── */

/**
 * Renders one slide. Pass `editable` + handlers for the canvas; omit them for thumbnails.
 */
export default function Slide({
  slide,
  theme,
  index,
  editable = false,
  selectedIds = [],
  editingId,
  onSelect,
  onEditEl,
  onChange,
  onElChange,
  onElsChange,
  onElCommitStart,
  onTextCommit,
  onPickImage,
  playing = false,
  autoAnim = false,
  preview = false,
  className = '',
}) {
  const root = useRef(null)
  // A detached page keeps the look (light/dark alternation) of the position it was made at.
  const at = slide.themeIndex ?? index ?? 0
  const th = theme.alt && at % 2 === 1 ? { ...theme, ...theme.alt } : theme
  theme = th
  const isTitle = slide.type === 'title'
  const box = isTitle ? theme.box : theme.content
  // A "free" page is only elements (Canva model); otherwise the template lays the page out.
  const free = Boolean(slide.free)
  const structured = !free && (Boolean(theme.layouts) || !(slide.type === 'title' || slide.type === 'content'))
  const align = theme.center ? 'center' : 'left'
  const titleTransform = theme.upper ? 'uppercase' : 'none'

  return (
    <div
      ref={root}
      className={`slide ${playing ? 'playing' : ''} ${className}`}
      data-skin={theme.skin}
      style={{ background: slide.bg ?? theme.bg, color: theme.text, fontFamily: theme.bodyFont, ...themeVars(theme) }}
    >
      <div className="slide-inner">
        {/* the template's background artwork; once on the canvas it becomes elements (decorFree) */}
        {!slide.decorFree && (
          <div className="s-decor">
            <NewDecor kind={theme.decor} cover={isTitle || slide.type === 'end'} theme={theme} index={at} />
          </div>
        )}

        {free ? null : structured ? (
          <LayoutBody slide={slide} theme={theme} index={index} editable={editable} onChange={onChange} />
        ) : (
        <div
          className="s-classic"
          style={{
            position: 'absolute',
            left: `${box.l}%`,
            top: `${box.t}%`,
            width: `${box.w}%`,
            textAlign: isTitle ? align : 'left',
          }}
        >
          {isTitle ? (
            <>
              <Text
                className="s-title"
                value={slide.title}
                editable={editable}
                onCommit={(v) => onChange?.({ title: v })}
                style={{
                  fontFamily: theme.titleFont,
                  fontWeight: theme.titleWeight,
                  fontSize: `${5.8 * (theme.titleScale ?? 1) * (preview ? 1.12 : 1)}cqw`,
                  textTransform: titleTransform,
                }}
              />
              <div
                className="s-rule"
                style={{ background: theme.accent, margin: align === 'center' ? '2.2cqw auto' : '2.2cqw 0' }}
              />
              <Text
                className="s-sub"
                value={slide.subtitle}
                editable={editable}
                onCommit={(v) => onChange?.({ subtitle: v })}
                style={{ color: theme.muted }}
              />
            </>
          ) : (
            <>
              <div className="s-rule sm" style={{ background: theme.accent }} />
              <Text
                className="s-heading"
                value={slide.title}
                editable={editable}
                onCommit={(v) => onChange?.({ title: v })}
                style={{
                  fontFamily: theme.titleFont,
                  fontWeight: theme.titleWeight,
                  fontSize: `${3.4 * (theme.titleScale ?? 1)}cqw`,
                  textTransform: titleTransform,
                }}
              />
              <ul className="s-list">
                {slide.bullets.map((b, i) => (
                  <li key={i}>
                    <span className="s-dot" style={{ background: theme.accent }} />
                    <Text
                      as="span"
                      value={b}
                      editable={editable}
                      onCommit={(v) =>
                        onChange?.({
                          bullets: v ? slide.bullets.map((x, j) => (j === i ? v : x)) : slide.bullets.filter((_, j) => j !== i),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        )}

        {!isTitle && !structured && !free && index != null && (
          <div className="s-num" style={{ color: theme.muted }}>
            {String(index + 1).padStart(2, '0')}
          </div>
        )}

        <FreeLayer
          elements={slide.elements}
          theme={theme}
          editable={editable}
          selected={selectedIds}
          editingId={editingId}
          rootRef={root}
          onSelect={onSelect}
          onEdit={onEditEl}
          onChange={onElChange}
          onChangeMany={onElsChange}
          onCommitStart={onElCommitStart}
          onCommitText={onTextCommit}
          onPickImage={onPickImage}
          autoAnim={playing && autoAnim}
        />
      </div>
    </div>
  )
}
