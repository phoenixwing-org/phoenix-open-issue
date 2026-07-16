import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ExternalAuthProviderId } from '@open-issue/core'
import type {
  ExternalAuthProvider,
  ExternalIdentityProfile,
  ExternalTokenResult,
} from '../../packages/server/src/auth/providers/types.js'
import { ExternalAuthProviderError } from '../../packages/server/src/auth/providers/types.js'
import { FeishuAuthProvider } from '../../packages/server/src/auth/providers/feishu/FeishuAuthProvider.js'

let tempDir: string
let closeAsyncDb: () => Promise<void>
let db: import('../../packages/server/src/db/pnwDbAdapter.js').PnwDbAdapter
let adminId: string
let service: import('../../packages/server/src/service/ExternalAuthService.js').ExternalAuthService

const profile: ExternalIdentityProfile = {
  provider: 'feishu',
  providerSubject: 'tenant-a:open-a',
  tenantKey: 'tenant-a',
  openId: 'open-a',
  unionId: 'union-a',
  providerUserId: 'user-a',
  displayName: '飞书测试用户',
  avatarUrl: 'https://example.invalid/avatar.png',
  email: 'user@example.invalid',
  metadata: {},
}

class FakeProvider implements ExternalAuthProvider {
  readonly id: ExternalAuthProviderId = 'feishu'
  readonly enabled = true
  readonly info = { id: 'feishu' as const, name: '飞书', buttonText: '使用飞书登录' }
  currentProfile = profile

  createAuthorizationUrl(state: string): string {
    const url = new URL('https://accounts.example.invalid/authorize')
    url.searchParams.set('state', state)
    return url.toString()
  }

  async exchangeCode(_code: string): Promise<ExternalTokenResult> {
    return { accessToken: 'temporary-provider-token' }
  }

  async getIdentity(_accessToken: string): Promise<ExternalIdentityProfile> {
    return this.currentProfile
  }
}

const fakeProvider = new FakeProvider()

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-issue-external-auth-'))
  process.env.DB_DRIVER = 'sqlite'
  process.env.DB_PATH = path.join(tempDir, 'external-auth.sqlite')
  process.env.SERVE_STATIC = 'false'
  process.env.NODE_ENV = 'test'

  const connection = await import('../../packages/server/src/db/connection.js')
  closeAsyncDb = connection.closeAsyncDb
  await connection.initializeDb()
  db = connection.getDb()
  adminId = (db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string }).id

  const { ExternalAuthService } = await import('../../packages/server/src/service/ExternalAuthService.js')
  service = new ExternalAuthService(
    new Map([['feishu', fakeProvider]]),
    { enabled: true, stateTtlSeconds: 600, ticketTtlSeconds: 120 },
  )
})

afterAll(async () => {
  await closeAsyncDb?.()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe.sequential('第三方登录服务', () => {
  it('只公开启用提供方的展示信息', () => {
    expect(service.listProviders()).toEqual([
      { id: 'feishu', name: '飞书', buttonText: '使用飞书登录' },
    ])
  })

  it('拒绝站外或未列入范围的登录返回地址', async () => {
    await expect(service.startLogin('feishu', 'https://evil.example/steal')).rejects.toThrow('不合法')
    await expect(service.startLogin('feishu', '/unknown-admin-page')).rejects.toThrow('不在允许范围')
  })

  it('绑定时只保存 state 哈希，且同一 state 不能重放', async () => {
    const started = await service.startLink('feishu', adminId)
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    expect(state.length).toBeGreaterThanOrEqual(32)

    const attempt = db.get('SELECT stateHash FROM oauthLoginAttempts ORDER BY createdAt DESC LIMIT 1') as { stateHash: string }
    expect(attempt.stateHash).toMatch(/^[a-f0-9]{64}$/)
    expect(attempt.stateHash).not.toBe(state)

    await expect(service.completeCallback('feishu', { state, code: 'one-time-code' })).resolves.toMatchObject({
      purpose: 'link',
      provider: 'feishu',
    })
    await expect(service.completeCallback('feishu', { state, code: 'replayed-code' })).rejects.toMatchObject({
      code: 'invalid_state',
    })

    const identity = db.get('SELECT * FROM externalIdentities WHERE userId = ?', adminId) as Record<string, unknown>
    expect(identity).toMatchObject({
      provider: 'feishu',
      providerSubject: 'tenant-a:open-a',
      status: 'active',
    })
    expect(JSON.stringify(identity)).not.toContain('temporary-provider-token')
    expect(JSON.stringify(identity)).not.toContain('one-time-code')
  })

  it('用户取消授权时消费 state 并返回可识别错误', async () => {
    const started = await service.startLogin('feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    await expect(service.completeCallback('feishu', { state, error: 'access_denied' })).rejects.toMatchObject({
      code: 'access_denied',
    })
    await expect(service.completeCallback('feishu', { state, code: 'late-code' })).rejects.toMatchObject({
      code: 'invalid_state',
    })
  })

  it('已绑定身份可换取本项目会话，登录票据只能使用一次', async () => {
    const started = await service.startLogin('feishu', '/issue/test-id?from=feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    const callback = await service.completeCallback('feishu', { state, code: 'login-code' })
    expect(callback.ticket).toBeTruthy()

    const result = await service.exchangeTicket(callback.ticket!)
    expect(result.user).toMatchObject({ id: adminId, username: 'admin' })
    expect(result.token).toEqual(expect.any(String))
    expect(result.returnTo).toBe('/issue/test-id?from=feishu')

    await expect(service.exchangeTicket(callback.ticket!)).rejects.toThrow('无效或已过期')
  })

  it('完整备份包含长期身份绑定，但不包含 OAuth 临时凭证', async () => {
    const { BackupService } = await import('../../packages/server/src/service/BackupService.js')
    const backupService = new BackupService()
    const backup = await backupService.export('resetAll')
    expect(backup.tables.externalIdentities).toEqual([
      expect.objectContaining({ userId: adminId, provider: 'feishu', status: 'active' }),
    ])
    expect(backup.tables).not.toHaveProperty('oauthLoginAttempts')
    expect(backup.tables).not.toHaveProperty('oauthLoginTickets')

    const activeIdentity = db.get(
      "SELECT id FROM externalIdentities WHERE userId = ? AND status = 'active'",
      [adminId],
    ) as { id: string }
    db.run(
      `INSERT INTO oauthLoginTickets
       (id, ticketHash, userId, identityId, provider, returnTo, expiresAt, createdAt)
       VALUES ('stale-ticket', 'stale-hash', ?, ?, 'feishu', '/dashboard', '2099-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      [adminId, activeIdentity.id],
    )
    await backupService.import(backup, 'merge')
    expect((db.get('SELECT COUNT(*) AS count FROM oauthLoginTickets') as { count: number }).count).toBe(0)
  })

  it('拒绝过期的 OAuth state 和一次性登录票据', async () => {
    const { ExternalAuthService } = await import('../../packages/server/src/service/ExternalAuthService.js')
    const registry = new Map<ExternalAuthProviderId, ExternalAuthProvider>([['feishu', fakeProvider]])
    const expiredStateService = new ExternalAuthService(
      registry,
      { enabled: true, stateTtlSeconds: -1, ticketTtlSeconds: 120 },
    )
    const expiredStateStart = await expiredStateService.startLogin('feishu')
    const expiredState = new URL(expiredStateStart.authorizationUrl).searchParams.get('state')!
    await expect(expiredStateService.completeCallback('feishu', { state: expiredState, code: 'late' }))
      .rejects.toMatchObject({ code: 'invalid_state' })

    const expiredTicketService = new ExternalAuthService(
      registry,
      { enabled: true, stateTtlSeconds: 600, ticketTtlSeconds: -1 },
    )
    const ticketStart = await expiredTicketService.startLogin('feishu')
    const ticketState = new URL(ticketStart.authorizationUrl).searchParams.get('state')!
    const callback = await expiredTicketService.completeCallback('feishu', { state: ticketState, code: 'code' })
    await expect(expiredTicketService.exchangeTicket(callback.ticket!)).rejects.toThrow('无效或已过期')
  })

  it('未绑定身份不会按邮箱或姓名自动关联', async () => {
    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
      email: 'admin@example.invalid',
      displayName: 'admin',
    }
    const started = await service.startLogin('feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    await expect(service.completeCallback('feishu', { state, code: 'unknown-code' })).rejects.toMatchObject({
      code: 'identity_not_bound',
    })
    fakeProvider.currentProfile = profile
  })

  it('本地账号被禁用后，已绑定飞书身份也不能签发登录票据', async () => {
    db.run('UPDATE users SET disabled = 1 WHERE id = ?', [adminId])
    try {
      const started = await service.startLogin('feishu')
      const state = new URL(started.authorizationUrl).searchParams.get('state')!
      await expect(service.completeCallback('feishu', { state, code: 'disabled-user' })).rejects.toMatchObject({
        code: 'local_account_unavailable',
      })
    } finally {
      db.run('UPDATE users SET disabled = 0 WHERE id = ?', [adminId])
    }
  })

  it('解除绑定后该飞书身份不能继续登录，并保留撤销记录', async () => {
    const identities = await service.listMyIdentities(adminId)
    const active = identities.find(identity => identity.status === 'active')!
    const beforeUnlink = await service.startLogin('feishu')
    const beforeUnlinkState = new URL(beforeUnlink.authorizationUrl).searchParams.get('state')!
    const beforeUnlinkCallback = await service.completeCallback('feishu', { state: beforeUnlinkState, code: 'before-unlink' })
    await service.unlinkIdentity(active.id, adminId)
    await expect(service.exchangeTicket(beforeUnlinkCallback.ticket!)).rejects.toThrow('无效或已过期')

    const started = await service.startLogin('feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    await expect(service.completeCallback('feishu', { state, code: 'after-unlink' })).rejects.toMatchObject({
      code: 'identity_not_bound',
    })
    expect((await service.listMyIdentities(adminId))[0].status).toBe('revoked')
  })
})

describe('飞书提供方协议适配', () => {
  const baseConfig = {
    enabled: true,
    appId: 'cli_test_app',
    appSecret: 'server-only-secret',
    redirectUri: 'https://issues.example.com/api/auth/oauth/feishu/callback',
    allowedTenantKeys: ['tenant-a'],
    scopes: [],
    authorizationUrl: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
    tokenUrl: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
    userInfoUrl: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
  }

  it('授权链接不包含 App Secret，换票和用户信息请求符合官方接口', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/oauth/token')) {
        const requestBody = JSON.parse(String(init?.body))
        expect(requestBody).toEqual({
          grant_type: 'authorization_code',
          client_id: 'cli_test_app',
          client_secret: 'server-only-secret',
          code: 'oauth-code',
          redirect_uri: baseConfig.redirectUri,
        })
        return new Response(JSON.stringify({ code: 0, access_token: 'user-access-token' }), { status: 200 })
      }
      expect(init?.headers).toEqual({ Authorization: 'Bearer user-access-token' })
      return new Response(JSON.stringify({
        code: 0,
        data: {
          tenant_key: 'tenant-a',
          open_id: 'open-a',
          union_id: 'union-a',
          user_id: 'user-a',
          name: '飞书用户',
        },
      }), { status: 200 })
    })
    const provider = new FeishuAuthProvider(baseConfig, fetcher as typeof fetch)
    const authorizationUrl = provider.createAuthorizationUrl('secure-state')
    expect(authorizationUrl).toContain('client_id=cli_test_app')
    expect(authorizationUrl).toContain('state=secure-state')
    expect(authorizationUrl).not.toContain('server-only-secret')

    const token = await provider.exchangeCode('oauth-code')
    await expect(provider.getIdentity(token.accessToken)).resolves.toMatchObject({
      providerSubject: 'tenant-a:open-a',
      tenantKey: 'tenant-a',
      openId: 'open-a',
    })
  })

  it('拒绝不在允许列表中的飞书租户', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: 0,
      data: { tenant_key: 'tenant-other', open_id: 'open-other' },
    }), { status: 200 }))
    const provider = new FeishuAuthProvider(baseConfig, fetcher as typeof fetch)
    await expect(provider.getIdentity('token')).rejects.toEqual(
      expect.objectContaining<Partial<ExternalAuthProviderError>>({ code: 'tenant_not_allowed' }),
    )
  })

  it('将飞书网络异常和错误响应转换为稳定错误码', async () => {
    const unavailable = new FeishuAuthProvider(baseConfig, vi.fn(async () => {
      throw new Error('network down')
    }) as typeof fetch)
    await expect(unavailable.exchangeCode('code')).rejects.toEqual(
      expect.objectContaining<Partial<ExternalAuthProviderError>>({ code: 'provider_unavailable' }),
    )

    const rejected = new FeishuAuthProvider(baseConfig, vi.fn(async () => new Response(JSON.stringify({
      code: 20001,
      msg: 'invalid code',
    }), { status: 200 })) as typeof fetch)
    await expect(rejected.exchangeCode('code')).rejects.toEqual(
      expect.objectContaining<Partial<ExternalAuthProviderError>>({ code: 'provider_response_error' }),
    )
  })
})
