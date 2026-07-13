import { pnwCreateDb, type PnwDbAdapter as PnwSyncDbAdapter } from '../pnwDbAdapter.js'
import type { PnwDbAdapter, PnwDbExecutor, PnwDbParams, PnwDbRunResult } from './pnwDbTypes.js'

export class PnwSqliteAdapter implements PnwDbAdapter {
  readonly dialect = 'sqlite' as const
  private readonly sync: PnwSyncDbAdapter
  private readonly ownsConnection: boolean
  private queue: Promise<void> = Promise.resolve()

  constructor(dbPath: string)
  constructor(db: PnwSyncDbAdapter)
  constructor(source: string | PnwSyncDbAdapter) {
    this.ownsConnection = typeof source === 'string'
    this.sync = typeof source === 'string' ? pnwCreateDb(source) : source
  }

  get<T = Record<string, unknown>>(sql: string, params: PnwDbParams = []): Promise<T | undefined> {
    return this.serial(() => this.sync.get<T>(sql, params))
  }

  all<T = Record<string, unknown>>(sql: string, params: PnwDbParams = []): Promise<T[]> {
    return this.serial(() => this.sync.all<T>(sql, params))
  }

  run(sql: string, params: PnwDbParams = []): Promise<PnwDbRunResult> {
    return this.serial(() => this.sync.run(sql, params))
  }

  exec(sql: string): Promise<void> {
    return this.serial(() => this.sync.exec(sql))
  }

  transaction<T>(fn: (tx: PnwDbExecutor) => Promise<T>): Promise<T> {
    return this.serial(async () => {
      this.sync.exec('BEGIN TRANSACTION')
      const tx = this.directExecutor()
      try {
        const result = await fn(tx)
        this.sync.exec('COMMIT')
        return result
      } catch (error) {
        if (this.sync.inTransaction) this.sync.exec('ROLLBACK')
        throw error
      }
    })
  }

  tableExists(table: string): Promise<boolean> {
    return this.serial(() => !!this.sync.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table],
    ))
  }

  columnNames(table: string): Promise<Set<string>> {
    return this.serial(() => {
      const safe = table.replaceAll('"', '""')
      const rows = this.sync.all<{ name: string }>(`PRAGMA table_info("${safe}")`)
      return new Set(rows.map(row => row.name))
    })
  }

  indexExists(index: string): Promise<boolean> {
    return this.serial(() => !!this.sync.get(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
      [index],
    ))
  }

  close(): Promise<void> {
    return this.serial(() => {
      if (this.ownsConnection) this.sync.close()
    })
  }

  private directExecutor(): PnwDbExecutor {
    return {
      get: async <T>(sql: string, params: PnwDbParams = []) => this.sync.get<T>(sql, params),
      all: async <T>(sql: string, params: PnwDbParams = []) => this.sync.all<T>(sql, params),
      run: async (sql: string, params: PnwDbParams = []) => this.sync.run(sql, params),
      exec: async (sql: string) => this.sync.exec(sql),
    }
  }

  private serial<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}
