import { describe, it, expect } from 'vitest'
import { resolveOverlap, validatePush, canPushToList, canHandlePush } from './push.js'

const membersA = [
  { userId: 'u1', role: 'owner' as const },
  { userId: 'u2', role: 'editor' as const },
]
const membersB = [
  { userId: 'u2', role: 'editor' as const },
  { userId: 'u3', role: 'viewer' as const },
]
const membersC = [
  { userId: 'u4', role: 'editor' as const },
  { userId: 'u5', role: 'viewer' as const },
]

describe('resolveOverlap', () => {
  it('finds common members between two lists', () => {
    const result = resolveOverlap(membersA, membersB)
    expect(result).toEqual(['u2'])
  })

  it('returns empty array when no overlap', () => {
    const result = resolveOverlap(membersA, membersC)
    expect(result).toEqual([])
  })

  it('returns empty for empty lists', () => {
    expect(resolveOverlap([], [])).toEqual([])
    expect(resolveOverlap(membersA, [])).toEqual([])
  })
})

describe('validatePush', () => {
  it('allows push when members overlap', () => {
    const result = validatePush({ fromMembers: membersA, toMembers: membersB })
    expect(result.canPush).toBe(true)
    expect(result.valid).toBe(true)
    expect(result.overlapUserIds).toEqual(['u2'])
  })

  it('rejects push when no overlap', () => {
    const result = validatePush({ fromMembers: membersA, toMembers: membersC })
    expect(result.canPush).toBe(false)
    expect(result.overlapUserIds).toEqual([])
    expect(result.message).toContain('无法推送')
  })

  it('calculates correct overlap percentage', () => {
    // 1 out of max(2,2)=2 = 50%
    const result = validatePush({ fromMembers: membersA, toMembers: membersB })
    expect(result.overlapPercent).toBe(50)
  })
})

describe('canPushToList', () => {
  it('allows push when user has role and overlap exists', () => {
    expect(canPushToList('editor', true)).toBe(true)
  })

  it('rejects push when no overlap', () => {
    expect(canPushToList('owner', false)).toBe(false)
  })

  it('rejects push when user has no role', () => {
    expect(canPushToList(null, true)).toBe(false)
  })
})

describe('canHandlePush', () => {
  const targetMembers = [
    { userId: 'u1', role: 'owner' as const },
    { userId: 'u2', role: 'admin' as const },
  ]

  it('owner can handle pending push', () => {
    expect(canHandlePush('u1', { toListId: 'L2', status: 'pending' }, targetMembers)).toBe(true)
  })

  it('admin can handle pending push', () => {
    expect(canHandlePush('u2', { toListId: 'L2', status: 'pending' }, targetMembers)).toBe(true)
  })

  it('non-member cannot handle push', () => {
    expect(canHandlePush('u9', { toListId: 'L2', status: 'pending' }, targetMembers)).toBe(false)
  })

  it('cannot handle non-pending push', () => {
    expect(canHandlePush('u1', { toListId: 'L2', status: 'accepted' }, targetMembers)).toBe(false)
    expect(canHandlePush('u1', { toListId: 'L2', status: 'rejected' }, targetMembers)).toBe(false)
  })
})
