import type { AppEnv, Bindings } from './env'
import { cellByName, createApp, jsonBody } from '@template/worker-kit'
import { incrementRequest, parseMaxStep } from './step'

export { CounterCell } from './counter-cell'

const app = createApp<AppEnv>()

app.get('/api/counters/:name', async (c) => {
  const name = c.req.param('name')
  return c.json({ name, value: await cellByName(c.env.COUNTERS, name).value() })
})

app.post(
  '/api/counters/:name/increment',
  jsonBody((env: Bindings) => incrementRequest(parseMaxStep(env.MAX_STEP))),
  async (c) => {
    const name = c.req.param('name')
    const { by } = c.req.valid('json')
    return c.json({ name, value: await cellByName(c.env.COUNTERS, name).increment(by) })
  },
)

export default app
