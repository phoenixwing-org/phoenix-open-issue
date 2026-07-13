import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PnwSqliteAdapter } from '../../packages/server/src/db/pnw/pnwSqliteAdapter.js'

const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!()
})

async function createDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnw-sqlite-'))
  const db = new PnwSqliteAdapter(path.join(dir, 'test.sqlite'))
  cleanup.push(async () => {
    await db.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return db
}

describe('PnwSqliteAdapter', () => {
  it('提供异步 CRUD 和元数据接口', async () => {
    const db = await createDb()
    await db.exec('CREATE TABLE "items" ("id" TEXT PRIMARY KEY, "name" TEXT)')
    await db.run('INSERT INTO "items" ("id", "name") VALUES (?, ?)', ['1', 'one'])

    expect(await db.get('SELECT * FROM "items" WHERE "id" = ?', ['1']))
      .toEqual({ id: '1', name: 'one' })
    expect(await db.all('SELECT * FROM "items"')).toHaveLength(1)
    expect(await db.tableExists('items')).toBe(true)
    expect(await db.columnNames('items')).toEqual(new Set(['id', 'name']))
  })

  it('事务成功时提交', async () => {
    const db = await createDb()
    await db.exec('CREATE TABLE "items" ("id" TEXT PRIMARY KEY)')
    await db.transaction(async tx => {
      await tx.run('INSERT INTO "items" ("id") VALUES (?)', ['1'])
      await tx.run('INSERT INTO "items" ("id") VALUES (?)', ['2'])
    })
    expect(await db.all('SELECT * FROM "items"')).toHaveLength(2)
  })

  it('事务失败时回滚', async () => {
    const db = await createDb()
    await db.exec('CREATE TABLE "items" ("id" TEXT PRIMARY KEY)')
    await expect(db.transaction(async tx => {
      await tx.run('INSERT INTO "items" ("id") VALUES (?)', ['1'])
      throw new Error('rollback')
    })).rejects.toThrow('rollback')
    expect(await db.all('SELECT * FROM "items"')).toEqual([])
  })

  it('并发调用按连接顺序串行执行', async () => {
    const db = await createDb()
    await db.exec('CREATE TABLE "items" ("id" TEXT PRIMARY KEY)')
    await Promise.all(Array.from({ length: 20 }, (_, i) => (
      db.run('INSERT INTO "items" ("id") VALUES (?)', [String(i)])
    )))
    const row = await db.get<{ count: number }>('SELECT COUNT(*) AS "count" FROM "items"')
    expect(row?.count).toBe(20)
  })
})
