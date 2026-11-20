// Short-lived access tokens (JWT, HS256). Refresh tokens are opaque and live in the DB.
import { SignJWT, jwtVerify } from 'jose'

const ISSUER = 'qalam-ai'
const AUDIENCE = 'qalam-ai-app'

export function createTokenService({ jwtSecret, accessTtlMin }) {
  const key = new TextEncoder().encode(jwtSecret)
  return {
    accessTtlSec: accessTtlMin * 60,
    async signAccess(user) {
      return new SignJWT({ guest: user.isGuest || undefined, role: user.role === 'admin' ? 'admin' : undefined })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${accessTtlMin}m`)
        .sign(key)
    },
    /** @returns {Promise<{ sub: string } | null>} */
    async verifyAccess(token) {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] })
        return payload
      } catch {
        return null
      }
    },
  }
}
