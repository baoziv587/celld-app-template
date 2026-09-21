import type { Note } from '../shared/protocol'
import type { Env } from './env'
import { DurableObject } from 'cloudflare:workers'

type NoteRow = Record<string, SqlStorageValue> & {
  id: string
  text: string
  created_at: number
}

/** One board. The cell serializes writes, so the limit check cannot race. */
export class BoardCell extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, text TEXT NOT NULL, created_at INTEGER NOT NULL)')
  }

  list(): Note[] {
    return this.ctx.storage.sql
      .exec<NoteRow>('SELECT id, text, created_at FROM notes ORDER BY created_at DESC, id')
      .toArray()
      .map(row => ({ id: row.id, text: row.text, createdAt: row.created_at }))
  }

  /** Returns null when the board is full; the router owns the HTTP meaning of that. */
  add(text: string, limit: number): Note | null {
    const count = this.ctx.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM notes').one().n
    if (count >= limit) {
      return null
    }
    const created: Note = { id: crypto.randomUUID(), text, createdAt: Date.now() }
    this.ctx.storage.sql.exec('INSERT INTO notes (id, text, created_at) VALUES (?, ?, ?)', created.id, created.text, created.createdAt)
    return created
  }

  remove(id: string): boolean {
    return this.ctx.storage.sql.exec('DELETE FROM notes WHERE id = ?', id).rowsWritten > 0
  }
}
