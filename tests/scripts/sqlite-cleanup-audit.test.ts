import { describe, expect, it } from 'vitest'
import {
  classifySqliteEvidence,
  findSqliteBaselineRegressions,
  findSqliteEvidence,
} from '../../scripts/audit-sqlite-cleanup.mjs'

describe('SQLite cleanup source audit', () => {
  it('separates production, current docs, historical docs and importer tools', () => {
    const currentDocs = new Set(['README.md'])
    expect(classifySqliteEvidence('packages/server/src/db/connection.ts', currentDocs)).toBe('production')
    expect(classifySqliteEvidence('README.md', currentDocs)).toBe('currentDocs')
    expect(classifySqliteEvidence('docs/legacy.md', currentDocs)).toBe('historicalOrDraftDocs')
    expect(classifySqliteEvidence('scripts/import-legacy.ts', currentDocs)).toBe('testsToolsOrImporter')
  })

  it('finds driver, config and database-file evidence with line numbers', () => {
    const matches = findSqliteEvidence([
      "import 'node-sqlite3-wasm'",
      'DB_DRIVER=sqlite',
      'DB_PATH=data/open-issue.sqlite',
    ].join('\n'))
    expect(matches.map(match => match.line)).toEqual([1, 2, 3])
  })

  it('does not mistake generic PostgreSQL database text for SQLite evidence', () => {
    expect(findSqliteEvidence('DATABASE_URL=postgresql://localhost/openissue')).toEqual([])
  })

  it('allows cleanup below the temporary baseline and rejects new or increased evidence', () => {
    const baseline = {
      production: { 'packages/server/src/db/connection.ts': 2 },
      currentDocs: { 'README.md': 1 },
    }
    expect(findSqliteBaselineRegressions({
      production: [{ path: 'packages/server/src/db/connection.ts', matches: [{}] }],
      currentDocs: [],
    }, baseline)).toEqual([])

    expect(findSqliteBaselineRegressions({
      production: [
        { path: 'packages/server/src/db/connection.ts', matches: [{}, {}, {}] },
        { path: 'packages/server/src/db/new.ts', matches: [{}] },
      ],
      currentDocs: [{ path: 'README.md', matches: [{}, {}] }],
    }, baseline)).toEqual(expect.arrayContaining([
      expect.stringContaining('3 > 2'),
      expect.stringContaining('新增 SQLite 证据文件'),
      expect.stringContaining('2 > 1'),
    ]))
  })
})
