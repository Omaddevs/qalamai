// Merge, split and rotate — the implementation is portable (core/organize.js) and also runs in the browser.
import * as core from '../core/organize.js'
import { onServer } from '../lib/node-platform.js'

export const merge = onServer(core.merge)
export const split = onServer(core.split)
export const rotate = onServer(core.rotate)
