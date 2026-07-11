import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { Database } = require('node-sqlite3-wasm') as {
  Database: new (dbPath: string) => {
    get(sql: string, params?: unknown): unknown
    all(sql: string, params?: unknown): unknown[]
    run(sql: string, params?: unknown): { changes: number }
    exec(sql: string): void
    readonly inTransaction: boolean
    close(): void
  }
}

export interface PnwDbAdapter {
  get<T = Record<string, unknown>>(sql: string, params?: unknown): T | undefined
  all<T = Record<string, unknown>>(sql: string, params?: unknown): T[]
  run(sql: string, params?: unknown): { changes: number }
  exec(sql: string): void
  readonly inTransaction: boolean
  close(): void
}

class SqliteWasmAdapter implements PnwDbAdapter {
  private readonly db: InstanceType<typeof Database>

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
  }

  get<T = Record<string, unknown>>(sql: string, params?: unknown): T | undefined {
    const result = this.db.get(sql, params)
    return result == null ? undefined : result as T
  }

  all<T = Record<string, unknown>>(sql: string, params?: unknown): T[] {
    return this.db.all(sql, params) as T[]
  }

  run(sql: string, params?: unknown): { changes: number } {
    return this.db.run(sql, params)
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  get inTransaction(): boolean {
    return this.db.inTransaction
  }

  close(): void {
    this.db.close()
  }
}

export function pnwCreateDb(dbPath: string): PnwDbAdapter {
  return new SqliteWasmAdapter(dbPath)
}
