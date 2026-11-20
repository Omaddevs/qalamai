// Account actions shared by the sidebar and the profile page.
import { t } from './i18n/index.js'
import { signOutSafely } from './sync.js'

/** Sign out without losing unsent work (asks first if something isn't on the server), then go to the landing page. */
export async function signOut() {
  const done = await signOutSafely((n) => window.confirm(t('sync.leaveConfirm', { n })))
  if (!done) return
  window.location.hash = '#/welcome'
  window.scrollTo(0, 0)
}
