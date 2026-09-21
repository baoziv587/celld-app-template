import { describe, expect, it } from 'vitest'
import { boardName, createNoteRequest } from './protocol'

describe('createNoteRequest', () => {
  it('trims the text before checking it', () => {
    expect(createNoteRequest.parse({ text: '  hi  ' })).toEqual({ text: 'hi' })
  })

  it('rejects whitespace-only text', () => {
    expect(createNoteRequest.safeParse({ text: '   ' }).success).toBe(false)
  })
})

describe('boardName', () => {
  it('rejects path-like names', () => {
    expect(boardName.safeParse('../etc').success).toBe(false)
  })
})
