import type { CounterCell } from './counter-cell'

/** Bindings and string vars from wrangler.json. Vars are always strings. */
export interface Bindings {
  COUNTERS: DurableObjectNamespace<CounterCell>
  MAX_STEP: string
}

/** Hono's view of the worker: bindings only, no per-request variables. */
export interface AppEnv {
  Bindings: Bindings
}
