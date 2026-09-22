import type { Command } from './shared'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { APPS_DIR, K8S_DIR, listWorkers } from './shared'

function firstMatch(file: string, pattern: RegExp): string {
  return existsSync(file) ? (pattern.exec(readFileSync(file, 'utf8'))?.[1] ?? '-') : '-'
}

export const list: Command = {
  name: 'list',
  summary: 'Show every worker with its ports, bucket prefix and public host',
  usage: 'pnpm manage list',
  async run() {
    const rows = listWorkers().map((worker) => {
      const overlay = join(K8S_DIR, 'workers', worker, 'kustomization.yaml')
      return {
        worker,
        kind: existsSync(join(APPS_DIR, worker, 'src/routes')) ? 'web' : 'api',
        dev: firstMatch(join(APPS_DIR, worker, 'vite.config.ts'), /server: \{[^}]*\bport: (\d+)/),
        preview: firstMatch(join(APPS_DIR, worker, 'package.json'), / dev (?:\S+ )?--port (\d+)/),
        bucket: firstMatch(overlay, /CELLD_BUCKET=(\S+)/),
        host: firstMatch(overlay, /value: (\S+)/),
      }
    })
    const columns = ['worker', 'kind', 'dev', 'preview', 'bucket', 'host'] as const
    const widths = columns.map(column => Math.max(column.length, ...rows.map(row => row[column].length)))
    const format = (cells: readonly string[]): string => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ').trimEnd()
    process.stdout.write(`${[format(columns), ...rows.map(row => format(columns.map(column => row[column])))].join('\n')}\n`)
  },
}
