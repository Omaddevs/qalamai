import { randomBytes } from 'node:crypto'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Prefixed, URL-safe random id, e.g. "fil_3kPq9ZtB7xWm2LcV" (≈95 bits). */
export function newId(prefix, length = 16) {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % 62]
  return `${prefix}_${out}`
}

export const ID_PREFIX = {
  user: 'usr',
  session: 'ses',
  file: 'fil',
  job: 'job',
  document: 'doc',
  design: 'dsn',
  bio: 'bio',
  coin: 'cxn',
  support: 'msg',
  notification: 'ntf',
  payment: 'pay',
}
