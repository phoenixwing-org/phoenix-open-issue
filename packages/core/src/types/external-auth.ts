import type { LoginResult } from './user.js'

export type ExternalAuthProviderId = 'feishu'
export type ExternalIdentityStatus = 'active' | 'revoked'

export interface ExternalAuthProviderInfo {
  id: ExternalAuthProviderId
  name: string
  buttonText: string
}

export interface ExternalIdentityPublic {
  id: string
  provider: ExternalAuthProviderId
  tenantKey: string | null
  displayName: string | null
  avatarUrl: string | null
  email: string | null
  status: ExternalIdentityStatus
  linkedAt: string
  lastLoginAt: string | null
}

export interface ExternalIdentityAdminView extends ExternalIdentityPublic {
  userId: string
  openId: string | null
  unionId: string | null
  providerUserId: string | null
  linkedByUserId: string | null
  revokedAt: string | null
}

export interface ExternalAuthStartResult {
  authorizationUrl: string
}

export interface ExternalAuthTicketResult extends LoginResult {
  returnTo: string
}
