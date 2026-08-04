import { describe, expect, it, vi } from 'vitest'
import { pnwRunSchema } from '../../packages/server/src/db/pnw/pnwSchema.js'
import { RecordingPostgresAdapter } from './support/recording-postgres-adapter.js'

describe('pnwRunSchema', () => {
  it('rejects the legacy adapter before executing formal schema DDL', async () => {
    const exec = vi.fn()
    const db = { dialect: 'sqlite', exec } as any

    await expect(pnwRunSchema(db)).rejects.toThrow('PostgreSQL')
    expect(exec).not.toHaveBeenCalled()
  })

  it('生成完整 PostgreSQL schema，且重复运行保持幂等 DDL 契约', async () => {
    const db = new RecordingPostgresAdapter()
    await pnwRunSchema(db)
    await pnwRunSchema(db)

    const sql = db.statements.join('\n')
    expect(db.statements).toHaveLength(6)
    expect(await db.tableExists('schemaMigrations')).toBe(true)
    expect(sql).toContain('"approved" INTEGER NOT NULL DEFAULT 0')
    expect(sql).toContain('"disabled" INTEGER NOT NULL DEFAULT 0')
    expect(sql).toContain('"systemRole" TEXT NOT NULL DEFAULT')
    expect(sql).toContain('"tokenVersion" INTEGER NOT NULL DEFAULT 0')
    expect(sql).toContain('"extensions" JSONB NOT NULL DEFAULT')
    expect(sql).toContain('"listCount" INTEGER NOT NULL DEFAULT 0')
    expect(await db.indexExists('idx_dict_group_value')).toBe(true)
    expect(await db.tableExists('externalIdentities')).toBe(true)
    expect(await db.tableExists('oauthLoginAttempts')).toBe(true)
    expect(await db.tableExists('oauthLoginTickets')).toBe(true)
    expect(await db.tableExists('externalBindRequests')).toBe(true)
    expect(sql).toContain('"returnTo" TEXT NOT NULL')
    expect(await db.indexExists('idx_external_identities_provider_subject')).toBe(true)
    expect(sql).toContain('CREATE OR REPLACE FUNCTION "pnwSyncIssueListCount"')
    expect(sql).toContain('DROP TRIGGER IF EXISTS "trgIssueListLinksCount"')
  })

  it('为 camelCase 表和字段生成引用标识符', async () => {
    const db = new RecordingPostgresAdapter()
    await pnwRunSchema(db)
    const sql = db.statements.join('\n')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "issueListMembers"')
    expect(sql).toContain('"passwordHash" TEXT NOT NULL')
    expect(sql).toContain('"systemRole" TEXT NOT NULL')
    expect(sql).toContain('"providerSubject" TEXT NOT NULL')
  })
})
