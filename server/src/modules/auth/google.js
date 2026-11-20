// "Google bilan kiriş" — OAuth 2.0 authorization-code flow with PKCE, done on the server
// so the client secret never reaches the browser. Google's ID token is verified locally
// against its published keys (issuer, audience, expiry, signature).
import { createHash } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { AppError } from '../../lib/errors.js'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export const pkceChallenge = (verifier) => createHash('sha256').update(verifier).digest('base64url')

/** @param {{ clientId: string, clientSecret: string }} cfg */
export function createGoogleClient(cfg, { jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), fetchFn = fetch } = {}) {
  return {
    authUrl({ redirectUri, state, verifier }) {
      const q = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: 'S256',
        prompt: 'select_account',
      })
      return `${AUTH_URL}?${q}`
    },

    /** Swap the one-time code for tokens and return the verified identity. */
    async identity({ code, redirectUri, verifier }) {
      let res
      try {
        res = await fetchFn(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: verifier,
          }),
          signal: AbortSignal.timeout(10_000),
        })
      } catch {
        throw new AppError(502, 'GOOGLE_UNREACHABLE', 'Google bilan boğlanib bölmadi')
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.id_token) throw new AppError(401, 'GOOGLE_EXCHANGE_FAILED', `Google kodni qabul qilmadi (${body.error ?? res.status})`)

      let payload
      try {
        ;({ payload } = await jwtVerify(body.id_token, jwks, { issuer: ISSUERS, audience: cfg.clientId }))
      } catch {
        throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google tokeni tasdiqlanmadi')
      }
      if (!payload.sub) throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google tokeni tasdiqlanmadi')
      return {
        sub: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name.slice(0, 80) : '',
      }
    },
  }
}
