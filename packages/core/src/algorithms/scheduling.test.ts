import { describe, it, expect } from 'vitest'
import { isOverdue, calculateNextCheckpoint } from './scheduling.js'

describe('isOverdue', () => {
  const today = new Date('2026-06-30')

  it('returns overdue=true for past pending checkpoint', () => {
    const result = isOverdue('2026-01-01', 'pending', today)
    expect(result.overdue).toBe(true)
    expect(result.daysOverdue).toBeGreaterThan(100)
  })

  it('returns overdue=false for future pending checkpoint', () => {
    const result = isOverdue('2030-01-01', 'pending', today)
    expect(result.overdue).toBe(false)
    expect(result.daysOverdue).toBe(0)
  })

  it('returns overdue=false for today pending checkpoint', () => {
    const result = isOverdue('2026-06-30', 'pending', today)
    expect(result.overdue).toBe(false)
    expect(result.daysOverdue).toBe(0)
  })

  it('always returns false when status is done', () => {
    const result = isOverdue('2020-01-01', 'done', today)
    expect(result.overdue).toBe(false)
    expect(result.daysOverdue).toBe(0)
  })

  it('always returns false when status is skipped', () => {
    const result = isOverdue('2020-01-01', 'skipped', today)
    expect(result.overdue).toBe(false)
    expect(result.daysOverdue).toBe(0)
  })

  it('always returns false when status is voided', () => {
    const result = isOverdue('2020-01-01', 'voided', today)
    expect(result.overdue).toBe(false)
    expect(result.daysOverdue).toBe(0)
  })

  it('defaults now to current date', () => {
    const result = isOverdue('2000-01-01', 'pending')
    expect(result.overdue).toBe(true)
  })

  it('calculates correct days overdue', () => {
    // 2026-06-20 is 10 days before 2026-06-30
    const result = isOverdue('2026-06-20', 'pending', today)
    expect(result.overdue).toBe(true)
    expect(result.daysOverdue).toBe(10)
  })
})

describe('calculateNextCheckpoint', () => {
  const base = new Date('2026-01-01')

  it('adds days for daily frequency', () => {
    const next = calculateNextCheckpoint(base, { frequency: 'daily', interval: 3 })
    expect(next.toISOString().slice(0, 10)).toBe('2026-01-04')
  })

  it('adds weeks for weekly frequency', () => {
    const next = calculateNextCheckpoint(base, { frequency: 'weekly', interval: 1 })
    expect(next.toISOString().slice(0, 10)).toBe('2026-01-08')

    const next2 = calculateNextCheckpoint(base, { frequency: 'weekly', interval: 2 })
    expect(next2.toISOString().slice(0, 10)).toBe('2026-01-15')
  })

  it('adds months for monthly frequency', () => {
    const next = calculateNextCheckpoint(base, { frequency: 'monthly', interval: 1 })
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-01')

    const next2 = calculateNextCheckpoint(base, { frequency: 'monthly', interval: 3 })
    expect(next2.toISOString().slice(0, 10)).toBe('2026-04-01')
  })

  it('handles month boundary correctly', () => {
    const jan15 = new Date('2026-01-15')
    const next = calculateNextCheckpoint(jan15, { frequency: 'monthly', interval: 1 })
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-15')
  })

  it('does not mutate the input date', () => {
    const original = new Date(base)
    calculateNextCheckpoint(base, { frequency: 'daily', interval: 1 })
    expect(base.getTime()).toBe(original.getTime())
  })
})
