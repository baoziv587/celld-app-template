import { z } from 'zod'

/** Wire contract shared by the worker and the browser: one schema, both sides. */
export const note = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.number().int(),
})
export type Note = z.infer<typeof note>

export const noteList = z.object({ notes: z.array(note) })

export const createNoteRequest = z.object({
  text: z.string().trim().min(1, 'A note needs some text').max(500, 'A note is at most 500 characters'),
})
export type CreateNoteRequest = z.infer<typeof createNoteRequest>

export const boardName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'Board names use a-z, 0-9 and hyphens')
