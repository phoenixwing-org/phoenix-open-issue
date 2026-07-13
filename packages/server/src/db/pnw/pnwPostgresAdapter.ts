import { Pool, types as pgTypes, type PoolClient, type PoolConfig } from 'pg'
import type { PnwDbAdapter, PnwDbExecutor, PnwDbParams, PnwDbRunResult, PnwPostgresDbConfig } from './pnwDbTypes.js'
import { pnwCompilePostgresParams } from './pnwSqlParams.js'

type PnwPgQueryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>

pgTypes.setTypeParser(pgTypes.builtins.INT8, value => Number(value))

export class PnwPostgresAdapter implements PnwDbAdapter {
  readonly dialect = 'postgres' as const
  private readonly pool: Pool

  constructor(config: PnwPostgresDbConfig | PoolConfig) {
    this.pool = new Pool(toPoolConfig(config))
  }

  get<T = Record<string, unknown>>(sql: string, params: PnwDbParams = []): Promise<T | undefined> {
    return queryOne<T>(this.pool, sql, params)
  }

  all<T = Record<string, unknown>>(sql: string, params: PnwDbParams = []): Promise<T[]> {
    return queryAll<T>(this.pool, sql, params)
  }

  run(sql: string, params: PnwDbParams = []): Promise<PnwDbRunResult> {
    return runQuery(this.pool, sql, params)
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(pnwCompilePostgresParams(sql).text)
  }

  async transaction<T>(fn: (tx: PnwDbExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(executorFor(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async tableExists(table: string): Promise<boolean> {
    const row = await this.get(
      `SELECT 1 AS "found" FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = ? LIMIT 1`,
      [table],
    )
    return !!row
  }

  async columnNames(table: string): Promise<Set<string>> {
    const rows = await this.all<{ columnName: string }>(
      `SELECT column_name AS "columnName" FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = ?`,
      [table],
    )
    return new Set(rows.map(row => row.columnName))
  }

  async indexExists(index: string): Promise<boolean> {
    const row = await this.get(
      `SELECT 1 AS "found" FROM pg_indexes
       WHERE schemaname = current_schema() AND indexname = ? LIMIT 1`,
      [index],
    )
    return !!row
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

function executorFor(queryable: PnwPgQueryable): PnwDbExecutor {
  return {
    get: <T>(sql: string, params: PnwDbParams = []) => queryOne<T>(queryable, sql, params),
    all: <T>(sql: string, params: PnwDbParams = []) => queryAll<T>(queryable, sql, params),
    run: (sql: string, params: PnwDbParams = []) => runQuery(queryable, sql, params),
    exec: async (sql: string) => { await queryable.query(pnwCompilePostgresParams(sql).text) },
  }
}

async function queryOne<T>(queryable: PnwPgQueryable, sql: string, params: PnwDbParams): Promise<T | undefined> {
  const result = await execute<T>(queryable, sql, params)
  return result.rows[0]
}

async function queryAll<T>(queryable: PnwPgQueryable, sql: string, params: PnwDbParams): Promise<T[]> {
  return (await execute<T>(queryable, sql, params)).rows
}

async function runQuery(queryable: PnwPgQueryable, sql: string, params: PnwDbParams): Promise<PnwDbRunResult> {
  const result = await execute(queryable, sql, params)
  return { changes: result.rowCount ?? 0 }
}

async function execute<T>(
  queryable: PnwPgQueryable,
  sql: string,
  params: PnwDbParams,
): Promise<{ rows: T[]; rowCount: number | null }> {
  const compiled = pnwCompilePostgresParams(sql)
  if (compiled.parameterCount !== params.length) {
    throw new Error(`SQL 参数数量不匹配：需要 ${compiled.parameterCount}，收到 ${params.length}`)
  }
  const result = await queryable.query(compiled.text, [...params])
  return { rows: result.rows as T[], rowCount: result.rowCount }
}

function toPoolConfig(config: PnwPostgresDbConfig | PoolConfig): PoolConfig {
  if ('driver' in config) {
    return {
      connectionString: config.connectionString,
      max: config.poolMax ?? 10,
      ssl: config.ssl ? { rejectUnauthorized: true } : false,
    }
  }
  return config
}
