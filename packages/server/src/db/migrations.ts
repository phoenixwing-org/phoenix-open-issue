import type { PnwDbAdapter } from './pnwDbAdapter.js'
import { normalizeDictTags, hasDictTag, parseDictTags, formatDictTags } from '@open-issue/core'
import { ensurePendingOrgUnit } from '../utils/pendingOrgUnit.js'
import { dedupeDictEntries } from './dictDedupe.js'

export { dedupeDictEntries, type DictDedupeResult, type DictDedupeDetail } from './dictDedupe.js'

/** 旧库增量列：表名 → 列名 → ALTER 语句 */
export const COLUMN_MIGRATIONS: { table: string; column: string; sql: string }[] = [
  { table: 'users', column: 'approved', sql: 'ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1' },
  { table: 'users', column: 'disabled', sql: 'ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0' },
  { table: 'users', column: 'systemRole', sql: "ALTER TABLE users ADD COLUMN systemRole TEXT NOT NULL DEFAULT 'editor'" },
  { table: 'users', column: 'tokenVersion', sql: 'ALTER TABLE users ADD COLUMN tokenVersion INTEGER NOT NULL DEFAULT 0' },
  { table: 'issueLists', column: 'archived', sql: 'ALTER TABLE issueLists ADD COLUMN archived INTEGER NOT NULL DEFAULT 0' },
  { table: 'issueLists', column: 'isDeleted', sql: 'ALTER TABLE issueLists ADD COLUMN isDeleted INTEGER NOT NULL DEFAULT 0' },
  { table: 'issueLists', column: 'deletedAt', sql: 'ALTER TABLE issueLists ADD COLUMN deletedAt TEXT' },
  { table: 'dict', column: 'tags', sql: "ALTER TABLE dict ADD COLUMN tags TEXT NOT NULL DEFAULT ''" },
  { table: 'issues', column: 'functionId', sql: 'ALTER TABLE issues ADD COLUMN functionId TEXT' },
  { table: 'issues', column: 'extensions', sql: "ALTER TABLE issues ADD COLUMN extensions TEXT NOT NULL DEFAULT '{}'" },
  { table: 'issues', column: 'listCount', sql: 'ALTER TABLE issues ADD COLUMN listCount INTEGER NOT NULL DEFAULT 0 CHECK(listCount >= 0)' },
  { table: 'poiFunctions', column: 'enabled', sql: 'ALTER TABLE poiFunctions ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1' },
  { table: 'checkpoints', column: 'status', sql: "ALTER TABLE checkpoints ADD COLUMN status TEXT DEFAULT 'pending'" },
  { table: 'checkpoints', column: 'deadline', sql: 'ALTER TABLE checkpoints ADD COLUMN deadline TEXT' },
  { table: 'checkpoints', column: 'responsibleUserId', sql: 'ALTER TABLE checkpoints ADD COLUMN responsibleUserId TEXT' },
  { table: 'checkpoints', column: 'sortOrder', sql: 'ALTER TABLE checkpoints ADD COLUMN sortOrder INTEGER DEFAULT 0' },
  { table: 'checkpoints', column: 'createdAt', sql: "ALTER TABLE checkpoints ADD COLUMN createdAt TEXT DEFAULT (datetime('now'))" },
  { table: 'checkpoints', column: 'updatedAt', sql: "ALTER TABLE checkpoints ADD COLUMN updatedAt TEXT DEFAULT (datetime('now'))" },
  { table: 'issueListLinks', column: 'linkedAt', sql: "ALTER TABLE issueListLinks ADD COLUMN linkedAt TEXT DEFAULT (datetime('now'))" },
  { table: 'issueListLinks', column: 'linkedBy', sql: 'ALTER TABLE issueListLinks ADD COLUMN linkedBy TEXT' },
  { table: 'issueListLinks', column: 'attentionLevel', sql: 'ALTER TABLE issueListLinks ADD COLUMN attentionLevel INTEGER NOT NULL DEFAULT 3' },
  { table: 'issueListLinks', column: 'attentionUpdatedAt', sql: 'ALTER TABLE issueListLinks ADD COLUMN attentionUpdatedAt TEXT' },
  { table: 'issueListLinks', column: 'attentionUpdatedBy', sql: 'ALTER TABLE issueListLinks ADD COLUMN attentionUpdatedBy TEXT' },
]

export function getTableColumns(db: PnwDbAdapter, table: string): Set<string> {
  const rows = db.all(`PRAGMA table_info("${table}")`) as { name: string }[]
  return new Set(rows.map(r => r.name))
}

export function tableExists(db: PnwDbAdapter, table: string): boolean {
  const row = db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    table,
  ) as { name: string } | undefined
  return !!row
}

/** 追加缺失列，返回新增的 表.列 列表 */
export function applyColumnMigrations(db: PnwDbAdapter): string[] {
  const added: string[] = []
  for (const m of COLUMN_MIGRATIONS) {
    if (!tableExists(db, m.table)) continue
    const cols = getTableColumns(db, m.table)
    if (cols.has(m.column)) continue
    try {
      db.exec(m.sql)
      added.push(`${m.table}.${m.column}`)
    } catch {
      // 并发或约束冲突时忽略
    }
  }
  return added
}

export function migrateUserSystemRole(db: PnwDbAdapter, force = false): { adminSet: number; editorSet: number } {
  if (!force) {
    const done = db.get("SELECT value FROM systemFlags WHERE key = 'migrate_user_systemRole'") as { value: string } | undefined
    if (done?.value === '1') return { adminSet: 0, editorSet: 0 }
  }

  const adminRes = db.run("UPDATE users SET systemRole = 'admin' WHERE username = 'admin' AND systemRole != 'admin'")
  const editorRes = db.run("UPDATE users SET systemRole = 'editor' WHERE systemRole IS NULL OR systemRole = ''")
  db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_user_systemRole', '1')")
  return {
    adminSet: adminRes.changes ?? 0,
    editorSet: editorRes.changes ?? 0,
  }
}

export function migrateIssueListsListType(db: PnwDbAdapter): boolean {
  const done = db.get("SELECT value FROM systemFlags WHERE key = 'migrate_listType_no_check'") as { value: string } | undefined
  if (done?.value === '1') return false

  const sqlInfo = db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='issueLists'") as { sql: string }[]
  const ddl = sqlInfo[0]?.sql || ''
  if (!ddl.includes('CHECK(listType IN')) {
    db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_listType_no_check', '1')")
    return false
  }

  db.exec(`
    CREATE TABLE issueLists_new (
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
    INSERT INTO issueLists_new SELECT id, name, description, listType, ownerId, orgUnitId, archived, isDeleted, deletedAt, createdAt, updatedAt FROM issueLists;
    DROP TABLE issueLists;
    ALTER TABLE issueLists_new RENAME TO issueLists;
  `)
  db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_listType_no_check', '1')")
  return true
}

/** 扩展点检状态：已跳过用于业务跳过，已作废用于误建记录。 */
export function migrateCheckpointStatusVoided(db: PnwDbAdapter): boolean {
  if (!tableExists(db, 'checkpoints')) return false

  const sqlInfo = db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='checkpoints'") as { sql: string }[]
  const ddl = sqlInfo[0]?.sql || ''
  if (ddl.includes("'voided'")) return false
  // 极旧版本还没有 deadline。重建状态约束时直接以原点检日初始化该列，
  // 避免要求调用方必须先按某个固定顺序执行列迁移。
  const oldColumns = getTableColumns(db, 'checkpoints')
  const deadlineExpression = oldColumns.has('deadline') ? 'deadline' : 'checkpointDate'

  db.exec(`
    CREATE TABLE checkpoints_new (
      id TEXT PRIMARY KEY,
      issueId TEXT NOT NULL,
      checkpointDate TEXT NOT NULL,
      deadline TEXT,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','done','skipped','voided')),
      responsibleUserId TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO checkpoints_new (id, issueId, checkpointDate, deadline, description, status, responsibleUserId, sortOrder, createdAt, updatedAt)
    SELECT id, issueId, checkpointDate, ${deadlineExpression}, description, status, responsibleUserId, sortOrder, createdAt, updatedAt
    FROM checkpoints;
    DROP TABLE checkpoints;
    ALTER TABLE checkpoints_new RENAME TO checkpoints;
  `)
  return true
}

/**
 * v0.6.1 将原 checkpointDate 明确为可编辑的点检日，并新增可选 deadline。
 * 旧数据仅在首次迁移时复制一次；之后用户清空截止日不会被启动流程重新填回。
 */
export function migrateCheckpointDeadline(db: PnwDbAdapter): number {
  if (!tableExists(db, 'checkpoints') || !tableExists(db, 'systemFlags')) return 0
  const done = db.get("SELECT value FROM systemFlags WHERE key = 'migrate_checkpoint_deadline'") as { value: string } | undefined
  if (done?.value === '1') return 0
  const columns = getTableColumns(db, 'checkpoints')
  if (!columns.has('deadline')) return 0

  const result = db.run("UPDATE checkpoints SET deadline = checkpointDate WHERE deadline IS NULL OR deadline = ''")
  db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_checkpoint_deadline', '1')")
  return result.changes ?? 0
}

/**
 * v0.6.1 推送目标扩展：列表推送保持兼容，用户推送在接受前不绑定目标列表。
 * SQLite 无法直接解除 NOT NULL/替换 CHECK，因此以同事务表重建完成迁移。
 */
export function migratePushTargets(db: PnwDbAdapter): boolean {
  if (!tableExists(db, 'pushRecords')) return false
  const columns = getTableColumns(db, 'pushRecords')
  const sqlInfo = db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='pushRecords'") as { sql: string }[]
  const ddl = sqlInfo[0]?.sql ?? ''
  const isCurrent = columns.has('targetType')
    && columns.has('toUserId')
    && ddl.includes("'withdrawn'")
    && !/toListId\s+TEXT\s+NOT\s+NULL/i.test(ddl)

  if (!isCurrent) {
    const targetType = columns.has('targetType') ? 'targetType' : "'list'"
    const toUserId = columns.has('toUserId') ? 'toUserId' : 'NULL'
    db.exec(`
      CREATE TABLE pushRecords_new (
        id TEXT PRIMARY KEY,
        fromListId TEXT NOT NULL,
        targetType TEXT NOT NULL DEFAULT 'list' CHECK(targetType IN ('list','user')),
        toListId TEXT,
        toUserId TEXT,
        issueId TEXT NOT NULL,
        pushedBy TEXT NOT NULL,
        pushedAt TEXT DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
        handledBy TEXT,
        handledAt TEXT,
        rejectReason TEXT,
        note TEXT DEFAULT ''
      );
      INSERT INTO pushRecords_new
        (id, fromListId, targetType, toListId, toUserId, issueId, pushedBy, pushedAt, status, handledBy, handledAt, rejectReason, note)
      SELECT id, fromListId, ${targetType}, toListId, ${toUserId}, issueId, pushedBy, pushedAt, status, handledBy, handledAt, rejectReason, note
      FROM pushRecords;
      DROP TABLE pushRecords;
      ALTER TABLE pushRecords_new RENAME TO pushRecords;
    `)
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_push_target_list ON pushRecords(toListId, status);
    CREATE INDEX IF NOT EXISTS idx_push_target_user ON pushRecords(toUserId, status);
    CREATE INDEX IF NOT EXISTS idx_push_source ON pushRecords(fromListId, pushedAt);
  `)
  if (tableExists(db, 'systemFlags')) {
    db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_push_targets', '1')")
  }
  return !isCurrent
}

/** 将旧 Issue 主表里的 8D 长文本一次性复制为独立附属记录；保留旧列用于回滚。 */
export function migrateLegacyEightDReports(db: PnwDbAdapter): number {
  if (!tableExists(db, 'issues') || !tableExists(db, 'eightDReports') || !tableExists(db, 'systemFlags')) return 0
  const done = db.get("SELECT value FROM systemFlags WHERE key = 'migrate_legacy_eight_d_reports'") as { value: string } | undefined
  if (done?.value === '1') return 0
  const issueColumns = getTableColumns(db, 'issues')
  if (!['containment', 'rootCause', 'correctiveAction'].every(column => issueColumns.has(column))) return 0

  const result = db.run(`
    INSERT OR IGNORE INTO eightDReports
      (id, relatedIssueId, title, containment, rootCause, correctiveAction, createdBy, createdAt, updatedAt)
    SELECT 'legacy-8d-' || id, id, '8D · ' || title,
           COALESCE(containment, ''), COALESCE(rootCause, ''), COALESCE(correctiveAction, ''),
           createdBy, createdAt, updatedAt
      FROM issues
     WHERE TRIM(COALESCE(containment, '')) != ''
        OR TRIM(COALESCE(rootCause, '')) != ''
        OR TRIM(COALESCE(correctiveAction, '')) != ''
  `)
  db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_legacy_eight_d_reports', '1')")
  return result.changes ?? 0
}

/** 清理重复 issueListLinks，返回删除条数 */
export function dedupeIssueListLinks(db: PnwDbAdapter): number {
  const before = db.get('SELECT COUNT(*) as c FROM issueListLinks') as { c: number }
  db.exec('DELETE FROM issueListLinks WHERE id NOT IN (SELECT MIN(id) FROM issueListLinks GROUP BY issueId, listId)')
  const after = db.get('SELECT COUNT(*) as c FROM issueListLinks') as { c: number }
  return before.c - after.c
}

/**
 * SQLite 仅保留旧库/自动化兼容。正式运行以 PostgreSQL 触发器契约为准。
 * 触发器保证列表查询只读取 issues.listCount，不做逐行关联统计。
 */
export function ensureIssueExtensionsAndListCount(db: PnwDbAdapter, forceBackfill = false): number {
  if (!tableExists(db, 'issues') || !tableExists(db, 'issueListLinks') || !tableExists(db, 'systemFlags')) return 0
  applyColumnMigrations(db)

  const done = db.get("SELECT value FROM systemFlags WHERE key = 'migrate_issue_extensions_list_count'") as { value: string } | undefined
  let fixed = 0
  if (forceBackfill || done?.value !== '1') {
    const result = db.run(`
      UPDATE issues
         SET listCount = (
           SELECT CAST(COUNT(*) AS INTEGER)
             FROM issueListLinks link
            WHERE link.issueId = issues.id
         )
       WHERE listCount != (
           SELECT CAST(COUNT(*) AS INTEGER)
             FROM issueListLinks link
            WHERE link.issueId = issues.id
         )
    `)
    fixed = result.changes ?? 0
  }

  db.exec(`
    DROP TRIGGER IF EXISTS trg_issueListLinks_count_insert;
    DROP TRIGGER IF EXISTS trg_issueListLinks_count_delete;
    DROP TRIGGER IF EXISTS trg_issueListLinks_count_update;

    CREATE TRIGGER trg_issueListLinks_count_insert
    AFTER INSERT ON issueListLinks
    BEGIN
      UPDATE issues SET listCount = COALESCE(listCount, 0) + 1 WHERE id = NEW.issueId;
    END;

    CREATE TRIGGER trg_issueListLinks_count_delete
    AFTER DELETE ON issueListLinks
    BEGIN
      UPDATE issues SET listCount = MAX(COALESCE(listCount, 0) - 1, 0) WHERE id = OLD.issueId;
    END;

    CREATE TRIGGER trg_issueListLinks_count_update
    AFTER UPDATE OF issueId ON issueListLinks
    WHEN OLD.issueId != NEW.issueId
    BEGIN
      UPDATE issues SET listCount = MAX(COALESCE(listCount, 0) - 1, 0) WHERE id = OLD.issueId;
      UPDATE issues SET listCount = COALESCE(listCount, 0) + 1 WHERE id = NEW.issueId;
    END;
  `)
  db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_issue_extensions_list_count', '1')")
  return fixed
}

/**
 * 统一旧版同名索引，并在编号无重复时建立全局唯一索引。
 * 返回 false 表示存在重复编号，应先运行 Issue 编号修复。
 */
export function ensureIssueNoIndexes(db: PnwDbAdapter): boolean {
  if (!tableExists(db, 'issues')) return true

  db.exec('DROP INDEX IF EXISTS idx_issues_issueNo')
  db.exec('CREATE INDEX IF NOT EXISTS idx_issues_list_issueNo ON issues(listId, issueNo)')

  const duplicate = db.get(`
    SELECT issueNo FROM issues
    WHERE issueNo IS NOT NULL AND issueNo != ''
    GROUP BY issueNo HAVING COUNT(*) > 1 LIMIT 1
  `) as { issueNo: string } | undefined
  if (duplicate) return false

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_issues_issueNo ON issues(issueNo)')
  return true
}

/** 旧格式 core,general → ,core,general, */
export function migrateDictTagsFormat(db: PnwDbAdapter): number {
  if (!tableExists(db, 'dict')) return 0
  const rows = db.all('SELECT id, tags FROM dict WHERE tags IS NOT NULL AND tags != \'\'') as { id: string; tags: string }[]
  let updated = 0
  for (const row of rows) {
    const normalized = normalizeDictTags(row.tags)
    if (normalized !== row.tags) {
      db.run('UPDATE dict SET tags = ? WHERE id = ?', [normalized, row.id])
      updated++
    }
  }
  return updated
}

/** 点检表类型：内置项 (core) 不应带 general 标签 */
export function migrateListTypeCoreTags(db: PnwDbAdapter): number {
  if (!tableExists(db, 'dict')) return 0
  const rows = db.all(`
    SELECT id, tags FROM dict
    WHERE groupName = 'listType' AND tags LIKE '%,core,%'
  `) as { id: string; tags: string }[]
  let updated = 0
  for (const row of rows) {
    if (!hasDictTag(row.tags, 'general')) continue
    const next = formatDictTags(parseDictTags(row.tags).filter(t => t !== 'general'))
    if (next !== normalizeDictTags(row.tags)) {
      db.run('UPDATE dict SET tags = ? WHERE id = ?', [next, row.id])
      updated++
    }
  }
  return updated
}

/** 是否已建立 (groupName, value) 唯一索引 */
export function hasDictUniqueIndex(db: PnwDbAdapter): boolean {
  if (!tableExists(db, 'dict')) return true
  const row = db.get(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_dict_group_value'",
  ) as { name: string } | undefined
  return !!row
}

/** 同分组 value 仍重复的分组数 */
export function countDictDuplicateGroups(db: PnwDbAdapter): number {
  if (!tableExists(db, 'dict')) return 0
  const row = db.get(`
    SELECT COUNT(*) as c FROM (
      SELECT groupName, value FROM dict GROUP BY groupName, value HAVING COUNT(*) > 1
    )
  `) as { c: number }
  return row.c
}

export interface DictRepairResult {
  tagsMigrated: number
  listTypeCoreTagsFixed: number
  removed: number
  tagsMerged: number
  indexOk: boolean
  duplicateGroupsRemaining: number
}

/**
 * 规范 tags、去重、尝试建唯一索引。不抛错，供启动与手动修正共用。
 * 旧库有重复 value 时 indexOk=false，需用户在设置页执行「数据字典补全」。
 */
export function repairDictDataAndIndex(db: PnwDbAdapter): DictRepairResult {
  const empty: DictRepairResult = {
    tagsMigrated: 0,
    listTypeCoreTagsFixed: 0,
    removed: 0,
    tagsMerged: 0,
    indexOk: true,
    duplicateGroupsRemaining: 0,
  }
  if (!tableExists(db, 'dict')) return empty

  const tagsMigrated = migrateDictTagsFormat(db)
  const listTypeCoreTagsFixed = migrateListTypeCoreTags(db)
  let removed = 0
  let tagsMerged = 0
  for (let attempt = 0; attempt < 5; attempt++) {
    const dedupe = dedupeDictEntries(db)
    removed += dedupe.removed
    tagsMerged += dedupe.tagsMerged
    if (dedupe.removed === 0) break
  }

  let indexOk = hasDictUniqueIndex(db)
  if (!indexOk) {
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_dict_group_value ON dict(groupName, value)')
      indexOk = true
    } catch {
      indexOk = false
    }
  }

  const duplicateGroupsRemaining = countDictDuplicateGroups(db)
  if (duplicateGroupsRemaining > 0) indexOk = false

  return { tagsMigrated, listTypeCoreTagsFixed, removed, tagsMerged, indexOk, duplicateGroupsRemaining }
}

/** @deprecated 使用 repairDictDataAndIndex；失败时抛错 */
export function ensureDictUniqueIndex(db: PnwDbAdapter): void {
  const r = repairDictDataAndIndex(db)
  if (!r.indexOk) {
    throw new Error(
      `dict 唯一索引未建立，仍有 ${r.duplicateGroupsRemaining} 组重复 (groupName, value)`,
    )
  }
}

/**
 * voided → attentionLevel 迁移，完成后重建表并删除 voided / voidedAt / voidedBy 三列
 */
export function dropIssueListLinkVoidedColumns(db: PnwDbAdapter): boolean {
  if (!tableExists(db, 'issueListLinks')) return false
  const cols = getTableColumns(db, 'issueListLinks')
  if (!cols.has('voided') && !cols.has('voidedAt') && !cols.has('voidedBy')) return false

  db.exec(`
    CREATE TABLE issueListLinks_new (
      id TEXT PRIMARY KEY,
      issueId TEXT NOT NULL,
      listId TEXT NOT NULL,
      attentionLevel INTEGER NOT NULL DEFAULT 3 CHECK(attentionLevel BETWEEN 0 AND 5),
      attentionUpdatedAt TEXT,
      attentionUpdatedBy TEXT,
      linkedAt TEXT DEFAULT (datetime('now')),
      linkedBy TEXT NOT NULL
    );
    INSERT INTO issueListLinks_new (id, issueId, listId, attentionLevel, attentionUpdatedAt, attentionUpdatedBy, linkedAt, linkedBy)
    SELECT id, issueId, listId, attentionLevel, attentionUpdatedAt, attentionUpdatedBy, linkedAt, linkedBy
    FROM issueListLinks;
    DROP TABLE issueListLinks;
    ALTER TABLE issueListLinks_new RENAME TO issueListLinks;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_issueListLinks_unique ON issueListLinks(issueId, listId);
  `)
  return true
}

export function migrateIssueListLinkAttention(db: PnwDbAdapter, force = false): {
  voidedMapped: number
  timestampsCopied: number
  voidedColumnsDropped: boolean
} {
  if (!tableExists(db, 'issueListLinks')) return { voidedMapped: 0, timestampsCopied: 0, voidedColumnsDropped: false }

  applyColumnMigrations(db)
  const cols = getTableColumns(db, 'issueListLinks')

  if (!force) {
    const done = db.get("SELECT value FROM systemFlags WHERE key = 'migrate_link_attentionLevel'") as { value: string } | undefined
    if (done?.value === '1') {
      const voidedColumnsDropped = dropIssueListLinkVoidedColumns(db)
      return { voidedMapped: 0, timestampsCopied: 0, voidedColumnsDropped }
    }
  }

  let timestampsCopied = 0

  if (cols.has('voidedAt') && cols.has('attentionUpdatedAt')) {
    const r = db.run(`
      UPDATE issueListLinks SET attentionUpdatedAt = voidedAt
      WHERE voidedAt IS NOT NULL AND (attentionUpdatedAt IS NULL OR attentionUpdatedAt = '')
    `)
    timestampsCopied += r.changes ?? 0
  }
  if (cols.has('voidedBy') && cols.has('attentionUpdatedBy')) {
    const r = db.run(`
      UPDATE issueListLinks SET attentionUpdatedBy = voidedBy
      WHERE voidedBy IS NOT NULL AND (attentionUpdatedBy IS NULL OR attentionUpdatedBy = '')
    `)
    timestampsCopied += r.changes ?? 0
  }

  let voidedMapped = 0
  if (cols.has('voided') && cols.has('attentionLevel')) {
    const r = db.run(`
      UPDATE issueListLinks SET attentionLevel = CASE WHEN voided = 1 THEN 0 ELSE 3 END
      WHERE voided IS NOT NULL
    `)
    voidedMapped = r.changes ?? 0
  }

  db.run('UPDATE issueListLinks SET attentionLevel = 3 WHERE attentionLevel IS NULL OR attentionLevel < 0 OR attentionLevel > 5')

  const voidedColumnsDropped = dropIssueListLinkVoidedColumns(db)

  db.run("INSERT OR REPLACE INTO systemFlags (key, value) VALUES ('migrate_link_attentionLevel', '1')")
  return { voidedMapped, timestampsCopied, voidedColumnsDropped }
}

export function runDataMigrations(db: PnwDbAdapter): {
  userRole: { adminSet: number; editorSet: number }
  listTypeRebuilt: boolean
  pendingOrgCreated: boolean
  linkAttention: { voidedMapped: number; timestampsCopied: number; voidedColumnsDropped: boolean }
} {
  const userRole = migrateUserSystemRole(db, true)
  const listTypeRebuilt = migrateIssueListsListType(db)
  const linkAttention = migrateIssueListLinkAttention(db)
  ensureIssueExtensionsAndListCount(db)
  const pendingBefore = db.get("SELECT id FROM orgUnits WHERE name = '待定组'") as { id: string } | undefined
  ensurePendingOrgUnit(db)
  const pendingAfter = db.get("SELECT id FROM orgUnits WHERE name = '待定组'") as { id: string } | undefined
  return {
    userRole,
    listTypeRebuilt,
    pendingOrgCreated: !pendingBefore && !!pendingAfter,
    linkAttention,
  }
}
