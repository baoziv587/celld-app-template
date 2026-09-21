import type { CounterCell } from './counter-cell'

/** Bindings and string vars from wrangler.json. Vars are always strings. */
export interface Env {
  COUNTERS: DurableObjectNamespace<CounterCell>
  MAX_STEP: string
}
