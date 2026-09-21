import type { Command } from './shared'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APPS_DIR, capture, fail, K8S_DIR, listWorkers } from './shared'

/** Problems that would make a worker and its fleet disagree. Empty means consistent. */
function problemsOf(worker: string, rootKustomization: string): string[] {
  const problems: string[] = []
  const config = JSON.parse(readFileSync(join(APPS_DIR, worker, 'wrangler.json'), 'utf8')) as { name?: string }
  if (config.name !== worker) {
    problems.push(`apps/${worker}/wrangler.json: "name" must equal the directory name`)
  }
  if (!rootKustomization.includes(`workers/${worker}`)) {
    problems.push(`workers/${worker} is not listed in deployments/k8s/kustomization.yaml`)
  }

  const rendered = capture('kubectl', ['kustomize', join(K8S_DIR, 'workers', worker)])
  if (rendered === null) {
    return [...problems, `deployments/k8s/workers/${worker} does not render (kubectl kustomize)`]
  }
  // `manage deploy` publishes to <BUCKET_ROOT>/<worker>; the fleet must read the same prefix.
  if (!new RegExp(`CELLD_BUCKET: [a-z0-9]+://[^/]+/${worker}$`, 'm').test(rendered)) {
    problems.push(`workers/${worker}: CELLD_BUCKET must end in /${worker}`)
  }
  if (!/image: ghcr\.io\/denoland\/celld:v\d/.test(rendered)) {
    problems.push(`workers/${worker}: celld image is not pinned to a release tag`)
  }
  return problems
}

export const check: Command = {
  name: 'check',
  summary: 'Offline check that every worker and its Kubernetes overlay agree',
  usage: 'pnpm manage check',
  async run() {
    if (capture('kubectl', ['version', '--client']) === null) {
      fail('kubectl is required (it provides kustomize); no cluster is contacted')
    }
    const workers = listWorkers()
    const rootKustomization = readFileSync(join(K8S_DIR, 'kustomization.yaml'), 'utf8')

    const orphans = readdirSync(join(K8S_DIR, 'workers'))
      .filter(name => existsSync(join(K8S_DIR, 'workers', name, 'kustomization.yaml')) && !workers.includes(name))
      .map(name => `deployments/k8s/workers/${name} has no apps/${name}`)

    const problems = [...workers.flatMap(worker => problemsOf(worker, rootKustomization)), ...orphans]
    if (problems.length > 0) {
      fail(`\n  ${problems.join('\n  ')}`)
    }
    console.warn(`ok: ${workers.length} worker(s) consistent (${workers.join(', ')})`)
  },
}
