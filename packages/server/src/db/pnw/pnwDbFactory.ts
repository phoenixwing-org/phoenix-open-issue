import type { PnwDbAdapter, PnwDbConfig } from './pnwDbTypes.js'
import { PnwPostgresAdapter } from './pnwPostgresAdapter.js'
import { PnwSqliteAdapter } from './pnwSqliteAdapter.js'

export function pnwCreateAsyncDb(config: PnwDbConfig): PnwDbAdapter {
  if (config.driver === 'sqlite') return new PnwSqliteAdapter(config.path)
  return new PnwPostgresAdapter(config)
}
