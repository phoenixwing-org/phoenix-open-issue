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
  it('Issue 扩展属性默认空对象，listCount 随关联增删自动维护', () => {
    expect(db.get('SELECT extensions, listCount FROM issues WHERE id = ?', 'issue-1'))
      .toEqual({ extensions: '{}', listCount: 1 })

    db.run(`INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('list-count-extra', '计数列表', 'custom', ?)`, adminId)
    db.run(`INSERT INTO issueListLinks (id, issueId, listId, linkedBy) VALUES ('link-count-extra', 'issue-1', 'list-count-extra', ?)`, adminId)
    expect(db.get('SELECT listCount FROM issues WHERE id = ?', 'issue-1')).toEqual({ listCount: 2 })

    db.run(`DELETE FROM issueListLinks WHERE id = 'link-count-extra'`)
    expect(db.get('SELECT listCount FROM issues WHERE id = ?', 'issue-1')).toEqual({ listCount: 1 })
    db.run(`DELETE FROM issueLists WHERE id = 'list-count-extra'`)
  })

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

  it('点检删除兼容接口改为作废', async () => {
    const { CheckpointService } = await import('../../packages/server/src/service/CheckpointService.js')
    await new CheckpointService().delete('checkpoint-1', adminId)
    const row = db.get('SELECT status FROM checkpoints WHERE id = ?', 'checkpoint-1') as { status: string }
    expect(row.status).toBe('voided')
  })

  it('列表点检查询包含关联进来的 Issue', async () => {
    const { CheckpointService } = await import('../../packages/server/src/service/CheckpointService.js')
    db.run(`INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('list-linked', '关联列表', 'custom', ?)`, adminId)
    db.run(`INSERT INTO issueListLinks (id, issueId, listId, linkedBy) VALUES ('link-linked', 'issue-1', 'list-linked', ?)`, adminId)

    const grouped = await new CheckpointService().getByListId('list-linked', adminId)
    expect(grouped['issue-1']).toHaveLength(1)
    expect(grouped['issue-1'][0].id).toBe('checkpoint-1')
  })

  it('点检默认按最新日期优先返回', async () => {
    const { CheckpointService } = await import('../../packages/server/src/service/CheckpointService.js')
    db.run(
      `INSERT INTO checkpoints (id, issueId, checkpointDate, description, sortOrder)
       VALUES ('checkpoint-2', 'issue-1', '2099-01-02', '较新的点检', 2)`,
    )

    const checkpoints = await new CheckpointService().getByIssueId('issue-1', adminId)
    expect(checkpoints.map(cp => cp.id)).toEqual(['checkpoint-2', 'checkpoint-1'])
  })

  it('点检日可编辑，截止日可设置并可再次清空', async () => {
    const { CheckpointService } = await import('../../packages/server/src/service/CheckpointService.js')
    const service = new CheckpointService()
    const created = await service.create('issue-1', {
      checkpointDate: '2099-02-01',
      deadline: null,
      description: '无截止日点检',
    }, adminId)
    expect(created).toEqual(expect.objectContaining({
      checkpointDate: '2099-02-01',
      deadline: null,
    }))

    const scheduled = await service.update(created.id, {
      checkpointDate: '2099-02-02',
      deadline: '2099-02-10',
    }, adminId)
    expect(scheduled).toEqual(expect.objectContaining({
      checkpointDate: '2099-02-02',
      deadline: '2099-02-10',
    }))

    const cleared = await service.update(created.id, { deadline: null }, adminId)
    expect(cleared.deadline).toBeNull()
  })

  it('后台拒绝非法点检日或截止日', async () => {
    const { CheckpointService } = await import('../../packages/server/src/service/CheckpointService.js')
    const service = new CheckpointService()
    await expect(service.create('issue-1', {
      checkpointDate: '2099-02-31',
      description: '非法日期',
    }, adminId)).rejects.toThrow(/点检日必须为 YYYY-MM-DD/)
    await expect(service.update('checkpoint-1', { deadline: 'not-a-date' }, adminId))
      .rejects.toThrow(/截止日必须为 YYYY-MM-DD/)
  })

  it('旧点检表升级后支持作废状态', async () => {
    const { pnwCreateDb } = await import('../../packages/server/src/db/pnwDbAdapter.js')
    const { migrateCheckpointStatusVoided } = await import('../../packages/server/src/db/migrations.js')
    const legacyPath = path.join(tempDir, 'legacy-checkpoints.sqlite')
    const legacyDb = pnwCreateDb(legacyPath)
    legacyDb.exec(`
      CREATE TABLE checkpoints (
        id TEXT PRIMARY KEY,
        issueId TEXT NOT NULL,
        checkpointDate TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','done','skipped')),
        responsibleUserId TEXT,
        sortOrder INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );
      INSERT INTO checkpoints (id, issueId, checkpointDate, description, status)
      VALUES ('legacy-cp', 'legacy-issue', '2026-07-13', '旧记录', 'skipped');
    `)

    expect(migrateCheckpointStatusVoided(legacyDb)).toBe(true)
    legacyDb.run("UPDATE checkpoints SET status = 'voided' WHERE id = 'legacy-cp'")
    expect(legacyDb.get('SELECT status, deadline FROM checkpoints WHERE id = ?', 'legacy-cp')).toEqual({
      status: 'voided',
      deadline: '2026-07-13',
    })
    legacyDb.close()
  })

  it('旧点检日期只在首次升级时复制到 deadline，之后允许永久清空', async () => {
    const { pnwCreateDb } = await import('../../packages/server/src/db/pnwDbAdapter.js')
    const { applyColumnMigrations, migrateCheckpointDeadline } = await import('../../packages/server/src/db/migrations.js')
    const legacyPath = path.join(tempDir, 'legacy-deadline.sqlite')
    const legacyDb = pnwCreateDb(legacyPath)
    legacyDb.exec(`
      CREATE TABLE systemFlags (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE checkpoints (
        id TEXT PRIMARY KEY,
        issueId TEXT NOT NULL,
        checkpointDate TEXT NOT NULL,
        description TEXT NOT NULL
      );
      INSERT INTO checkpoints (id, issueId, checkpointDate, description)
      VALUES ('legacy-deadline-cp', 'legacy-issue', '2026-07-20', '待迁移');
    `)

    expect(applyColumnMigrations(legacyDb)).toContain('checkpoints.deadline')
    expect(migrateCheckpointDeadline(legacyDb)).toBe(1)
    expect(legacyDb.get('SELECT deadline FROM checkpoints WHERE id = ?', 'legacy-deadline-cp'))
      .toEqual({ deadline: '2026-07-20' })

    legacyDb.run("UPDATE checkpoints SET deadline = NULL WHERE id = 'legacy-deadline-cp'")
    expect(migrateCheckpointDeadline(legacyDb)).toBe(0)
    expect(legacyDb.get('SELECT deadline FROM checkpoints WHERE id = ?', 'legacy-deadline-cp'))
      .toEqual({ deadline: null })
    legacyDb.close()
  })

  it('旧推送表升级后保留列表记录并支持未绑定列表的用户推送与撤回', async () => {
    const { pnwCreateDb } = await import('../../packages/server/src/db/pnwDbAdapter.js')
    const { migratePushTargets } = await import('../../packages/server/src/db/migrations.js')
    const legacyPath = path.join(tempDir, 'legacy-push-targets.sqlite')
    const legacyDb = pnwCreateDb(legacyPath)
    legacyDb.exec(`
      CREATE TABLE systemFlags (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE pushRecords (
        id TEXT PRIMARY KEY,
        fromListId TEXT NOT NULL,
        toListId TEXT NOT NULL,
        issueId TEXT NOT NULL,
        pushedBy TEXT NOT NULL,
        pushedAt TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
        handledBy TEXT,
        handledAt TEXT,
        rejectReason TEXT,
        note TEXT DEFAULT ''
      );
      INSERT INTO pushRecords (id, fromListId, toListId, issueId, pushedBy, status)
      VALUES ('legacy-push', 'from-list', 'to-list', 'issue-1', 'user-1', 'accepted');
    `)

    expect(migratePushTargets(legacyDb)).toBe(true)
    expect(legacyDb.get('SELECT targetType, toListId, toUserId, status FROM pushRecords WHERE id = ?', 'legacy-push'))
      .toEqual({ targetType: 'list', toListId: 'to-list', toUserId: null, status: 'accepted' })
    legacyDb.run(`
      INSERT INTO pushRecords (id, fromListId, targetType, toListId, toUserId, issueId, pushedBy, status)
      VALUES ('user-push', 'from-list', 'user', NULL, 'user-2', 'issue-1', 'user-1', 'withdrawn')
    `)
    expect(legacyDb.get('SELECT toListId, toUserId, status FROM pushRecords WHERE id = ?', 'user-push'))
      .toEqual({ toListId: null, toUserId: 'user-2', status: 'withdrawn' })
    expect(migratePushTargets(legacyDb)).toBe(false)
    legacyDb.close()
  })

  it('旧 Issue 的 8D 内容一次性迁移到可空关联的附属报告', async () => {
    const { pnwCreateDb } = await import('../../packages/server/src/db/pnwDbAdapter.js')
    const { migrateLegacyEightDReports } = await import('../../packages/server/src/db/migrations.js')
    const legacyPath = path.join(tempDir, 'legacy-eight-d.sqlite')
    const legacyDb = pnwCreateDb(legacyPath)
    legacyDb.exec(`
      CREATE TABLE systemFlags (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE issues (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, containment TEXT, rootCause TEXT,
        correctiveAction TEXT, createdBy TEXT NOT NULL, createdAt TEXT, updatedAt TEXT
      );
      CREATE TABLE eightDReports (
        id TEXT PRIMARY KEY, relatedIssueId TEXT, title TEXT NOT NULL, containment TEXT NOT NULL DEFAULT '',
        rootCause TEXT NOT NULL DEFAULT '', correctiveAction TEXT NOT NULL DEFAULT '', createdBy TEXT NOT NULL,
        createdAt TEXT, updatedAt TEXT, isDeleted INTEGER NOT NULL DEFAULT 0, deletedAt TEXT
      );
      INSERT INTO issues VALUES ('legacy-issue-8d', '旧问题', '先隔离', '工装偏移', '更换工装', 'user-1', '2026-07-01', '2026-07-02');
    `)

    expect(migrateLegacyEightDReports(legacyDb)).toBe(1)
    expect(legacyDb.get('SELECT relatedIssueId, title, containment, rootCause, correctiveAction FROM eightDReports'))
      .toEqual({
        relatedIssueId: 'legacy-issue-8d',
        title: '8D · 旧问题',
        containment: '先隔离',
        rootCause: '工装偏移',
        correctiveAction: '更换工装',
      })
    expect(migrateLegacyEightDReports(legacyDb)).toBe(0)
    legacyDb.run("UPDATE eightDReports SET relatedIssueId = NULL WHERE id = 'legacy-8d-legacy-issue-8d'")
    expect(legacyDb.get('SELECT relatedIssueId FROM eightDReports')).toEqual({ relatedIssueId: null })
    legacyDb.close()
  })

  it('旧备份缺少 deadline 时继承原日期，显式空截止仍保持为空', async () => {
    const { BackupService } = await import('../../packages/server/src/service/BackupService.js')
    await new BackupService().import({
      version: 1,
      timestamp: new Date().toISOString(),
      tables: {
        checkpoints: [
          {
            id: 'legacy-backup-cp',
            issueId: 'issue-1',
            checkpointDate: '2099-03-01',
            description: '旧备份',
          },
          {
            id: 'nullable-backup-cp',
            issueId: 'issue-1',
            checkpointDate: '2099-03-02',
            deadline: null,
            description: '新版无截止',
          },
        ],
      },
    } as any, 'merge')

    expect(db.get('SELECT deadline FROM checkpoints WHERE id = ?', 'legacy-backup-cp'))
      .toEqual({ deadline: '2099-03-01' })
    expect(db.get('SELECT deadline FROM checkpoints WHERE id = ?', 'nullable-backup-cp'))
      .toEqual({ deadline: null })
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
