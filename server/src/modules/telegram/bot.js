// Minimal Telegram Bot API client: method calls plus a long-polling update loop.
// Long polling needs no public HTTPS address, so the bot works on a laptop too.
// Only one process may poll a bot at a time (Telegram answers 409 to the second).
import { request } from 'node:https'

/**
 * fetch() look-alike that connects to a fixed IP while TLS still verifies the real host name.
 * Used where a network blocks api.telegram.org's usual address but not Telegram's other front ends.
 */
export function pinnedFetch(ip) {
  const lookup = (_host, opts, cb) => (opts?.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4))
  return (url, { method = 'GET', headers = {}, body, signal } = {}) =>
    new Promise((resolve, reject) => {
      const req = request(url, { method, headers: body ? { ...headers, 'content-length': Buffer.byteLength(body) } : headers, lookup, signal }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const buf = Buffer.concat(chunks)
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(buf.toString('utf8')),
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          })
        })
        res.on('error', reject)
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
}

export function createBotApi(token, { apiUrl = 'https://api.telegram.org', apiIp = null, fetchFn = apiIp ? pinnedFetch(apiIp) : fetch, log = console } = {}) {
  const base = `${apiUrl}/bot${token}`
  let me = null
  let stopper = null

  async function call(method, params = {}, { signal, timeoutMs = 15_000 } = {}) {
    const res = await fetchFn(`${base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    })
    const body = await res.json().catch(() => ({}))
    if (!body.ok) {
      const err = new Error(`Telegram ${method}: ${body.description ?? res.status}`)
      err.status = body.error_code ?? res.status
      throw err
    }
    return body.result
  }

  return {
    call,

    /** The bot's own profile (username for t.me links); cached after the first success. */
    async getMe() {
      me ??= await call('getMe')
      return me
    },

    /**
     * The user's current (first) profile photo as JPEG bytes, or null when they have none or
     * hide it from bots. Picks the largest size up to 640 px.
     */
    async profilePhoto(userId) {
      const { photos } = await call('getUserProfilePhotos', { user_id: Number(userId), limit: 1 })
      const sizes = photos?.[0]
      if (!sizes?.length) return null
      const best = [...sizes].sort((a, b) => b.width - a.width).find((p) => p.width <= 640) ?? sizes[0]
      const file = await call('getFile', { file_id: best.file_id })
      if (!file.file_path || file.file_size > 5_000_000) return null
      const res = await fetchFn(`${apiUrl}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    },

    sendMessage: (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra }),

    /** Read updates until stop() and hand each one to onUpdate. Errors back off and retry. */
    startPolling(onUpdate) {
      if (stopper) return
      const ctrl = new AbortController()
      stopper = ctrl
      ;(async () => {
        let offset = 0
        // getUpdates refuses to work while a webhook is set
        await call('deleteWebhook', { drop_pending_updates: false }).catch((err) => log.warn({ err }, 'telegram: deleteWebhook failed'))
        await this.getMe().then((b) => log.info(`telegram: @${b.username} polling`)).catch(() => {})
        while (!ctrl.signal.aborted) {
          try {
            const updates = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, { signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(35_000)]) })
            for (const u of updates) {
              offset = u.update_id + 1
              try {
                await onUpdate(u)
              } catch (err) {
                log.error({ err }, 'telegram: update handler failed')
              }
            }
          } catch (err) {
            if (ctrl.signal.aborted) break
            const wait = err.status === 409 ? 10_000 : 3_000
            if (err.status === 409) log.warn('telegram: another process is polling this bot — retrying in 10 s')
            else if (err.name !== 'TimeoutError') log.warn({ err }, 'telegram: getUpdates failed')
            await new Promise((r) => setTimeout(r, wait).unref?.())
          }
        }
      })()
    },

    stopPolling() {
      stopper?.abort()
      stopper = null
    },
  }
}
