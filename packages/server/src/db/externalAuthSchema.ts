import type { PnwDbDialect } from './pnw/pnwDbTypes.js'

/** 第三方登录表；只使用 SQLite/PostgreSQL 均支持的基础类型。 */
export function externalAuthSchemaSql(dialect: PnwDbDialect): string {
  const now = dialect === 'postgres' ? '(CURRENT_TIMESTAMP::TEXT)' : "(datetime('now'))"
  return `
    CREATE TABLE IF NOT EXISTS "externalIdentities" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerSubject" TEXT NOT NULL,
      "tenantKey" TEXT,
      "openId" TEXT,
      "unionId" TEXT,
      "providerUserId" TEXT,
      "displayName" TEXT,
      "avatarUrl" TEXT,
      "email" TEXT,
      "metadataJson" TEXT NOT NULL DEFAULT '{}',
      "status" TEXT NOT NULL DEFAULT 'active' CHECK("status" IN ('active','revoked')),
      "linkSource" TEXT NOT NULL DEFAULT 'self' CHECK("linkSource" IN ('self','admin','auto_provision')),
      "linkedByUserId" TEXT,
      "linkedAt" TEXT NOT NULL DEFAULT ${now},
      "lastLoginAt" TEXT,
      "lastSyncedAt" TEXT,
      "revokedAt" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT ${now},
      "updatedAt" TEXT NOT NULL DEFAULT ${now}
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "idx_external_identities_provider_subject"
      ON "externalIdentities"("provider", "providerSubject");
    CREATE INDEX IF NOT EXISTS "idx_external_identities_user"
      ON "externalIdentities"("userId", "status");
    CREATE INDEX IF NOT EXISTS "idx_external_identities_tenant"
      ON "externalIdentities"("provider", "tenantKey");

    CREATE TABLE IF NOT EXISTS "oauthLoginAttempts" (
      "id" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "purpose" TEXT NOT NULL CHECK("purpose" IN ('login','link')),
      "stateHash" TEXT NOT NULL,
      "userId" TEXT,
      "returnTo" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "usedAt" TEXT,
      "failureCode" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT ${now}
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "idx_oauth_attempts_state_hash"
      ON "oauthLoginAttempts"("stateHash");
    CREATE INDEX IF NOT EXISTS "idx_oauth_attempts_expiry"
      ON "oauthLoginAttempts"("expiresAt", "usedAt");

    CREATE TABLE IF NOT EXISTS "oauthLoginTickets" (
      "id" TEXT PRIMARY KEY,
      "ticketHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "identityId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "returnTo" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "usedAt" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT ${now}
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "idx_oauth_tickets_ticket_hash"
      ON "oauthLoginTickets"("ticketHash");
    CREATE INDEX IF NOT EXISTS "idx_oauth_tickets_expiry"
      ON "oauthLoginTickets"("expiresAt", "usedAt");

    CREATE TABLE IF NOT EXISTS "externalBindRequests" (
      "id" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "providerSubject" TEXT NOT NULL,
      "tenantKey" TEXT,
      "openId" TEXT,
      "unionId" TEXT,
      "providerUserId" TEXT,
      "displayName" TEXT,
      "avatarUrl" TEXT,
      "email" TEXT,
      "metadataJson" TEXT NOT NULL DEFAULT '{}',
      "proposedUsername" TEXT,
      "proposedDisplayName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending','bound','rejected','expired')),
      "boundUserId" TEXT,
      "handledByUserId" TEXT,
      "handledAt" TEXT,
      "note" TEXT,
      "profileTokenHash" TEXT,
      "profileTokenExpiresAt" TEXT,
      "lastSeenAt" TEXT NOT NULL DEFAULT ${now},
      "createdAt" TEXT NOT NULL DEFAULT ${now},
      "updatedAt" TEXT NOT NULL DEFAULT ${now}
    );

    CREATE INDEX IF NOT EXISTS "idx_external_bind_requests_provider_subject"
      ON "externalBindRequests"("provider", "providerSubject");
    CREATE INDEX IF NOT EXISTS "idx_external_bind_requests_status"
      ON "externalBindRequests"("status", "updatedAt");
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_external_bind_requests_profile_token"
      ON "externalBindRequests"("profileTokenHash");
  `
}
