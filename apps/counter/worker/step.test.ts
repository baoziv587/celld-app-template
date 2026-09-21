import { describe, expect, it } from 'vitest'
import { incrementRequest, parseMaxStep } from './step'

describe('incrementRequest', () => {
  it('defaults to a step of one', () => {
    expect(incrementRequest(10).parse({})).toEqual({ by: 1 })
  })

  it('rejects a step above the configured limit', () => {
    expect(incrementRequest(10).safeParse({ by: 11 }).success).toBe(false)
  })
})

describe('parseMaxStep', () => {
  it('fails loudly on a bad config value', () => {
    expect(() => parseMaxStep('lots')).toThrow(/MAX_STEP/)
  })
})
