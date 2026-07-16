import { getAsyncDb } from '../db/connection.js'
import { generateId } from '@open-issue/core'
import bcrypt from 'bcryptjs'
import { signToken } from '../utils/jwt.js'
import { ConflictError, UnauthorizedError, ForbiddenError, BadRequestError } from '../utils/errors.js'
import { resolveOrgUnitIdAsync } from '../utils/pendingOrgUnit.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import type { User, UserPublic, CreateUserInput, LoginResult, RegisterResult, SystemRole } from '@open-issue/core'

function toPublic(user: User): UserPublic {
  const { passwordHash: _, tokenVersion: __, ...pub } = user
  return pub
}

export class AuthService {
  async register(input: CreateUserInput): Promise<RegisterResult> {
    const db = getAsyncDb()
    const existing = await db.get('SELECT "id" FROM "users" WHERE "username" = ?', [input.username])
    if (existing) {
      throw new ConflictError('用户名已存在')
    }

    const id = generateId()
    const passwordHash = bcrypt.hashSync(input.password, 10)
    const now = new Date().toISOString()

    // 用户选择组织或默认待定组，新注册需管理员批准
    const orgId = await resolveOrgUnitIdAsync(db, input.orgUnitId)

    await db.run(
      `INSERT INTO "users" ("id", "username", "email", "passwordHash", "displayName", "orgUnitId", "approved", "systemRole", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.username, input.email ?? null, passwordHash, input.displayName ?? null, orgId, 0, 'editor', now, now],
    )

    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [id]) as User
    console.log(`👤 [REGISTER] new user "${user.username}" → org=${orgId} → pending approval`)

    return { token: null, user: toPublic(user), pending: true }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const db = getAsyncDb()
    const user = await db.get<User>('SELECT * FROM "users" WHERE "username" = ?', [username])
    if (!user) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    const valid = bcrypt.compareSync(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    return this.createLoginResult(user)
  }

  /** 第三方身份精确匹配后，仍通过本地账号状态签发本项目会话。 */
  async loginUserById(userId: string): Promise<LoginResult> {
    const user = await getAsyncDb().get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')
    return this.createLoginResult(user)
  }

  async getMe(userId: string): Promise<UserPublic> {
    const db = getAsyncDb()
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) {
      throw new UnauthorizedError('用户不存在')
    }
    return toPublic(user)
  }

  async getUserById(userId: string): Promise<UserPublic> {
    const db = getAsyncDb()
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) {
      throw new UnauthorizedError('用户不存在')
    }
    return toPublic(user)
  }

  async getAllUsers(includeDisabled = false): Promise<UserPublic[]> {
    const db = getAsyncDb()
    const sql = includeDisabled
      ? 'SELECT * FROM "users" WHERE "approved" = 1 ORDER BY "username"'
      : 'SELECT * FROM "users" WHERE "approved" = 1 AND ("disabled" IS NULL OR "disabled" = 0) ORDER BY "username"'
    const users = await db.all<User>(sql)
    return users.map(toPublic)
  }

  async getPendingUsers(actorId: string): Promise<UserPublic[]> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const users = await db.all<User>('SELECT * FROM "users" WHERE "approved" = 0 ORDER BY "createdAt" DESC')
    return users.map(toPublic)
  }

  async approveUser(userId: string, approved: boolean, actorId: string): Promise<UserPublic> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')
    await db.run(
      'UPDATE "users" SET "approved" = ?, "tokenVersion" = "tokenVersion" + ?, "updatedAt" = ? WHERE "id" = ?',
      [approved ? 1 : 0, approved ? 0 : 1, new Date().toISOString(), userId],
    )
    console.log(`👤 [APPROVE] user "${user.username}" → ${approved ? 'approved' : 'rejected'}`)
    return toPublic(await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId]) as User)
  }

  async updateUserOrg(userId: string, orgUnitId: string | null, actorId: string): Promise<UserPublic> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')
    const resolvedOrgId = await resolveOrgUnitIdAsync(db, orgUnitId)
    await db.run('UPDATE "users" SET "orgUnitId" = ?, "updatedAt" = ? WHERE "id" = ?',
      [resolvedOrgId, new Date().toISOString(), userId])
    console.log(`👤 [MOVE] user "${user.username}" → org=${resolvedOrgId}`)
    return toPublic(await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId]) as User)
  }

  async updateUser(userId: string, data: { displayName?: string; email?: string; orgUnitId?: string | null; systemRole?: SystemRole }, actorId: string): Promise<UserPublic> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')

    if (data.systemRole !== undefined) {
      if (userId === actorId && data.systemRole !== 'admin') {
        throw new ForbiddenError('不能降低自己的管理员权限')
      }
    }

    const orgUnitId = 'orgUnitId' in data ? await resolveOrgUnitIdAsync(db, data.orgUnitId) : user.orgUnitId
    await db.run(
      `UPDATE "users" SET
        "displayName" = COALESCE(?, "displayName"),
        "email" = COALESCE(?, "email"),
        "orgUnitId" = ?,
        "systemRole" = COALESCE(?, "systemRole"),
        "updatedAt" = ?
       WHERE "id" = ?`,
      [data.displayName ?? null, data.email ?? null, orgUnitId, data.systemRole ?? null, new Date().toISOString(), userId],
    )
    console.log(`👤 [UPDATE] user "${user.username}"`)
    return toPublic(await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId]) as User)
  }

  // ── Feature 1: 用户禁用 ──
  async disableUser(userId: string, actorId: string): Promise<UserPublic> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')
    if (userId === actorId) throw new ForbiddenError('不能禁用自己')
    await db.run('UPDATE "users" SET "disabled" = 1, "tokenVersion" = "tokenVersion" + 1, "updatedAt" = ? WHERE "id" = ?',
      [new Date().toISOString(), userId])
    console.log(`🚫 [DISABLE] user "${user.username}" disabled by "${actorId}"`)
    return toPublic(await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId]) as User)
  }

  async enableUser(userId: string, actorId?: string): Promise<UserPublic> {
    const db = getAsyncDb()
    if (actorId) await assertSystemAdminAsync(db, actorId)
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')
    await db.run('UPDATE "users" SET "disabled" = 0, "updatedAt" = ? WHERE "id" = ?',
      [new Date().toISOString(), userId])
    console.log(`✅ [ENABLE] user "${user.username}" re-enabled`)
    return toPublic(await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId]) as User)
  }

  // ── Feature 4: 密码重置 ──
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const db = getAsyncDb()
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')

    const valid = bcrypt.compareSync(oldPassword, user.passwordHash)
    if (!valid) throw new UnauthorizedError('当前密码错误')

    if (newPassword.length < 6) {
      throw new BadRequestError('新密码长度不能少于6位')
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10)
    await db.run('UPDATE "users" SET "passwordHash" = ?, "tokenVersion" = "tokenVersion" + 1, "updatedAt" = ? WHERE "id" = ?',
      [passwordHash, new Date().toISOString(), userId])
    console.log(`🔑 [CHANGE_PW] user "${user.username}" changed password`)
  }

  async adminResetPassword(userId: string, newPassword: string, actorId: string): Promise<void> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const user = await db.get<User>('SELECT * FROM "users" WHERE "id" = ?', [userId])
    if (!user) throw new UnauthorizedError('用户不存在')

    if (newPassword.length < 6) {
      throw new BadRequestError('新密码长度不能少于6位')
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10)
    await db.run('UPDATE "users" SET "passwordHash" = ?, "tokenVersion" = "tokenVersion" + 1, "updatedAt" = ? WHERE "id" = ?',
      [passwordHash, new Date().toISOString(), userId])
    console.log(`🔑 [ADMIN_RESET_PW] user "${user.username}" password reset by "${actorId}"`)
  }

  private createLoginResult(user: User): LoginResult {
    if (!user.approved) {
      throw new UnauthorizedError('账号尚未通过管理员批准')
    }
    if (user.disabled) {
      throw new UnauthorizedError('账号已被禁用，请联系管理员')
    }
    const token = signToken({ userId: user.id, username: user.username, tokenVersion: user.tokenVersion ?? 0 })
    return { token, user: toPublic(user) }
  }
}
