import type {
  PnwDbAdapter,
  PnwDbExecutor,
  PnwDbParams,
  PnwDbRunResult,
} from '../../../packages/server/src/db/pnw/pnwDbTypes.js'

interface AdapterState {
  appliedMigrations: Set<string>
  events: string[]
  tables: Set<string>
  indexes: Set<string>
}

/**
 * PostgreSQL contract double for schema/migration unit tests.
 *
 * It intentionally implements only the stable metadata and ledger operations
 * used by the runners; SQL validity remains covered by the opt-in real PG suite.
 */
export class RecordingPostgresAdapter implements PnwDbAdapter {
  readonly dialect = 'postgres' as const
  readonly statements: string[] = []
  private state: AdapterState = freshState()

  async get<T = Record<string, unknown>>(sql: string, params: PnwDbParams = []): Promise<T | undefined> {
    if (/FROM\s+schemaMigrations/i.test(sql)) {
      const id = String(params[0] ?? '')
      return (this.state.appliedMigrations.has(id) ? { id } : undefined) as T | undefined
    }
    return undefined
  }

  async all<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (/FROM\s+events/i.test(sql)) {
      return this.state.events.map(id => ({ id })) as T[]
    }
    return []
  }

  async run(sql: string, params: PnwDbParams = []): Promise<PnwDbRunResult> {
    this.statements.push(sql)
    if (/INSERT\s+INTO\s+schemaMigrations/i.test(sql)) {
      this.state.appliedMigrations.add(String(params[0]))
    } else if (/INSERT\s+INTO\s+events/i.test(sql)) {
      this.state.events.push(String(params[0]))
    }
    return { changes: 1 }
  }

  async exec(sql: string): Promise<void> {
    this.statements.push(sql)
    for (const match of sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+["']?([A-Za-z0-9_]+)["']?/gi)) {
      this.state.tables.add(match[1])
    }
    for (const match of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+["']?([A-Za-z0-9_]+)["']?/gi)) {
      this.state.indexes.add(match[1])
    }
  }

  async transaction<T>(fn: (tx: PnwDbExecutor) => Promise<T>): Promise<T> {
    const before = cloneState(this.state)
    try {
      return await fn(this)
    } catch (error) {
      this.state = before
      throw error
    }
  }

  async tableExists(table: string): Promise<boolean> {
    return this.state.tables.has(table)
  }

  async columnNames(): Promise<Set<string>> {
    return new Set()
  }

  async indexExists(index: string): Promise<boolean> {
    return this.state.indexes.has(index)
  }

  async close(): Promise<void> {}
}

function freshState(): AdapterState {
  return {
    appliedMigrations: new Set(),
    events: [],
    tables: new Set(),
    indexes: new Set(),
  }
}

function cloneState(state: AdapterState): AdapterState {
  return {
    appliedMigrations: new Set(state.appliedMigrations),
    events: [...state.events],
    tables: new Set(state.tables),
    indexes: new Set(state.indexes),
  }
}
