import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

export const REPO_ROOT = resolve(import.meta.dirname, '../..')
export const APPS_DIR = join(REPO_ROOT, 'apps')
export const K8S_DIR = join(REPO_ROOT, 'deployments/k8s')
/** Worker templates. They are workspace packages, so lint, typecheck and tests cover them too. */
export const TEMPLATES_DIR = join(REPO_ROOT, 'templates')

export interface Command {
  name: string
  summary: string
  usage: string
  run: (argv: string[]) => Promise<void>
}

export function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

/** A worker is any directory under apps/ that has a wrangler.json. */
export function listWorkers(): string[] {
  if (!existsSync(APPS_DIR)) {
    return []
  }
  return readdirSync(APPS_DIR)
    .filter(name => existsSync(join(APPS_DIR, name, 'wrangler.json')))
    .sort()
}

export function requireWorker(name: string | undefined, usage: string): string {
  if (name === undefined) {
    fail(`usage: ${usage}`)
  }
  if (!listWorkers().includes(name)) {
    fail(`no such worker: ${name} (known: ${listWorkers().join(', ') || 'none yet, run pnpm manage new'})`)
  }
  return name
}

/** Run a child with inherited stdio and stop the CLI with its exit code on failure. */
export function run(command: string, args: string[], options: { cwd?: string, env?: NodeJS.ProcessEnv } = {}): void {
  const result = spawnSync(command, args, { cwd: options.cwd ?? REPO_ROOT, env: options.env ?? process.env, stdio: 'inherit' })
  if (result.error !== undefined) {
    fail(`cannot run ${command}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

/** Run a child and return its stdout, or null when it cannot run or fails. */
export function capture(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8' })
  return result.status === 0 ? result.stdout : null
}
