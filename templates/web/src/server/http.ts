import { createMiddleware } from '@tanstack/react-start'
import { errorResponse, parseOrBadRequest } from '@template/worker-kit'

/** Route middleware for /api: a thrown HttpError becomes the JSON error shape. */
export const jsonErrors = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  try {
    return await next()
  }
  catch (error) {
    return errorResponse(error)
  }
})

/** Parse a JSON request body with a shared schema; anything else is a 400. */
export async function jsonBody<Schema extends Parameters<typeof parseOrBadRequest>[0]>(request: Request, schema: Schema) {
  return parseOrBadRequest(schema, await request.json().catch(() => null))
}
