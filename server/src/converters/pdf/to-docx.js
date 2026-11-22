// PDF → DOCX — portable (core/docx.js), also run in the browser.
import * as core from '../core/docx.js'
import { onServer } from '../lib/node-platform.js'

export const run = onServer(core.run)
