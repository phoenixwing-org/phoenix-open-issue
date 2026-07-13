import { generateId, normalizeDictTags } from '@open-issue/core'
import { getAsyncDb, getDb } from '../db/connection.js'
import { migrateIssueListLinkAttention } from '../db/migrations.js'
import { pnwRunSchema } from '../db/pnw/pnwSchema.js'
import type { PnwDbAdapter } from '../db/pnw/pnwDbTypes.js'
import { DictService } from './DictService.js'

export type RepairTaskId = 'schema' | 'checkpoints' | 'links' | 'dict' | 'users' | 'issueNo' | 'linkAttention' | 'all'

export interface RepairTaskResult {
  task: RepairTaskId
  message: string
  details: string[]
  fixed: number
}

export class DbRepairService {
  async repairSchema(): Promise<RepairTaskResult> {
    const db = getAsyncDb()
    await ensureSchema(db)
    return result('schema', '表结构已检查', [`${db.dialect} Schema 已初始化并验证`], 0)
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
    ]
    const fixed = changes.reduce((sum, item) => sum + item.changes, 0)
    return result(
      'checkpoints',
      fixed ? `已修正 ${fixed} 条点检记录` : '点检数据已是最新',
      fixed ? [`补全缺失状态、顺序和时间：${fixed} 条`] : ['点检数据无需修正'],
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
    const fixed = missing.length + deduped
    return result(
      'links',
      fixed ? `已修正 ${fixed} 条链接` : '链接数据完整',
      [`补建 ${missing.length} 条，去重 ${deduped} 条`, `当前链接 ${total} 条（关注 ${active}）`],
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

  async runTask(task: RepairTaskId): Promise<RepairTaskResult[]> {
    if (task === 'all') {
      const tasks: Exclude<RepairTaskId, 'all'>[] = [
        'schema', 'checkpoints', 'links', 'dict', 'users', 'issueNo', 'linkAttention',
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
      default: throw Object.assign(new Error(`未知修正任务: ${task}`), { statusCode: 400 })
    }
  }
}

async function count(db: ReturnType<typeof getAsyncDb>, sql: string): Promise<number> {
  return Number((await db.get<{ c: number }>(sql))?.c ?? 0)
}

async function ensureSchema(db: PnwDbAdapter): Promise<void> {
  if (db.dialect === 'postgres') await pnwRunSchema(db)
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
