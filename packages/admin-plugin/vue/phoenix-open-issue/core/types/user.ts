/** 系统级权限（与列表成员 role 无关） */
export type SystemRole = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  username: string
  email: string | null
  passwordHash: string
  displayName: string | null
  orgUnitId: string | null
  approved: number
  disabled?: number
  systemRole: SystemRole
  /** 令牌版本；密码变更、禁用或撤销审批时递增，使旧令牌立即失效。 */
  tokenVersion: number
  createdAt: string
  updatedAt: string
}

export type UserPublic = Omit<User, 'passwordHash' | 'tokenVersion'>

export interface CreateUserInput {
  username: string
  email?: string
  password: string
  displayName?: string
  orgUnitId?: string
}

export interface LoginInput {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserPublic
}

export interface RegisterResult {
  token: string | null
  user: UserPublic
  pending: boolean
}

export interface ChangePasswordInput {
  oldPassword: string
  newPassword: string
}

export interface AdminResetPasswordInput {
  newPassword: string
}
