import type { Command } from './shared'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import * as prompts from '@clack/prompts'
import { APPS_DIR, fail, K8S_DIR, REPO_ROOT, TEMPLATES_DIR } from './shared'

/**
 * Templates live in templates/, inside this repo, and not in a remote one: they
 * depend on this repo's worker-kit, tsconfig and fleet base, so they must move in
 * lockstep with it. As workspace packages they are linted, typechecked and tested
 * like any worker, so they cannot rot unnoticed. apps/ belongs entirely to the user.
 */
const KINDS = {
  api: { label: 'API only', hint: 'Worker + Durable Object, no frontend' },
  web: { label: 'Web app', hint: 'TanStack Start (server-rendered React) + Durable Object' },
} as const
type Kind = keyof typeof KINDS

/** Files where the template's name appears as an identifier, not as prose. */
const RENAMED_FILES = ['package.json', 'wrangler.json']
/** The `server` line of vite.config.ts, e.g. `server: { host: '127.0.0.1', port: 8790 }`. */
const DEV_PORT = /server: \{[^}]*\bport: (\d+)/
/** The `preview` script: `celld dev . --port N` or `celld.mjs dev --port N`. */
const PREVIEW_PORT = / dev (?:\S+ )?--port (\d+)/
const NEVER_COPIED = new Set(['node_modules', 'dist', '.celld', '.wrangler', '.dev.vars', '.prod.vars', 'wrangler.deploy.json'])

/** Same rule celld applies to the Wrangler `name`, shortened so derived K8s names fit in 63 bytes. */
function nameProblem(name: string): string | undefined {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(name)) {
    return 'Use lowercase letters, digits and inner hyphens (max 40 characters)'
  }
  if (existsSync(join(APPS_DIR, name))) {
    return `apps/${name} already exists`
  }
  return undefined
}

function workerFiles(relativePath: string): string[] {
  return (existsSync(APPS_DIR) ? readdirSync(APPS_DIR) : [])
    .map(worker => join(APPS_DIR, worker, relativePath))
    .filter(existsSync)
}

/** Next free port: one above the highest any existing worker claims. */
function nextPort(relativePath: string, pattern: RegExp, floor: number): number {
  const claimed = workerFiles(relativePath).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(pattern)].map(match => Number(match[1])),
  )
  return Math.max(floor, ...claimed) + 1
}

function rewrite(file: string, edit: (content: string) => string): void {
  if (existsSync(file)) {
    writeFileSync(file, edit(readFileSync(file, 'utf8')))
  }
}

interface Plan {
  name: string
  kind: Kind
  host: string
}

function scaffold({ name, kind, host }: Plan): { previewPort: number, devPort: number } {
  const template = join(TEMPLATES_DIR, kind)
  const overlayTemplate = join(TEMPLATES_DIR, 'k8s/kustomization.yaml')
  for (const required of [join(template, 'wrangler.json'), overlayTemplate]) {
    if (!existsSync(required)) {
      fail(`${required} is missing. Restore it with: git checkout origin/main -- templates`)
    }
  }
  const target = join(APPS_DIR, name)
  // Read the ports before copying, or the clone would count against itself.
  const previewPort = nextPort('package.json', new RegExp(PREVIEW_PORT, 'g'), 8800)
  const devPort = nextPort('vite.config.ts', new RegExp(DEV_PORT, 'g'), 8700)

  cpSync(template, target, {
    recursive: true,
    filter: path => !NEVER_COPIED.has(basename(path)),
  })

  const templateName = new RegExp(`\\btemplate-${kind}\\b`, 'g')
  for (const file of RENAMED_FILES) {
    rewrite(join(target, file), content => content.replace(templateName, name))
  }
  rewrite(join(target, 'package.json'), content => content.replace(PREVIEW_PORT, (script, port: string) => script.replace(port, String(previewPort))))
  rewrite(join(target, 'vite.config.ts'), content => content.replace(DEV_PORT, (line, port: string) => line.replace(port, String(devPort))))

  // The Kubernetes side of a worker is one small kustomize overlay.
  const overlay = join(K8S_DIR, 'workers', name)
  mkdirSync(overlay, { recursive: true })
  cpSync(overlayTemplate, join(overlay, 'kustomization.yaml'))
  rewrite(join(overlay, 'kustomization.yaml'), content => content
    .replace(/\btemplate-worker\b/g, name)
    .replace(/value: .*$/m, `value: ${host}`))
  rewrite(join(K8S_DIR, 'kustomization.yaml'), content => `${content.trimEnd()}\n  - workers/${name}\n`)
  return { previewPort, devPort }
}

function cancelled(): never {
  prompts.cancel('Nothing was created.')
  process.exit(1)
}

async function ask(args: { name: string | undefined, kind: string | undefined, host: string | undefined }): Promise<Plan> {
  const name = args.name ?? await prompts.text({
    message: 'Worker name',
    placeholder: 'billing',
    validate: value => nameProblem(value ?? ''),
  })
  if (prompts.isCancel(name)) {
    cancelled()
  }
  const problem = nameProblem(name)
  if (problem !== undefined) {
    prompts.log.error(problem)
    process.exit(1)
  }

  const kind = args.kind ?? await prompts.select({
    message: 'What kind of worker?',
    options: Object.entries(KINDS).map(([value, { label, hint }]) => ({ value, label, hint })),
  })
  if (prompts.isCancel(kind)) {
    cancelled()
  }
  if (!(kind in KINDS)) {
    prompts.log.error(`--kind must be one of: ${Object.keys(KINDS).join(', ')}`)
    process.exit(1)
  }

  const host = args.host ?? await prompts.text({
    message: 'Public hostname in Kubernetes',
    defaultValue: `${name}.example.com`,
    placeholder: `${name}.example.com`,
  })
  if (prompts.isCancel(host)) {
    cancelled()
  }

  return { name, kind: kind as Kind, host }
}

export const newWorker: Command = {
  name: 'new',
  summary: 'Scaffold a worker and its Kubernetes overlay from templates/',
  usage: 'pnpm manage new [name] [--kind api|web] [--host HOST] [--no-install]',
  async run(argv) {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        'kind': { type: 'string' },
        'host': { type: 'string' },
        'no-install': { type: 'boolean', default: false },
      },
    })

    prompts.intro('New celld worker')
    const plan = await ask({ name: positionals[0], kind: values.kind, host: values.host })
    const { previewPort, devPort } = scaffold(plan)
    prompts.log.success(`Created apps/${plan.name} from templates/${plan.kind}`)

    if (!values['no-install']) {
      const spinner = prompts.spinner()
      spinner.start('Linking workspace packages')
      // The lockfile gains a package, so a frozen install (pnpm's default under CI) would refuse.
      const install = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: REPO_ROOT, encoding: 'utf8' })
      if (install.status === 0) {
        spinner.stop('Workspace linked')
      }
      else {
        spinner.stop('pnpm install failed')
        prompts.log.error(`${install.stderr || install.stdout}`.trim() || `pnpm exited with ${install.status ?? install.error?.message}`)
        prompts.log.warn(`apps/${plan.name} was created. Fix the problem, then run: pnpm install`)
      }
    }

    prompts.note(
      [
        `pnpm manage dev ${plan.name}                            vite + workerd on :${devPort}`,
        `pnpm manage preview ${plan.name}                        real celld runtime on :${previewPort}`,
        `pnpm manage k8s apply ${plan.name}                      create its fleet (once)`,
        `pnpm manage deploy ${plan.name}                         release the code`,
      ].join('\n'),
      'Next steps',
    )
    prompts.outro(`Rename the example cell and routes in apps/${plan.name}/worker to make it yours.`)
  },
}
