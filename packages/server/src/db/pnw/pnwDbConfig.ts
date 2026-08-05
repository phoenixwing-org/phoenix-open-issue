import path from 'node:path'
import type { PnwDbConfig } from './pnwDbTypes.js'

export function pnwResolveDbConfig(env: NodeJS.ProcessEnv): PnwDbConfig {
  const driver = (env.DB_DRIVER || 'postgres').trim().toLowerCase()

  if (driver === 'sqlite') {
    if ((env.NODE_ENV || '').trim().toLowerCase() === 'production') {
      throw new Error('生产运行时禁止 SQLite；legacy 导入演练必须在隔离的非生产环境操作副本')
    }
    if (!parseBoolean(env.ALLOW_LEGACY_SQLITE, false, 'ALLOW_LEGACY_SQLITE')) {
      throw new Error('SQLite 仅用于 legacy 恢复；必须显式设置 ALLOW_LEGACY_SQLITE=true')
    }
    if (env.DATABASE_URL?.trim()) {
      throw new Error('SQLite legacy 模式不能同时设置 DATABASE_URL')
    }
    const dbPath = env.DB_PATH?.trim()
    if (!dbPath) throw new Error('SQLite legacy 模式需要显式 DB_PATH，且只能指向已登记归档的工作副本')
    if (!path.isAbsolute(dbPath)) throw new Error('SQLite legacy 模式的 DB_PATH 必须是绝对路径')
    return { driver: 'sqlite', path: path.normalize(dbPath) }
  }

  if (driver === 'postgres' || driver === 'pg') {
    if (env.DB_PATH?.trim()) {
      throw new Error('PostgreSQL 模式不能设置 DB_PATH')
    }
    const connectionString = env.DATABASE_URL?.trim()
    if (!connectionString) throw new Error('PostgreSQL 模式需要 DATABASE_URL')

    const poolMax = parsePositiveInteger(env.DB_POOL_MAX, 10, 'DB_POOL_MAX')
    const ssl = parseBoolean(env.DB_SSL, false, 'DB_SSL')
    return { driver: 'postgres', connectionString, poolMax, ssl }
  }

  throw new Error(`不支持的 DB_DRIVER：${driver}`)
}

function parsePositiveInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw == null || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} 必须是正整数`)
  return value
}

function parseBoolean(raw: string | undefined, fallback: boolean, name: string): boolean {
  if (raw == null || raw.trim() === '') return fallback
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  throw new Error(`${name} 必须是 true/false 或 1/0`)
}
