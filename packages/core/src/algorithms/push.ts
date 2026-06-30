import type { PushValidationResult, MemberRole } from '../types/index.js'

interface MemberLike {
  user_id: string
  role: MemberRole
}

/**
 * 计算两个列表成员的交集
 */
export function resolveOverlap(fromMembers: MemberLike[], toMembers: MemberLike[]): string[] {
  const toSet = new Set(toMembers.map(m => m.user_id))
  return fromMembers
    .map(m => m.user_id)
    .filter(uid => toSet.has(uid))
}

/**
 * 验证推送是否可行
 *
 * 规则：源列表和目标列表必须有至少 1 个共同成员
 */
export function validatePush(params: {
  fromMembers: MemberLike[]
  toMembers: MemberLike[]
}): PushValidationResult {
  const overlapUserIds = resolveOverlap(params.fromMembers, params.toMembers)
  const totalSize = Math.max(params.fromMembers.length, params.toMembers.length, 1)
  const overlapPercent = Math.round((overlapUserIds.length / totalSize) * 100)
  const canPush = overlapUserIds.length > 0

  return {
    valid: canPush,
    overlapUserIds,
    overlapPercent,
    canPush,
    message: canPush
      ? `可推送：${overlapUserIds.length} 个共同成员（${overlapPercent}%）`
      : '无法推送：源列表和目标列表没有共同成员',
  }
}

/**
 * 检查推送发起者在目标列表中的角色是否允许推送
 * viewer 也可以在满足成员重叠的前提下推送
 */
export function canPushToList(userRole: MemberRole | null, overlapExists: boolean): boolean {
  if (!userRole) return false
  if (!overlapExists) return false
  return true
}
