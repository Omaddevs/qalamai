// An invitation drawn by shared/invite.js inside an iframe: the studio's live preview and the
// small pictures in the template gallery and the project list.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { renderInvitePage } from '../../shared/invite.js'

/** Live preview: scripts run (countdown, cover, music), scroll position survives every edit. */
export const InviteLive = forwardRef(function InviteLive({ data, cover }, ref) {
  const frame = useRef(null)
  const y = useRef(0)
  const [doc, setDoc] = useState(() => renderInvitePage(data, { editor: true, cover }))

  // redraw shortly after typing stops, at the place the user was looking at
  useEffect(() => {
    const id = setTimeout(() => setDoc(renderInvitePage(data, { editor: true, cover, y: y.current })), 180)
    return () => clearTimeout(id)
  }, [data, cover])

  useEffect(() => {
    const onMsg = (e) => {
      if (e.source === frame.current?.contentWindow && e.data?.qi === 'y') y.current = e.data.y
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useImperativeHandle(ref, () => ({
    goto: (id) => frame.current?.contentWindow?.postMessage({ qi: 'goto', id }, '*'),
  }))

  return <iframe ref={frame} className="iv-frame" title="preview" srcDoc={doc} sandbox="allow-scripts" style={{ background: data.theme?.bg }} />
})

/** A still picture of the page (no scripts): thumbnails. */
export function InviteStill({ data }) {
  const doc = useMemo(() => renderInvitePage(data, { static: true }), [data])
  return <iframe className="iv-still" title="" srcDoc={doc} sandbox="" tabIndex={-1} aria-hidden="true" style={{ background: data?.theme?.bg }} />
}
