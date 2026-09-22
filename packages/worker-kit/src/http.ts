import type { Context, Env, MiddlewareHandler } from 'hono'
import type { z } from 'zod'
import { validator } from 'hono/validator'
import { badRequest } from './errors'

/** Parse, don't validate: the caller only ever sees the schema's output type. */
export function parseOrBadRequest<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map(issue => issue.message).join('; '))
  }
  return parsed.data
}

/**
 * Validate a JSON body against a Zod schema; the handler reads it with
 * `c.req.valid('json')`. Pass a function to build the schema from the worker's
 * bindings, so a limit configured in wrangler vars has a single source.
 */
export function jsonBody<Schema extends z.ZodType, E extends Env = any>(
  schema: Schema | ((bindings: E['Bindings']) => Schema),
): MiddlewareHandler<E, string, { in: { json: z.input<Schema> }, out: { json: z.output<Schema> } }> {
  const middleware = validator('json', (value: unknown, c: Context<E>) => {
    const resolved = typeof schema === 'function' ? schema(c.env) : schema
    return parseOrBadRequest(resolved, value)
  })
  // hono's validator types its output from the callback; this pins it to the schema's types instead.
  return middleware as MiddlewareHandler<E, string, { in: { json: z.input<Schema> }, out: { json: z.output<Schema> } }>
}
