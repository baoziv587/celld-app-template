import type { BoardCell } from './board-cell'

export interface Env {
  ASSETS: Fetcher
  BOARDS: DurableObjectNamespace<BoardCell>
  MAX_NOTES_PER_BOARD: string
}
