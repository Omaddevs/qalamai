// A picture from a link the user pasted (Google Images, a site, a direct image address): the browser
// cannot read other sites' pictures (CORS), so the server fetches it once and hands the bytes back;
// the editor then keeps it on the device like an uploaded file. Nothing is stored here.
//
// It must not become a way into our own network (SSRF):
//   · only http/https on the standard ports;
//   · every address a name resolves to is checked when the connection is made (no private, loopback,
//     link-local, CGNAT or multicast ranges), which also stops DNS rebinding; literal IPs likewise;
//   · redirects are followed by hand (at most 4), each hop checked again;
//   · size and time are capped, and only real image bytes (checked by their signature) are returned.
import { lookup as dnsLookup } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import { AppError } from '../../lib/errors.js'

export const MAX_BYTES = 15 * 1024 * 1024
const MAX_HTML = 1024 * 1024
const MAX_HOPS = 4
const TIMEOUT_MS = 15_000

export const badUrl = () => new AppError(400, 'IMAGE_URL_BAD', 'Havola notöğri — rasm manzilini (http yoki https) qöying')
export const noImage = () => new AppError(422, 'IMAGE_NOT_FOUND', 'Bu havolada rasm topilmadi')
export const tooBig = () => new AppError(413, 'IMAGE_TOO_BIG', 'Rasm juda katta (15 MB gaça)')
export const fetchFailed = () => new AppError(502, 'IMAGE_FETCH_FAILED', 'Rasmni yuklab bölmadi — boşqa havolani sinab köring')

/* ───────── which addresses may be reached ───────── */

const blocked = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(net, bits, 'ipv4')
for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32]]) blocked.addSubnet(net, bits, 'ipv6')

/** True for an address the server must never connect to (IPv4-mapped IPv6 is judged as IPv4). */
export function isPrivateAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return blocked.check(mapped[1], 'ipv4')
  const family = isIP(address)
  if (!family) return true
  return blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

/** dns.lookup that refuses names pointing (even partly) at a private address. */
function safeLookup(hostname, options, cb) {
  dnsLookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err)
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return cb(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }))
    if (options?.all) return cb(null, addrs)
    cb(null, addrs[0].address, addrs[0].family)
  })
}

/* ───────── links people paste ───────── */

/**
 * The image address inside a link: search-result pages carry the original in a parameter
 * (Google `imgurl`, Bing `mediaurl`, Yandex `img_url`). Throws for anything not http(s).
 */
export function imageUrlOf(input) {
  let url
  try {
    url = new URL(String(input).trim())
  } catch {
    throw badUrl()
  }
  for (const key of ['imgurl', 'mediaurl', 'img_url']) {
    const inner = url.searchParams.get(key)
    if (inner && /^https?:\/\//i.test(inner)) return imageUrlOf(inner)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw badUrl()
  if (url.port && !['80', '443'].includes(url.port)) throw badUrl()
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && isPrivateAddress(host)) throw badUrl()
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw badUrl()
  return url
}

/** The kind of picture from its first bytes (a server's own Content-Type is not trusted). */
export function sniffImage(buf) {
  const b = buf.subarray(0, 32)
  const asc = (s, at = 0) => b.subarray(at, at + s.length).toString('latin1') === s
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (asc('\x89PNG\r\n\x1a\n')) return 'image/png'
  if (asc('GIF87a') || asc('GIF89a')) return 'image/gif'
  if (asc('RIFF') && asc('WEBP', 8)) return 'image/webp'
  if (asc('ftyp', 4) && /^(avif|avis)/.test(b.subarray(8, 12).toString('latin1'))) return 'image/avif'
  if (asc('BM')) return 'image/bmp'
  const head = buf.subarray(0, 1024).toString('utf8').replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'image/svg+xml'
  return null
}

/** The page's own preview picture (og:image / twitter:image / image_src), absolute. */
export function pagePicture(html, base) {
  const metas = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
  ]
  for (const re of metas) {
    const m = re.exec(html)
    if (m) {
      try {
        return new URL(m[1].replace(/&amp;/g, '&'), base).href
      } catch {
        /* next */
      }
    }
  }
  return null
}

/* ───────── fetching ───────── */

/** One GET with the address check; resolves { status, headers, body: Buffer } or a redirect. */
function get(url, { limit, signal }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.get(
      url,
      {
        lookup: safeLookup,
        signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; QalamAI-ImageFetch/1.0; +https://qalamai.uz)',
          accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,text/html;q=0.5',
          'accept-encoding': 'identity',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return resolve({ redirect: res.headers.location })
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(res.statusCode === 404 || res.statusCode === 410 ? noImage() : fetchFailed())
        }
        const declared = Number(res.headers['content-length'])
        if (declared > limit) {
          res.destroy()
          return reject(tooBig())
        }
        const chunks = []
        let size = 0
        res.on('data', (c) => {
          size += c.length
          if (size > limit) {
            res.destroy()
            reject(tooBig())
          } else chunks.push(c)
        })
        res.on('end', () => resolve({ type: String(res.headers['content-type'] ?? '').toLowerCase(), body: Buffer.concat(chunks) }))
        res.on('error', () => reject(fetchFailed()))
      },
    )
    req.on('error', (e) => reject(e instanceof AppError ? e : e.code === 'EBLOCKED' ? badUrl() : fetchFailed()))
  })
}

/**
 * The picture a pasted link points to.
 * @returns {Promise<{ type: string, body: Buffer }>}
 */
export async function fetchImage(input, { signal } = {}) {
  let url = imageUrlOf(input)
  const timer = AbortSignal.timeout(TIMEOUT_MS)
  const sig = signal ? AbortSignal.any([signal, timer]) : timer
  let fromPage = false
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let res
    try {
      res = await get(url, { limit: MAX_BYTES, signal: sig })
    } catch (e) {
      throw e instanceof AppError ? e : fetchFailed()
    }
    if (res.redirect) {
      url = imageUrlOf(new URL(res.redirect, url).href)
      continue
    }
    const type = sniffImage(res.body)
    if (type) return { type, body: res.body }
    // a web page: its preview picture, once
    if (!fromPage && /text\/html|application\/xhtml/.test(res.type)) {
      const pic = pagePicture(res.body.subarray(0, MAX_HTML).toString('utf8'), url)
      if (pic) {
        url = imageUrlOf(pic)
        fromPage = true
        continue
      }
    }
    throw noImage()
  }
  throw fetchFailed()
}
