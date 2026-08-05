import type { UserPublic } from '/$/phoenix-open-issue/core'

export interface HostUser {
  id?: number | string
  departmentId?: number | string | null
  name?: string | null
  username?: string | null
  nickName?: string | null
  email?: string | null
  status?: number | null
  createTime?: string | null
  updateTime?: string | null
  [key: string]: unknown
}

/** 将 Phoenix Admin 的账号外形集中转换为旧 Issue 算法所需的 actor。 */
export function toIssueUser(user: HostUser | null | undefined): UserPublic | null {
  if (!user?.id || !user.username) return null

  return {
    id: String(user.id),
    username: user.username,
    email: user.email ?? null,
    displayName: user.nickName ?? user.name ?? null,
    orgUnitId: user.departmentId == null ? null : String(user.departmentId),
    disabled: user.status === 0 ? 1 : 0,
    createdAt: user.createTime ?? '',
    updatedAt: user.updateTime ?? '',
  }
}
