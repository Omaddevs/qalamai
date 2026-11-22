// PDF compression — portable (core/compress.js), also run in the browser.
import * as core from '../core/compress.js'
import { onServer } from '../lib/node-platform.js'

export const run = onServer(core.run)
