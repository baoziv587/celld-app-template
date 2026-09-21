/** An error that carries the HTTP status the edge should answer with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function notFound(message = 'Not found'): HttpError {
  return new HttpError(404, 'not_found', message)
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, 'bad_request', message)
}

export function methodNotAllowed(method: string): HttpError {
  return new HttpError(405, 'method_not_allowed', `${method} is not allowed here`)
}

/** Unknown errors become an opaque 500 so internals never leak to clients. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  console.error(error)
  return Response.json({ error: { code: 'internal', message: 'Internal error' } }, { status: 500 })
}
