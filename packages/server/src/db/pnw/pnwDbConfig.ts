import type { PnwDbConfig } from './pnwDbTypes.js'

export function pnwResolveDbConfig(
  env: NodeJS.ProcessEnv,
  defaultSqlitePath: string,
): PnwDbConfig {
  const driver = (env.DB_DRIVER || 'sqlite').trim().toLowerCase()

  if (driver === 'sqlite') {
    const dbPath = (env.DB_PATH || defaultSqlitePath).trim()
    if (!dbPath) throw new Error('SQLite 模式需要 DB_PATH')
    return { driver: 'sqlite', path: dbPath }
  }

  if (driver === 'postgres' || driver === 'pg') {
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
