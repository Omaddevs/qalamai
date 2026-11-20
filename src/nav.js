// Moves between addresses without a reload. Public pages use real paths (/narxlar, /kirish …),
// the app uses "#/…"; App.jsx listens to popstate and hashchange and re-reads the route.
export function go(url, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

/** Click handler for an <a href> that should navigate in-app (keeps Ctrl/⌘-click = new tab). */
export const linkClick = (onNav) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  onNav(e)
}
