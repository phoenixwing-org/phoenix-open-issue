import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tempDir: string
let closeAsyncDb: () => Promise<void>
let db: import('../../packages/server/src/db/pnwDbAdapter.js').PnwDbAdapter
let repair: import('../../packages/server/src/service/DbRepairService.js').DbRepairService

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-issue-db-repair-'))
  process.env.DB_DRIVER = 'sqlite'
  process.env.ALLOW_LEGACY_SQLITE = 'true'
  process.env.DB_PATH = path.join(tempDir, 'repair.sqlite')
  process.env.SERVE_STATIC = 'false'
  process.env.NODE_ENV = 'test'

  const connection = await import('../../packages/server/src/db/connection.js')
  closeAsyncDb = connection.closeAsyncDb
  await connection.initializeDb()
  db = connection.getDb()

  // 模拟旧库：已有第三方登录首期表，但缺少待审查表
  db.exec('DROP TABLE IF EXISTS externalBindRequests')

  const { DbRepairService } = await import('../../packages/server/src/service/DbRepairService.js')
  repair = new DbRepairService()
})

afterAll(async () => {
  await closeAsyncDb?.()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe.sequential('数据库修正 · 表结构补全', () => {
  it('补建 externalBindRequests，且再次执行仍幂等', async () => {
    expect(db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='externalBindRequests'")).toBeUndefined()

    const first = await repair.repairSchema()
    expect(first.task).toBe('schema')
    expect(first.fixed).toBeGreaterThan(0)
    expect(first.details.some(line => line.includes('externalBindRequests'))).toBe(true)
    expect(db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='externalBindRequests'")).toBeTruthy()

    const second = await repair.repairSchema()
    expect(second.fixed).toBe(0)
    expect(second.message).toMatch(/已是最新|已检查/)
    expect(second.details).toEqual(expect.arrayContaining([
      expect.stringContaining('✓ externalBindRequests'),
    ]))
  })

  it('全部执行包含表结构补全且可重复', async () => {
    const results = await repair.runTask('all')
    expect(results.map(r => r.task)).toContain('schema')
    expect(results.every(r => typeof r.message === 'string')).toBe(true)

    const again = await repair.runTask('all')
    const schema = again.find(r => r.task === 'schema')!
    expect(schema.fixed).toBe(0)
  })

  it('点检修正保留无截止日记录并明确其为合法数据', async () => {
    db.run(`
      INSERT INTO checkpoints (id, issueId, checkpointDate, deadline, description)
      VALUES ('repair-no-deadline', 'repair-issue', '2026-07-31', NULL, '允许无截止日')
    `)

    const result = await repair.repairCheckpoints()
    expect(result.details).toEqual(expect.arrayContaining([
      expect.stringContaining('无截止日'),
      expect.stringContaining('不补写'),
      expect.stringContaining('checkpointDate'),
    ]))
    expect(db.get('SELECT deadline FROM checkpoints WHERE id = ?', 'repair-no-deadline'))
      .toEqual({ deadline: null })
  })

  it('链接修正会按 issueListLinks 重新校正 Issue.listCount', async () => {
    const adminId = (db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string }).id
    db.run(`INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('repair-count-list', '计数修复', 'custom', ?)`, adminId)
    db.run(`
      INSERT INTO issues (id, listId, issueNo, title, createdBy)
      VALUES ('repair-count-issue', 'repair-count-list', 'ISS-2099-9998', '关联计数修复', ?)
    `, adminId)
    db.run(`
      INSERT INTO issueListLinks (id, issueId, listId, linkedBy)
      VALUES ('repair-count-link', 'repair-count-issue', 'repair-count-list', ?)
    `, adminId)
    db.run(`UPDATE issues SET listCount = 9 WHERE id = 'repair-count-issue'`)

    const repaired = await repair.repairIssueListLinks()
    expect(repaired.details).toEqual(expect.arrayContaining([
      expect.stringContaining('关联计数校正 1 条'),
    ]))
    expect(db.get('SELECT listCount FROM issues WHERE id = ?', 'repair-count-issue'))
      .toEqual({ listCount: 1 })
  })

  it('8D 报告修正保留正文，并把失效 Issue 关联转为独立报告', async () => {
    const adminId = (db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string }).id
    db.run(`
      INSERT INTO eightDReports
        (id, relatedIssueId, title, containment, createdBy)
      VALUES ('repair-orphan-report', 'missing-issue', '孤立报告', '保留正文', ?)
    `, adminId)
    db.run(`
      INSERT INTO issues
        (id, listId, issueNo, title, containment, rootCause, correctiveAction, createdBy)
      VALUES ('repair-legacy-8d-issue', 'repair-list', 'ISS-2099-9999', '旧 8D', '隔离', '根因', '措施', ?)
    `, adminId)

    const repaired = await repair.repairReports()
    expect(repaired.fixed).toBeGreaterThanOrEqual(2)
    expect(db.get('SELECT relatedIssueId, containment FROM eightDReports WHERE id = ?', 'repair-orphan-report'))
      .toEqual({ relatedIssueId: null, containment: '保留正文' })
    expect(db.get('SELECT relatedIssueId, rootCause FROM eightDReports WHERE id = ?', 'legacy-8d-repair-legacy-8d-issue'))
      .toEqual({ relatedIssueId: 'repair-legacy-8d-issue', rootCause: '根因' })

    const again = await repair.repairReports()
    expect(again.fixed).toBe(0)
  })
})
