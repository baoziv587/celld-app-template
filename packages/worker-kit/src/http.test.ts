import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createApp } from './app'
import { HttpError } from './errors'
import { jsonBody } from './http'

const app = createApp<{ Bindings: { MAX: string } }>()
  .post('/static', jsonBody(z.object({ by: z.number().int() })), c => c.json(c.req.valid('json')))
  .post('/from-env', jsonBody((env: { MAX: string }) => z.object({ by: z.number().max(Number(env.MAX)) })), c => c.json(c.req.valid('json')))
  .get('/boom', () => {
    throw new HttpError(418, 'teapot', 'short and stout')
  })

function post(path: string, body: string) {
  return app.request(path, { method: 'POST', body, headers: { 'content-type': 'application/json' } }, { MAX: '5' })
}

describe('jsonBody', () => {
  it('hands the parsed body to the handler', async () => {
    const response = await post('/static', JSON.stringify({ by: 2 }))
    expect(await response.json()).toEqual({ by: 2 })
  })

  it('turns a schema failure into a 400 with the error shape', async () => {
    const response = await post('/static', JSON.stringify({ by: 'two' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'bad_request' } })
  })

  it('builds the schema from the bindings', async () => {
    expect((await post('/from-env', JSON.stringify({ by: 5 }))).status).toBe(200)
    expect((await post('/from-env', JSON.stringify({ by: 6 }))).status).toBe(400)
  })
})

describe('createApp', () => {
  it('answers thrown HttpErrors with their status', async () => {
    const response = await app.request('/boom')
    expect(response.status).toBe(418)
    expect(await response.json()).toEqual({ error: { code: 'teapot', message: 'short and stout' } })
  })

  it('answers unknown paths as JSON', async () => {
    const response = await app.request('/nope')
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: { code: 'not_found' } })
  })
})

describe('createApp with hono errors', () => {
  it('answers a malformed JSON body with 400', async () => {
    const response = await post('/static', '{nope')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'bad_request' } })
  })
})
