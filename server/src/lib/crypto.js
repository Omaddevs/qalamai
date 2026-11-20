// Passwords: scrypt (memory-hard, built into Node — no native addon to compile).
// Stored as  scrypt$N$r$p$<salt b64>$<hash b64>  so parameters can be raised later.
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 }

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password.normalize('NFKC'), salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  if (!stored?.startsWith('scrypt$')) return false
  const [, N, r, p, saltB64, hashB64] = stored.split('$')
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Opaque random token (refresh tokens). Only its SHA-256 is stored. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const sha256 = (s) => createHash('sha256').update(s).digest('hex')

/** HMAC signature for short-lived file URLs (so <img src> works without headers). */
export function sign(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function verifySignature(secret, payload, signature) {
  if (typeof signature !== 'string') return false
  const expected = Buffer.from(sign(secret, payload))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
