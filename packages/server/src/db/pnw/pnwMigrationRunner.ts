import type { PnwDbAdapter, PnwDbExecutor } from './pnwDbTypes.js'
import { externalAuthSchemaSql } from '../externalAuthSchema.js'
import { ISSUE_LIST_COUNT_BACKFILL_SQL, pnwIssueExtensionsSchemaSql } from './pnwIssueExtensions.js'

export interface PnwMigration {
  id: string
  up: (db: PnwDbExecutor) => Promise<void>
}

export const OPEN_ISSUE_MIGRATIONS: readonly PnwMigration[] = [
  {
    id: '20260711-dual-db-baseline',
    up: async () => {},
  },
  {
    id: '20260713-checkpoint-voided-status',
    up: async db => {
      await db.exec('ALTER TABLE "checkpoints" DROP CONSTRAINT IF EXISTS "checkpoints_status_check"')
      await db.exec(`ALTER TABLE "checkpoints"
        ADD CONSTRAINT "checkpoints_status_check"
        CHECK ("status" IN ('pending','done','skipped','voided'))`)
    },
  },
  {
    id: '20260715-user-token-version',
    up: async db => {
      await db.exec('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0')
    },
  },
  {
    id: '20260716-external-auth',
    up: async db => {
      await db.exec(externalAuthSchemaSql('postgres'))
    },
  },
  {
    // 20260716 已应用的库不会重跑旧迁移；此处幂等补建 externalBindRequests 等增量表。
    id: '20260720-external-bind-requests',
    up: async db => {
      await db.exec(externalAuthSchemaSql('postgres'))
    },
  },
  {
    id: '20260731-checkpoint-deadline',
    up: async db => {
      await db.exec('ALTER TABLE "checkpoints" ADD COLUMN IF NOT EXISTS "deadline" TEXT')
      await db.run('UPDATE "checkpoints" SET "deadline" = "checkpointDate" WHERE "deadline" IS NULL')
    },
  },
  {
    id: '20260731-issue-extensions-list-count',
    up: async db => {
      await db.exec(pnwIssueExtensionsSchemaSql())
      await db.run(ISSUE_LIST_COUNT_BACKFILL_SQL)
    },
  },
  {
    id: '20260731-push-targets',
    up: async db => {
      await db.exec(`ALTER TABLE "pushRecords" ADD COLUMN IF NOT EXISTS "targetType" TEXT NOT NULL DEFAULT 'list'`)
      await db.exec(`ALTER TABLE "pushRecords" ADD COLUMN IF NOT EXISTS "toUserId" TEXT`)
      await db.exec(`UPDATE "pushRecords" SET "targetType" = 'list' WHERE "targetType" IS NULL OR "targetType" = ''`)
      await db.exec(`ALTER TABLE "pushRecords" ALTER COLUMN "toListId" DROP NOT NULL`)
      await db.exec(`ALTER TABLE "pushRecords" DROP CONSTRAINT IF EXISTS "pushRecords_status_check"`)
      await db.exec(`ALTER TABLE "pushRecords" DROP CONSTRAINT IF EXISTS "pushRecords_targetType_check"`)
      await db.exec(`ALTER TABLE "pushRecords" ADD CONSTRAINT "pushRecords_targetType_check" CHECK ("targetType" IN ('list','user'))`)
      await db.exec(`ALTER TABLE "pushRecords" ADD CONSTRAINT "pushRecords_status_check" CHECK ("status" IN ('pending','accepted','rejected','withdrawn'))`)
      await db.exec(`CREATE INDEX IF NOT EXISTS "idx_push_target_list" ON "pushRecords"("toListId", "status")`)
      await db.exec(`CREATE INDEX IF NOT EXISTS "idx_push_target_user" ON "pushRecords"("toUserId", "status")`)
      await db.exec(`CREATE INDEX IF NOT EXISTS "idx_push_source" ON "pushRecords"("fromListId", "pushedAt")`)
    },
  },
  {
    id: '20260731-eight-d-reports',
    up: async db => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS "eightDReports" (
          "id" TEXT PRIMARY KEY,
          "relatedIssueId" TEXT,
          "title" TEXT NOT NULL,
          "containment" TEXT NOT NULL DEFAULT '',
          "rootCause" TEXT NOT NULL DEFAULT '',
          "correctiveAction" TEXT NOT NULL DEFAULT '',
          "createdBy" TEXT NOT NULL,
          "createdAt" TEXT DEFAULT (CURRENT_TIMESTAMP::TEXT),
          "updatedAt" TEXT DEFAULT (CURRENT_TIMESTAMP::TEXT),
          "isDeleted" INTEGER NOT NULL DEFAULT 0,
          "deletedAt" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_eightDReports_issue" ON "eightDReports"("relatedIssueId", "isDeleted");
        CREATE INDEX IF NOT EXISTS "idx_eightDReports_creator" ON "eightDReports"("createdBy", "isDeleted");
      `)
      await db.run(`
        INSERT INTO "eightDReports"
          ("id", "relatedIssueId", "title", "containment", "rootCause", "correctiveAction", "createdBy", "createdAt", "updatedAt")
        SELECT 'legacy-8d-' || "id", "id", '8D · ' || "title",
               COALESCE("containment", ''), COALESCE("rootCause", ''), COALESCE("correctiveAction", ''),
               "createdBy", "createdAt", "updatedAt"
          FROM "issues"
         WHERE TRIM(COALESCE("containment", '')) != ''
            OR TRIM(COALESCE("rootCause", '')) != ''
            OR TRIM(COALESCE("correctiveAction", '')) != ''
        ON CONFLICT ("id") DO NOTHING
      `)
    },
  },
]

export async function pnwRunMigrations(
  db: PnwDbAdapter,
  migrations: readonly PnwMigration[] = OPEN_ISSUE_MIGRATIONS,
): Promise<string[]> {
  if (db.dialect !== 'postgres') {
    throw new Error('正式 migration runner 只接受 PostgreSQL adapter')
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schemaMigrations (
      id TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    )
  `)
  const applied: string[] = []
  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    const existing = await db.get('SELECT id FROM schemaMigrations WHERE id = ?', [migration.id])
    if (existing) continue
    await db.transaction(async tx => {
      await migration.up(tx)
      await tx.run(
        'INSERT INTO schemaMigrations (id, appliedAt) VALUES (?, ?)',
        [migration.id, new Date().toISOString()],
      )
    })
    applied.push(migration.id)
  }
  return applied
}
