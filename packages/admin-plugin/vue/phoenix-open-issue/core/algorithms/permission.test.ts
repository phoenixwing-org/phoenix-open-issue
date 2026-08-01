import { describe, it, expect } from 'vitest'
import { checkListAccess, canManageList, canDeleteList, canDeleteListAsUser, canAddMember, canAddMemberAsUser, canTransferPrimaryOwnerAsUser, canModifyIssue, canCreateIssue, canEditOwnIssue, canPerformListAction } from './permission.js'

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
  it('only owner can delete by role', () => {
    expect(canDeleteList('owner')).toBe(true)
    expect(canDeleteList('admin')).toBe(false)
    expect(canDeleteList('editor')).toBe(false)
    expect(canDeleteList(null)).toBe(false)
  })
})

describe('canDeleteListAsUser', () => {
  it('system admin can delete any list', () => {
    expect(canDeleteListAsUser(null, 'admin', 'other-owner', 'u1')).toBe(true)
  })

  it('list owner can delete even without member role', () => {
    expect(canDeleteListAsUser(null, 'zhangsan', 'u1', 'u1')).toBe(true)
  })

  it('list owner member can delete via role', () => {
    expect(canDeleteListAsUser('owner', 'zhangsan', 'u1', 'u1')).toBe(true)
  })

  it('list admin member cannot delete', () => {
    expect(canDeleteListAsUser('admin', 'zhangsan', 'u2', 'u1')).toBe(false)
  })

  it('editor cannot delete', () => {
    expect(canDeleteListAsUser('editor', 'zhangsan', 'u2', 'u1')).toBe(false)
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

describe('canAddMemberAsUser', () => {
  it('system admin can manage members without list role', () => {
    expect(canAddMemberAsUser(null, { systemRole: 'admin' })).toBe(true)
    expect(canAddMemberAsUser(null, 'admin')).toBe(true)
  })

  it('non-admin still needs owner or admin list role', () => {
    expect(canAddMemberAsUser('owner', { systemRole: 'editor' })).toBe(true)
    expect(canAddMemberAsUser('editor', { systemRole: 'editor' })).toBe(false)
  })
})

describe('canTransferPrimaryOwnerAsUser', () => {
  it('system admin can transfer without being list owner member', () => {
    expect(canTransferPrimaryOwnerAsUser(null, { systemRole: 'admin' })).toBe(true)
  })

  it('list owner role member can transfer', () => {
    expect(canTransferPrimaryOwnerAsUser('owner', { systemRole: 'editor' })).toBe(true)
    expect(canTransferPrimaryOwnerAsUser('admin', { systemRole: 'editor' })).toBe(false)
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

describe('canPerformListAction', () => {
  it('system viewer is globally read-only even with owner role', () => {
    const user = { systemRole: 'viewer' as const }
    expect(canPerformListAction(user, 'owner', 'read')).toBe(true)
    expect(canPerformListAction(user, 'owner', 'manage-list')).toBe(false)
    expect(canPerformListAction(user, 'owner', 'create-issue')).toBe(false)
    expect(canPerformListAction(user, 'owner', 'handle-push')).toBe(false)
    expect(canDeleteListAsUser('owner', user, 'u1', 'u1')).toBe(false)
    expect(canAddMemberAsUser('owner', user)).toBe(false)
    expect(canTransferPrimaryOwnerAsUser('owner', user)).toBe(false)
  })

  it('system editor follows list role', () => {
    const user = { systemRole: 'editor' as const }
    expect(canPerformListAction(user, 'editor', 'modify-issue')).toBe(true)
    expect(canPerformListAction(user, 'viewer', 'modify-issue')).toBe(false)
    expect(canPerformListAction(user, 'reporter', 'create-issue')).toBe(true)
  })

  it('system admin can manage a list without membership', () => {
    expect(canPerformListAction({ systemRole: 'admin' }, null, 'read')).toBe(true)
    expect(canPerformListAction({ systemRole: 'admin' }, null, 'delete-list')).toBe(true)
  })

  it('push permissions follow the documented owner/admin/editor matrix', () => {
    expect(canPerformListAction({ systemRole: 'editor' }, 'editor', 'push')).toBe(true)
    expect(canPerformListAction({ systemRole: 'editor' }, 'reporter', 'push')).toBe(false)
    expect(canPerformListAction({ systemRole: 'editor' }, 'viewer', 'push')).toBe(false)
    expect(canPerformListAction({ systemRole: 'editor' }, 'admin', 'handle-push')).toBe(true)
    expect(canPerformListAction({ systemRole: 'editor' }, 'editor', 'handle-push')).toBe(false)
  })
})
