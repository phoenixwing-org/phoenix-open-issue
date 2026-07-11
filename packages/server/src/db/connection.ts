// 禁止使用 better-sqlite3（需要 C++ 编译），统一通过适配层使用 node-sqlite3-wasm
import { pnwCreateDb, type PnwDbAdapter } from './pnwDbAdapter.js'
import { config } from '../config.js'
import { runSchema } from './schema.js'
import { seedEssential } from '../seed.js'
import fs from 'fs'
import path from 'path'

let db: PnwDbAdapter

function cleanStaleLock(dbPath: string): void {
  const lockPath = dbPath + '.lock'
  try {
    if (fs.existsSync(lockPath)) {
      fs.rmSync(lockPath, { recursive: true, force: true })
      console.log('🧹 清理残留锁文件:', lockPath)
    }
  } catch {}
}

export function getDb(): PnwDbAdapter {
  if (!db) {
    cleanStaleLock(config.dbPath)
    db = pnwCreateDb(config.dbPath)

    // 设置忙等待超时：遇到锁时等待最多 5 秒，而非立即报错
    // SQLite 在 WAL 模式下允许多读一写，busy_timeout 避免并发写入时"database is locked"
    db.exec('PRAGMA busy_timeout = 5000')

    // 同步模式 FULL：每次写入确保数据落盘，崩溃不丢数据
    db.exec('PRAGMA synchronous = FULL')

    // WAL 模式：读不阻塞写，写不阻塞读，适合 10-50 人并发
    try {
      db.exec('PRAGMA journal_mode = WAL')
    } catch {
      // 如果 WAL 文件损坏（上次崩溃遗留），清理后重试
      const dir = path.dirname(config.dbPath)
      const base = path.basename(config.dbPath)
      const wal = path.join(dir, base + '-wal')
      const shm = path.join(dir, base + '-shm')
      try { if (fs.existsSync(wal)) fs.unlinkSync(wal) } catch {}
      try { if (fs.existsSync(shm)) fs.unlinkSync(shm) } catch {}
      db.exec('PRAGMA journal_mode = WAL')
    }

    db.exec('PRAGMA foreign_keys = OFF')
    runSchema(db)
    // 首次初始化：自动创建 admin + 字典
    seedEssential()
  }
  return db
}

export function closeDb(): void {
  if (db) {
    // 关闭前执行 WAL checkpoint，确保数据写入主文件
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch {}
    try { db.close() } catch {}
  }
}
