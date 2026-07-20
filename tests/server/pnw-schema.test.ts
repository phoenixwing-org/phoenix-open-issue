import { afterEach, describe, expect, it } from 'vitest'
import { PnwSqliteAdapter } from '../../packages/server/src/db/pnw/pnwSqliteAdapter.js'
import { pnwRunSchema } from '../../packages/server/src/db/pnw/pnwSchema.js'

describe('pnwRunSchema', () => {
  let db: PnwSqliteAdapter | undefined

  afterEach(async () => {
    await db?.close()
  })

  it('creates the complete fresh schema and can run repeatedly', async () => {
    db = new PnwSqliteAdapter(':memory:')
    await pnwRunSchema(db)
    await pnwRunSchema(db)

    expect(await db.tableExists('schemaMigrations')).toBe(true)
    expect(await db.columnNames('users')).toEqual(expect.objectContaining(new Set([
      'approved', 'disabled', 'systemRole', 'tokenVersion',
    ])))
    expect(await db.columnNames('issues')).toContain('functionId')
    expect(await db.indexExists('idx_dict_group_value')).toBe(true)
    expect(await db.tableExists('externalIdentities')).toBe(true)
    expect(await db.tableExists('oauthLoginAttempts')).toBe(true)
    expect(await db.tableExists('oauthLoginTickets')).toBe(true)
    expect(await db.tableExists('externalBindRequests')).toBe(true)
    expect(await db.columnNames('oauthLoginTickets')).toContain('returnTo')
    expect(await db.indexExists('idx_external_identities_provider_subject')).toBe(true)
  })

  it('uses quoted camelCase identifiers in generated tables', async () => {
    db = new PnwSqliteAdapter(':memory:')
    await pnwRunSchema(db)
    await db.run(
      'INSERT INTO "users" ("id", "username", "passwordHash", "systemRole") VALUES (?, ?, ?, ?)',
      ['u1', 'admin', 'hash', 'admin'],
    )

    const row = await db.get<{ systemRole: string }>(
      'SELECT "systemRole" FROM "users" WHERE "id" = ?',
      ['u1'],
    )
    expect(row?.systemRole).toBe('admin')
  })
})
