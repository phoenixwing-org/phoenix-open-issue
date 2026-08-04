import { describe, expect, it } from 'vitest'
import {
  canAddMember,
  canAddMemberAsUser,
  canCreateIssue,
  canDeleteList,
  canDeleteListAsUser,
  canEditOwnIssue,
  canManageList,
  canModifyIssue,
  canPerformListAction,
  canTransferPrimaryOwnerAsUser,
  checkListAccess,
} from './permission.js'

const members = [
  { userId: 'u1', role: 'owner' as const },
  { userId: 'u2', role: 'admin' as const },
  { userId: 'u3', role: 'editor' as const },
  { userId: 'u4', role: 'reporter' as const },
  { userId: 'u5', role: 'viewer' as const },
]
const root = { hostRoot: true }
const regular = { hostRoot: false }

describe('Issue list resource permissions', () => {
  it('finds member roles and fails closed for non-members', () => {
    expect(checkListAccess('u1', members)).toBe('owner')
    expect(checkListAccess('u3', members)).toBe('editor')
    expect(checkListAccess('u999', members)).toBeNull()
    expect(checkListAccess('u1', [])).toBeNull()
  })

  it('keeps list management and deletion roles distinct', () => {
    expect(canManageList('owner')).toBe(true)
    expect(canManageList('admin')).toBe(true)
    expect(canManageList('editor')).toBe(true)
    expect(canManageList('reporter')).toBe(false)
    expect(canDeleteList('owner')).toBe(true)
    expect(canDeleteList('admin')).toBe(false)
  })

  it('allows only owner/admin member roles to manage members', () => {
    expect(canAddMember('owner')).toBe(true)
    expect(canAddMember('admin')).toBe(true)
    expect(canAddMember('editor')).toBe(false)
    expect(canAddMember('viewer')).toBe(false)
  })

  it('keeps create and modify Issue role matrices', () => {
    expect(canModifyIssue('owner')).toBe(true)
    expect(canModifyIssue('editor')).toBe(true)
    expect(canModifyIssue('reporter')).toBe(false)
    expect(canCreateIssue('reporter')).toBe(true)
    expect(canCreateIssue('viewer')).toBe(false)
    expect(canEditOwnIssue('reporter')).toBe(true)
    expect(canEditOwnIssue('viewer')).toBe(false)
  })
})

describe('Host boundary plus Issue resource roles', () => {
  it('retains the Cool root bypass without recreating legacy systemRole', () => {
    expect(canPerformListAction(root, null, 'read')).toBe(true)
    expect(canPerformListAction(root, null, 'delete-list')).toBe(true)
    expect(canAddMemberAsUser(null, root)).toBe(true)
    expect(canTransferPrimaryOwnerAsUser(null, root)).toBe(true)
  })

  it('requires ordinary users to satisfy the list role matrix', () => {
    expect(canPerformListAction(regular, 'editor', 'modify-issue')).toBe(true)
    expect(canPerformListAction(regular, 'viewer', 'modify-issue')).toBe(false)
    expect(canPerformListAction(regular, null, 'read')).toBe(false)
    expect(canAddMemberAsUser('owner', regular)).toBe(true)
    expect(canAddMemberAsUser('editor', regular)).toBe(false)
    expect(canTransferPrimaryOwnerAsUser('owner', regular)).toBe(true)
    expect(canTransferPrimaryOwnerAsUser('admin', regular)).toBe(false)
  })

  it('preserves owner and push rules', () => {
    expect(canDeleteListAsUser(null, regular, 'u1', 'u1')).toBe(true)
    expect(canDeleteListAsUser('admin', regular, 'u2', 'u1')).toBe(false)
    expect(canPerformListAction(regular, 'editor', 'push')).toBe(true)
    expect(canPerformListAction(regular, 'reporter', 'push')).toBe(false)
    expect(canPerformListAction(regular, 'admin', 'handle-push')).toBe(true)
    expect(canPerformListAction(regular, 'editor', 'handle-push')).toBe(false)
  })
})
