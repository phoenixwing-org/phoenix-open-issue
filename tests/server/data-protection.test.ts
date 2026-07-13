import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tempDir: string
let db: import('../../packages/server/src/db/pnwDbAdapter.js').PnwDbAdapter
let closeDb: () => void
let adminId: string

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-issue-test-'))
  process.env.DB_DRIVER = 'sqlite'
  process.env.DB_PATH = path.join(tempDir, 'test.sqlite')
  process.env.SERVE_STATIC = 'false'

  const connection = await import('../../packages/server/src/db/connection.js')
  closeDb = connection.closeDb
  await connection.initializeDb()
  db = connection.getDb()
  adminId = (db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string }).id

  db.run(
    `INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('list-1', '测试列表', 'custom', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO issueListMembers (id, listId, userId, role) VALUES ('member-1', 'list-1', ?, 'owner')`,
    adminId,
  )
  db.run(
    `INSERT INTO issues (id, listId, issueNo, title, createdBy)
     VALUES ('issue-1', 'list-1', 'ISS-2099-0001', '测试 Issue', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO issueListLinks (id, issueId, listId, linkedBy)
     VALUES ('link-1', 'issue-1', 'list-1', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO checkpoints (id, issueId, checkpointDate, description)
     VALUES ('checkpoint-1', 'issue-1', '2099-01-01', '测试点检')`,
  )
  db.run(
    `INSERT INTO pushRecords (id, fromListId, toListId, issueId, pushedBy)
     VALUES ('push-1', 'list-1', 'list-1', 'issue-1', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO orgUnits (id, name, unitType) VALUES ('org-1', '测试组织', 'group')`,
  )
  db.run(
    `INSERT INTO poiFunctions (id, platform, externalId, functionName)
     VALUES ('function-1', '测试平台', '1', '测试功能')`,
  )
  db.run(
    `INSERT INTO dict (id, groupName, value, label) VALUES ('dict-1', 'testGroup', 'test', '测试')`,
  )
})

afterAll(() => {
  closeDb?.()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('数据保护规则', () => {
  it('列表删除只设置软删除标记', async () => {
    const { IssueListService } = await import('../../packages/server/src/service/IssueListService.js')
    await new IssueListService().delete('list-1', adminId)

    const row = db.get('SELECT isDeleted, deletedAt FROM issueLists WHERE id = ?', 'list-1') as {
      isDeleted: number
      deletedAt: string | null
    }
    expect(row.isDeleted).toBe(1)
    expect(row.deletedAt).toBeTruthy()
  })

  it('Issue 删除兼容接口改为取消且保留关联数据', async () => {
    const { IssueService } = await import('../../packages/server/src/service/IssueService.js')
    await new IssueService().delete('issue-1', adminId)

    const issue = db.get('SELECT status, closeReason FROM issues WHERE id = ?', 'issue-1') as {
      status: string
      closeReason: string
    }
    expect(issue).toEqual({ status: 'cancelled', closeReason: 'cancelled' })
    expect((db.get('SELECT COUNT(*) AS c FROM checkpoints WHERE issueId = ?', 'issue-1') as { c: number }).c).toBe(1)
    expect((db.get('SELECT COUNT(*) AS c FROM issueListLinks WHERE issueId = ?', 'issue-1') as { c: number }).c).toBe(1)
    expect((db.get('SELECT COUNT(*) AS c FROM pushRecords WHERE issueId = ?', 'issue-1') as { c: number }).c).toBe(1)
  })

  it('点检删除兼容接口改为跳过', async () => {
    const { CheckpointService } = await import('../../packages/server/src/service/CheckpointService.js')
    await new CheckpointService().delete('checkpoint-1', adminId)
    const row = db.get('SELECT status FROM checkpoints WHERE id = ?', 'checkpoint-1') as { status: string }
    expect(row.status).toBe('skipped')
  })

  it('组织节点拒绝物理删除', async () => {
    const { OrgUnitService } = await import('../../packages/server/src/service/OrgUnitService.js')
    await expect(new OrgUnitService().delete('org-1')).rejects.toThrow(/不允许删除/)
    expect(db.get('SELECT id FROM orgUnits WHERE id = ?', 'org-1')).toBeTruthy()
  })

  it('功能删除兼容接口改为停用', async () => {
    const { FunctionService } = await import('../../packages/server/src/service/FunctionService.js')
    await new FunctionService().delete('function-1')
    const row = db.get('SELECT enabled FROM poiFunctions WHERE id = ?', 'function-1') as { enabled: number }
    expect(row.enabled).toBe(0)
  })

  it('字典删除兼容接口改为停用', async () => {
    const { DictService } = await import('../../packages/server/src/service/DictService.js')
    await new DictService().delete('dict-1')
    const row = db.get('SELECT enabled FROM dict WHERE id = ?', 'dict-1') as { enabled: number }
    expect(row.enabled).toBe(0)
  })
})

describe('数据库发布迁移', () => {
  it('Issue 编号索引可重复执行并保持全局唯一', async () => {
    const { ensureIssueNoIndexes } = await import('../../packages/server/src/db/migrations.js')
    expect(ensureIssueNoIndexes(db)).toBe(true)
    expect(ensureIssueNoIndexes(db)).toBe(true)

    const indexes = db.all('PRAGMA index_list("issues")') as { name: string; unique: number }[]
    expect(indexes).toContainEqual(expect.objectContaining({ name: 'uq_issues_issueNo', unique: 1 }))
    expect(indexes).toContainEqual(expect.objectContaining({ name: 'idx_issues_list_issueNo' }))
  })
})
