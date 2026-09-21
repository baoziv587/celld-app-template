import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { errorResponse, HttpError } from './errors'
import { readJson, segmentsAfter } from './http'

describe('segmentsAfter', () => {
  it('splits the path that follows the prefix', () => {
    expect(segmentsAfter('/api/counters/visits/increment', '/api/counters')).toEqual(['visits', 'increment'])
  })

  it('rejects a lookalike prefix', () => {
    expect(segmentsAfter('/api/countersX', '/api/counters')).toBeNull()
  })
})

describe('readJson', () => {
  const schema = z.object({ by: z.number().int() })

  it('returns the parsed body', async () => {
    const request = new Request('http://x', { method: 'POST', body: JSON.stringify({ by: 2 }) })
    await expect(readJson(request, schema)).resolves.toEqual({ by: 2 })
  })

  it('turns a schema failure into a 400', async () => {
    const request = new Request('http://x', { method: 'POST', body: JSON.stringify({ by: 'two' }) })
    const error = await readJson(request, schema).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HttpError)
    expect(errorResponse(error).status).toBe(400)
  })
})
