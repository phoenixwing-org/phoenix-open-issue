import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
import { signToken } from '../utils/jwt.js'
import { ConflictError, UnauthorizedError } from '../utils/errors.js'
import type { User, UserPublic, CreateUserInput, LoginResult } from '@phoenix-wing/open-issue-core'

function toPublic(user: User): UserPublic {
  const { password_hash: _, ...pub } = user
  return pub
}

export class AuthService {
  register(input: CreateUserInput): LoginResult {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(input.username)
    if (existing) {
      throw new ConflictError('用户名已存在')
    }

    const id = uuid()
    const password_hash = bcrypt.hashSync(input.password, 10)
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.username, input.email ?? null, password_hash, input.display_name ?? null, now, now)

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User
    const token = signToken({ userId: user.id, username: user.username })

    return { token, user: toPublic(user) }
  }

  login(username: string, password: string): LoginResult {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined
    if (!user) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    const token = signToken({ userId: user.id, username: user.username })
    return { token, user: toPublic(user) }
  }

  getMe(userId: string): UserPublic {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined
    if (!user) {
      throw new UnauthorizedError('用户不存在')
    }
    return toPublic(user)
  }

  getUserById(userId: string): UserPublic {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined
    if (!user) {
      throw new UnauthorizedError('用户不存在')
    }
    return toPublic(user)
  }

  getAllUsers(): UserPublic[] {
    const db = getDb()
    const users = db.prepare('SELECT * FROM users ORDER BY username').all() as User[]
    return users.map(toPublic)
  }
}
