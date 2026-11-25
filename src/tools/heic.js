// HEIC / HEIF (iPhone photos) decoding on the device. Only Safari decodes HEIC natively and the
// server's sharp build has no HEVC decoder, so libheif (WebAssembly, ~1 MB) does it here. It is
// loaded on the first HEIC file only. The primary image comes out upright (libheif applies the
// irot/imir transforms), as an ImageBitmap like createImageBitmap gives.
let lib = null

const load = () => (lib ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then((m) => m.default()))

/** Is this a HEIC/HEIF file? (ISO-BMFF "ftyp" box with a HEIF brand) */
export async function isHeic(blob) {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const tag = String.fromCharCode(...head.subarray(4, 12))
  return tag.startsWith('ftyp') && /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1)$/.test(tag.slice(4))
}

export async function decodeHeic(blob) {
  const libheif = await load()
  const decoder = new libheif.HeifDecoder()
  const images = decoder.decode(new Uint8Array(await blob.arrayBuffer()))
  if (!images?.length) throw new Error('HEIC: no image')
  // the primary image when the build can tell (is_primary is broken in some libheif-js builds); else the first
  const primary = (im) => {
    try {
      return im.is_primary()
    } catch {
      return false
    }
  }
  const image = images.find(primary) ?? images[0]
  try {
    const width = image.get_width()
    const height = image.get_height()
    const pixels = new ImageData(width, height)
    await new Promise((resolve, reject) =>
      image.display(pixels, (out) => (out ? resolve() : reject(new Error('HEIC: decode failed')))),
    )
    return await createImageBitmap(pixels)
  } finally {
    for (const im of images) im.free?.()
  }
}
