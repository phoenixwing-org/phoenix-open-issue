import { getAsyncDb } from '../db/connection.js'
import { generateId } from '@open-issue/core'
import bcrypt from 'bcryptjs'

interface BackupData {
  version: number
  timestamp: string
  tables: Record<string, Record<string, unknown>[]>
}

const TABLE_NAMES = [
  'users', 'orgUnits', 'issueLists', 'issueListMembers',
  'issues', 'issueListLinks', 'checkpoints', 'pushRecords', 'dict', 'poiFunctions',
]

export class BackupService {
  /** 导出全部数据为 JSON（排除 passwordHash） */
  async export(): Promise<BackupData> {
    const db = getAsyncDb()
    const tables: Record<string, Record<string, unknown>[]> = {}

    for (const table of TABLE_NAMES) {
      const rows = await db.all<Record<string, unknown>>(`SELECT * FROM "${table}"`)
      // 去除敏感字段
      if (table === 'users') {
        for (const row of rows) {
          delete row.passwordHash
        }
      }
      tables[table] = rows
    }

    return {
      version: 1,
      timestamp: new Date().toISOString(),
      tables,
    }
  }

  /** 导入数据 */
  async import(data: BackupData, mode: 'replace' | 'merge'): Promise<{ imported: Record<string, number> }> {
    if (!data || data.version !== 1) {
      throw Object.assign(new Error('备份文件格式不正确或版本不兼容'), { statusCode: 400 })
    }
    if (!data.tables || typeof data.tables !== 'object') {
      throw Object.assign(new Error('备份文件缺少 table 数据'), { statusCode: 400 })
    }

    const db = getAsyncDb()
    const imported: Record<string, number> = {}
    const now = new Date().toISOString()

    await db.transaction(async tx => {
      if (mode === 'replace') {
        for (const table of [...TABLE_NAMES].reverse()) {
          await tx.run(`DELETE FROM "${table}"`)
        }
      }

      for (const table of TABLE_NAMES) {
        const rows = data.tables[table]
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          imported[table] = 0
          continue
        }

        let count = 0
        for (const row of rows) {
          if (table === 'users') {
            const pwHash = bcrypt.hashSync('123456', 10)
            const result = await tx.run(
              `INSERT INTO "users" ("id", "username", "email", "passwordHash", "displayName", "orgUnitId", "approved", "disabled", "createdAt", "updatedAt")
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
              [row.id, row.username, row.email ?? null, pwHash, row.displayName ?? null,
               row.orgUnitId ?? null, row.approved ?? 1, row.disabled ?? 0,
               row.createdAt || now, row.updatedAt || now],
            )
            count += result.changes
          } else {
            const cols = Object.keys(row).filter(k => row[k] !== undefined)
            if (!cols.every(isSafeIdentifier)) {
              throw Object.assign(new Error(`备份 ${table} 包含非法列名`), { statusCode: 400 })
            }
            const placeholders = cols.map(() => '?').join(', ')
            const values = cols.map(k => row[k])
            const result = await tx.run(
              `INSERT INTO "${table}" (${cols.map(quoteIdentifier).join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values,
            )
            count += result.changes
          }
        }
        imported[table] = count
      }
    })

    console.log(`📦 [BACKUP] import ${mode} — ${Object.values(imported).reduce((a, b) => a + b, 0)} rows`)
    return { imported }
  }

  /** 数据库修正：为缺失 issueListLinks 的 Issue 补建链接记录 */
  async repairIssueListLinks(): Promise<{ created: number; skipped: number }> {
    const db = getAsyncDb()
    const now = new Date().toISOString()

    // 仅补建「完全没有链接行」的 Issue；attentionLevel = 0（不关注）是合法记录，不得再 INSERT
    const orphans = await db.all< { id: string; listId: string; createdBy: string; createdAt: string }>(`
      SELECT i.id, i.listId, i.createdBy, i.createdAt
      FROM issues i
      WHERE i.listId IS NOT NULL AND i.listId != ''
        AND NOT EXISTS (
          SELECT 1 FROM issueListLinks l
          WHERE l.issueId = i.id AND l.listId = i.listId
        )
    `)

    let created = 0
    for (const row of orphans) {
      const linkId = generateId()
      await db.run(
        'INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt, attentionLevel) VALUES (?, ?, ?, ?, ?, 3)',
        [linkId, row.id, row.listId, row.createdBy || 'system', row.createdAt || now],
      )
      created++
    }

    // 统计已有链接的数量
    const existing = await db.get<{ c: number }>(`
      SELECT COUNT(*) as c FROM issueListLinks
      WHERE attentionLevel > 0
    `) as { c: number }

    console.log(`🔧 [REPAIR] issueListLinks: ${created} created, ${existing.c} total active links`)
    return { created, skipped: existing.c - created }
  }
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}
