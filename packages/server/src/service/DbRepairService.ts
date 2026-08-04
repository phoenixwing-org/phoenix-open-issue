import { generateId, normalizeDictTags } from '@open-issue/core'
import { getAsyncDb, getDb } from '../db/connection.js'
import { migrateIssueListLinkAttention } from '../db/migrations.js'
import { externalAuthSchemaSql } from '../db/externalAuthSchema.js'
import { pnwRunSchema } from '../db/pnw/pnwSchema.js'
import { pnwRunMigrations } from '../db/pnw/pnwMigrationRunner.js'
import type { PnwDbAdapter } from '../db/pnw/pnwDbTypes.js'
import { DictService } from './DictService.js'

export type RepairTaskId =
  | 'schema'
  | 'checkpoints'
  | 'links'
  | 'dict'
  | 'users'
  | 'issueNo'
  | 'linkAttention'
  | 'reports'
  | 'all'

export interface RepairTaskResult {
  task: RepairTaskId
  message: string
  details: string[]
  fixed: number
}

const EXTERNAL_AUTH_TABLES = [
  'externalIdentities',
  'oauthLoginAttempts',
  'oauthLoginTickets',
  'externalBindRequests',
] as const

const EXTERNAL_AUTH_INDEXES = [
  'idx_external_identities_provider_subject',
  'idx_external_identities_user',
  'idx_external_identities_tenant',
  'idx_oauth_attempts_state_hash',
  'idx_oauth_attempts_expiry',
  'idx_oauth_tickets_ticket_hash',
  'idx_oauth_tickets_expiry',
  'idx_external_bind_requests_provider_subject',
  'idx_external_bind_requests_status',
  'idx_external_bind_requests_profile_token',
] as const

export class DbRepairService {
  /**
   * 表结构补全（幂等）：建表/加列、跑迁移，并校验第三方登录相关表
   *（含 externalBindRequests 待审查表）。可重复执行。
   */
  async repairSchema(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    const before = await snapshotExternalAuth(db)
    const checkpointColumnsBefore = await existingColumnNames(db, 'checkpoints')
    const pushColumnsBefore = await existingColumnNames(db, 'pushRecords')
    const reportColumnsBefore = await existingColumnNames(db, 'eightDReports')
    const issueColumnsBefore = await existingColumnNames(db, 'issues')
    const applied = await ensureSchema(db)
    const after = await snapshotExternalAuth(db)
    const checkpointColumnsAfter = await existingColumnNames(db, 'checkpoints')
    const pushColumnsAfter = await existingColumnNames(db, 'pushRecords')
    const reportColumnsAfter = await existingColumnNames(db, 'eightDReports')
    const issueColumnsAfter = await existingColumnNames(db, 'issues')

    const createdTables = EXTERNAL_AUTH_TABLES.filter(name => !before.tables.has(name) && after.tables.has(name))
    const missingTables = EXTERNAL_AUTH_TABLES.filter(name => !after.tables.has(name))
    const createdIndexes = EXTERNAL_AUTH_INDEXES.filter(name => !before.indexes.has(name) && after.indexes.has(name))
    const missingIndexes = EXTERNAL_AUTH_INDEXES.filter(name => !after.indexes.has(name))
    const checkpointColumnsAdded = ['checkpointDate', 'deadline'].filter(
      name => !checkpointColumnsBefore.has(name) && checkpointColumnsAfter.has(name),
    )
    const missingCheckpointColumns = ['checkpointDate', 'deadline'].filter(name => !checkpointColumnsAfter.has(name))
    const pushColumnsAdded = ['targetType', 'toListId', 'toUserId', 'status'].filter(
      name => !pushColumnsBefore.has(name) && pushColumnsAfter.has(name),
    )
    const missingPushColumns = ['targetType', 'toListId', 'toUserId', 'status'].filter(name => !pushColumnsAfter.has(name))
    const reportColumnsAdded = ['relatedIssueId', 'title', 'containment', 'rootCause', 'correctiveAction', 'isDeleted'].filter(
      name => !reportColumnsBefore.has(name) && reportColumnsAfter.has(name),
    )
    const missingReportColumns = ['relatedIssueId', 'title', 'containment', 'rootCause', 'correctiveAction', 'isDeleted']
      .filter(name => !reportColumnsAfter.has(name))
    const issueColumnsAdded = ['extensions', 'listCount'].filter(
      name => !issueColumnsBefore.has(name) && issueColumnsAfter.has(name),
    )
    const missingIssueColumns = ['extensions', 'listCount'].filter(name => !issueColumnsAfter.has(name))
    const reportTableReady = await db.tableExists('eightDReports')
    const reportIndexesReady = await db.indexExists('idx_eightDReports_issue')
      && await db.indexExists('idx_eightDReports_creator')
    const pushIndexesReady = await db.indexExists('idx_push_target_list')
      && await db.indexExists('idx_push_target_user')
      && await db.indexExists('idx_push_source')
    const fixed = applied.length + createdTables.length + createdIndexes.length + checkpointColumnsAdded.length
      + pushColumnsAdded.length + reportColumnsAdded.length + issueColumnsAdded.length

    const details = [
      `${db.dialect} Schema 已检查（幂等，可重复执行）`,
      applied.length ? `新应用迁移：${applied.join(', ')}` : '无待应用迁移',
      createdTables.length
        ? `新建第三方登录表：${createdTables.join(', ')}`
        : '第三方登录表已存在（externalIdentities / oauth* / externalBindRequests）',
      createdIndexes.length ? `新建索引：${createdIndexes.join(', ')}` : '第三方登录索引已就绪',
      checkpointColumnsAdded.length
        ? `补全点检日期列：${checkpointColumnsAdded.join(', ')}`
        : '点检日期列已就绪（checkpointDate / deadline）',
      pushColumnsAdded.length ? `补全推送目标列：${pushColumnsAdded.join(', ')}` : '推送目标列已就绪（targetType / toListId / toUserId / status）',
      reportColumnsAdded.length ? `补全 8D 报告列：${reportColumnsAdded.join(', ')}` : '8D 报告表与列已就绪',
      issueColumnsAdded.length ? `补全 Issue 扩展列：${issueColumnsAdded.join(', ')}` : 'Issue 扩展列已就绪（extensions / listCount）',
      pushIndexesReady ? '✓ 用户/列表推送索引已就绪' : '✗ 推送索引缺失',
      reportTableReady && reportIndexesReady ? '✓ eightDReports 与索引已就绪' : '✗ eightDReports 表或索引缺失',
      ...EXTERNAL_AUTH_TABLES.map(name => (after.tables.has(name) ? `✓ ${name}` : `✗ ${name} 缺失`)),
    ]
    if (missingTables.length) details.push(`仍缺失表：${missingTables.join(', ')}`)
    if (missingIndexes.length) details.push(`仍缺失索引：${missingIndexes.join(', ')}`)
    if (missingCheckpointColumns.length) details.push(`仍缺失点检列：${missingCheckpointColumns.join(', ')}`)
    if (missingPushColumns.length) details.push(`仍缺失推送列：${missingPushColumns.join(', ')}`)
    if (missingReportColumns.length) details.push(`仍缺失 8D 报告列：${missingReportColumns.join(', ')}`)
    if (missingIssueColumns.length) details.push(`仍缺失 Issue 扩展列：${missingIssueColumns.join(', ')}`)

    if (missingTables.length || missingIndexes.length || missingCheckpointColumns.length || missingPushColumns.length
      || missingReportColumns.length || missingIssueColumns.length || !pushIndexesReady || !reportTableReady || !reportIndexesReady) {
      return result('schema', '表结构点检未完全通过', details, fixed)
    }
    return result(
      'schema',
      fixed ? `表结构已补全（${fixed} 项）` : '表结构已是最新',
      details,
      fixed,
    )
  }

  async repairCheckpoints(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    const now = new Date().toISOString()
    const changes = [
      await db.run("UPDATE checkpoints SET status = 'pending' WHERE status IS NULL OR status = ''"),
      await db.run('UPDATE checkpoints SET sortOrder = 0 WHERE sortOrder IS NULL'),
      await db.run("UPDATE checkpoints SET createdAt = ? WHERE createdAt IS NULL OR createdAt = ''", [now]),
      await db.run(`
        UPDATE checkpoints SET updatedAt = COALESCE(NULLIF(updatedAt, ''), createdAt, ?)
        WHERE updatedAt IS NULL OR updatedAt = ''
      `, [now]),
      // deadline 可为空；只把旧接口可能写入的空字符串规范成 NULL，不擅自生成截止日。
      await db.run("UPDATE checkpoints SET deadline = NULL WHERE TRIM(COALESCE(deadline, '')) = '' AND deadline IS NOT NULL"),
    ]
    const fixed = changes.reduce((sum, item) => sum + item.changes, 0)
    const withoutDeadline = await count(db, 'SELECT COUNT(*) AS c FROM checkpoints WHERE deadline IS NULL')
    return result(
      'checkpoints',
      fixed ? `已修正 ${fixed} 条点检记录` : '点检数据已是最新',
      [
        fixed ? `补全缺失状态、顺序、审计时间或日期空值规范：${fixed} 条` : '点检数据无需修正',
        `无截止日 ${withoutDeadline} 条（合法，不补写且不参与逾期判断）`,
        '时间线按点检日 checkpointDate 排序；deadline 仅用于截止与逾期',
      ],
      fixed,
    )
  }

  async repairIssueListLinks(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    const now = new Date().toISOString()
    const missing = await db.all<{ id: string; listId: string; createdBy: string; createdAt: string }>(`
      SELECT i.id, i.listId, i.createdBy, i.createdAt
      FROM issues i
      WHERE i.listId IS NOT NULL AND i.listId != ''
        AND NOT EXISTS (
          SELECT 1 FROM issueListLinks l WHERE l.issueId = i.id AND l.listId = i.listId
        )
    `)
    for (const row of missing) {
      await db.run(
        `INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt, attentionLevel)
         VALUES (?, ?, ?, ?, ?, 3) ON CONFLICT DO NOTHING`,
        [generateId(), row.id, row.listId, row.createdBy || 'system', row.createdAt || now],
      )
    }

    const before = await count(db, 'SELECT COUNT(*) AS c FROM issueListLinks')
    await db.run(`
      DELETE FROM issueListLinks
      WHERE id NOT IN (SELECT MIN(id) FROM issueListLinks GROUP BY issueId, listId)
    `)
    const total = await count(db, 'SELECT COUNT(*) AS c FROM issueListLinks')
    const active = await count(db, 'SELECT COUNT(*) AS c FROM issueListLinks WHERE attentionLevel > 0')
    const deduped = before - total
    const countRepair = await db.run(`
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
    const fixed = missing.length + deduped + countRepair.changes
    return result(
      'links',
      fixed ? `已修正 ${fixed} 条链接` : '链接数据完整',
      [
        `补建 ${missing.length} 条，去重 ${deduped} 条，关联计数校正 ${countRepair.changes} 条`,
        `当前链接 ${total} 条（关注 ${active}）`,
      ],
      fixed,
    )
  }

  async repairDict(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    const rows = await db.all<{ id: string; tags: string }>('SELECT id, tags FROM dict')
    let tagsMigrated = 0
    for (const row of rows) {
      const tags = normalizeDictTags(row.tags)
      if (tags !== row.tags) {
        await db.run('UPDATE dict SET tags = ? WHERE id = ?', [tags, row.id])
        tagsMigrated++
      }
    }
    const dedupe = await new DictService().dedupe()
    const fixed = tagsMigrated + dedupe.removed
    return result(
      'dict',
      fixed ? `已修正 ${fixed} 条字典数据` : '字典列与数据已完整',
      [
        `tags 规范 ${tagsMigrated} 条`,
        `重复项删除 ${dedupe.removed} 条，合并 tags ${dedupe.tagsMerged} 组`,
        dedupe.indexOk ? '唯一索引已就绪' : `仍有 ${dedupe.duplicateGroupsRemaining} 组重复`,
      ],
      fixed,
    )
  }

  async repairUsers(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    const admin = await db.run(
      "UPDATE users SET systemRole = 'admin' WHERE username = 'admin' AND systemRole != 'admin'",
    )
    const editors = await db.run(
      "UPDATE users SET systemRole = 'editor' WHERE systemRole IS NULL OR systemRole = ''",
    )
    const fixed = admin.changes + editors.changes
    return result(
      'users',
      fixed ? `已修正 ${fixed} 个用户权限` : '用户权限已是最新',
      [`admin ${admin.changes} 条，editor ${editors.changes} 条`],
      fixed,
    )
  }

  async repairIssueNo(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    const rows = await db.all<{ id: string; issueNo: string | null; createdAt: string }>(
      'SELECT id, issueNo, createdAt FROM issues ORDER BY createdAt, id',
    )
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (row.issueNo) counts.set(row.issueNo, (counts.get(row.issueNo) ?? 0) + 1)
    }
    const affectedYears = new Set<number>()
    for (const row of rows) {
      if (!row.issueNo || (counts.get(row.issueNo) ?? 0) > 1) {
        affectedYears.add(parseIssueYear(row.issueNo ?? '', row.createdAt))
      }
    }
    if (!affectedYears.size) return result('issueNo', 'Issue 编号无重复', [], 0)

    const now = new Date().toISOString()
    let fixed = 0
    const details: string[] = []
    await db.transaction(async tx => {
      for (const year of [...affectedYears].sort()) {
        const yearRows = rows.filter(row => parseIssueYear(row.issueNo ?? '', row.createdAt) === year)
        for (const row of yearRows) {
          await tx.run('UPDATE issues SET issueNo = ?, updatedAt = ? WHERE id = ?', [`__TEMP__${row.id}`, now, row.id])
        }
        for (const [index, row] of yearRows.entries()) {
          const issueNo = formatIssueNo(year, index + 1)
          await tx.run('UPDATE issues SET issueNo = ?, updatedAt = ? WHERE id = ?', [issueNo, now, row.id])
          if (row.issueNo !== issueNo) fixed++
        }
        details.push(`${year} 年重排 ${yearRows.length} 条`)
      }
    })
    return result('issueNo', `已重编 ${fixed} 条 Issue 编号`, details, fixed)
  }

  async repairLinkAttention(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    if (db.dialect === 'postgres') {
      return result('linkAttention', '链接关注系数已是最新', ['PostgreSQL 新 Schema 无废弃 voided 列'], 0)
    }
    const migrated = migrateIssueListLinkAttention(getDb(), true)
    const fixed = migrated.voidedMapped + migrated.timestampsCopied + (migrated.voidedColumnsDropped ? 1 : 0)
    return result(
      'linkAttention',
      fixed ? '链接关注系数迁移完成' : '链接关注系数已是最新',
      [`数据映射 ${migrated.voidedMapped} 条，时间戳复制 ${migrated.timestampsCopied} 条`],
      fixed,
    )
  }

  async repairReports(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    const orphaned = await db.run(`
      UPDATE eightDReports SET relatedIssueId = NULL, updatedAt = ?
      WHERE relatedIssueId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM issues WHERE issues.id = eightDReports.relatedIssueId)
    `, [new Date().toISOString()])
    const untitled = await db.run(`
      UPDATE eightDReports SET title = '未命名 8D 报告'
      WHERE TRIM(COALESCE(title, '')) = ''
    `)
    const legacy = await db.run(`
      INSERT INTO eightDReports
        (id, relatedIssueId, title, containment, rootCause, correctiveAction, createdBy, createdAt, updatedAt)
      SELECT 'legacy-8d-' || i.id, i.id, '8D · ' || i.title,
             COALESCE(i.containment, ''), COALESCE(i.rootCause, ''), COALESCE(i.correctiveAction, ''),
             i.createdBy, i.createdAt, i.updatedAt
        FROM issues i
       WHERE (TRIM(COALESCE(i.containment, '')) != ''
          OR TRIM(COALESCE(i.rootCause, '')) != ''
          OR TRIM(COALESCE(i.correctiveAction, '')) != '')
         AND NOT EXISTS (SELECT 1 FROM eightDReports r WHERE r.id = 'legacy-8d-' || i.id)
      ON CONFLICT DO NOTHING
    `)
    const fixed = orphaned.changes + untitled.changes + legacy.changes
    return result(
      'reports',
      fixed ? `已修正 ${fixed} 条 8D 报告数据` : '8D 报告数据完整',
      [
        `失效 Issue 关联转为独立报告 ${orphaned.changes} 条`,
        `缺失标题补全 ${untitled.changes} 条`,
        `旧 Issue 8D 内容迁移补全 ${legacy.changes} 条`,
      ],
      fixed,
    )
  }

  async runTask(task: RepairTaskId): Promise<RepairTaskResult[]> {
    if (task === 'all') {
      const tasks: Exclude<RepairTaskId, 'all'>[] = [
        'schema', 'checkpoints', 'links', 'dict', 'users', 'issueNo', 'linkAttention', 'reports',
      ]
      const results: RepairTaskResult[] = []
      for (const item of tasks) results.push(...await this.runTask(item))
      return results
    }
    switch (task) {
      case 'schema': return [await this.repairSchema()]
      case 'checkpoints': return [await this.repairCheckpoints()]
      case 'links': return [await this.repairIssueListLinks()]
      case 'dict': return [await this.repairDict()]
      case 'users': return [await this.repairUsers()]
      case 'issueNo': return [await this.repairIssueNo()]
      case 'linkAttention': return [await this.repairLinkAttention()]
      case 'reports': return [await this.repairReports()]
      default: throw Object.assign(new Error(`未知修正任务: ${task}`), { statusCode: 400 })
    }
  }
}

async function count(db: ReturnType<typeof getAsyncDb>, sql: string): Promise<number> {
  return Number((await db.get<{ c: number }>(sql))?.c ?? 0)
}

async function ensureSchema(db: PnwDbAdapter): Promise<string[]> {
  if (db.dialect === 'postgres') {
    await pnwRunSchema(db)
    await db.exec(externalAuthSchemaSql('postgres'))
    return pnwRunMigrations(db)
  }
  // legacy 恢复链继续使用原同步 schema bridge，不写正式 migration ledger。
  const { runSchema } = await import('../db/schema.js')
  runSchema(getDb())
  return []
}

async function snapshotExternalAuth(db: PnwDbAdapter): Promise<{ tables: Set<string>; indexes: Set<string> }> {
  const tables = new Set<string>()
  const indexes = new Set<string>()
  for (const name of EXTERNAL_AUTH_TABLES) {
    if (await db.tableExists(name)) tables.add(name)
  }
  for (const name of EXTERNAL_AUTH_INDEXES) {
    if (await db.indexExists(name)) indexes.add(name)
  }
  return { tables, indexes }
}

async function existingColumnNames(db: PnwDbAdapter, table: string): Promise<Set<string>> {
  return await db.tableExists(table) ? await db.columnNames(table) : new Set<string>()
}

function result(task: RepairTaskId, message: string, details: string[], fixed: number): RepairTaskResult {
  return { task, message, details, fixed }
}

function parseIssueYear(issueNo: string, createdAt: string): number {
  const match = issueNo.match(/^ISS-(\d{4})-/)
  if (match) return Number(match[1])
  const year = new Date(createdAt).getFullYear()
  return Number.isFinite(year) ? year : new Date().getFullYear()
}

function formatIssueNo(year: number, sequence: number): string {
  return `ISS-${year}-${String(sequence).padStart(4, '0')}`
}
