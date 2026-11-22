// The typesetter on the server — the logic is portable (core/typeset.js).
import * as core from '../core/typeset.js'
import { nodePlatform } from '../lib/node-platform.js'

export { PRESETS, toBlocks } from '../core/typeset.js'
export const typeset = (html, opts) => core.typeset(html, opts, nodePlatform)
