import type { ExternalAuthProviderId, ExternalAuthProviderInfo } from '@open-issue/core'

export interface ExternalIdentityProfile {
  provider: ExternalAuthProviderId
  providerSubject: string
  tenantKey: string
  openId: string
  unionId: string | null
  providerUserId: string | null
  displayName: string | null
  avatarUrl: string | null
  email: string | null
  metadata: Record<string, unknown>
}

export interface ExternalTokenResult {
  accessToken: string
}

export interface ExternalAuthProvider {
  readonly id: ExternalAuthProviderId
  readonly info: ExternalAuthProviderInfo
  readonly enabled: boolean
  createAuthorizationUrl(state: string): string
  exchangeCode(code: string): Promise<ExternalTokenResult>
  getIdentity(accessToken: string): Promise<ExternalIdentityProfile>
}

export class ExternalAuthProviderError extends Error {
  constructor(
    public readonly code: 'provider_unavailable' | 'provider_response_error' | 'identity_incomplete' | 'tenant_not_allowed',
    message: string,
  ) {
    super(message)
    this.name = 'ExternalAuthProviderError'
  }
}
