// Kit kinds and the kit check, without the templates (kits.js), so the app shell stays light.
import { t } from '../i18n/index.js'

// `kind` is the stable id stored on designs; label and blurb follow the interface language.
export const KIT_TYPES = Object.fromEntries(
  [
    ['logo', 'Logo'],
    ['bio', 'Link in Bio'],
    ['cv', 'Rezyume'],
  ].map(([type, kind]) => [
    type,
    {
      kind,
      get label() {
        return t(`kit.${type}.label`)
      },
      get blurb() {
        return t(`kit.${type}.blurb`)
      },
    },
  ]),
)

export const isKit = (d) => Boolean(d?.type && KIT_TYPES[d.type])
