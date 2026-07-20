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
})
