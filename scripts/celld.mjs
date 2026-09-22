// Run celld (deploy by default, or dev) for the worker in the current directory
// against a rendered Wrangler config.
//
//   node scripts/celld.mjs                 celld deploy
//   node scripts/celld.mjs dev --port N    celld dev, for a preview on the real runtime
//
// The rendered config starts from wrangler.json and adds two things celld cannot
// take from the source config:
//
// 1. Runtime vars. celld only reads worker variables from the Wrangler config at
//    deploy time, and secrets must not live in wrangler.json, so they arrive as
//    WORKER_VAR_<NAME> environment variables and are merged in here.
// 2. Built output. A worker built by Vite with the Cloudflare plugin (TanStack
//    Start apps) leaves a self-contained bundle in dist/server and its assets in
//    dist/client. The config the plugin writes next to it is Wrangler-only, so
//    celld gets the source config pointed at those two directories instead.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const PREFIX = 'WORKER_VAR_'
const SOURCE = 'wrangler.json'
const RENDERED = 'wrangler.deploy.json'
const BUILT = { dir: 'dist', main: 'server/index.js', assets: 'client', pluginConfig: 'server/wrangler.json' }

const config = JSON.parse(readFileSync(SOURCE, 'utf8'))

const overrides = Object.fromEntries(
  Object.entries(process.env)
    .filter(([name]) => name.startsWith(PREFIX))
    .map(([name, value]) => [name.slice(PREFIX.length), value]),
)
config.vars = { ...config.vars, ...overrides }

// The rendered config lives where its relative `main` and `assets` paths resolve.
let rendered = RENDERED
if (existsSync(join(BUILT.dir, BUILT.pluginConfig))) {
  config.main = BUILT.main
  const assets = join(BUILT.dir, BUILT.assets)
  if (existsSync(assets)) {
    config.assets = { ...config.assets, directory: BUILT.assets }
    // Written by the Cloudflare plugin for Wrangler; celld refuses to deploy it.
    rmSync(join(assets, '.assetsignore'), { force: true })
  }
  rendered = join(BUILT.dir, RENDERED)
  // `celld dev` reads .dev.vars next to the config it was given.
  if (existsSync('.dev.vars')) {
    copyFileSync('.dev.vars', join(dirname(rendered), '.dev.vars'))
  }
}
writeFileSync(rendered, JSON.stringify(config, null, 2))

const names = Object.keys(overrides)
process.stdout.write(`worker "${config.name}": ${names.length} var override(s)${names.length > 0 ? ` (${names.join(', ')})` : ''}\n`)

// Bucket, endpoint and region come from CELLD_BUCKET, S3_ENDPOINT, AWS_REGION.
const [verb = 'deploy', ...rest] = process.argv.slice(2)
const args = verb === 'dev' ? ['dev', rendered, ...rest] : [verb, '--config', rendered, ...rest]
const result = spawnSync('celld', args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
