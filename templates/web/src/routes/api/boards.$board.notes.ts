import { createNoteRequest } from '@shared/protocol'
import { createFileRoute } from '@tanstack/react-router'
import { notesOnCells } from '@worker/notes'
import { jsonBody, jsonErrors } from '@/server/http'

/**
 * The HTTP face of the notes, for clients that are not this page:
 * GET  /api/boards/:board/notes        list
 * POST /api/boards/:board/notes        body: { "text": string }
 */
export const Route = createFileRoute('/api/boards/$board/notes')({
  server: {
    middleware: [jsonErrors],
    handlers: {
      GET: async ({ params }) => Response.json({ notes: await notesOnCells.list(params.board) }),
      POST: async ({ params, request }) => {
        const body = await jsonBody(request, createNoteRequest)
        return Response.json(await notesOnCells.create(params.board, body), { status: 201 })
      },
    },
  },
})
