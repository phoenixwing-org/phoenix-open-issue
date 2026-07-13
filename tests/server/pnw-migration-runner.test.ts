import { afterEach, describe, expect, it } from 'vitest'
import { pnwRunMigrations } from '../../packages/server/src/db/pnw/pnwMigrationRunner.js'
import { PnwSqliteAdapter } from '../../packages/server/src/db/pnw/pnwSqliteAdapter.js'

describe('pnwRunMigrations', () => {
  let db: PnwSqliteAdapter | undefined

  afterEach(async () => {
    await db?.close()
  })

  it('runs fixed IDs in order and skips applied migrations', async () => {
    db = new PnwSqliteAdapter(':memory:')
    const migrations = [
      { id: '002-second', up: async (tx: any) => { await tx.run('INSERT INTO events (id) VALUES (?)', ['2']) } },
      { id: '001-first', up: async (tx: any) => { await tx.exec('CREATE TABLE events (id TEXT PRIMARY KEY)') } },
    ]

    expect(await pnwRunMigrations(db, migrations)).toEqual(['001-first', '002-second'])
    expect(await pnwRunMigrations(db, migrations)).toEqual([])
    expect(await db.all('SELECT id FROM events')).toEqual([{ id: '2' }])
  })

  it('rolls back both migration work and migration record on failure', async () => {
    db = new PnwSqliteAdapter(':memory:')
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
})
