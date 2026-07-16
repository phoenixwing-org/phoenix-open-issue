import type { PnwDbAdapter } from './pnwDbAdapter.js'
import { ensurePendingOrgUnit } from '../utils/pendingOrgUnit.js'
import {
  applyColumnMigrations,
  dedupeIssueListLinks,
  migrateCheckpointStatusVoided,
  migrateIssueListsListType,
  migrateUserSystemRole,
  migrateIssueListLinkAttention,
  repairDictDataAndIndex,
  ensureIssueNoIndexes,
} from './migrations.js'

export function runSchema(db: PnwDbAdapter): void {
  // ---- 建表 ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      passwordHash TEXT NOT NULL,
      displayName TEXT,
      orgUnitId TEXT,
      approved INTEGER NOT NULL DEFAULT 0,
      tokenVersion INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orgUnits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitType TEXT NOT NULL CHECK(unitType IN ('group','department','division')),
      parentId TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issueLists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      listType TEXT NOT NULL,
      ownerId TEXT NOT NULL,
      orgUnitId TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      deletedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issueListMembers (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('owner','admin','editor','reporter','viewer')),
      joinedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      issueNo TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed','cancelled')),
      closeReason TEXT,
      closedBy TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      severity TEXT NOT NULL DEFAULT 'minor',
      category TEXT,
      detectionPhase TEXT,
      reporterId TEXT,
      assigneeId TEXT,
      dueDate TEXT,
      completedAt TEXT,
      containment TEXT DEFAULT '',
      rootCause TEXT DEFAULT '',
      correctiveAction TEXT DEFAULT '',
      sortOrder INTEGER DEFAULT 0,
      createdBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_issues_list_issueNo ON issues(listId, issueNo);
    CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(listId, category);
    CREATE INDEX IF NOT EXISTS idx_issues_detectionPhase ON issues(listId, detectionPhase);
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      issueId TEXT NOT NULL,
      checkpointDate TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','done','skipped','voided')),
      responsibleUserId TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pushRecords (
      id TEXT PRIMARY KEY,
      fromListId TEXT NOT NULL,
      toListId TEXT NOT NULL,
      issueId TEXT NOT NULL,
      pushedBy TEXT NOT NULL,
      pushedAt TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      handledBy TEXT,
      handledAt TEXT,
      rejectReason TEXT,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS issueListLinks (
      id TEXT PRIMARY KEY,
      issueId TEXT NOT NULL,
      listId TEXT NOT NULL,
      attentionLevel INTEGER NOT NULL DEFAULT 3 CHECK(attentionLevel BETWEEN 0 AND 5),
      attentionUpdatedAt TEXT,
      attentionUpdatedBy TEXT,
      linkedAt TEXT DEFAULT (datetime('now')),
      linkedBy TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_issueListLinks_unique ON issueListLinks(issueId, listId);

    CREATE TABLE IF NOT EXISTS dict (
      id TEXT PRIMARY KEY,
      groupName TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      tags TEXT NOT NULL DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS systemFlags (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS poiFunctions (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      externalId TEXT NOT NULL,
      functionName TEXT NOT NULL,
      targetYear TEXT,
      clientGroup TEXT,
      developGroup TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(platform, externalId)
    );
  `)

  // ---- 迁移：旧库列增量添加（须在 CREATE TABLE 之后） ----
  applyColumnMigrations(db)
  dedupeIssueListLinks(db)
  const issueNoIndexOk = ensureIssueNoIndexes(db)
  if (!issueNoIndexOk) {
    console.warn('⚠️ Issue 编号存在重复，唯一索引未建立；请在设置 → 数据库修正中执行 Issue 编号修复')
  }

  migrateUserSystemRole(db)
  migrateIssueListsListType(db)
  migrateCheckpointStatusVoided(db)
  migrateIssueListLinkAttention(db)
  const dictRepair = repairDictDataAndIndex(db)
  if (!dictRepair.indexOk) {
    console.warn(
      `⚠️ 数据字典：${dictRepair.duplicateGroupsRemaining} 组 (groupName,value) 仍重复，唯一索引未建立。`,
      '系统可正常使用，请登录后前往 设置 → 数据库修正 → 数据字典补全',
    )
  }
  ensurePendingOrgUnit(db)
}

// re-export for external use
export { migrateUserSystemRole, migrateIssueListsListType, migrateCheckpointStatusVoided, migrateIssueListLinkAttention, dedupeDictEntries, ensureDictUniqueIndex, migrateDictTagsFormat, repairDictDataAndIndex, hasDictUniqueIndex, countDictDuplicateGroups, ensureIssueNoIndexes } from './migrations.js'
export type { DictRepairResult, DictDedupeResult, DictDedupeDetail } from './migrations.js'
