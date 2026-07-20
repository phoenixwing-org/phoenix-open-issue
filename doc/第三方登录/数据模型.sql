-- 第三方登录数据模型草案
-- 兼容当前项目 SQLite / PostgreSQL 的基础类型；正式实施时分别加入两套迁移。
-- 项目当前主要通过逻辑关联维护数据关系，userId 对应 users.id。

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
  "status" TEXT NOT NULL DEFAULT 'active',
  "linkSource" TEXT NOT NULL DEFAULT 'self',
  "linkedByUserId" TEXT,
  "linkedAt" TEXT NOT NULL,
  "lastLoginAt" TEXT,
  "lastSyncedAt" TEXT,
  "revokedAt" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  CHECK ("status" IN ('active', 'revoked')),
  CHECK ("linkSource" IN ('self', 'admin', 'auto_provision'))
);

-- 同一提供方身份只能归属一个本地用户。
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_identities_provider_subject
  ON "externalIdentities"("provider", "providerSubject");

CREATE INDEX IF NOT EXISTS idx_external_identities_user
  ON "externalIdentities"("userId", "status");

CREATE INDEX IF NOT EXISTS idx_external_identities_tenant
  ON "externalIdentities"("provider", "tenantKey");

-- OAuth 开始到回调之间的短期事务。
-- 只保存 state 的哈希，不保存原始 state 或授权码。
CREATE TABLE IF NOT EXISTS "oauthLoginAttempts" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "userId" TEXT,
  "returnTo" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT,
  "failureCode" TEXT,
  "createdAt" TEXT NOT NULL,
  CHECK ("purpose" IN ('login', 'link'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_attempts_state_hash
  ON "oauthLoginAttempts"("stateHash");

CREATE INDEX IF NOT EXISTS idx_oauth_attempts_expiry
  ON "oauthLoginAttempts"("expiresAt", "usedAt");

-- OAuth 回调跳转前端时使用的一次性登录票据。
-- 数据库只存票据哈希，前端拿到的原文只能使用一次。
CREATE TABLE IF NOT EXISTS "oauthLoginTickets" (
  "id" TEXT PRIMARY KEY,
  "ticketHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "returnTo" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT,
  "createdAt" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tickets_ticket_hash
  ON "oauthLoginTickets"("ticketHash");

CREATE INDEX IF NOT EXISTS idx_oauth_tickets_expiry
  ON "oauthLoginTickets"("expiresAt", "usedAt");

-- 未绑定第三方身份的待审查队列（多提供方共用，按 provider 区分）。
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
  "status" TEXT NOT NULL DEFAULT 'pending',
  "boundUserId" TEXT,
  "handledByUserId" TEXT,
  "handledAt" TEXT,
  "note" TEXT,
  "profileTokenHash" TEXT,
  "profileTokenExpiresAt" TEXT,
  "lastSeenAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  CHECK ("status" IN ('pending', 'bound', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_external_bind_requests_provider_subject
  ON "externalBindRequests"("provider", "providerSubject");
CREATE INDEX IF NOT EXISTS idx_external_bind_requests_status
  ON "externalBindRequests"("status", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_bind_requests_profile_token
  ON "externalBindRequests"("profileTokenHash");

-- 登录型 MVP 不创建令牌持久化表。
-- 如果将来确需代表用户调用飞书 API，应新增独立 externalAuthTokens 表：
-- 1. access/refresh token 必须使用专用密钥加密；
-- 2. 记录过期、轮换和撤销状态；
-- 3. 不得进入普通备份、用户导出和日志；
-- 4. 不得把加密令牌直接放入 externalIdentities.metadataJson。
