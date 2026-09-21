import { z } from 'zod'

/** Build the request schema from config so the limit has a single source. */
export function incrementRequest(maxStep: number) {
  return z.object({
    by: z.number().int().min(1).max(maxStep).default(1),
  })
}

export function parseMaxStep(raw: string): number {
  const maxStep = Number.parseInt(raw, 10)
  if (!Number.isInteger(maxStep) || maxStep < 1) {
    throw new Error(`MAX_STEP must be a positive integer, got "${raw}"`)
  }
  return maxStep
}
