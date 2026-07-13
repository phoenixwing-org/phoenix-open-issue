import type { PnwDbAdapter, PnwDbDialect, PnwDbExecutor } from './pnwDbTypes.js'

export interface PnwMigration {
  id: string
  up: (db: PnwDbExecutor, dialect: PnwDbDialect) => Promise<void>
}

export const OPEN_ISSUE_MIGRATIONS: readonly PnwMigration[] = [
  {
    id: '20260711-dual-db-baseline',
    up: async () => {},
  },
  {
    id: '20260713-checkpoint-voided-status',
    up: async (db, dialect) => {
      if (dialect !== 'postgres') return
      await db.exec('ALTER TABLE "checkpoints" DROP CONSTRAINT IF EXISTS "checkpoints_status_check"')
      await db.exec(`ALTER TABLE "checkpoints"
        ADD CONSTRAINT "checkpoints_status_check"
        CHECK ("status" IN ('pending','done','skipped','voided'))`)
    },
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
      await migration.up(tx, db.dialect)
      await tx.run(
        'INSERT INTO schemaMigrations (id, appliedAt) VALUES (?, ?)',
        [migration.id, new Date().toISOString()],
      )
    })
    applied.push(migration.id)
  }
  return applied
}
