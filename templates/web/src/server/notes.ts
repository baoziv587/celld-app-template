import { boardName, createNoteRequest } from '@shared/protocol'
import { createServerFn } from '@tanstack/react-start'
import { notesOnCells } from '@worker/notes'
import { z } from 'zod'

/**
 * Server functions: the page calls these like local functions. On the server
 * they run in place; in the browser Start turns them into typed RPC calls.
 * Input is parsed with the shared schemas, so bad data never reaches a cell.
 */
export const listNotes = createServerFn()
  .validator(boardName)
  .handler(({ data: board }) => notesOnCells.list(board))

export const createNote = createServerFn({ method: 'POST' })
  .validator(z.object({ board: boardName, ...createNoteRequest.shape }))
  .handler(({ data: { board, text } }) => notesOnCells.create(board, { text }))

export const deleteNote = createServerFn({ method: 'POST' })
  .validator(z.object({ board: boardName, id: z.string() }))
  .handler(({ data: { board, id } }) => notesOnCells.remove(board, id))
