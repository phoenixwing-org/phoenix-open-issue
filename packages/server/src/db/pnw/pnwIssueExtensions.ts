/**
 * PostgreSQL Issue 扩展字段与关联列表计数器。
 *
 * listCount 是高频读取的 counter cache：列表/详情查询直接读取 issues，
 * 只有 issueListLinks 增删或 issueId 变更时由触发器维护。
 */
export function pnwIssueExtensionsSchemaSql(): string {
  return `
    ALTER TABLE "issues"
      ADD COLUMN IF NOT EXISTS "extensions" JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE "issues"
      ADD COLUMN IF NOT EXISTS "listCount" INTEGER NOT NULL DEFAULT 0;

    CREATE OR REPLACE FUNCTION "pnwSyncIssueListCount"()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE "issues"
           SET "listCount" = COALESCE("listCount", 0) + 1
         WHERE "id" = NEW."issueId";
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE "issues"
           SET "listCount" = GREATEST(COALESCE("listCount", 0) - 1, 0)
         WHERE "id" = OLD."issueId";
      ELSIF OLD."issueId" IS DISTINCT FROM NEW."issueId" THEN
        UPDATE "issues"
           SET "listCount" = GREATEST(COALESCE("listCount", 0) - 1, 0)
         WHERE "id" = OLD."issueId";
        UPDATE "issues"
           SET "listCount" = COALESCE("listCount", 0) + 1
         WHERE "id" = NEW."issueId";
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS "trgIssueListLinksCount" ON "issueListLinks";
    CREATE TRIGGER "trgIssueListLinksCount"
      AFTER INSERT OR DELETE OR UPDATE OF "issueId" ON "issueListLinks"
      FOR EACH ROW EXECUTE FUNCTION "pnwSyncIssueListCount"();
  `
}

export const ISSUE_LIST_COUNT_BACKFILL_SQL = `
  UPDATE "issues" i
     SET "listCount" = (
       SELECT CAST(COUNT(*) AS INTEGER)
         FROM "issueListLinks" link
        WHERE link."issueId" = i."id"
     )
`
