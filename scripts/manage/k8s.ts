import type { Command } from './shared'
import { join } from 'node:path'
import { fail, K8S_DIR, requireWorker, run } from './shared'

const USAGE = 'pnpm manage k8s <apply|diff|render> [worker]'
const KUBECTL_ARGS = {
  apply: ['apply', '-k'],
  diff: ['diff', '-k'],
  render: ['kustomize'],
} as const

/** Cluster side only. Releasing code is `manage deploy` and never goes through here. */
export const k8s: Command = {
  name: 'k8s',
  summary: 'Apply, diff or render the kustomize tree: everything, or one worker\'s fleet',
  usage: USAGE,
  async run([action, worker]) {
    if (action === undefined || !(action in KUBECTL_ARGS)) {
      fail(`usage: ${USAGE}`)
    }
    const target = worker === undefined ? K8S_DIR : join(K8S_DIR, 'workers', requireWorker(worker, USAGE))
    run('kubectl', [...KUBECTL_ARGS[action as keyof typeof KUBECTL_ARGS], target])
  },
}
