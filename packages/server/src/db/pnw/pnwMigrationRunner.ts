import type { PnwDbAdapter, PnwDbExecutor } from './pnwDbTypes.js'

export interface PnwMigration {
  id: string
  up: (db: PnwDbExecutor) => Promise<void>
}

export const OPEN_ISSUE_MIGRATIONS: readonly PnwMigration[] = [
  {
    id: '20260711-dual-db-baseline',
    up: async () => {},
  },
]

export async function pnwRunMigrations(
  db: PnwDbAdapter,
  migrations: readonly PnwMigration[] = OPEN_ISSUE_MIGRATIONS,
): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schemaMigrations (
      id TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    )
  `)
  const applied: string[] = []
  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    const existing = await db.get('SELECT id FROM schemaMigrations WHERE id = ?', [migration.id])
    if (existing) continue
    await db.transaction(async tx => {
      await migration.up(tx)
      await tx.run(
        'INSERT INTO schemaMigrations (id, appliedAt) VALUES (?, ?)',
        [migration.id, new Date().toISOString()],
      )
    })
    applied.push(migration.id)
  }
  return applied
}
