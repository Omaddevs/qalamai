// PDF → images, text, Excel and PowerPoint — portable (core/formats.js), also run in the browser.
import * as core from '../core/formats.js'
import { onServer } from '../lib/node-platform.js'

export const toImages = onServer(core.toImages)
export const toText = onServer(core.toText)
export const toXlsx = onServer(core.toXlsx)
export const toPptx = onServer(core.toPptx)
