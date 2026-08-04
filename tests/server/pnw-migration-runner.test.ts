import { describe, expect, it, vi } from 'vitest'
import { OPEN_ISSUE_MIGRATIONS, pnwRunMigrations } from '../../packages/server/src/db/pnw/pnwMigrationRunner.js'
import { RecordingPostgresAdapter } from './support/recording-postgres-adapter.js'

describe('pnwRunMigrations', () => {
  it('runs fixed IDs in order and skips applied migrations', async () => {
    const db = new RecordingPostgresAdapter()
    const migrations = [
      { id: '002-second', up: async (tx: any) => { await tx.run('INSERT INTO events (id) VALUES (?)', ['2']) } },
      { id: '001-first', up: async (tx: any) => { await tx.exec('CREATE TABLE events (id TEXT PRIMARY KEY)') } },
    ]

    expect(await pnwRunMigrations(db, migrations)).toEqual(['001-first', '002-second'])
    expect(await pnwRunMigrations(db, migrations)).toEqual([])
    expect(await db.all('SELECT id FROM events')).toEqual([{ id: '2' }])
  })

  it('rejects the legacy adapter before creating a formal migration ledger', async () => {
    const exec = vi.fn()
    const db = { dialect: 'sqlite', exec } as any

    await expect(pnwRunMigrations(db)).rejects.toThrow('PostgreSQL')
    expect(exec).not.toHaveBeenCalled()
  })

  it('rolls back both migration work and migration record on failure', async () => {
    const db = new RecordingPostgresAdapter()
    await expect(pnwRunMigrations(db, [{
      id: '001-failing',
      up: async tx => {
        await tx.exec('CREATE TABLE failedWork (id TEXT)')
        throw new Error('migration failed')
      },
    }])).rejects.toThrow('migration failed')

    expect(await db.tableExists('failedWork')).toBe(false)
    expect(await db.get('SELECT id FROM schemaMigrations WHERE id = ?', ['001-failing'])).toBeUndefined()
  })

  it('PostgreSQL deadline 迁移幂等加列并一次性回填旧日期', async () => {
    const migration = OPEN_ISSUE_MIGRATIONS.find(item => item.id === '20260731-checkpoint-deadline')
    expect(migration).toBeTruthy()
    const executor = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ changes: 2 }),
      exec: vi.fn().mockResolvedValue(undefined),
    }

    await migration!.up(executor)
    expect(executor.exec).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN IF NOT EXISTS "deadline" TEXT'))
    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining('SET "deadline" = "checkpointDate"'))

  })

  it('PostgreSQL 推送目标迁移解除目标列表非空约束并扩展状态', async () => {
    const migration = OPEN_ISSUE_MIGRATIONS.find(item => item.id === '20260731-push-targets')
    expect(migration).toBeTruthy()
    const executor = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ changes: 0 }),
      exec: vi.fn().mockResolvedValue(undefined),
    }

    await migration!.up(executor)
    const sql = executor.exec.mock.calls.map(call => call[0]).join('\n')
    expect(sql).toContain('"targetType"')
    expect(sql).toContain('"toUserId"')
    expect(sql).toContain('ALTER COLUMN "toListId" DROP NOT NULL')
    expect(sql).toContain("'withdrawn'")

  })

  it('PostgreSQL Issue 扩展迁移增加 JSONB、固化列表数并建立维护触发器', async () => {
    const migration = OPEN_ISSUE_MIGRATIONS.find(item => item.id === '20260731-issue-extensions-list-count')
    expect(migration).toBeTruthy()
    const executor = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ changes: 2 }),
      exec: vi.fn().mockResolvedValue(undefined),
    }

    await migration!.up(executor)
    const sql = executor.exec.mock.calls.map(call => call[0]).join('\n')
    expect(sql).toContain('"extensions" JSONB NOT NULL DEFAULT')
    expect(sql).toContain('"listCount" INTEGER NOT NULL DEFAULT 0')
    expect(sql).toContain('CREATE TRIGGER "trgIssueListLinksCount"')
    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining('CAST(COUNT(*) AS INTEGER)'))

  })

  it('PostgreSQL 8D 迁移建独立表并复制旧 Issue 内容', async () => {
    const migration = OPEN_ISSUE_MIGRATIONS.find(item => item.id === '20260731-eight-d-reports')
    expect(migration).toBeTruthy()
    const executor = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ changes: 1 }),
      exec: vi.fn().mockResolvedValue(undefined),
    }
    await migration!.up(executor)
    expect(executor.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS "eightDReports"'))
    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining("'legacy-8d-' || \"id\""))
    expect(executor.run).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT ("id") DO NOTHING'))
  })
})
