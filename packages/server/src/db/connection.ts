import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { config } from '../config.js'
import { runSchema } from './schema.js'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(config.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    db = new Database(config.dbPath)

    // 性能设置
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = OFF')

    // 建表
    runSchema(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
