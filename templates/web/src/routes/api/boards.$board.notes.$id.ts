import { createFileRoute } from '@tanstack/react-router'
import { notesOnCells } from '@worker/notes'
import { jsonErrors } from '@/server/http'

/** DELETE /api/boards/:board/notes/:id */
export const Route = createFileRoute('/api/boards/$board/notes/$id')({
  server: {
    middleware: [jsonErrors],
    handlers: {
      DELETE: async ({ params }) => {
        await notesOnCells.remove(params.board, params.id)
        return new Response(null, { status: 204 })
      },
    },
  },
})
