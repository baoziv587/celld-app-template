import type { Command } from './shared'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { APPS_DIR, fail, REPO_ROOT, requireWorker, run } from './shared'

const USAGE = 'pnpm manage deploy <worker> [--env path/to/deploy.env]'
const CELLD_DEPLOY = join(import.meta.dirname, '../celld.mjs')

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

/**
 * A release only writes the worker into its bucket prefix. Running celld nodes
 * adopt it in place within CELLD_DEPLOY_POLL_S (30 s), so nothing in Kubernetes
 * changes: no image, no Job, no rollout.
 */
export const deploy: Command = {
  name: 'deploy',
  summary: 'Release a worker: typecheck, build, then celld deploy to its bucket prefix',
  usage: USAGE,
  async run(argv) {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { env: { type: 'string', default: join(REPO_ROOT, 'deployments/deploy.env') } },
    })
    const worker = requireWorker(positionals[0], USAGE)
    const workerDir = join(APPS_DIR, worker)
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

    run('pnpm', ['--filter', `${worker}...`, '--if-present', 'typecheck'], { env })
    run('pnpm', ['--filter', worker, '--if-present', 'build'], { env })
    run('node', [CELLD_DEPLOY], { cwd: workerDir, env })
  },
}
