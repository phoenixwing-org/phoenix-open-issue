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
  const checkpointOwnerId = `pg-test-checkpoint-owner-${suffix}`
  const flagKey = `pg-test-flag-${suffix}`
  const migrationId = `pg-test-migration-${suffix}`
  const sourceListId = `pg-test-source-${suffix}`
  const linkedListId = `pg-test-linked-${suffix}`
  const issueId = `pg-test-issue-${suffix}`
  const externalIdentityId = `pg-test-external-identity-${suffix}`
  const checkpointId = `pg-test-checkpoint-${suffix}`
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
    await db.run('DELETE FROM externalIdentities WHERE id = ?', [externalIdentityId])
    await db.run('DELETE FROM checkpoints WHERE id = ?', [checkpointId])
    await db.run('DELETE FROM issueListLinks WHERE issueId = ?', [issueId])
    await db.run('DELETE FROM issues WHERE id = ?', [issueId])
    await db.run('DELETE FROM issueLists WHERE id IN (?, ?)', [sourceListId, linkedListId])
    await db.run('DELETE FROM users WHERE id = ?', [checkpointOwnerId])
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

    await db.run(
      `INSERT INTO externalIdentities
       (id, userId, provider, providerSubject, tenantKey, openId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [externalIdentityId, userId, 'feishu', `tenant-${suffix}:open-${suffix}`, `tenant-${suffix}`, `open-${suffix}`],
    )
    expect(await db.get<{ tenantKey: string }>(
      'SELECT tenantKey FROM externalIdentities WHERE id = ?',
      [externalIdentityId],
    )).toEqual({ tenantKey: `tenant-${suffix}` })
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

  it('returns checkpoints for an Issue linked into the queried list', async () => {
    await db.run('INSERT INTO users (id, username, passwordHash) VALUES (?, ?, ?)', [checkpointOwnerId, `pg-owner-${suffix}`, 'hash'])
    await db.run(
      'INSERT INTO issueLists (id, name, listType, ownerId) VALUES (?, ?, ?, ?)',
      [sourceListId, 'Source', 'custom', checkpointOwnerId],
    )
    await db.run(
      'INSERT INTO issueLists (id, name, listType, ownerId) VALUES (?, ?, ?, ?)',
      [linkedListId, 'Linked', 'custom', checkpointOwnerId],
    )
    await db.run(
      'INSERT INTO issues (id, listId, title, createdBy) VALUES (?, ?, ?, ?)',
      [issueId, sourceListId, 'Linked issue', checkpointOwnerId],
    )
    await db.run(
      'INSERT INTO issueListLinks (id, issueId, listId, linkedBy) VALUES (?, ?, ?, ?)',
      [`pg-test-link-${suffix}`, issueId, linkedListId, checkpointOwnerId],
    )
    await db.run(
      'INSERT INTO issueListLinks (id, issueId, listId, linkedBy) VALUES (?, ?, ?, ?)',
      [`pg-test-origin-link-${suffix}`, issueId, sourceListId, checkpointOwnerId],
    )
    expect(await db.get<{ extensions: Record<string, unknown>; listCount: number }>(
      'SELECT extensions, listCount FROM issues WHERE id = ?',
      [issueId],
    )).toEqual({ extensions: {}, listCount: 2 })
    await db.run(
      'INSERT INTO checkpoints (id, issueId, checkpointDate, description) VALUES (?, ?, ?, ?)',
      [checkpointId, issueId, '2026-07-13', 'Visible in linked list'],
    )
    await db.run("UPDATE checkpoints SET status = 'voided' WHERE id = ?", [checkpointId])
    expect(await db.get<{ status: string }>('SELECT status FROM checkpoints WHERE id = ?', [checkpointId]))
      .toEqual({ status: 'voided' })

    const checkpoints = await db.all<{ id: string }>(`
      SELECT DISTINCT c.* FROM checkpoints c
      JOIN issues i ON i.id = c.issueId
      JOIN issueListLinks il ON il.issueId = i.id
      WHERE il.listId = ?
    `, [linkedListId])
    expect(checkpoints.map(row => row.id)).toContain(checkpointId)

    const issue = await db.get<{ originListName: string }>(`
      SELECT origin.name AS "originListName"
      FROM issues i
      JOIN issueLists origin ON i.listId = origin.id
      WHERE i.id = ?
    `, [issueId])
    expect(issue?.originListName).toBe('Source')
  })
})
