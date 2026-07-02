// DB 适配层 —— 抽象 SQL 操作，隔离具体实现
// 当前实现：node-sqlite3-wasm（纯 WASM，无需 C++ 编译）
// 切换实现只需改本文件 + connection.ts
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
const { Database } = require('node-sqlite3-wasm')

// ── 接口 ──
export interface DbAdapter {
  get<T = Record<string, unknown>>(sql: string, params?: unknown): T | undefined
  all<T = Record<string, unknown>>(sql: string, params?: unknown): T[]
  run(sql: string, params?: unknown): { changes: number }
  exec(sql: string): void
  readonly inTransaction: boolean
  close(): void
}

// ── node-sqlite3-wasm 实现 ──
class SqliteWasmAdapter implements DbAdapter {
  private db: InstanceType<typeof Database>

  constructor(dbPath: string) {
    // 确保目录存在
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(dbPath)
  }

  get<T = Record<string, unknown>>(sql: string, params?: unknown): T | undefined {
    return this.db.get(sql, params) as unknown as T | undefined
  }

  all<T = Record<string, unknown>>(sql: string, params?: unknown): T[] {
    return this.db.all(sql, params) as unknown as T[]
  }

  run(sql: string, params?: unknown): { changes: number } {
    return this.db.run(sql, params) as { changes: number }
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

// ── 工厂 ──
export function createDb(dbPath: string): DbAdapter {
  return new SqliteWasmAdapter(dbPath)
}
