import type { ExternalAuthProvider, ExternalIdentityProfile, ExternalTokenResult } from '../types.js'
import { ExternalAuthProviderError } from '../types.js'

interface FeishuProviderConfig {
  enabled: boolean
  appId: string
  appSecret: string
  redirectUri: string
  allowedTenantKeys: string[]
  scopes: string[]
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl: string
}

type FetchLike = typeof fetch

export class FeishuAuthProvider implements ExternalAuthProvider {
  readonly id = 'feishu' as const
  readonly info = {
    id: 'feishu' as const,
    name: '飞书',
    buttonText: '使用飞书登录',
  }

  constructor(
    private readonly providerConfig: FeishuProviderConfig,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  get enabled(): boolean {
    return this.providerConfig.enabled
  }

  createAuthorizationUrl(state: string): string {
    const url = new URL(this.providerConfig.authorizationUrl)
    url.searchParams.set('client_id', this.providerConfig.appId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', this.providerConfig.redirectUri)
    url.searchParams.set('state', state)
    if (this.providerConfig.scopes.length) {
      url.searchParams.set('scope', this.providerConfig.scopes.join(' '))
    }
    return url.toString()
  }

  async exchangeCode(code: string): Promise<ExternalTokenResult> {
    let response: Response
    try {
      response = await this.fetcher(this.providerConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.providerConfig.appId,
          client_secret: this.providerConfig.appSecret,
          code,
          redirect_uri: this.providerConfig.redirectUri,
        }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new ExternalAuthProviderError('provider_unavailable', '飞书认证服务暂时不可用')
    }

    const body = await readJson(response)
    const payload = objectValue(body.data) || body
    if (!response.ok || numericValue(body.code) !== 0 || !stringValue(payload.access_token)) {
      throw new ExternalAuthProviderError('provider_response_error', '飞书授权码校验失败，请重新发起登录')
    }
    return { accessToken: stringValue(payload.access_token)! }
  }

  async getIdentity(accessToken: string): Promise<ExternalIdentityProfile> {
    let response: Response
    try {
      response = await this.fetcher(this.providerConfig.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new ExternalAuthProviderError('provider_unavailable', '飞书用户信息服务暂时不可用')
    }

    const body = await readJson(response)
    const data = objectValue(body.data) || body
    if (!response.ok || numericValue(body.code) !== 0) {
      throw new ExternalAuthProviderError('provider_response_error', '无法读取飞书登录用户信息')
    }

    const tenantKey = stringValue(data.tenant_key)
    const openId = stringValue(data.open_id)
    if (!tenantKey || !openId) {
      throw new ExternalAuthProviderError('identity_incomplete', '飞书返回的用户身份不完整')
    }
    if (this.providerConfig.allowedTenantKeys.length
      && !this.providerConfig.allowedTenantKeys.includes(tenantKey)) {
      throw new ExternalAuthProviderError('tenant_not_allowed', '当前飞书组织未获准登录本系统')
    }

    return {
      provider: this.id,
      providerSubject: `${tenantKey}:${openId}`,
      tenantKey,
      openId,
      unionId: stringValue(data.union_id),
      providerUserId: stringValue(data.user_id),
      displayName: stringValue(data.name),
      avatarUrl: stringValue(data.avatar_url) || stringValue(data.avatar_big) || stringValue(data.avatar_middle),
      email: stringValue(data.enterprise_email) || stringValue(data.email),
      metadata: {
        employeeNo: stringValue(data.employee_no),
      },
    }
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return objectValue(await response.json()) || {}
  } catch {
    throw new ExternalAuthProviderError('provider_response_error', '飞书认证服务返回了无法识别的数据')
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numericValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}
