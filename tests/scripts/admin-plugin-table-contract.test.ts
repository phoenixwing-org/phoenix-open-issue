import { describe, expect, it } from 'vitest'
import {
  extractCreatedTables,
  validatePluginTableContract,
} from '../../scripts/lib/admin-plugin-table-contract.mjs'

describe('Admin plugin owned-table contract', () => {
  it('extracts quoted, unquoted and schema-qualified CREATE TABLE definitions only', () => {
    expect(extractCreatedTables(`
      CREATE TABLE IF NOT EXISTS oip_issue (id text);
      CREATE TABLE "oip_repair_ledger" (id text);
      CREATE TABLE public.oip_outside_schema (id text);
      CREATE INDEX ON oip_issue (id);
      ALTER TABLE oip_issue ADD COLUMN title text;
    `)).toEqual([
      { schema: null, table: 'oip_issue' },
      { schema: null, table: 'oip_repair_ledger' },
      { schema: 'public', table: 'oip_outside_schema' },
    ])
  })

  it('accepts one closed manifest, Entity and migration table set', () => {
    expect(validatePluginTableContract({
      ownedTables: ['oip_issue', 'oip_repair_ledger'],
      entityTables: ['oip_issue', 'oip_repair_ledger'],
      migrationTables: [
        { schema: null, table: 'oip_issue' },
        { schema: null, table: 'oip_repair_ledger' },
      ],
    })).toEqual([])
  })

  it('fails closed for unowned, missing, schema-qualified and non-plugin tables', () => {
    expect(validatePluginTableContract({
      ownedTables: ['oip_issue', 'oip_declared_only'],
      entityTables: ['oip_issue', 'oip_entity_only'],
      migrationTables: [
        { schema: null, table: 'oip_issue' },
        { schema: null, table: 'oip_migration_only' },
        { schema: 'public', table: 'oip_schema_table' },
        { schema: null, table: 'host_table' },
      ],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('oip_entity_only'),
      expect.stringContaining('oip_migration_only'),
      expect.stringContaining('oip_declared_only'),
      expect.stringContaining('public.oip_schema_table'),
      expect.stringContaining('host_table'),
    ]))
  })
})
