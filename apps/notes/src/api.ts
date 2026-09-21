import type { z } from 'zod'
import type { CreateNoteRequest, Note } from '../shared/protocol'
import { note, noteList } from '../shared/protocol'

/** Every response is parsed, so a drifting server fails here and not deep in a component. */
async function request<Schema extends z.ZodType>(path: string, schema: Schema, init?: RequestInit): Promise<z.infer<Schema>> {
  const response = await fetch(path, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`)
  }
  return schema.parse(await response.json())
}

function notesPath(board: string): string {
  return `/api/boards/${encodeURIComponent(board)}/notes`
}

export async function listNotes(board: string): Promise<Note[]> {
  return (await request(notesPath(board), noteList)).notes
}

export function createNote(board: string, body: CreateNoteRequest): Promise<Note> {
  return request(notesPath(board), note, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function deleteNote(board: string, id: string): Promise<void> {
  const response = await fetch(`${notesPath(board)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Delete failed (${response.status})`)
  }
}
