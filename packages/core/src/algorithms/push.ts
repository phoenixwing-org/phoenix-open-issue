import type { PushValidationResult } from '../types/index.js'

interface MemberLike {
  userId: string
  role: string
}

export function resolveOverlap(fromMembers: MemberLike[], toMembers: MemberLike[]): string[] {
  const toSet = new Set(toMembers.map(m => m.userId))
  return fromMembers
    .map(m => m.userId)
    .filter(uid => toSet.has(uid))
}

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

export function canPushToList(userRole: string | null, overlapExists: boolean): boolean {
  if (!userRole) return false
  if (!overlapExists) return false
  return true
}

export function canHandlePush(
  userId: string,
  push: { toListId: string; status: string },
  targetListMembers: MemberLike[],
): boolean {
  if (push.status !== 'pending') return false
  const member = targetListMembers.find(m => m.userId === userId)
  return member?.role === 'owner' || member?.role === 'admin'
}
