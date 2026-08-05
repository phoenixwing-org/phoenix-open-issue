import type { MemberRole } from '../types/index.js'

export type HostAccessContext = { hostRoot: boolean }

export type ListAction =
  | 'read'
  | 'manage-list'
  | 'delete-list'
  | 'manage-members'
  | 'create-issue'
  | 'modify-issue'
  | 'push'
  | 'handle-push'

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

export function canPerformListAction(
  host: HostAccessContext,
  role: MemberRole | null,
  action: ListAction,
): boolean {
  // Cool's built-in root account is the only platform identity bypass. Other
  // users first pass Host capability middleware, then this resource-role gate.
  if (host.hostRoot) return true
  if (action === 'read') return role !== null

  switch (action) {
    case 'manage-list': return canManageList(role)
    case 'delete-list': return canDeleteList(role)
    case 'manage-members': return canAddMember(role)
    case 'create-issue': return canCreateIssue(role)
    case 'modify-issue': return canModifyIssue(role)
    case 'push': return role === 'owner' || role === 'admin' || role === 'editor'
    case 'handle-push': return role === 'owner' || role === 'admin'
    default: return false
  }
}

export function canDeleteListAsUser(
  role: MemberRole | null,
  host: HostAccessContext,
  ownerId: string,
  userId: string,
): boolean {
  if (host.hostRoot) return true
  if (ownerId === userId) return true
  return canDeleteList(role)
}

export function canAddMember(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function canAddMemberAsUser(
  role: MemberRole | null,
  host: HostAccessContext,
): boolean {
  return host.hostRoot || canAddMember(role)
}

export function canTransferPrimaryOwnerAsUser(
  role: MemberRole | null,
  host: HostAccessContext,
): boolean {
  return host.hostRoot || role === 'owner'
}

export function canManageOwnerMemberRoleAsUser(
  role: MemberRole | null,
  host: HostAccessContext,
): boolean {
  return host.hostRoot || role === 'owner'
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
