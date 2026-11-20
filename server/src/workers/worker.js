// Worker-thread entry: runs one tool task at a time and reports progress.
// Converter modules are imported lazily so a worker only loads what it uses.
import { parentPort, workerData } from 'node:worker_threads'

const runners = {
  thumbnail: () => import('../converters/thumbnail.js'),
  tool: () => import('../converters/index.js'),
}

parentPort.on('message', async ({ id, task }) => {
  const progress = (pct, stage) => parentPort.postMessage({ id, type: 'progress', pct: Math.max(0, Math.min(100, Math.round(pct))), stage })
  try {
    const mod = await runners[task.kind]()
    const result = await mod.run(task, { progress, env: workerData })
    parentPort.postMessage({ id, type: 'done', result })
  } catch (err) {
    parentPort.postMessage({
      id,
      type: 'error',
      code: err.code && /^[A-Z_]+$/.test(err.code) ? err.code : 'TOOL_FAILED',
      message: err.code && /^[A-Z_]+$/.test(err.code) ? err.message : 'Faylni qayta işlab bölmadi. U şikastlangan yoki parol bilan himoyalangan bölişi mumkin.',
      stack: err.stack,
    })
  }
})
