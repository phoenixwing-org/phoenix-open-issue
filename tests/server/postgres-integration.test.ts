import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PnwPostgresAdapter } from '../../packages/server/src/db/pnw/pnwPostgresAdapter.js'
import { pnwRunSchema } from '../../packages/server/src/db/pnw/pnwSchema.js'
import { pnwRunMigrations } from '../../packages/server/src/db/pnw/pnwMigrationRunner.js'

const connectionString = process.env.TEST_POSTGRES_URL
const describePostgres = connectionString ? describe : describe.skip

describePostgres('PostgreSQL integration', () => {
  const suffix = randomUUID()
  const userId = `pg-test-user-${suffix}`
  const flagKey = `pg-test-flag-${suffix}`
  const migrationId = `pg-test-migration-${suffix}`
  let db: PnwPostgresAdapter

  beforeAll(async () => {
    db = new PnwPostgresAdapter({
      driver: 'postgres',
      connectionString: connectionString!,
      ssl: false,
      poolMax: 2,
    })
    await pnwRunSchema(db)
  })

  afterAll(async () => {
    if (!db) return
    await db.run('DELETE FROM users WHERE id = ?', [userId])
    await db.run('DELETE FROM systemFlags WHERE key = ?', [flagKey])
    await db.run('DELETE FROM schemaMigrations WHERE id = ?', [migrationId])
    await db.close()
  })

  it('preserves camelCase fields through real PostgreSQL queries', async () => {
    await db.run(
      `INSERT INTO users (id, username, passwordHash, displayName, systemRole)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, `pg-test-${suffix}`, 'hash', 'PG Test', 'editor'],
    )

    const row = await db.get<{ displayName: string; systemRole: string }>(
      'SELECT displayName, systemRole FROM users WHERE id = ?',
      [userId],
    )
    expect(row).toEqual({ displayName: 'PG Test', systemRole: 'editor' })
  })

  it('rolls back failed transactions', async () => {
    await expect(db.transaction(async tx => {
      await tx.run('INSERT INTO systemFlags (key, value) VALUES (?, ?)', [flagKey, 'pending'])
      throw new Error('rollback')
    })).rejects.toThrow('rollback')

    expect(await db.get('SELECT value FROM systemFlags WHERE key = ?', [flagKey])).toBeUndefined()
  })

  it('returns COUNT values as numbers', async () => {
    const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM users')
    expect(typeof row?.count).toBe('number')
  })

  it('records migrations once on PostgreSQL', async () => {
    const migrations = [{ id: migrationId, up: async () => {} }]
    expect(await pnwRunMigrations(db, migrations)).toEqual([migrationId])
    expect(await pnwRunMigrations(db, migrations)).toEqual([])
  })
})
