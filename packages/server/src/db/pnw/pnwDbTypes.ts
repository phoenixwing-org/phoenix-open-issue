export type PnwDbDialect = 'sqlite' | 'postgres'
export type PnwDbParams = readonly unknown[]

export interface PnwDbRunResult {
  changes: number
}

export interface PnwDbExecutor {
  get<T = Record<string, unknown>>(sql: string, params?: PnwDbParams): Promise<T | undefined>
  all<T = Record<string, unknown>>(sql: string, params?: PnwDbParams): Promise<T[]>
  run(sql: string, params?: PnwDbParams): Promise<PnwDbRunResult>
  exec(sql: string): Promise<void>
}

export interface PnwDbAdapter extends PnwDbExecutor {
  readonly dialect: PnwDbDialect
  transaction<T>(fn: (tx: PnwDbExecutor) => Promise<T>): Promise<T>
  tableExists(table: string): Promise<boolean>
  columnNames(table: string): Promise<Set<string>>
  indexExists(index: string): Promise<boolean>
  close(): Promise<void>
}

export interface PnwSqliteDbConfig {
  driver: 'sqlite'
  path: string
}

export interface PnwPostgresDbConfig {
  driver: 'postgres'
  connectionString: string
  poolMax?: number
  ssl?: boolean
}

export type PnwDbConfig = PnwSqliteDbConfig | PnwPostgresDbConfig
