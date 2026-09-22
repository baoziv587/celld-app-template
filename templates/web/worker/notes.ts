import type { NotesApi } from '@shared/notes-api'
import { boardName } from '@shared/protocol'
import { badRequest, cellByName, conflict, notFound } from '@template/worker-kit'
import { env } from 'cloudflare:workers'

/**
 * NotesApi on the cells themselves. Server functions and the /api routes both
 * go through here, so the page and outside clients see the same rules.
 * Errors are HttpErrors: the /api routes turn them into JSON responses.
 */
function board(raw: string) {
  const parsed = boardName.safeParse(raw)
  if (!parsed.success) {
    throw badRequest('Invalid board name')
  }
  return cellByName(env.BOARDS, parsed.data)
}

export const notesOnCells: NotesApi = {
  list: raw => board(raw).list(),

  async create(raw, { text }) {
    const created = await board(raw).add(text, Number.parseInt(env.MAX_NOTES_PER_BOARD, 10))
    if (created === null) {
      throw conflict('board_full', 'This board is full')
    }
    return created
  },

  async remove(raw, id) {
    if (!(await board(raw).remove(id))) {
      throw notFound('No such note')
    }
  },
}
