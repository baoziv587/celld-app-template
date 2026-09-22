import type { BoardCell } from './board-cell'

/**
 * Bindings and string vars from wrangler.json, reachable anywhere on the server
 * as `import { env } from 'cloudflare:workers'`. Vars are always strings.
 */
export interface Bindings {
  BOARDS: DurableObjectNamespace<BoardCell>
  MAX_NOTES_PER_BOARD: string
}

declare global {
  // The `env` export of cloudflare:workers is typed as Cloudflare.Env; a namespace is the only way to extend it.
  // eslint-disable-next-line ts/no-namespace
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}
