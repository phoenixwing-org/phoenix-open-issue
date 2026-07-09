import { getDb } from '../db/connection.js'
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
  export(): BackupData {
    const db = getDb()
    const tables: Record<string, Record<string, unknown>[]> = {}

    for (const table of TABLE_NAMES) {
      const rows = db.all(`SELECT * FROM "${table}"`) as Record<string, unknown>[]
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
  import(data: BackupData, mode: 'replace' | 'merge'): { imported: Record<string, number> } {
    if (!data || data.version !== 1) {
      throw Object.assign(new Error('备份文件格式不正确或版本不兼容'), { statusCode: 400 })
    }
    if (!data.tables || typeof data.tables !== 'object') {
      throw Object.assign(new Error('备份文件缺少 table 数据'), { statusCode: 400 })
    }

    const db = getDb()
    const imported: Record<string, number> = {}

    if (mode === 'replace') {
      // 逆序清空（子表先删）
      for (const table of [...TABLE_NAMES].reverse()) {
        db.run(`DELETE FROM "${table}"`)
      }
    }

    const now = new Date().toISOString()

    for (const table of TABLE_NAMES) {
      const rows = data.tables[table]
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        imported[table] = 0
        continue
      }

      let count = 0
      for (const row of rows) {
        try {
          if (table === 'users') {
            // 用户：重新生成密码哈希（默认 123456）
            const pwHash = bcrypt.hashSync('123456', 10)
            db.run(
              `INSERT OR IGNORE INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, disabled, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [row.id, row.username, row.email ?? null, pwHash, row.displayName ?? null,
               row.orgUnitId ?? null, row.approved ?? 1, row.disabled ?? 0,
               row.createdAt || now, row.updatedAt || now],
            )
          } else {
            // 其他表：直接插入
            const cols = Object.keys(row).filter(k => row[k] !== undefined)
            const placeholders = cols.map(() => '?').join(', ')
            const values = cols.map(k => row[k])
            db.run(
              `INSERT OR IGNORE INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders})`,
              values,
            )
          }
          count++
        } catch {
          // 冲突跳过（merge 模式）
        }
      }
      imported[table] = count
    }

    console.log(`📦 [BACKUP] import ${mode} — ${Object.values(imported).reduce((a, b) => a + b, 0)} rows`)
    return { imported }
  }

  /** 数据库修正：为缺失 issueListLinks 的 Issue 补建链接记录 */
  repairIssueListLinks(): { created: number; skipped: number } {
    const db = getDb()
    const now = new Date().toISOString()

    // 查找所有没有对应 issueListLinks 记录的 Issue（按主 listId）
    const orphans = db.all(`
      SELECT i.id, i.listId, i.createdBy, i.createdAt
      FROM issues i
      WHERE i.listId IS NOT NULL AND i.listId != ''
        AND NOT EXISTS (
          SELECT 1 FROM issueListLinks l
          WHERE l.issueId = i.id AND l.listId = i.listId
            AND l.attentionLevel > 0
        )
    `) as { id: string; listId: string; createdBy: string; createdAt: string }[]

    let created = 0
    for (const row of orphans) {
      const linkId = generateId()
      db.run(
        'INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt) VALUES (?, ?, ?, ?, ?)',
        [linkId, row.id, row.listId, row.createdBy || 'system', row.createdAt || now],
      )
      created++
    }

    // 统计已有链接的数量
    const existing = db.get(`
      SELECT COUNT(*) as c FROM issueListLinks
      WHERE attentionLevel > 0
    `) as { c: number }

    console.log(`🔧 [REPAIR] issueListLinks: ${created} created, ${existing.c} total active links`)
    return { created, skipped: existing.c - created }
  }
}
