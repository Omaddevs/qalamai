// Images → PDF (one image per page) — the implementation is portable (core/organize.js).
import { imagesToPdf } from '../core/organize.js'
import { onServer } from '../lib/node-platform.js'

export const run = onServer(imagesToPdf)
