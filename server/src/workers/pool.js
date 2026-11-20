// Fixed-size worker-thread pool. Tool runs (PDF parsing, rendering, ML inference) are
// CPU-heavy; running them off the main thread keeps the API responsive.
// One task per worker at a time; a timed-out or crashed worker is replaced.
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { ToolError } from '../lib/errors.js'

const WORKER_FILE = fileURLToPath(new URL('./worker.js', import.meta.url))

export class WorkerPool {
  /** @param {{ size: number, timeoutMs: number, workerData?: object, log?: any }} opts */
  constructor({ size, timeoutMs, workerData = {}, log }) {
    this.size = size
    this.timeoutMs = timeoutMs
    this.workerData = workerData
    this.log = log
    this.idle = []
    this.busy = new Set()
    this.queue = []
    this.seq = 0
    this.closed = false
    for (let i = 0; i < size; i++) this.idle.push(this.#spawn())
  }

  #spawn() {
    const w = new Worker(WORKER_FILE, { workerData: this.workerData })
    w.unref()
    w.on('error', (err) => this.log?.error({ err }, 'tool worker crashed'))
    return w
  }

  get pending() {
    return this.queue.length
  }

  /**
   * @param {object} task  structured-cloneable task description
   * @param {{ onProgress?: (pct: number, stage?: string) => void, signal?: AbortSignal, priority?: boolean }} [opts]
   */
  run(task, { onProgress, signal, priority = false } = {}) {
    if (this.closed) return Promise.reject(new Error('pool closed'))
    return new Promise((resolve, reject) => {
      const item = { id: ++this.seq, task, onProgress, resolve, reject, signal }
      if (signal?.aborted) return reject(new ToolError('CANCELED', 'Bekor qilindi'))
      signal?.addEventListener('abort', () => this.#cancel(item), { once: true })
      if (priority) this.queue.unshift(item)
      else this.queue.push(item)
      this.#drain()
    })
  }

  #cancel(item) {
    const i = this.queue.indexOf(item)
    if (i !== -1) {
      this.queue.splice(i, 1)
      item.reject(new ToolError('CANCELED', 'Bekor qilindi'))
    } else if (item.worker) {
      this.#retire(item.worker)
      item.done(new ToolError('CANCELED', 'Bekor qilindi'))
    }
  }

  #retire(worker) {
    this.busy.delete(worker)
    worker.removeAllListeners('message')
    worker.removeAllListeners('exit')
    worker.terminate().catch(() => {})
    if (!this.closed) this.idle.push(this.#spawn())
  }

  #drain() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop()
      const item = this.queue.shift()
      this.busy.add(worker)
      item.worker = worker
      let finished = false

      const timer = setTimeout(() => {
        this.log?.warn({ task: item.task.kind, tool: item.task.tool }, 'tool run timed out — replacing worker')
        this.#retire(worker)
        item.done(new ToolError('TIMEOUT', 'Işlov beriş juda uzoq davom etdi. Kiçikroq fayl bilan urinib köring.'))
        this.#drain()
      }, this.timeoutMs)

      item.done = (err, value) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        if (err) item.reject(err)
        else item.resolve(value)
      }

      const onMessage = (msg) => {
        if (msg.id !== item.id) return
        if (msg.type === 'progress') return item.onProgress?.(msg.pct, msg.stage)
        worker.off('message', onMessage)
        worker.off('exit', onExit)
        this.busy.delete(worker)
        if (!this.closed) this.idle.push(worker)
        if (msg.type === 'done') item.done(null, msg.result)
        else item.done(Object.assign(new ToolError(msg.code, msg.message), { stack: msg.stack }))
        this.#drain()
      }
      const onExit = (code) => {
        worker.off('message', onMessage)
        this.busy.delete(worker)
        if (!this.closed) this.idle.push(this.#spawn())
        item.done(new ToolError('WORKER_CRASHED', `Işlov berişda xatolik (kod ${code}). Qayta urinib köring.`))
        this.#drain()
      }
      worker.on('message', onMessage)
      worker.once('exit', onExit)
      worker.postMessage({ id: item.id, task: item.task })
    }
  }

  async destroy() {
    this.closed = true
    for (const item of this.queue.splice(0)) item.reject(new ToolError('SHUTDOWN', 'Server qayta işga tuşmoqda'))
    const all = [...this.idle, ...this.busy]
    this.idle = []
    this.busy.clear()
    await Promise.all(all.map((w) => w.terminate().catch(() => {})))
  }
}
