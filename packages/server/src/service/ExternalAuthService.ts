import { createHash, randomBytes } from 'node:crypto'
import { generateId } from '@open-issue/core'
import type {
  ExternalAuthProviderId,
  ExternalAuthProviderInfo,
  ExternalAuthStartResult,
  ExternalAuthTicketResult,
  ExternalBindRequestAdminView,
  ExternalBindRequestHandleResult,
  ExternalBindRequestPublic,
  ExternalBindRequestStatus,
  ExternalIdentityAdminView,
  ExternalIdentityPublic,
} from '@open-issue/core'
import bcrypt from 'bcryptjs'
import { getAsyncDb } from '../db/connection.js'
import { config } from '../config.js'
import { AuthService } from './AuthService.js'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import { getActiveUserAsync } from '../utils/access.js'
import { resolveOrgUnitIdAsync } from '../utils/pendingOrgUnit.js'
import {
  getExternalAuthProviders,
  isExternalAuthProviderError,
  type ProviderRegistry,
} from '../auth/providers/registry.js'
import type { ExternalAuthProvider, ExternalIdentityProfile } from '../auth/providers/types.js'
import type { PnwDbExecutor } from '../db/pnw/pnwDbTypes.js'
import { LoginPolicyService } from './LoginPolicyService.js'

type OAuthPurpose = 'login' | 'link'

interface OAuthAttemptRow {
  id: string
  provider: ExternalAuthProviderId
  purpose: OAuthPurpose
  userId: string | null
  returnTo: string
  expiresAt: string
  usedAt: string | null
}

interface OAuthTicketRow {
  id: string
  userId: string
  identityId: string
  provider: ExternalAuthProviderId
  returnTo: string
  expiresAt: string
  usedAt: string | null
}

interface ExternalIdentityRow extends ExternalIdentityAdminView {
  providerSubject: string
  metadataJson: string
  linkSource: string
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

interface ExternalBindRequestRow {
  id: string
  provider: ExternalAuthProviderId
  providerSubject: string
  tenantKey: string | null
  openId: string | null
  unionId: string | null
  providerUserId: string | null
  displayName: string | null
  avatarUrl: string | null
  email: string | null
  metadataJson: string
  proposedUsername: string | null
  proposedDisplayName: string | null
  status: ExternalBindRequestStatus
  boundUserId: string | null
  handledByUserId: string | null
  handledAt: string | null
  note: string | null
  profileTokenHash: string | null
  profileTokenExpiresAt: string | null
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}

export interface ExternalAuthCallbackResult {
  purpose: 'login' | 'link' | 'bind_pending'
  provider: ExternalAuthProviderId
  returnTo: string
  ticket?: string
  bindRequestId?: string
  profileToken?: string
}

export interface ExternalAuthRuntimeOptions {
  enabled: boolean
  stateTtlSeconds: number
  ticketTtlSeconds: number
}

export class ExternalAuthFlowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly returnTo = '/login',
  ) {
    super(message)
    this.name = 'ExternalAuthFlowError'
  }
}

export class ExternalAuthService {
  private readonly authService = new AuthService()
  private readonly loginPolicy = new LoginPolicyService()

  constructor(
    private readonly registry: ProviderRegistry = getExternalAuthProviders(),
    private readonly runtime: ExternalAuthRuntimeOptions = config.externalAuth,
  ) {}

  listProviders(): ExternalAuthProviderInfo[] {
    return this.runtime.enabled
      ? [...this.registry.values()].filter(provider => provider.enabled).map(provider => provider.info)
      : []
  }

  /** 公开列表：尊重管理员「第三方登录」开关。 */
  async listProvidersForLogin(): Promise<ExternalAuthProviderInfo[]> {
    const policy = await this.loginPolicy.getPolicy()
    if (!policy.externalEnabled) return []
    return this.listProviders()
  }

  async startLogin(providerId: string, returnTo?: string): Promise<ExternalAuthStartResult> {
    await this.loginPolicy.assertExternalLoginAllowed()
    return this.start(providerId, 'login', null, returnTo)
  }

  /** 自助绑定已关闭；仅管理员可通过待审查队列完成绑定。 */
  async startLink(_providerId: string, _userId: string, _returnTo?: string): Promise<ExternalAuthStartResult> {
    throw new ForbiddenError('自助绑定已关闭，请使用飞书登录提交待审查，由管理员完成绑定')
  }

  async completeCallback(
    providerId: string,
    input: { state?: string; code?: string; error?: string },
  ): Promise<ExternalAuthCallbackResult> {
    if (!input.state) throw new ExternalAuthFlowError('invalid_state', '第三方登录状态缺失')
    const provider = this.requireProvider(providerId)
    const attempt = await this.consumeAttempt(provider.id, input.state)

    if (input.error) {
      await this.setAttemptFailure(attempt.id, input.error)
      throw new ExternalAuthFlowError(
        input.error === 'access_denied' ? 'access_denied' : 'provider_denied',
        input.error === 'access_denied' ? '已取消飞书授权' : '飞书未完成授权',
        attempt.returnTo,
      )
    }
    if (!input.code) {
      await this.setAttemptFailure(attempt.id, 'missing_code')
      throw new ExternalAuthFlowError('missing_code', '飞书没有返回授权码', attempt.returnTo)
    }

    let profile: ExternalIdentityProfile
    try {
      const token = await provider.exchangeCode(input.code)
      profile = await provider.getIdentity(token.accessToken)
    } catch (error) {
      const code = isExternalAuthProviderError(error) ? error.code : 'provider_response_error'
      await this.setAttemptFailure(attempt.id, code)
      throw new ExternalAuthFlowError(code, error instanceof Error ? error.message : '飞书认证失败', attempt.returnTo)
    }

    if (attempt.purpose === 'link') {
      throw new ExternalAuthFlowError('self_link_disabled', '自助绑定已关闭，请联系管理员', attempt.returnTo)
    }

    const identity = await this.findActiveIdentity(profile.provider, profile.providerSubject)
    if (!identity) {
      const pending = await this.upsertBindRequest(profile)
      console.info(`📋 [EXTERNAL_AUTH] bind pending provider=${profile.provider} request=${pending.id}`)
      return {
        purpose: 'bind_pending',
        provider: provider.id,
        returnTo: attempt.returnTo,
        bindRequestId: pending.id,
        profileToken: pending.profileToken,
      }
    }
    try {
      await getActiveUserAsync(getAsyncDb(), identity.userId)
    } catch {
      throw new ExternalAuthFlowError('local_account_unavailable', '本系统账号未批准或已被禁用', attempt.returnTo)
    }
    const ticket = await this.issueTicket(identity.id, identity.userId, provider.id, attempt.returnTo)
    const now = new Date().toISOString()
    await getAsyncDb().run(
      `UPDATE "externalIdentities"
       SET "displayName" = ?, "avatarUrl" = ?, "email" = ?, "lastSyncedAt" = ?, "updatedAt" = ?
       WHERE "id" = ?`,
      [profile.displayName, profile.avatarUrl, profile.email, now, now, identity.id],
    )
    console.info(`🎫 [EXTERNAL_AUTH] ticket issued provider=${provider.id} user=${identity.userId}`)
    return { purpose: 'login', provider: provider.id, returnTo: attempt.returnTo, ticket }
  }

  async exchangeTicket(ticket: string): Promise<ExternalAuthTicketResult> {
    if (!ticket || ticket.length < 32) throw new UnauthorizedError('第三方登录票据无效')
    const db = getAsyncDb()
    const now = new Date().toISOString()
    const ticketHash = hashSecret(ticket)
    const row = await db.get<OAuthTicketRow>(
      `SELECT * FROM "oauthLoginTickets" WHERE "ticketHash" = ?`,
      [ticketHash],
    )
    if (!row || row.usedAt || row.expiresAt <= now) throw new UnauthorizedError('第三方登录票据无效或已过期')
    const identity = await db.get<{ id: string }>(
      `SELECT "id" FROM "externalIdentities"
       WHERE "id" = ? AND "userId" = ? AND "provider" = ? AND "status" = 'active'`,
      [row.identityId, row.userId, row.provider],
    )
    if (!identity) throw new UnauthorizedError('第三方登录绑定已失效')
    const consumed = await db.run(
      `UPDATE "oauthLoginTickets" SET "usedAt" = ?
       WHERE "id" = ? AND "usedAt" IS NULL AND "expiresAt" > ?`,
      [now, row.id, now],
    )
    if (consumed.changes !== 1) throw new UnauthorizedError('第三方登录票据已被使用')
    const login = await this.authService.loginUserById(row.userId)
    await db.run(
      `UPDATE "externalIdentities" SET "lastLoginAt" = ?, "updatedAt" = ? WHERE "id" = ?`,
      [now, now, row.identityId],
    )
    console.info(`✅ [EXTERNAL_AUTH] login provider=${row.provider} user=${row.userId}`)
    return { ...login, returnTo: row.returnTo }
  }

  async getPublicBindRequestByToken(profileToken: string): Promise<ExternalBindRequestPublic> {
    const row = await this.requirePendingByProfileToken(profileToken)
    return toPublicBindRequest(row)
  }

  async updateBindRequestProfile(
    profileToken: string,
    input: { proposedUsername?: string; proposedDisplayName?: string },
  ): Promise<ExternalBindRequestPublic> {
    const row = await this.requirePendingByProfileToken(profileToken)
    const proposedUsername = normalizeOptionalText(input.proposedUsername, 64)
    const proposedDisplayName = normalizeOptionalText(input.proposedDisplayName, 64)
    if (proposedUsername === undefined && proposedDisplayName === undefined) {
      throw new BadRequestError('请至少填写用户名或姓名')
    }
    if (proposedUsername !== undefined && proposedUsername !== null) {
      assertValidUsername(proposedUsername)
    }
    const now = new Date().toISOString()
    await getAsyncDb().run(
      `UPDATE "externalBindRequests" SET
         "proposedUsername" = COALESCE(?, "proposedUsername"),
         "proposedDisplayName" = COALESCE(?, "proposedDisplayName"),
         "updatedAt" = ?
       WHERE "id" = ? AND "status" = 'pending'`,
      [
        proposedUsername === undefined ? null : proposedUsername,
        proposedDisplayName === undefined ? null : proposedDisplayName,
        now,
        row.id,
      ],
    )
    const updated = await getAsyncDb().get<ExternalBindRequestRow>(
      `SELECT * FROM "externalBindRequests" WHERE "id" = ?`,
      [row.id],
    )
    return toPublicBindRequest(updated!)
  }

  async listBindRequests(
    actorId: string,
    filters: { status?: string; provider?: string } = {},
  ): Promise<ExternalBindRequestAdminView[]> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const clauses: string[] = []
    const params: unknown[] = []
    if (filters.status) {
      clauses.push('"status" = ?')
      params.push(filters.status)
    }
    if (filters.provider) {
      clauses.push('"provider" = ?')
      params.push(filters.provider)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await db.all<ExternalBindRequestRow>(
      `SELECT * FROM "externalBindRequests" ${where}
       ORDER BY CASE "status" WHEN 'pending' THEN 0 ELSE 1 END, "updatedAt" DESC`,
      params,
    )
    return rows.map(toAdminBindRequest)
  }

  async updateBindRequestAdmin(
    requestId: string,
    actorId: string,
    input: { proposedUsername?: string; proposedDisplayName?: string; note?: string },
  ): Promise<ExternalBindRequestAdminView> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const row = await this.requireBindRequest(requestId)
    if (row.status !== 'pending') throw new BadRequestError('仅待审查记录可修改')
    const proposedUsername = normalizeOptionalText(input.proposedUsername, 64)
    const proposedDisplayName = normalizeOptionalText(input.proposedDisplayName, 64)
    const note = normalizeOptionalText(input.note, 500)
    if (proposedUsername !== undefined && proposedUsername !== null) assertValidUsername(proposedUsername)
    const now = new Date().toISOString()
    await db.run(
      `UPDATE "externalBindRequests" SET
         "proposedUsername" = COALESCE(?, "proposedUsername"),
         "proposedDisplayName" = COALESCE(?, "proposedDisplayName"),
         "note" = COALESCE(?, "note"),
         "updatedAt" = ?
       WHERE "id" = ?`,
      [
        proposedUsername === undefined ? null : proposedUsername,
        proposedDisplayName === undefined ? null : proposedDisplayName,
        note === undefined ? null : note,
        now,
        requestId,
      ],
    )
    return toAdminBindRequest(await this.requireBindRequest(requestId))
  }

  async bindRequestToUser(
    requestId: string,
    userId: string,
    actorId: string,
  ): Promise<ExternalBindRequestHandleResult> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const request = await this.requireBindRequest(requestId)
    if (request.status !== 'pending') throw new BadRequestError('该申请已处理')
    await getActiveUserAsync(db, userId)
    await db.transaction(async tx => {
      await this.linkIdentityForAdmin(tx, userId, request, actorId)
      await this.markBindRequestHandled(tx, request.id, userId, actorId, 'bound', null)
    })
    console.info(`🔗 [EXTERNAL_AUTH] admin bound request=${requestId} user=${userId} actor=${actorId}`)
    const user = await this.authService.getUserById(userId)
    return { request: toAdminBindRequest(await this.requireBindRequest(requestId)), user }
  }

  async createUserAndBindRequest(
    requestId: string,
    actorId: string,
    input: {
      username: string
      password: string
      displayName?: string
      email?: string
      orgUnitId?: string | null
    },
  ): Promise<ExternalBindRequestHandleResult> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const request = await this.requireBindRequest(requestId)
    if (request.status !== 'pending') throw new BadRequestError('该申请已处理')

    const username = input.username.trim()
    assertValidUsername(username)
    if (!input.password || input.password.length < 6) throw new BadRequestError('密码至少 6 位')

    const existing = await db.get<{ id: string }>('SELECT "id" FROM "users" WHERE "username" = ?', [username])
    if (existing) throw new ConflictError('用户名已存在')

    const displayName = (input.displayName?.trim()
      || request.proposedDisplayName
      || request.displayName
      || username)
    const email = input.email?.trim() || request.email || null
    const orgId = await resolveOrgUnitIdAsync(db, input.orgUnitId ?? undefined)
    const userId = generateId()
    const passwordHash = bcrypt.hashSync(input.password, 10)
    const now = new Date().toISOString()

    try {
      await db.transaction(async tx => {
        await tx.run(
          `INSERT INTO "users" ("id", "username", "email", "passwordHash", "displayName", "orgUnitId", "approved", "systemRole", "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, 1, 'editor', ?, ?)`,
          [userId, username, email, passwordHash, displayName, orgId, now, now],
        )
        await this.linkIdentityForAdmin(tx, userId, request, actorId)
        await this.markBindRequestHandled(tx, request.id, userId, actorId, 'bound', null)
      })
    } catch (error) {
      const conflict = await db.get<{ id: string }>('SELECT "id" FROM "users" WHERE "username" = ?', [username])
      if (conflict) throw new ConflictError('用户名已存在，请刷新后重试')
      throw error
    }

    console.info(`👤 [EXTERNAL_AUTH] admin create-and-bind request=${requestId} user=${userId} actor=${actorId}`)
    const user = await this.authService.getUserById(userId)
    return { request: toAdminBindRequest(await this.requireBindRequest(requestId)), user }
  }

  async rejectBindRequest(
    requestId: string,
    actorId: string,
    note?: string,
  ): Promise<ExternalBindRequestAdminView> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    const request = await this.requireBindRequest(requestId)
    if (request.status !== 'pending') throw new BadRequestError('该申请已处理')
    await this.markBindRequestHandled(
      db,
      request.id,
      null,
      actorId,
      'rejected',
      normalizeOptionalText(note, 500) ?? null,
    )
    console.info(`🚫 [EXTERNAL_AUTH] admin rejected request=${requestId} actor=${actorId}`)
    return toAdminBindRequest(await this.requireBindRequest(requestId))
  }

  async isUsernameAvailable(username: string, actorId: string): Promise<{ available: boolean }> {
    await assertSystemAdminAsync(getAsyncDb(), actorId)
    const trimmed = username.trim()
    if (!trimmed) throw new BadRequestError('用户名不能为空')
    try {
      assertValidUsername(trimmed)
    } catch {
      return { available: false }
    }
    const existing = await getAsyncDb().get<{ id: string }>(
      'SELECT "id" FROM "users" WHERE "username" = ?',
      [trimmed],
    )
    return { available: !existing }
  }

  async listMyIdentities(userId: string): Promise<ExternalIdentityPublic[]> {
    const rows = await getAsyncDb().all<ExternalIdentityRow>(
      `SELECT * FROM "externalIdentities" WHERE "userId" = ? ORDER BY "linkedAt" DESC`,
      [userId],
    )
    return rows.map(toPublicIdentity)
  }

  async listUserIdentities(userId: string, actorId: string): Promise<ExternalIdentityAdminView[]> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, actorId)
    return db.all<ExternalIdentityAdminView>(
      `SELECT "id", "userId", "provider", "tenantKey", "openId", "unionId", "providerUserId",
              "displayName", "avatarUrl", "email", "status", "linkedByUserId", "linkedAt",
              "lastLoginAt", "revokedAt"
       FROM "externalIdentities" WHERE "userId" = ? ORDER BY "linkedAt" DESC`,
      [userId],
    )
  }

  async unlinkIdentity(identityId: string, userId: string, actorId?: string): Promise<void> {
    const db = getAsyncDb()
    if (actorId && actorId !== userId) await assertSystemAdminAsync(db, actorId)
    const row = await db.get<ExternalIdentityRow>(
      `SELECT * FROM "externalIdentities" WHERE "id" = ?`,
      [identityId],
    )
    if (!row) throw new NotFoundError('第三方登录身份')
    if (row.userId !== userId) throw new ForbiddenError('第三方登录身份不属于目标用户')
    if (row.status === 'revoked') return
    const now = new Date().toISOString()
    await db.run(
      `UPDATE "externalIdentities" SET "status" = 'revoked', "revokedAt" = ?, "updatedAt" = ? WHERE "id" = ?`,
      [now, now, identityId],
    )
    await db.run(
      `DELETE FROM "oauthLoginTickets"
       WHERE "userId" = ? AND "provider" = ? AND "usedAt" IS NULL`,
      [row.userId, row.provider],
    )
    console.info(`🔓 [EXTERNAL_AUTH] unlinked provider=${row.provider} user=${row.userId} actor=${actorId || userId}`)
  }

  private async start(
    providerId: string,
    purpose: OAuthPurpose,
    userId: string | null,
    returnTo?: string,
  ): Promise<ExternalAuthStartResult> {
    const provider = this.requireProvider(providerId)
    if (purpose === 'link') throw new ForbiddenError('自助绑定已关闭，请联系管理员')
    const normalizedReturnTo = normalizeReturnTo(returnTo, '/dashboard')
    const state = randomBytes(32).toString('base64url')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.runtime.stateTtlSeconds * 1000).toISOString()
    const db = getAsyncDb()
    await db.run(
      `INSERT INTO "oauthLoginAttempts"
       ("id", "provider", "purpose", "stateHash", "userId", "returnTo", "expiresAt", "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), provider.id, purpose, hashSecret(state), userId, normalizedReturnTo, expiresAt, now.toISOString()],
    )
    void this.cleanupExpired().catch(error => console.warn('清理过期 OAuth 事务失败:', error))
    return { authorizationUrl: provider.createAuthorizationUrl(state) }
  }

  private requireProvider(providerId: string): ExternalAuthProvider {
    if (!this.runtime.enabled) throw new NotFoundError('第三方登录提供方')
    const provider = this.registry.get(providerId as ExternalAuthProviderId)
    if (!provider || !provider.enabled) throw new NotFoundError('第三方登录提供方')
    return provider
  }

  private async consumeAttempt(provider: ExternalAuthProviderId, state: string): Promise<OAuthAttemptRow> {
    const db = getAsyncDb()
    const stateHash = hashSecret(state)
    const now = new Date().toISOString()
    const attempt = await db.get<OAuthAttemptRow>(
      `SELECT * FROM "oauthLoginAttempts" WHERE "provider" = ? AND "stateHash" = ?`,
      [provider, stateHash],
    )
    if (!attempt || attempt.usedAt || attempt.expiresAt <= now) {
      throw new ExternalAuthFlowError('invalid_state', '第三方登录状态无效、已使用或已过期')
    }
    const consumed = await db.run(
      `UPDATE "oauthLoginAttempts" SET "usedAt" = ?
       WHERE "id" = ? AND "usedAt" IS NULL AND "expiresAt" > ?`,
      [now, attempt.id, now],
    )
    if (consumed.changes !== 1) {
      throw new ExternalAuthFlowError('invalid_state', '第三方登录状态已被使用')
    }
    return attempt
  }

  private async upsertBindRequest(
    profile: ExternalIdentityProfile,
  ): Promise<{ id: string; profileToken: string }> {
    const db = getAsyncDb()
    const now = new Date()
    const nowIso = now.toISOString()
    const profileToken = randomBytes(32).toString('base64url')
    const profileTokenHash = hashSecret(profileToken)
    const profileTokenExpiresAt = new Date(now.getTime() + this.runtime.ticketTtlSeconds * 1000 * 30).toISOString()
    const proposedDisplayName = profile.displayName
    const metadataJson = JSON.stringify(profile.metadata)

    const pending = await db.get<ExternalBindRequestRow>(
      `SELECT * FROM "externalBindRequests"
       WHERE "provider" = ? AND "providerSubject" = ? AND "status" = 'pending'`,
      [profile.provider, profile.providerSubject],
    )

    if (pending) {
      await db.run(
        `UPDATE "externalBindRequests" SET
           "tenantKey" = ?, "openId" = ?, "unionId" = ?, "providerUserId" = ?,
           "displayName" = ?, "avatarUrl" = ?, "email" = ?, "metadataJson" = ?,
           "proposedDisplayName" = COALESCE("proposedDisplayName", ?),
           "profileTokenHash" = ?, "profileTokenExpiresAt" = ?,
           "lastSeenAt" = ?, "updatedAt" = ?
         WHERE "id" = ?`,
        [
          profile.tenantKey, profile.openId, profile.unionId, profile.providerUserId,
          profile.displayName, profile.avatarUrl, profile.email, metadataJson,
          proposedDisplayName,
          profileTokenHash, profileTokenExpiresAt,
          nowIso, nowIso, pending.id,
        ],
      )
      return { id: pending.id, profileToken }
    }

    const id = generateId()
    await db.run(
      `INSERT INTO "externalBindRequests"
       ("id", "provider", "providerSubject", "tenantKey", "openId", "unionId", "providerUserId",
        "displayName", "avatarUrl", "email", "metadataJson", "proposedUsername", "proposedDisplayName",
        "status", "profileTokenHash", "profileTokenExpiresAt", "lastSeenAt", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        id, profile.provider, profile.providerSubject, profile.tenantKey, profile.openId,
        profile.unionId, profile.providerUserId, profile.displayName, profile.avatarUrl,
        profile.email, metadataJson, proposedDisplayName, profileTokenHash,
        profileTokenExpiresAt, nowIso, nowIso, nowIso,
      ],
    )
    return { id, profileToken }
  }

  private async linkIdentityForAdmin(
    tx: PnwDbExecutor,
    userId: string,
    request: ExternalBindRequestRow,
    actorId: string,
  ): Promise<void> {
    const existing = await tx.get<ExternalIdentityRow>(
      `SELECT * FROM "externalIdentities" WHERE "provider" = ? AND "providerSubject" = ?`,
      [request.provider, request.providerSubject],
    )
    if (existing && existing.userId !== userId && existing.status === 'active') {
      throw new ConflictError('该飞书账号已绑定其他本系统用户')
    }
    const now = new Date().toISOString()
    if (existing) {
      await tx.run(
        `UPDATE "externalIdentities" SET
           "userId" = ?, "tenantKey" = ?, "openId" = ?, "unionId" = ?, "providerUserId" = ?,
           "displayName" = ?, "avatarUrl" = ?, "email" = ?, "metadataJson" = ?,
           "status" = 'active', "linkSource" = 'admin', "linkedByUserId" = ?, "linkedAt" = ?,
           "lastSyncedAt" = ?, "revokedAt" = NULL, "updatedAt" = ?
         WHERE "id" = ?`,
        [
          userId, request.tenantKey, request.openId, request.unionId, request.providerUserId,
          request.displayName, request.avatarUrl, request.email, request.metadataJson,
          actorId, now, now, now, existing.id,
        ],
      )
      return
    }
    await tx.run(
      `INSERT INTO "externalIdentities"
       ("id", "userId", "provider", "providerSubject", "tenantKey", "openId", "unionId",
        "providerUserId", "displayName", "avatarUrl", "email", "metadataJson", "status",
        "linkSource", "linkedByUserId", "linkedAt", "lastSyncedAt", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'admin', ?, ?, ?, ?, ?)`,
      [
        generateId(), userId, request.provider, request.providerSubject, request.tenantKey,
        request.openId, request.unionId, request.providerUserId, request.displayName,
        request.avatarUrl, request.email, request.metadataJson, actorId, now, now, now, now,
      ],
    )
  }

  private async markBindRequestHandled(
    db: PnwDbExecutor,
    requestId: string,
    boundUserId: string | null,
    actorId: string,
    status: 'bound' | 'rejected',
    note: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()
    await db.run(
      `UPDATE "externalBindRequests" SET
         "status" = ?, "boundUserId" = ?, "handledByUserId" = ?, "handledAt" = ?,
         "note" = COALESCE(?, "note"), "profileTokenHash" = NULL, "profileTokenExpiresAt" = NULL,
         "updatedAt" = ?
       WHERE "id" = ? AND "status" = 'pending'`,
      [status, boundUserId, actorId, now, note, now, requestId],
    )
  }

  private async requireBindRequest(requestId: string): Promise<ExternalBindRequestRow> {
    const row = await getAsyncDb().get<ExternalBindRequestRow>(
      `SELECT * FROM "externalBindRequests" WHERE "id" = ?`,
      [requestId],
    )
    if (!row) throw new NotFoundError('第三方绑定申请')
    return row
  }

  private async requirePendingByProfileToken(profileToken: string): Promise<ExternalBindRequestRow> {
    if (!profileToken || profileToken.length < 32) throw new UnauthorizedError('补填凭证无效或已过期')
    const now = new Date().toISOString()
    const row = await getAsyncDb().get<ExternalBindRequestRow>(
      `SELECT * FROM "externalBindRequests" WHERE "profileTokenHash" = ?`,
      [hashSecret(profileToken)],
    )
    if (!row || row.status !== 'pending' || !row.profileTokenExpiresAt || row.profileTokenExpiresAt <= now) {
      throw new UnauthorizedError('补填凭证无效或已过期')
    }
    return row
  }

  private findActiveIdentity(provider: ExternalAuthProviderId, providerSubject: string): Promise<ExternalIdentityRow | undefined> {
    return getAsyncDb().get<ExternalIdentityRow>(
      `SELECT * FROM "externalIdentities"
       WHERE "provider" = ? AND "providerSubject" = ? AND "status" = 'active'`,
      [provider, providerSubject],
    )
  }

  private async issueTicket(
    identityId: string,
    userId: string,
    provider: ExternalAuthProviderId,
    returnTo: string,
  ): Promise<string> {
    const rawTicket = randomBytes(32).toString('base64url')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.runtime.ticketTtlSeconds * 1000).toISOString()
    await getAsyncDb().run(
      `INSERT INTO "oauthLoginTickets"
       ("id", "ticketHash", "userId", "identityId", "provider", "returnTo", "expiresAt", "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), hashSecret(rawTicket), userId, identityId, provider, returnTo, expiresAt, now.toISOString()],
    )
    return rawTicket
  }

  private setAttemptFailure(id: string, code: string): Promise<{ changes: number }> {
    return getAsyncDb().run(
      `UPDATE "oauthLoginAttempts" SET "failureCode" = ? WHERE "id" = ?`,
      [code.slice(0, 80), id],
    )
  }

  private async cleanupExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const db = getAsyncDb()
    await db.run(`DELETE FROM "oauthLoginAttempts" WHERE "expiresAt" < ?`, [cutoff])
    await db.run(`DELETE FROM "oauthLoginTickets" WHERE "expiresAt" < ?`, [cutoff])
  }
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeReturnTo(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    throw new BadRequestError('登录返回地址不合法')
  }
  const parsed = new URL(value, 'http://local.invalid')
  if (parsed.origin !== 'http://local.invalid') throw new BadRequestError('登录返回地址不合法')
  const allowedExactPaths = new Set([
    '/', '/dashboard', '/lists', '/settings', '/welcome', '/org',
    '/push-history', '/functions', '/test-runner', '/login',
  ])
  const allowedPath = allowedExactPaths.has(parsed.pathname)
    || parsed.pathname.startsWith('/list/')
    || parsed.pathname.startsWith('/issue/')
  if (!allowedPath) throw new BadRequestError('登录返回地址不在允许范围内')
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

function toPublicIdentity(row: ExternalIdentityRow): ExternalIdentityPublic {
  return {
    id: row.id,
    provider: row.provider,
    tenantKey: row.tenantKey,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    email: row.email,
    status: row.status,
    linkedAt: row.linkedAt,
    lastLoginAt: row.lastLoginAt,
  }
}

function toPublicBindRequest(row: ExternalBindRequestRow): ExternalBindRequestPublic {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    email: row.email,
    avatarUrl: row.avatarUrl,
    proposedUsername: row.proposedUsername,
    proposedDisplayName: row.proposedDisplayName,
    status: row.status,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  }
}

function toAdminBindRequest(row: ExternalBindRequestRow): ExternalBindRequestAdminView {
  return {
    ...toPublicBindRequest(row),
    providerSubject: row.providerSubject,
    tenantKey: row.tenantKey,
    openId: row.openId,
    unionId: row.unionId,
    providerUserId: row.providerUserId,
    boundUserId: row.boundUserId,
    handledByUserId: row.handledByUserId,
    handledAt: row.handledAt,
    note: row.note,
    updatedAt: row.updatedAt,
  }
}

/** undefined = 未传；null = 清空；string = 新值 */
function normalizeOptionalText(value: unknown, maxLen: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw new BadRequestError('字段格式不正确')
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > maxLen) throw new BadRequestError(`内容过长（最多 ${maxLen} 字）`)
  return trimmed
}

function assertValidUsername(username: string): void {
  if (username.length < 2 || username.length > 64) throw new BadRequestError('用户名长度为 2–64 个字符')
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5.-]+$/.test(username)) {
    throw new BadRequestError('用户名仅允许字母、数字、下划线、中文、点号和短横线')
  }
}
