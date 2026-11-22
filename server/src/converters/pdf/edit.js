// PDF editor saves — the implementation is portable (core/edit.js) and also runs in the browser.
import * as core from '../core/edit.js'
import { onServer } from '../lib/node-platform.js'

export { uprightBox, arrangePages } from '../core/edit.js'
export { loadPdf } from '../core/pdf.js'
export const run = onServer(core.run)
