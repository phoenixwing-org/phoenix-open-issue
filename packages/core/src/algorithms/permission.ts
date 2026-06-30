import type { MemberRole } from '../types/index.js'

export function checkListAccess(
  userId: string,
  members: Array<{ userId: string; role: MemberRole }>,
): MemberRole | null {
  const member = members.find(m => m.userId === userId)
  return member?.role ?? null
}

export function canManageList(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export function canDeleteList(role: MemberRole | null): boolean {
  return role === 'owner'
}

export function canAddMember(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function canModifyIssue(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export function canCreateIssue(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor' || role === 'reporter'
}

export function canEditOwnIssue(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor' || role === 'reporter'
}
