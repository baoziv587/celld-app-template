import handler from '@tanstack/react-start/server-entry'

/** The worker: TanStack Start answers every request; the cells are exported next to it. */
export { BoardCell } from '@worker/board-cell'

export default {
  fetch: handler.fetch,
}
