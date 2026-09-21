import type { Command } from './shared'
import process from 'node:process'
import * as prompts from '@clack/prompts'
import { fail, listWorkers, requireWorker, run } from './shared'

async function pickWorkers(action: string): Promise<string[]> {
  const workers = listWorkers()
  if (workers.length === 0) {
    fail('there are no workers yet; create one with: pnpm manage new')
  }
  if (workers.length === 1) {
    return workers
  }
  const picked = await prompts.multiselect({
    message: `Which workers do you want to ${action}?`,
    options: workers.map(worker => ({ value: worker, label: worker })),
    required: true,
  })
  if (prompts.isCancel(picked)) {
    prompts.cancel('Nothing was started.')
    process.exit(1)
  }
  return picked
}

/** Runs one package script across the chosen workers, in parallel, until Ctrl-C. */
function workerScript(name: string, script: string, summary: string): Command {
  const usage = `pnpm manage ${name} [worker...] [--all]`
  return {
    name,
    summary,
    usage,
    async run(argv) {
      const named = argv.filter(arg => arg !== '--all')
      const unknownFlag = named.find(arg => arg.startsWith('-'))
      if (unknownFlag !== undefined) {
        fail(`unknown option ${unknownFlag}\nusage: ${usage}`)
      }
      const workers = argv.includes('--all')
        ? listWorkers()
        : named.length > 0 ? named.map(worker => requireWorker(worker, usage)) : await pickWorkers(name)

      if (workers.length === 0) {
        fail('there are no workers yet; create one with: pnpm manage new')
      }
      run('pnpm', ['--parallel', ...workers.flatMap(worker => ['--filter', worker]), script])
    },
  }
}

export const dev = workerScript('dev', 'dev', 'Develop workers: Vite + workerd with HMR, no celld needed')
export const preview = workerScript('preview', 'preview', 'Run workers on the real celld runtime before a release')
