// Entrypoint of the worker image: inject runtime vars, then run `celld deploy`.
//
// celld only reads worker variables from the Wrangler config at deploy time.
// Secrets must not be baked into the image, so they arrive as WORKER_VAR_<NAME>
// environment variables and are merged into a throwaway config right here.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const PREFIX = 'WORKER_VAR_'
const SOURCE = 'wrangler.json'
// Same directory as the source, so relative `main` and `assets` paths still resolve.
const RENDERED = 'wrangler.deploy.json'

const config = JSON.parse(readFileSync(SOURCE, 'utf8'))
const overrides = Object.fromEntries(
  Object.entries(process.env)
    .filter(([name]) => name.startsWith(PREFIX))
    .map(([name, value]) => [name.slice(PREFIX.length), value]),
)
config.vars = { ...config.vars, ...overrides }
writeFileSync(RENDERED, JSON.stringify(config, null, 2))

const names = Object.keys(overrides)
process.stdout.write(`worker "${config.name}": ${names.length} var override(s)${names.length > 0 ? ` (${names.join(', ')})` : ''}\n`)

// Bucket, endpoint and region come from CELLD_BUCKET, S3_ENDPOINT, AWS_REGION.
const args = process.argv.length > 2 ? process.argv.slice(2) : ['deploy', '--config', RENDERED]
const result = spawnSync('celld', args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
