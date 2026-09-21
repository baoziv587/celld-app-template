/**
 * The repo's management CLI:  pnpm manage <command> [args]
 * Run it with no command to pick one interactively.
 */
import type { Command } from './manage/shared'
import process from 'node:process'
import * as prompts from '@clack/prompts'
import { check } from './manage/check'
import { deploy } from './manage/deploy'
import { dev, preview } from './manage/dev'
import { k8s } from './manage/k8s'
import { list } from './manage/list'
import { newWorker } from './manage/new'

const COMMANDS: readonly Command[] = [newWorker, dev, preview, list, check, deploy, k8s]

function help(): string {
  const width = Math.max(...COMMANDS.map(command => command.usage.length))
  return [
    'Usage: pnpm manage <command> [args]',
    '',
    ...COMMANDS.map(command => `  ${command.usage.padEnd(width)}  ${command.summary}`),
  ].join('\n')
}

async function pick(): Promise<Command> {
  const name = await prompts.select({
    message: 'What do you want to do?',
    options: COMMANDS.map(command => ({ value: command.name, label: command.name, hint: command.summary })),
  })
  if (prompts.isCancel(name)) {
    prompts.cancel('Nothing was done.')
    process.exit(1)
  }
  return COMMANDS.find(command => command.name === name)!
}

const [name, ...argv] = process.argv.slice(2)

if (name === '-h' || name === '--help' || name === 'help') {
  process.stdout.write(`${help()}\n`)
}
else {
  const command = name === undefined ? await pick() : COMMANDS.find(candidate => candidate.name === name)
  if (command === undefined) {
    console.error(`error: unknown command "${name}"\n\n${help()}`)
    process.exit(1)
  }
  await command.run(argv)
}
