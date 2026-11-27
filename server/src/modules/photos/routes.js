// Free photos for the editor's Elements panel, from Unsplash (unsplash.com/developers).
// The Access Key stays on the server: the browser asks us, we ask Unsplash. Answers are kept for
// an hour so popular searches don't spend the hourly API limit. Pictures themselves are not
// copied — the editor uses Unsplash's own image addresses (their API guidelines ask for that),
// credits the photographer, and tells Unsplash when a photo is put into a design (/download).
// Without UNSPLASH_ACCESS_KEY the endpoints answer PHOTOS_OFF and the editor uses Openverse.
import { AppError } from '../../lib/errors.js'
import { fetchImage } from './fetchImage.js'

const PER_PAGE = 20
const TTL_MS = 60 * 60 * 1000
const MAX_CACHED = 500
const UTM = 'utm_source=qalamai&utm_medium=referral'

const withUtm = (url) => (url ? `${url}${url.includes('?') ? '&' : '?'}${UTM}` : null)

const off = () => new AppError(503, 'PHOTOS_OFF', 'Rasmlar xizmati ulanmagan')
const limited = () => new AppError(429, 'PHOTOS_LIMIT', 'Rasmlar xizmati band — birozdan keyin urinib köring')
const failed = () => new AppError(502, 'PHOTOS_FAILED', 'Rasmlar xizmatidan javob kelmadi')

/** Unsplash photo → what the editor needs. */
export function toItem(p) {
  const raw = p.urls?.raw
  return {
    id: p.id,
    provider: 'unsplash',
    // sized by Unsplash's image CDN (imgix): a light preview for the panel, a sharp copy for the page
    thumb: raw ? `${raw}&w=400&q=70&auto=format&fit=max` : p.urls?.small,
    url: raw ? `${raw}&w=1920&q=82&auto=format&fit=max` : p.urls?.regular,
    w: p.width || 4,
    h: p.height || 3,
    color: p.color ?? null,
    title: p.alt_description ?? p.description ?? '',
    author: p.user?.name ?? '',
    authorUrl: withUtm(p.user?.links?.html),
    link: withUtm(p.links?.html),
  }
}

/**
 * @param {{ key: string, apiUrl: string, fetch?: typeof fetch }} o
 */
export function createUnsplash({ key, apiUrl, fetch: doFetch = fetch }) {
  const cache = new Map() // url → { at, value }

  async function call(path) {
    let res
    try {
      res = await doFetch(`${apiUrl}${path}`, {
        headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw failed()
    }
    // Unsplash answers 403 "Rate Limit Exceeded" when the hourly limit is spent
    if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) throw limited()
    if (res.status === 401 || res.status === 403) throw off()
    if (!res.ok) throw failed()
    return res.json()
  }

  return {
    async search(q, page) {
      const path = `/search/photos?${new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE), content_filter: 'high' })}`
      const hit = cache.get(path)
      if (hit && Date.now() - hit.at < TTL_MS) return hit.value
      const json = await call(path)
      const value = {
        provider: 'unsplash',
        items: (json.results ?? []).filter((p) => p?.id && p.urls).map(toItem),
        more: page < Math.min(json.total_pages ?? 1, 30),
      }
      if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value)
      cache.set(path, { at: Date.now(), value })
      return value
    },
    /** Counts a use of the photo on Unsplash (required by their API guidelines). */
    async download(id) {
      await call(`/photos/${encodeURIComponent(id)}/download`)
    },
  }
}

/** @param {import('fastify').FastifyInstance} app */
export default async function photoRoutes(app) {
  const { config } = app.ctx
  const unsplash = app.ctx.unsplash ?? (config.unsplash ? createUnsplash(config.unsplash) : null)

  app.addHook('preHandler', app.authenticate)

  app.get(
    '/search',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['photos'],
        summary: 'Bepul rasmlarni qidiriş (Unsplash)',
        querystring: {
          type: 'object',
          required: ['q'],
          properties: { q: { type: 'string', minLength: 1, maxLength: 100 }, page: { type: 'integer', minimum: 1, maximum: 30, default: 1 } },
        },
      },
    },
    async (req) => {
      if (!unsplash) throw off()
      return unsplash.search(req.query.q.trim().toLowerCase(), req.query.page)
    },
  )

  // a picture from a pasted link (the browser cannot read other sites' pictures); nothing is kept
  app.post(
    '/fetch',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['photos'],
        summary: 'Havoladagi rasmni olib beriş (Google, sayt yoki rasm manzili)',
        body: { type: 'object', required: ['url'], additionalProperties: false, properties: { url: { type: 'string', minLength: 8, maxLength: 4096 } } },
      },
    },
    async (req, reply) => {
      const fetchOne = app.ctx.fetchImage ?? fetchImage
      const { type, body } = await fetchOne(req.body.url)
      reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').type(type)
      return body
    },
  )

  app.post(
    '/:id/download',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['photos'],
        summary: 'Rasm dizaynga qöşildi (Unsplash statistikasi uçun)',
        params: { type: 'object', properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,40}$' } } },
      },
    },
    async (req, reply) => {
      if (!unsplash) throw off()
      await unsplash.download(req.params.id).catch((e) => req.log.warn({ err: e.message }, 'unsplash download ping failed'))
      reply.status(204)
    },
  )
}
