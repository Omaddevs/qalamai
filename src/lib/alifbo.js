// Moved to shared/ so the server's i18n can transliterate too. Script names follow the interface language.
import { SCRIPTS as BASE } from '../../shared/alifbo.js'
import { t } from '../i18n/index.js'

export { convert, detectScript } from '../../shared/alifbo.js'
export const SCRIPTS = BASE.map((s) => ({
  id: s.id,
  get label() {
    return t(`av.script.${s.id}`)
  },
}))
