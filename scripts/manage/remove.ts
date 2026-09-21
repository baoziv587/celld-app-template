import type { Command } from './shared'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import * as prompts from '@clack/prompts'
import { APPS_DIR, K8S_DIR, requireWorker } from './shared'

const USAGE = 'pnpm manage remove <worker> [--yes]'

/** The inverse of `new`: the worker, its overlay, and its line in the root kustomization. */
export const remove: Command = {
  name: 'remove',
  summary: 'Delete a worker and its Kubernetes overlay from the repo (not from the cluster)',
  usage: USAGE,
  async run(argv) {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { yes: { type: 'boolean', default: false } },
    })
    const worker = requireWorker(positionals[0], USAGE)
    const overlay = join(K8S_DIR, 'workers', worker)

    // Once the overlay is gone, kubectl can no longer find what it created.
    prompts.log.warn(`If ${worker} is running in a cluster, remove it there first:\n  kubectl delete -k deployments/k8s/workers/${worker}\nIts data under the bucket prefix is never deleted by this tool.`)
    if (!values.yes) {
      const confirmed = await prompts.confirm({ message: `Delete apps/${worker} and its overlay from this repo?`, initialValue: false })
      if (prompts.isCancel(confirmed) || !confirmed) {
        prompts.cancel('Nothing was deleted.')
        process.exit(1)
      }
    }

    rmSync(join(APPS_DIR, worker), { recursive: true, force: true })
    rmSync(overlay, { recursive: true, force: true })
    const rootKustomization = join(K8S_DIR, 'kustomization.yaml')
    if (existsSync(rootKustomization)) {
      const kept = readFileSync(rootKustomization, 'utf8').split('\n').filter(line => line.trim() !== `- workers/${worker}`)
      writeFileSync(rootKustomization, kept.join('\n'))
    }
    prompts.log.success(`Removed ${worker}. Run pnpm install to refresh the workspace.`)
  },
}
