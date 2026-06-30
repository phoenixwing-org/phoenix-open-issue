export interface User {
  id: string
  username: string
  email: string | null
  passwordHash: string
  displayName: string | null
  orgUnitId: string | null
  approved: number
  createdAt: string
  updatedAt: string
}

export type UserPublic = Omit<User, 'passwordHash'>

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
