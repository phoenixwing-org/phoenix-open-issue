import type { LoginResult, UserPublic } from './user.js'

export type ExternalAuthProviderId = 'feishu'
export type ExternalIdentityStatus = 'active' | 'revoked'
export type ExternalBindRequestStatus = 'pending' | 'bound' | 'rejected' | 'expired'

export interface LoginPolicy {
  localEnabled: boolean
  externalEnabled: boolean
  externalConfigured: boolean
}

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

export interface ExternalBindRequestPublic {
  id: string
  provider: ExternalAuthProviderId
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  proposedUsername: string | null
  proposedDisplayName: string | null
  status: ExternalBindRequestStatus
  createdAt: string
  lastSeenAt: string
}

export interface ExternalBindRequestAdminView extends ExternalBindRequestPublic {
  providerSubject: string
  tenantKey: string | null
  openId: string | null
  unionId: string | null
  providerUserId: string | null
  boundUserId: string | null
  handledByUserId: string | null
  handledAt: string | null
  note: string | null
  updatedAt: string
}

export interface ExternalAuthStartResult {
  authorizationUrl: string
}

export interface ExternalAuthTicketResult extends LoginResult {
  returnTo: string
}

export interface ExternalBindRequestHandleResult {
  request: ExternalBindRequestAdminView
  user: UserPublic
}
