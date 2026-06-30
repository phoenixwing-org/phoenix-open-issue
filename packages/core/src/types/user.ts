export interface User {
  id: string
  username: string
  email: string | null
  passwordHash: string
  displayName: string | null
  orgUnitId: string | null
  createdAt: string
  updatedAt: string
}

export type UserPublic = Omit<User, 'passwordHash'>

export interface CreateUserInput {
  username: string
  email?: string
  password: string
  displayName?: string
}

export interface LoginInput {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserPublic
}
