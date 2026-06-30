import { describe, it, expect } from 'vitest'
import { checkListAccess, canManageList, canDeleteList, canAddMember, canModifyIssue, canCreateIssue, canEditOwnIssue } from './permission.js'

const members = [
  { userId: 'u1', role: 'owner' as const },
  { userId: 'u2', role: 'admin' as const },
  { userId: 'u3', role: 'editor' as const },
  { userId: 'u4', role: 'reporter' as const },
  { userId: 'u5', role: 'viewer' as const },
]

describe('checkListAccess', () => {
  it('finds a member and returns their role', () => {
    expect(checkListAccess('u1', members)).toBe('owner')
    expect(checkListAccess('u3', members)).toBe('editor')
    expect(checkListAccess('u5', members)).toBe('viewer')
  })

  it('returns null for non-members', () => {
    expect(checkListAccess('u999', members)).toBeNull()
  })

  it('returns null for empty members list', () => {
    expect(checkListAccess('u1', [])).toBeNull()
  })
})

describe('canManageList', () => {
  it('owner, admin, editor can manage', () => {
    expect(canManageList('owner')).toBe(true)
    expect(canManageList('admin')).toBe(true)
    expect(canManageList('editor')).toBe(true)
  })

  it('reporter, viewer, null cannot manage', () => {
    expect(canManageList('reporter')).toBe(false)
    expect(canManageList('viewer')).toBe(false)
    expect(canManageList(null)).toBe(false)
  })
})

describe('canDeleteList', () => {
  it('only owner can delete', () => {
    expect(canDeleteList('owner')).toBe(true)
    expect(canDeleteList('admin')).toBe(false)
    expect(canDeleteList('editor')).toBe(false)
    expect(canDeleteList(null)).toBe(false)
  })
})

describe('canAddMember', () => {
  it('owner and admin can add members', () => {
    expect(canAddMember('owner')).toBe(true)
    expect(canAddMember('admin')).toBe(true)
  })

  it('editor and below cannot add members', () => {
    expect(canAddMember('editor')).toBe(false)
    expect(canAddMember('viewer')).toBe(false)
  })
})

describe('canModifyIssue', () => {
  it('owner, admin, editor can modify', () => {
    expect(canModifyIssue('owner')).toBe(true)
    expect(canModifyIssue('admin')).toBe(true)
    expect(canModifyIssue('editor')).toBe(true)
  })

  it('reporter and viewer cannot modify', () => {
    expect(canModifyIssue('reporter')).toBe(false)
    expect(canModifyIssue('viewer')).toBe(false)
  })
})

describe('canCreateIssue', () => {
  it('owner, admin, editor, reporter can create', () => {
    expect(canCreateIssue('owner')).toBe(true)
    expect(canCreateIssue('reporter')).toBe(true)
  })

  it('viewer cannot create', () => {
    expect(canCreateIssue('viewer')).toBe(false)
  })
})

describe('canEditOwnIssue', () => {
  it('owner, admin, editor, reporter can edit own', () => {
    expect(canEditOwnIssue('owner')).toBe(true)
    expect(canEditOwnIssue('reporter')).toBe(true)
  })

  it('viewer cannot edit own', () => {
    expect(canEditOwnIssue('viewer')).toBe(false)
  })
})
