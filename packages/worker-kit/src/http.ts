import type { z } from 'zod'
import { badRequest } from './errors'

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

/** Parse, don't validate: the handler only ever sees the schema's output type. */
export async function readJson<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const raw: unknown = await request.json().catch(() => {
    throw badRequest('Body must be JSON')
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map(issue => issue.message).join('; '))
  }
  return parsed.data
}

/** Path segments after a fixed prefix, or null when the prefix does not match. */
export function segmentsAfter(pathname: string, prefix: string): string[] | null {
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    return null
  }
  return pathname.slice(prefix.length).split('/').filter(part => part.length > 0)
}
