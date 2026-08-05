# PostgreSQL 正式路径与 legacy SQLite 边界

状态：transitional；待旧库归档与导入演练完成后删除。

- 新功能、测试和正式部署只使用 PostgreSQL；不得新增 legacy embedded DB 依赖、adapter、schema、migration 或 fixture。
- 未配置 `DATABASE_URL` 时必须拒绝启动，禁止创建本地数据库或静默回退。
- `better-sqlite3`、`@types/better-sqlite3` 和其他新 embedded DB 驱动一律禁止引入。
- 既有 `node-sqlite3-wasm` 只服务已登记 legacy 旧库的归档/导入；必须显式设置 `DB_DRIVER=sqlite` 与 `ALLOW_LEGACY_SQLITE=true`，不得用于新开发或生产。
- 不要扩展 `packages/server/src/db/pnw/pnwSqliteAdapter.ts` 或同步 `db/connection.ts`；有价值的领域语义先迁到纯算法/PostgreSQL 测试，再删除兼容实现。
- 真实旧库、校验和、owner、保留期和旧库→PostgreSQL 对账未冻结前，不得删除唯一恢复入口。
