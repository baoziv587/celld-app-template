import type { Env } from './env'
import { cellByName, errorResponse, json, methodNotAllowed, notFound, readJson, segmentsAfter } from '@template/worker-kit'
import { incrementRequest, parseMaxStep } from './step'

export { CounterCell } from './counter-cell'

/**
 * GET  /api/counters/:name            read
 * POST /api/counters/:name/increment  body: { "by"?: number }
 */
async function route(request: Request, env: Env): Promise<Response> {
  const [name, action, ...extra] = segmentsAfter(new URL(request.url).pathname, '/api/counters') ?? []
  if (name === undefined || extra.length > 0) {
    throw notFound()
  }

  const counter = cellByName(env.COUNTERS, name)

  if (action === undefined) {
    if (request.method !== 'GET') {
      throw methodNotAllowed(request.method)
    }
    return json({ name, value: await counter.value() })
  }

  if (action === 'increment') {
    if (request.method !== 'POST') {
      throw methodNotAllowed(request.method)
    }
    const { by } = await readJson(request, incrementRequest(parseMaxStep(env.MAX_STEP)))
    return json({ name, value: await counter.increment(by) })
  }

  throw notFound()
}

const worker: ExportedHandler<Env> = {
  fetch: (request, env) => route(request, env).catch(errorResponse),
}

export default worker
