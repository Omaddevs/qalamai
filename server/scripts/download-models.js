// Pre-download the background-removal model(s) so the first request is instant.
//   npm run models                → the model set in BG_MODEL (default u2netp)
//   npm run models -- silueta u2net isnet-general-use
import { config } from '../src/config.js'
import { MODELS, ensureModel } from '../src/converters/image/remove-bg.js'

const names = process.argv.slice(2).length ? process.argv.slice(2) : [config.bg.model]
for (const name of names) {
  if (!MODELS[name]) {
    console.error(`Unknown model "${name}". Available: ${Object.keys(MODELS).join(', ')}`)
    process.exit(1)
  }
  let last = -1
  process.stdout.write(`${name} (${MODELS[name].mb} MB) → ${config.modelsDir}\n`)
  const path = await ensureModel(name, config.modelsDir, {
    onProgress: (f) => {
      const pct = Math.floor(f * 100)
      if (pct !== last && pct % 10 === 0) process.stdout.write(`  ${pct}%\n`)
      last = pct
    },
  })
  console.log(`  ✓ ${path}`)
}
