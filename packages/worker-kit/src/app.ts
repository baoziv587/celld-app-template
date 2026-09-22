import type { Env } from 'hono'
import { Hono } from 'hono'
import { notFound, onError } from './errors'

/**
 * A Hono app with the repo's error contract wired in: thrown HttpErrors and
 * unknown paths answer as `{ error: { code, message } }`. Every worker starts here.
 */
export function createApp<E extends Env>(): Hono<E> {
  return new Hono<E>()
    .onError(onError)
    .notFound(() => errorResponse(notFound()))
}

function errorResponse(error: unknown): Response {
  return onError(error, undefined as never)
}
