// Watermark and page numbers — the implementation is portable (core/stamp.js) and also runs in the browser.
import * as core from '../core/stamp.js'
import { onServer } from '../lib/node-platform.js'

export const frame = core.frame
export const watermark = onServer(core.watermark)
export const pageNumbers = onServer(core.pageNumbers)
