import type { Env } from './env'
import { badRequest, cellByName, errorResponse, HttpError, json, methodNotAllowed, notFound, readJson, segmentsAfter } from '@template/worker-kit'
import { boardName, createNoteRequest } from '../shared/protocol'

export { BoardCell } from './board-cell'

/**
 * GET    /api/boards/:board/notes      list
 * POST   /api/boards/:board/notes      body: { "text": string }
 * DELETE /api/boards/:board/notes/:id  remove
 */
async function routeApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const [rawBoard, collection, noteId, ...extra] = segmentsAfter(pathname, '/api/boards') ?? []
  if (collection !== 'notes' || extra.length > 0) {
    throw notFound()
  }
  const parsedBoard = boardName.safeParse(rawBoard)
  if (!parsedBoard.success) {
    throw badRequest('Invalid board name')
  }
  const board = cellByName(env.BOARDS, parsedBoard.data)

  if (noteId !== undefined) {
    if (request.method !== 'DELETE') {
      throw methodNotAllowed(request.method)
    }
    if (!(await board.remove(noteId))) {
      throw notFound('No such note')
    }
    return new Response(null, { status: 204 })
  }

  switch (request.method) {
    case 'GET':
      return json({ notes: await board.list() })
    case 'POST': {
      const { text } = await readJson(request, createNoteRequest)
      const created = await board.add(text, Number.parseInt(env.MAX_NOTES_PER_BOARD, 10))
      if (created === null) {
        throw new HttpError(409, 'board_full', 'This board is full')
      }
      return json(created, 201)
    }
    default:
      throw methodNotAllowed(request.method)
  }
}

const worker: ExportedHandler<Env> = {
  fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }
    return routeApi(request, env, pathname).catch(errorResponse)
  },
}

export default worker
