import { getAsyncDb } from '../db/connection.js'
import { generateId } from '@open-issue/core'
import bcrypt from 'bcryptjs'
import { BadRequestError } from '../utils/errors.js'
import { config } from '../config.js'

interface BackupData {
  version: number
  timestamp: string
  passwordPolicy?: BackupPasswordPolicy
  exportScope?: BackupExportScope
  tables: Record<string, Record<string, unknown>[]>
}

type BackupPasswordPolicy = 'resetAll' | 'resetAdmin'
type BackupExportScope = 'full' | 'accessible'

const TABLE_NAMES = [
  'users', 'externalIdentities', 'externalBindRequests', 'orgUnits', 'issueLists', 'issueListMembers',
  'issues', 'issueListLinks', 'checkpoints', 'eightDReports', 'pushRecords', 'dict', 'poiFunctions',
]
const TRANSIENT_TABLE_NAMES = ['oauthLoginTickets', 'oauthLoginAttempts']

export class BackupService {
  /** 导出数据；迁移模式仅保留非 admin 用户的 bcrypt 哈希。 */
  async export(passwordPolicy: BackupPasswordPolicy = 'resetAll', userId?: string): Promise<BackupData> {
    const db = getAsyncDb()
    const tables: Record<string, Record<string, unknown>[]> = {}

    if (userId) return this.exportAccessibleData(userId)

    for (const table of TABLE_NAMES) {
      const rows = await db.all<Record<string, unknown>>(`SELECT * FROM "${table}"`)
      // 常规备份不保留密码哈希；迁移模式仅保留非 admin 用户的哈希。
      if (table === 'users') {
        for (const row of rows) {
          if (passwordPolicy === 'resetAll' || row.username === 'admin') delete row.passwordHash
        }
      }
      tables[table] = rows
    }

    return {
      version: 1,
      timestamp: new Date().toISOString(),
      passwordPolicy,
      exportScope: 'full',
      tables,
    }
  }

  /** 导入数据 */
  async import(data: BackupData, mode: 'replace' | 'merge'): Promise<{
    imported: Record<string, number>
    passwords: { preserved: number; reset: number }
  }> {
    if (!data || data.version !== 1) {
      throw new BadRequestError('备份文件格式不正确或版本不兼容')
    }
    if (!data.tables || typeof data.tables !== 'object') {
      throw new BadRequestError('备份文件缺少 table 数据')
    }
    if (data.exportScope === 'accessible') {
      throw new BadRequestError('受限导出文件仅供个人数据留存，不能导入数据库')
    }

    const db = getAsyncDb()
    const imported: Record<string, number> = {}
    const passwords = { preserved: 0, reset: 0 }
    const now = new Date().toISOString()

    await db.transaction(async tx => {
      // 导入前撤销所有未完成 OAuth 事务和一次性票据，避免账号数据变化后继续使用旧凭证。
      for (const table of TRANSIENT_TABLE_NAMES) {
        await tx.run(`DELETE FROM "${table}"`)
      }
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
            const preservePassword = data.passwordPolicy === 'resetAdmin'
              && row.username !== 'admin'
              && isBcryptHash(row.passwordHash)
            const pwHash = preservePassword
              ? row.passwordHash as string
              : bcrypt.hashSync(config.bootstrapAdminPassword, 10)
            const result = await tx.run(
              `INSERT INTO "users" ("id", "username", "email", "passwordHash", "displayName", "orgUnitId", "approved", "disabled", "systemRole", "tokenVersion", "createdAt", "updatedAt")
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
              [row.id, row.username, row.email ?? null, pwHash, row.displayName ?? null,
               row.orgUnitId ?? null, row.approved ?? 1, row.disabled ?? 0,
               row.systemRole ?? (row.username === 'admin' ? 'admin' : 'editor'),
               Number(row.tokenVersion ?? 0) + 1,
               row.createdAt || now, row.updatedAt || now],
            )
            count += result.changes
            if (result.changes > 0) {
              if (preservePassword) passwords.preserved++
              else passwords.reset++
            }
          } else {
            // v0.6.1 以前的备份没有 checkpoint.deadline。当且仅当字段完全缺失时，
            // 继承旧 checkpointDate，保持升级前的计划/逾期含义；显式 null 必须保留。
            const normalizedRow = table === 'checkpoints' && !Object.hasOwn(row, 'deadline')
              ? { ...row, deadline: row.checkpointDate ?? null }
              : row
            const cols = Object.keys(normalizedRow).filter(k => normalizedRow[k] !== undefined)
            if (!cols.every(isSafeIdentifier)) {
              throw new BadRequestError(`备份 ${table} 包含非法列名`)
            }
            const placeholders = cols.map(() => '?').join(', ')
            const values = cols.map(k => normalizedRow[k])
            const result = await tx.run(
              `INSERT INTO "${table}" (${cols.map(quoteIdentifier).join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values,
            )
            count += result.changes
          }
        }
        imported[table] = count
      }

      // listCount 是可重建的 counter cache。备份可能来自旧版本，也可能在导入
      // issueListLinks 时被触发器递增，因此导入结束后以关联表为准统一校正一次。
      await tx.run(`
        UPDATE issues
           SET listCount = (
             SELECT CAST(COUNT(*) AS INTEGER)
               FROM issueListLinks link
              WHERE link.issueId = issues.id
           )
      `)
    })

    console.log(`📦 [BACKUP] import ${mode} — ${Object.values(imported).reduce((a, b) => a + b, 0)} rows`)
    return { imported, passwords }
  }

  private async exportAccessibleData(userId: string): Promise<BackupData> {
    const db = getAsyncDb()
    const tables = emptyTables()
    const lists = await db.all<Record<string, unknown>>(`
      SELECT DISTINCT l.*
      FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      WHERE (l.ownerId = ? OR m.userId = ?) AND l.isDeleted = 0
      ORDER BY l.updatedAt DESC
    `, [userId, userId])
    const listIds = lists.map(row => row.id).filter((id): id is string => typeof id === 'string')
    tables.issueLists = lists
    tables.eightDReports = await db.all(
      'SELECT * FROM eightDReports WHERE relatedIssueId IS NULL AND createdBy = ? AND isDeleted = 0',
      [userId],
    )
    tables.pushRecords = await db.all(
      'SELECT * FROM pushRecords WHERE pushedBy = ? OR toUserId = ?',
      [userId, userId],
    )
    if (!listIds.length) return {
      version: 1,
      timestamp: new Date().toISOString(),
      passwordPolicy: 'resetAll',
      exportScope: 'accessible',
      tables,
    }

    const placeholders = listIds.map(() => '?').join(', ')
    tables.issueListMembers = await db.all(
      `SELECT * FROM issueListMembers WHERE listId IN (${placeholders})`,
      listIds,
    )
    const issues = await db.all<Record<string, unknown>>(`
      SELECT DISTINCT i.* FROM issues i
      LEFT JOIN issueListLinks il ON il.issueId = i.id
      WHERE i.listId IN (${placeholders}) OR il.listId IN (${placeholders})
    `, [...listIds, ...listIds])
    const issueIds = issues.map(row => row.id).filter((id): id is string => typeof id === 'string')
    tables.issues = issues
    tables.issueListLinks = await db.all(
      `SELECT * FROM issueListLinks WHERE listId IN (${placeholders})`,
      listIds,
    )
    tables.pushRecords = await db.all(
      `SELECT * FROM pushRecords
       WHERE fromListId IN (${placeholders}) OR toListId IN (${placeholders})
          OR pushedBy = ? OR toUserId = ?`,
      [...listIds, ...listIds, userId, userId],
    )
    if (issueIds.length) {
      const issuePlaceholders = issueIds.map(() => '?').join(', ')
      tables.checkpoints = await db.all(
        `SELECT * FROM checkpoints WHERE issueId IN (${issuePlaceholders})`,
        issueIds,
      )
      tables.eightDReports = await db.all(
        `SELECT * FROM eightDReports
         WHERE isDeleted = 0 AND (relatedIssueId IN (${issuePlaceholders}) OR (relatedIssueId IS NULL AND createdBy = ?))`,
        [...issueIds, userId],
      )
    }
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      passwordPolicy: 'resetAll',
      exportScope: 'accessible',
      tables,
    }
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

function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)
}

function emptyTables(): Record<string, Record<string, unknown>[]> {
  return Object.fromEntries(TABLE_NAMES.map(table => [table, []]))
}
