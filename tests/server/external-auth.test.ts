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

  it('自助绑定已关闭', async () => {
    await expect(service.startLink('feishu', adminId)).rejects.toThrow('自助绑定')
  })

  it('未绑定登录写入待审查且不按邮箱自动关联', async () => {
    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
      email: 'admin@example.invalid',
      displayName: 'admin',
    }
    const started = await service.startLogin('feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    const callback = await service.completeCallback('feishu', { state, code: 'unknown-code' })
    expect(callback).toMatchObject({
      purpose: 'bind_pending',
      provider: 'feishu',
      bindRequestId: expect.any(String),
      profileToken: expect.any(String),
    })
    expect(callback.profileToken!.length).toBeGreaterThanOrEqual(32)

    const pending = db.get(
      "SELECT * FROM externalBindRequests WHERE providerSubject = ? AND status = 'pending'",
      ['tenant-a:open-unknown'],
    ) as Record<string, unknown>
    expect(pending).toMatchObject({
      displayName: 'admin',
      email: 'admin@example.invalid',
      proposedDisplayName: 'admin',
    })
    expect(JSON.stringify(pending)).not.toContain('temporary-provider-token')

    const publicView = await service.getPublicBindRequestByToken(callback.profileToken!)
    expect(publicView.proposedDisplayName).toBe('admin')

    await service.updateBindRequestProfile(callback.profileToken!, {
      proposedUsername: 'newbie',
      proposedDisplayName: '新人',
    })
    const updated = db.get(
      'SELECT proposedUsername, proposedDisplayName FROM externalBindRequests WHERE id = ?',
      [callback.bindRequestId!],
    ) as { proposedUsername: string; proposedDisplayName: string }
    expect(updated).toEqual({ proposedUsername: 'newbie', proposedDisplayName: '新人' })

    fakeProvider.currentProfile = profile
  })

  it('管理员可将待审查绑定到已有账号，之后可登录', async () => {
    const pending = db.get(
      "SELECT id FROM externalBindRequests WHERE providerSubject = ? AND status = 'pending'",
      ['tenant-a:open-unknown'],
    ) as { id: string }
    const result = await service.bindRequestToUser(pending.id, adminId, adminId)
    expect(result.user.id).toBe(adminId)
    expect(result.request.status).toBe('bound')

    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
    }
    const started = await service.startLogin('feishu', '/dashboard')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    const callback = await service.completeCallback('feishu', { state, code: 'bound-login' })
    expect(callback.ticket).toBeTruthy()
    const login = await service.exchangeTicket(callback.ticket!)
    expect(login.user.id).toBe(adminId)
    fakeProvider.currentProfile = profile
  })

  it('登录 state 哈希存储且不能重放；已绑定身份票据只能使用一次', async () => {
    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
    }
    const started = await service.startLogin('feishu', '/issue/test-id?from=feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    expect(state.length).toBeGreaterThanOrEqual(32)

    const attempt = db.get('SELECT stateHash FROM oauthLoginAttempts ORDER BY createdAt DESC LIMIT 1') as { stateHash: string }
    expect(attempt.stateHash).toMatch(/^[a-f0-9]{64}$/)
    expect(attempt.stateHash).not.toBe(state)

    const callback = await service.completeCallback('feishu', { state, code: 'one-time-code' })
    expect(callback.purpose).toBe('login')
    await expect(service.completeCallback('feishu', { state, code: 'replayed-code' })).rejects.toMatchObject({
      code: 'invalid_state',
    })

    const result = await service.exchangeTicket(callback.ticket!)
    expect(result.user).toMatchObject({ id: adminId, username: 'admin' })
    expect(result.returnTo).toBe('/issue/test-id?from=feishu')
    await expect(service.exchangeTicket(callback.ticket!)).rejects.toThrow('无效或已过期')
    fakeProvider.currentProfile = profile
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

  it('完整备份包含长期身份与待审查，但不包含 OAuth 临时凭证', async () => {
    const { BackupService } = await import('../../packages/server/src/service/BackupService.js')
    const backupService = new BackupService()
    const backup = await backupService.export('resetAll')
    expect(backup.tables.externalIdentities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: adminId, provider: 'feishu', status: 'active' }),
      ]),
    )
    expect(backup.tables.externalBindRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ providerSubject: 'tenant-a:open-unknown', status: 'bound' }),
      ]),
    )
    expect(backup.tables).not.toHaveProperty('oauthLoginAttempts')
    expect(backup.tables).not.toHaveProperty('oauthLoginTickets')

    const activeIdentity = db.get(
      "SELECT id FROM externalIdentities WHERE userId = ? AND status = 'active' LIMIT 1",
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

    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
    }
    const expiredTicketService = new ExternalAuthService(
      registry,
      { enabled: true, stateTtlSeconds: 600, ticketTtlSeconds: -1 },
    )
    const ticketStart = await expiredTicketService.startLogin('feishu')
    const ticketState = new URL(ticketStart.authorizationUrl).searchParams.get('state')!
    const callback = await expiredTicketService.completeCallback('feishu', { state: ticketState, code: 'code' })
    await expect(expiredTicketService.exchangeTicket(callback.ticket!)).rejects.toThrow('无效或已过期')
    fakeProvider.currentProfile = profile
  })

  it('本地账号被禁用后，已绑定飞书身份也不能签发登录票据', async () => {
    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
    }
    db.run('UPDATE users SET disabled = 1 WHERE id = ?', [adminId])
    try {
      const started = await service.startLogin('feishu')
      const state = new URL(started.authorizationUrl).searchParams.get('state')!
      await expect(service.completeCallback('feishu', { state, code: 'disabled-user' })).rejects.toMatchObject({
        code: 'local_account_unavailable',
      })
    } finally {
      db.run('UPDATE users SET disabled = 0 WHERE id = ?', [adminId])
      fakeProvider.currentProfile = profile
    }
  })

  it('解除绑定后再次登录进入待审查；管理员可新建账号并绑定', async () => {
    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-unknown',
      openId: 'open-unknown',
    }
    const identities = await service.listMyIdentities(adminId)
    const active = identities.find(identity => identity.status === 'active' && identity.displayName !== '飞书测试用户')
      || identities.find(identity => identity.status === 'active')!
    await service.unlinkIdentity(active.id, adminId)

    const started = await service.startLogin('feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    const pendingCallback = await service.completeCallback('feishu', { state, code: 'after-unlink' })
    expect(pendingCallback.purpose).toBe('bind_pending')

    await expect(service.isUsernameAvailable('feishu_new_user', adminId)).resolves.toEqual({ available: true })
    const created = await service.createUserAndBindRequest(pendingCallback.bindRequestId!, adminId, {
      username: 'feishu_new_user',
      password: 'secret12',
      displayName: '飞书新人',
    })
    expect(created.user).toMatchObject({ username: 'feishu_new_user', approved: 1, displayName: '飞书新人' })
    expect(created.request.status).toBe('bound')

    await expect(service.createUserAndBindRequest(pendingCallback.bindRequestId!, adminId, {
      username: 'another',
      password: 'secret12',
    })).rejects.toThrow('已处理')

    const loginStart = await service.startLogin('feishu')
    const loginState = new URL(loginStart.authorizationUrl).searchParams.get('state')!
    const loginCallback = await service.completeCallback('feishu', { state: loginState, code: 'new-user-login' })
    const login = await service.exchangeTicket(loginCallback.ticket!)
    expect(login.user.username).toBe('feishu_new_user')

    fakeProvider.currentProfile = profile
  })

  it('新建绑定撞名时返回冲突', async () => {
    fakeProvider.currentProfile = {
      ...profile,
      providerSubject: 'tenant-a:open-conflict',
      openId: 'open-conflict',
      displayName: '冲突用户',
    }
    const started = await service.startLogin('feishu')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    const pending = await service.completeCallback('feishu', { state, code: 'conflict-code' })
    await expect(service.createUserAndBindRequest(pending.bindRequestId!, adminId, {
      username: 'admin',
      password: 'secret12',
    })).rejects.toThrow('用户名已存在')
    await service.rejectBindRequest(pending.bindRequestId!, adminId, '测试拒绝')
    const rejected = db.get(
      'SELECT status, note FROM externalBindRequests WHERE id = ?',
      [pending.bindRequestId!],
    ) as { status: string; note: string }
    expect(rejected).toEqual({ status: 'rejected', note: '测试拒绝' })
    fakeProvider.currentProfile = profile
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
