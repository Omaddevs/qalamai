// Unicode fonts for pdf-lib on the server (the logic lives in core/fonts.js).
import { fontSet as coreFontSet, printable } from '../core/fonts.js'
import { nodePlatform } from './node-platform.js'

export { printable }
export const fontSet = (pdfDoc) => coreFontSet(pdfDoc, nodePlatform.font)
