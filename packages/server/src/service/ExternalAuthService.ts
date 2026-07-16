import { createHash, randomBytes } from 'node:crypto'
import { generateId } from '@open-issue/core'
import type {
  ExternalAuthProviderId,
  ExternalAuthProviderInfo,
  ExternalAuthStartResult,
  ExternalAuthTicketResult,
  ExternalIdentityAdminView,
  ExternalIdentityPublic,
} from '@open-issue/core'
import { getAsyncDb } from '../db/connection.js'
import { config } from '../config.js'
import { AuthService } from './AuthService.js'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import { getActiveUserAsync } from '../utils/access.js'
import {
  getExternalAuthProviders,
  isExternalAuthProviderError,
  type ProviderRegistry,
} from '../auth/providers/registry.js'
import type { ExternalAuthProvider, ExternalIdentityProfile } from '../auth/providers/types.js'

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

export interface ExternalAuthCallbackResult {
  purpose: OAuthPurpose
  provider: ExternalAuthProviderId
  returnTo: string
  ticket?: string
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

  constructor(
    private readonly registry: ProviderRegistry = getExternalAuthProviders(),
    private readonly runtime: ExternalAuthRuntimeOptions = config.externalAuth,
  ) {}

  listProviders(): ExternalAuthProviderInfo[] {
    return this.runtime.enabled
      ? [...this.registry.values()].filter(provider => provider.enabled).map(provider => provider.info)
      : []
  }

  async startLogin(providerId: string, returnTo?: string): Promise<ExternalAuthStartResult> {
    return this.start(providerId, 'login', null, returnTo)
  }

  async startLink(providerId: string, userId: string, returnTo?: string): Promise<ExternalAuthStartResult> {
    return this.start(providerId, 'link', userId, returnTo || '/settings?tab=login-methods')
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
      if (!attempt.userId) throw new ExternalAuthFlowError('invalid_link_attempt', '绑定请求缺少本地用户', attempt.returnTo)
      await this.linkIdentity(attempt.userId, profile)
      console.info(`🔗 [EXTERNAL_AUTH] linked provider=${profile.provider} user=${attempt.userId}`)
      return { purpose: 'link', provider: provider.id, returnTo: attempt.returnTo }
    }

    const identity = await this.findActiveIdentity(profile.provider, profile.providerSubject)
    if (!identity) {
      throw new ExternalAuthFlowError('identity_not_bound', '该飞书账号尚未绑定本系统用户', attempt.returnTo)
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
    if (purpose === 'link' && !userId) throw new UnauthorizedError('请先登录后再绑定飞书')
    const normalizedReturnTo = normalizeReturnTo(returnTo, purpose === 'link' ? '/settings?tab=login-methods' : '/dashboard')
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

  private async linkIdentity(userId: string, profile: ExternalIdentityProfile): Promise<void> {
    const db = getAsyncDb()
    await getActiveUserAsync(db, userId)
    const existing = await db.get<ExternalIdentityRow>(
      `SELECT * FROM "externalIdentities" WHERE "provider" = ? AND "providerSubject" = ?`,
      [profile.provider, profile.providerSubject],
    )
    if (existing && existing.userId !== userId) {
      throw new ExternalAuthFlowError('identity_already_bound', '该飞书账号已绑定其他本系统用户', '/settings?tab=login-methods')
    }
    const now = new Date().toISOString()
    if (existing) {
      await db.run(
        `UPDATE "externalIdentities" SET
           "tenantKey" = ?, "openId" = ?, "unionId" = ?, "providerUserId" = ?,
           "displayName" = ?, "avatarUrl" = ?, "email" = ?, "metadataJson" = ?,
           "status" = 'active', "linkedByUserId" = ?, "linkedAt" = ?, "lastSyncedAt" = ?,
           "revokedAt" = NULL, "updatedAt" = ?
         WHERE "id" = ?`,
        [profile.tenantKey, profile.openId, profile.unionId, profile.providerUserId,
         profile.displayName, profile.avatarUrl, profile.email, JSON.stringify(profile.metadata),
         userId, now, now, now, existing.id],
      )
      return
    }
    try {
      await db.run(
        `INSERT INTO "externalIdentities"
         ("id", "userId", "provider", "providerSubject", "tenantKey", "openId", "unionId",
          "providerUserId", "displayName", "avatarUrl", "email", "metadataJson", "status",
          "linkSource", "linkedByUserId", "linkedAt", "lastSyncedAt", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'self', ?, ?, ?, ?, ?)`,
        [generateId(), userId, profile.provider, profile.providerSubject, profile.tenantKey,
         profile.openId, profile.unionId, profile.providerUserId, profile.displayName,
         profile.avatarUrl, profile.email, JSON.stringify(profile.metadata), userId,
         now, now, now, now],
      )
    } catch (error) {
      const conflictingIdentity = await db.get<{ id: string }>(
        `SELECT "id" FROM "externalIdentities" WHERE "provider" = ? AND "providerSubject" = ?`,
        [profile.provider, profile.providerSubject],
      )
      if (conflictingIdentity) throw new ConflictError('该飞书账号已被绑定，请刷新后重试')
      throw error
    }
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
