import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
import { signToken } from '../utils/jwt.js'
import { ConflictError, UnauthorizedError } from '../utils/errors.js'
import { resolveOrgUnitId } from '../utils/pendingOrgUnit.js'
import type { User, UserPublic, CreateUserInput, LoginResult, RegisterResult } from '@phoenix-wing/open-issue-core'

function toPublic(user: User): UserPublic {
  const { passwordHash: _, ...pub } = user
  return pub
}

export class AuthService {
  register(input: CreateUserInput): RegisterResult {
    const db = getDb()
    const existing = db.get('SELECT id FROM users WHERE username = ?', input.username)
    if (existing) {
      throw new ConflictError('用户名已存在')
    }

    const id = uuid()
    const passwordHash = bcrypt.hashSync(input.password, 10)
    const now = new Date().toISOString()

    // 用户选择组织或默认待定组，新注册需管理员批准
    const orgId = resolveOrgUnitId(db, input.orgUnitId)

    db.run(
      `INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.username, input.email ?? null, passwordHash, input.displayName ?? null, orgId, 0, now, now],
    )

    const user = db.get('SELECT * FROM users WHERE id = ?', id) as User
    console.log(`👤 [REGISTER] new user "${user.username}" → org=${orgId} → pending approval`)

    return { token: null, user: toPublic(user), pending: true }
  }

  login(username: string, password: string): LoginResult {
    const db = getDb()
    const user = db.get('SELECT * FROM users WHERE username = ?', username) as User | undefined
    if (!user) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    const valid = bcrypt.compareSync(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    if (!user.approved) {
      throw new UnauthorizedError('账号尚未通过管理员批准')
    }

    const token = signToken({ userId: user.id, username: user.username })
    return { token, user: toPublic(user) }
  }

  getMe(userId: string): UserPublic {
    const db = getDb()
    const user = db.get('SELECT * FROM users WHERE id = ?', userId) as User | undefined
    if (!user) {
      throw new UnauthorizedError('用户不存在')
    }
    return toPublic(user)
  }

  getUserById(userId: string): UserPublic {
    const db = getDb()
    const user = db.get('SELECT * FROM users WHERE id = ?', userId) as User | undefined
    if (!user) {
      throw new UnauthorizedError('用户不存在')
    }
    return toPublic(user)
  }

  getAllUsers(): UserPublic[] {
    const db = getDb()
    const users = db.all('SELECT * FROM users WHERE approved = 1 ORDER BY username') as User[]
    return users.map(toPublic)
  }

  getPendingUsers(): UserPublic[] {
    const db = getDb()
    const users = db.all('SELECT * FROM users WHERE approved = 0 ORDER BY createdAt DESC') as User[]
    return users.map(toPublic)
  }

  approveUser(userId: string, approved: boolean): UserPublic {
    const db = getDb()
    const user = db.get('SELECT * FROM users WHERE id = ?', userId) as User | undefined
    if (!user) throw new UnauthorizedError('用户不存在')
    db.run('UPDATE users SET approved = ?, updatedAt = ? WHERE id = ?',
      [approved ? 1 : 0, new Date().toISOString(), userId])
    console.log(`👤 [APPROVE] user "${user.username}" → ${approved ? 'approved' : 'rejected'}`)
    return toPublic(db.get('SELECT * FROM users WHERE id = ?', userId) as User)
  }

  updateUserOrg(userId: string, orgUnitId: string | null): UserPublic {
    const db = getDb()
    const user = db.get('SELECT * FROM users WHERE id = ?', userId) as User | undefined
    if (!user) throw new UnauthorizedError('用户不存在')
    const resolvedOrgId = resolveOrgUnitId(db, orgUnitId)
    db.run('UPDATE users SET orgUnitId = ?, updatedAt = ? WHERE id = ?',
      [resolvedOrgId, new Date().toISOString(), userId])
    console.log(`👤 [MOVE] user "${user.username}" → org=${resolvedOrgId}`)
    return toPublic(db.get('SELECT * FROM users WHERE id = ?', userId) as User)
  }

  updateUser(userId: string, data: { displayName?: string; email?: string; orgUnitId?: string | null }): UserPublic {
    const db = getDb()
    const user = db.get('SELECT * FROM users WHERE id = ?', userId) as User | undefined
    if (!user) throw new UnauthorizedError('用户不存在')
    const orgUnitId = 'orgUnitId' in data ? resolveOrgUnitId(db, data.orgUnitId) : user.orgUnitId
    db.run('UPDATE users SET displayName = COALESCE(?, displayName), email = COALESCE(?, email), orgUnitId = ?, updatedAt = ? WHERE id = ?',
      [data.displayName ?? null, data.email ?? null, orgUnitId, new Date().toISOString(), userId])
    console.log(`👤 [UPDATE] user "${user.username}"`)
    return toPublic(db.get('SELECT * FROM users WHERE id = ?', userId) as User)
  }
}
