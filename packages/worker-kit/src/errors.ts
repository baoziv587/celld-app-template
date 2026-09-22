import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

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

export function conflict(code: string, message: string): HttpError {
  return new HttpError(409, code, message)
}

/** Unknown errors become an opaque 500 so internals never leak to clients. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  // Raised by hono itself, e.g. for a malformed JSON body.
  if (error instanceof HTTPException) {
    return Response.json({ error: { code: error.status === 400 ? 'bad_request' : 'http_error', message: error.message } }, { status: error.status })
  }
  console.error(error)
  return Response.json({ error: { code: 'internal', message: 'Internal error' } }, { status: 500 })
}

/** Hono `onError` handler: every thrown error becomes the JSON error shape. */
export function onError(error: unknown, _c: Context): Response {
  return errorResponse(error)
}
