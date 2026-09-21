/**
 * Release one worker:  pnpm deploy:worker <worker> [--env path/to/deploy.env]
 *
 * A release only writes the worker into its bucket prefix. Running celld nodes
 * adopt it in place within CELLD_DEPLOY_POLL_S (30 s), so nothing in Kubernetes
 * changes: no image, no Job, no rollout.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const ENTRYPOINT = join(REPO_ROOT, 'deployments/worker-entrypoint.mjs')

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

/** `NAME=value` lines, the same subset of dotenv that celld reads from .dev.vars. */
function readEnvFile(file: string): Record<string, string> {
  const entries = readFileSync(file, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      if (separator < 1) {
        fail(`${file}: expected NAME=value, got "${line}"`)
      }
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^(["'])(.*)\1$/, '$2')]
    })
  return Object.fromEntries(entries)
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error !== undefined) {
    fail(`cannot run ${command}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { env: { type: 'string', default: join(REPO_ROOT, 'deployments/deploy.env') } },
})

const worker = positionals[0] ?? fail('usage: pnpm deploy:worker <worker>')
const workerDir = join(REPO_ROOT, 'apps', worker)
if (!existsSync(join(workerDir, 'wrangler.json'))) {
  fail(`no such worker: apps/${worker}`)
}
if (!existsSync(values.env)) {
  fail(`${values.env} not found; copy deployments/deploy.example.env and fill it in`)
}

// The file wins over the shell: a stray AWS_* export from another project must
// never decide which bucket or account a release goes to.
const target = { ...process.env, ...readEnvFile(values.env) }
const bucketRoot = target.BUCKET_ROOT ?? fail('BUCKET_ROOT is not set')

// Production vars and secrets for this worker; each NAME becomes env.NAME in the worker.
const varsFile = join(workerDir, '.prod.vars')
const vars = existsSync(varsFile) ? readEnvFile(varsFile) : {}
const workerVars = Object.fromEntries(Object.entries(vars).map(([name, value]) => [`WORKER_VAR_${name}`, value]))

const env = { ...target, ...workerVars, CELLD_BUCKET: `${bucketRoot.replace(/\/$/, '')}/${worker}` }

run('pnpm', ['--filter', `${worker}...`, '--if-present', 'typecheck'], REPO_ROOT, env)
run('pnpm', ['--filter', worker, '--if-present', 'build'], REPO_ROOT, env)
run('node', [ENTRYPOINT], workerDir, env)
