import { createHash } from 'node:crypto'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { inventoryLegacySqlite } from '../../scripts/inventory-legacy-sqlite.mjs'
import { verifySqlitePgRehearsal } from '../../scripts/verify-sqlite-pg-rehearsal.mjs'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function backup() {
  return {
    version: 1,
    exportScope: 'full',
    tables: {
      users: [{ id: 'user-1', username: 'admin', passwordHash: 'source', tokenVersion: 0 }],
      externalIdentities: [],
      externalBindRequests: [],
      orgUnits: [],
      issueLists: [{ id: 'list-1', ownerId: 'user-1', name: '主列表' }],
      issueListMembers: [],
      issues: [{
        id: 'issue-1',
        listId: 'list-1',
        issueNo: 'ISSUE-1',
        title: '问题',
        listCount: 0,
        extensions: '{}',
      }],
      issueListLinks: [{ id: 'link-1', issueId: 'issue-1', listId: 'list-1' }],
      checkpoints: [{
        id: 'checkpoint-1',
        issueId: 'issue-1',
        checkpointDate: '2026-08-03',
      }],
      eightDReports: [],
      pushRecords: [],
      dict: [{ id: 'dict-1', groupName: 'severity', value: 'minor' }],
      poiFunctions: [],
    },
  }
}

describe('SQLite 清理只读证据工具', () => {
  it('只读记录显式数据库文件的 SHA、大小、owner 与保留期', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'open-issue-sqlite-inventory-'))
    tempRoots.push(root)
    const databasePath = path.join(root, 'legacy.sqlite')
    const content = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.from('fixture')])
    writeFileSync(databasePath, content)

    const inventory = await inventoryLegacySqlite({
      owner: 'migration-owner',
      retentionUntil: '2027-08-03',
      files: [databasePath],
      generatedAt: '2026-08-03T00:00:00.000Z',
    })

    expect(inventory).toEqual(expect.objectContaining({
      owner: 'migration-owner',
      retentionUntil: '2027-08-03',
      readOnly: true,
    }))
    expect(inventory.files).toEqual([expect.objectContaining({
      path: realpathSync(databasePath),
      role: 'database',
      size: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    })])
  })

  it('拒绝相对路径，避免隐式扫描或误读工作目录', async () => {
    await expect(inventoryLegacySqlite({
      owner: 'migration-owner',
      retentionUntil: '2027-08-03',
      files: ['data/open-issue.sqlite'],
    })).rejects.toThrow('只接受显式绝对路径')
  })

  it('离线对账允许密码、token、listCount 与 legacy deadline 的预期转换', () => {
    const source = backup()
    const target = structuredClone(source)
    target.tables.users[0].passwordHash = 'target'
    target.tables.users[0].tokenVersion = 1
    target.tables.issues[0].listCount = 1
    target.tables.issues[0].extensions = {}
    target.tables.checkpoints[0].deadline = '2026-08-03'

    expect(verifySqlitePgRehearsal(source, target)).toEqual(
      expect.objectContaining({ passed: true, errors: [] }),
    )
  })

  it('业务字段不同或 PG 关联悬空时 fail closed', () => {
    const source = backup()
    const target = structuredClone(source)
    target.tables.issues[0].title = '被改写'
    target.tables.issues[0].listId = 'missing-list'

    const result = verifySqlitePgRehearsal(source, target)
    expect(result.passed).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'table issues 内容不一致',
      'issues 悬空引用：issue-1.listId=missing-list',
    ]))
  })
})
