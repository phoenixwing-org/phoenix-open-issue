import type { MemberRole, SystemRole } from '../types/index.js'

export type SystemAdminUser = { systemRole?: SystemRole | string | null; username?: string | null }

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

export function isSystemAdmin(user: string | SystemAdminUser | null | undefined): boolean {
  if (!user) return false
  if (typeof user === 'string') return user === 'admin'
  if (user.systemRole === 'admin') return true
  // 旧会话 localStorage 可能尚无 systemRole
  return user.username === 'admin'
}

export function isSystemViewer(user: string | SystemAdminUser | null | undefined): boolean {
  if (!user) return false
  if (typeof user === 'string') return user === 'viewer'
  return user.systemRole === 'viewer'
}

/**
 * 合并系统级和列表级权限。
 * - system admin：可跨列表执行所有动作；
 * - system viewer：全局只读上限，即使列表角色更高也不能写；
 * - system editor：按列表成员角色判断。
 */
export function canPerformListAction(
  user: string | SystemAdminUser | null | undefined,
  role: MemberRole | null,
  action: ListAction,
): boolean {
  if (isSystemAdmin(user)) return true
  if (action === 'read') return role !== null
  if (isSystemViewer(user)) return false

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
  user: string | SystemAdminUser,
  ownerId: string,
  userId: string,
): boolean {
  if (isSystemAdmin(user)) return true
  if (isSystemViewer(user)) return false
  if (ownerId === userId) return true
  return canDeleteList(role)
}

export function canAddMember(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

/** 系统管理员可管理成员，即使不是列表成员 */
export function canAddMemberAsUser(
  role: MemberRole | null,
  user: string | SystemAdminUser | null | undefined,
): boolean {
  if (isSystemAdmin(user)) return true
  if (isSystemViewer(user)) return false
  return canAddMember(role)
}

/** 设为主负责人：系统管理员，或列表 owner 角色成员 */
export function canTransferPrimaryOwnerAsUser(
  role: MemberRole | null,
  user: string | SystemAdminUser | null | undefined,
): boolean {
  if (isSystemAdmin(user)) return true
  if (isSystemViewer(user)) return false
  return role === 'owner'
}

/** 管理 owner 成员角色：系统管理员，或列表 owner 角色成员 */
export function canManageOwnerMemberRoleAsUser(
  role: MemberRole | null,
  user: string | SystemAdminUser | null | undefined,
): boolean {
  if (isSystemAdmin(user)) return true
  if (isSystemViewer(user)) return false
  return role === 'owner'
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
