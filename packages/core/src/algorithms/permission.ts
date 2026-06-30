import type { MemberRole } from '../types/index.js'

/**
 * 检查用户对列表的访问权限
 * @returns 角色名，null 表示无权限
 */
export function checkListAccess(
  userId: string,
  members: Array<{ user_id: string; role: MemberRole }>,
): MemberRole | null {
  const member = members.find(m => m.user_id === userId)
  return member?.role ?? null
}

/**
 * owner 或 editor 可以管理列表（修改名称、添加成员、删除列表）
 */
export function canManageList(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

/**
 * 只有 owner 可以删除列表
 */
export function canDeleteList(role: MemberRole | null): boolean {
  return role === 'owner'
}

/**
 * 检查是否可以添加成员
 */
export function canAddMember(role: MemberRole | null): boolean {
  return canManageList(role)
}

/**
 * 检查是否可以创建/编辑 Issue
 */
export function canModifyIssue(role: MemberRole | null): boolean {
  return canManageList(role)
}
