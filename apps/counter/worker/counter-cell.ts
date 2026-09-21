import type { Env } from './env'
import { DurableObject } from 'cloudflare:workers'

/** One named counter. Its SQLite database lives with the cell and follows it across nodes. */
export class CounterCell extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL)')
  }

  value(): number {
    const row = this.ctx.storage.sql.exec<{ value: number }>('SELECT value FROM counter WHERE id = 1').toArray()[0]
    return row?.value ?? 0
  }

  increment(by: number): number {
    this.ctx.storage.sql.exec(
      'INSERT INTO counter (id, value) VALUES (1, ?1) ON CONFLICT (id) DO UPDATE SET value = value + ?1',
      by,
    )
    return this.value()
  }
}
