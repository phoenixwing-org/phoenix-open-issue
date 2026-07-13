import type { PnwDbAdapter } from './pnwDbTypes.js'

export async function pnwRunSchema(db: PnwDbAdapter): Promise<void> {
  const now = db.dialect === 'postgres' ? "(CURRENT_TIMESTAMP::TEXT)" : '(CURRENT_TIMESTAMP)'
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "schemaMigrations" (
      "id" TEXT PRIMARY KEY,
      "appliedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY,
      "username" TEXT NOT NULL UNIQUE,
      "email" TEXT,
      "passwordHash" TEXT NOT NULL,
      "displayName" TEXT,
      "orgUnitId" TEXT,
      "approved" INTEGER NOT NULL DEFAULT 0,
      "disabled" INTEGER NOT NULL DEFAULT 0,
      "systemRole" TEXT NOT NULL DEFAULT 'editor',
      "createdAt" TEXT DEFAULT ${now},
      "updatedAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "orgUnits" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "unitType" TEXT NOT NULL CHECK("unitType" IN ('group','department','division')),
      "parentId" TEXT,
      "createdAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "issueLists" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT DEFAULT '',
      "listType" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "orgUnitId" TEXT,
      "archived" INTEGER NOT NULL DEFAULT 0,
      "isDeleted" INTEGER NOT NULL DEFAULT 0,
      "deletedAt" TEXT,
      "createdAt" TEXT DEFAULT ${now},
      "updatedAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "issueListMembers" (
      "id" TEXT PRIMARY KEY,
      "listId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'editor' CHECK("role" IN ('owner','admin','editor','reporter','viewer')),
      "joinedAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "issues" (
      "id" TEXT PRIMARY KEY,
      "listId" TEXT NOT NULL,
      "issueNo" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL,
      "description" TEXT DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'open' CHECK("status" IN ('open','in_progress','resolved','closed','cancelled')),
      "closeReason" TEXT,
      "closedBy" TEXT,
      "priority" TEXT NOT NULL DEFAULT 'medium' CHECK("priority" IN ('low','medium','high','critical')),
      "severity" TEXT NOT NULL DEFAULT 'minor',
      "category" TEXT,
      "detectionPhase" TEXT,
      "reporterId" TEXT,
      "assigneeId" TEXT,
      "dueDate" TEXT,
      "completedAt" TEXT,
      "containment" TEXT DEFAULT '',
      "rootCause" TEXT DEFAULT '',
      "correctiveAction" TEXT DEFAULT '',
      "sortOrder" INTEGER DEFAULT 0,
      "functionId" TEXT,
      "createdBy" TEXT NOT NULL,
      "createdAt" TEXT DEFAULT ${now},
      "updatedAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "checkpoints" (
      "id" TEXT PRIMARY KEY,
      "issueId" TEXT NOT NULL,
      "checkpointDate" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "status" TEXT DEFAULT 'pending' CHECK("status" IN ('pending','done','skipped')),
      "responsibleUserId" TEXT,
      "sortOrder" INTEGER DEFAULT 0,
      "createdAt" TEXT DEFAULT ${now},
      "updatedAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "pushRecords" (
      "id" TEXT PRIMARY KEY,
      "fromListId" TEXT NOT NULL,
      "toListId" TEXT NOT NULL,
      "issueId" TEXT NOT NULL,
      "pushedBy" TEXT NOT NULL,
      "pushedAt" TEXT DEFAULT ${now},
      "status" TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending','accepted','rejected')),
      "handledBy" TEXT,
      "handledAt" TEXT,
      "rejectReason" TEXT,
      "note" TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS "issueListLinks" (
      "id" TEXT PRIMARY KEY,
      "issueId" TEXT NOT NULL,
      "listId" TEXT NOT NULL,
      "attentionLevel" INTEGER NOT NULL DEFAULT 3 CHECK("attentionLevel" BETWEEN 0 AND 5),
      "attentionUpdatedAt" TEXT,
      "attentionUpdatedBy" TEXT,
      "linkedAt" TEXT DEFAULT ${now},
      "linkedBy" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "dict" (
      "id" TEXT PRIMARY KEY,
      "groupName" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "sortOrder" INTEGER DEFAULT 0,
      "enabled" INTEGER DEFAULT 1,
      "tags" TEXT NOT NULL DEFAULT '',
      "createdAt" TEXT DEFAULT ${now}
    );

    CREATE TABLE IF NOT EXISTS "systemFlags" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "poiFunctions" (
      "id" TEXT PRIMARY KEY,
      "platform" TEXT NOT NULL,
      "externalId" TEXT NOT NULL,
      "functionName" TEXT NOT NULL,
      "targetYear" TEXT,
      "clientGroup" TEXT,
      "developGroup" TEXT,
      "enabled" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT DEFAULT ${now},
      "updatedAt" TEXT DEFAULT ${now},
      UNIQUE("platform", "externalId")
    );

    CREATE INDEX IF NOT EXISTS "idx_issues_list_issueNo" ON "issues"("listId", "issueNo");
    CREATE INDEX IF NOT EXISTS "idx_issues_category" ON "issues"("listId", "category");
    CREATE INDEX IF NOT EXISTS "idx_issues_detectionPhase" ON "issues"("listId", "detectionPhase");
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_issues_issueNo" ON "issues"("issueNo");
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_issueListLinks_unique" ON "issueListLinks"("issueId", "listId");
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_dict_group_value" ON "dict"("groupName", "value");
  `)
}
