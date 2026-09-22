import type { CreateNoteRequest, Note } from './protocol'

/** What can be done with notes. worker/notes.ts implements it on the cells. */
export interface NotesApi {
  list: (board: string) => Promise<Note[]>
  create: (board: string, body: CreateNoteRequest) => Promise<Note>
  remove: (board: string, id: string) => Promise<void>
}
