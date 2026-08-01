import type { SystemRole, UserPublic } from '/$/phoenix-open-issue/core'

export interface HostUser {
  id?: number | string
  departmentId?: number | string | null
  name?: string | null
  username?: string | null
  nickName?: string | null
  email?: string | null
  status?: number | null
  systemRole?: string | null
  createTime?: string | null
  updateTime?: string | null
  [key: string]: unknown
}

function systemRoleOf(user: HostUser): SystemRole {
  if (user.systemRole === 'admin' || user.systemRole === 'viewer') return user.systemRole
  if (user.username === 'admin') return 'admin'
  return 'editor'
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
    approved: 1,
    disabled: user.status === 0 ? 1 : 0,
    systemRole: systemRoleOf(user),
    createdAt: user.createTime ?? '',
    updatedAt: user.updateTime ?? '',
  }
}
