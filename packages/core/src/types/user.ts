export interface User {
  id: string
  username: string
  email: string | null
  password_hash: string
  display_name: string | null
  org_unit_id: string | null
  created_at: string
  updated_at: string
}

/** 返回给前端的用户信息（去掉 password_hash） */
export type UserPublic = Omit<User, 'password_hash'>

export interface CreateUserInput {
  username: string
  email?: string
  password: string
  display_name?: string
}

export interface LoginInput {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserPublic
}
