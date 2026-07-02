// 禁止使用 better-sqlite3（需要 C++ 编译），统一通过适配层使用 node-sqlite3-wasm
import { createDb } from './adapter.js'
import type { DbAdapter } from './adapter.js'
import { config } from '../config.js'
import { runSchema } from './schema.js'

let db: DbAdapter

export function getDb(): DbAdapter {
  if (!db) {
    db = createDb(config.dbPath)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = OFF')
    runSchema(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
