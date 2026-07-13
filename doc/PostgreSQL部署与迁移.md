# PostgreSQL 部署与 SQLite 数据迁移

## 1. 运行模式

服务启动时只选择一种数据库，不双写，也不会在 PostgreSQL 连接失败时回退 SQLite。

```dotenv
# SQLite（默认）
DB_DRIVER=sqlite
DB_PATH=/var/lib/phoenix-open-issue/open-issue.sqlite

# PostgreSQL
DB_DRIVER=postgres
DATABASE_URL=postgresql://openissue:change-me@127.0.0.1:5432/openissue
DB_POOL_MAX=10
DB_SSL=false
```

正式环境必须设置独立的 `JWT_SECRET`。远程数据库建议启用 TLS；`DB_SSL=true` 使用证书校验，数据库证书链必须受系统信任。

## 2. PostgreSQL 初始化

1. 创建独立数据库和最小权限账号。
2. 复制 PG 模板：`cp packages/server/.env.postgres.example packages/server/.env`，再填写 `JWT_SECRET` 和 `DATABASE_URL`。
3. 服务自动创建 Schema、索引、admin 和基础字典。
4. 日志出现 `Database: PostgreSQL` 后访问 `/health`。

不要对 PG 手工执行 SQLite 的 `schema.ts` 或 `migrations.ts`，它们只用于既有 SQLite 文件升级。

## 3. SQLite → PostgreSQL

推荐在停机窗口迁移，避免导出后仍有用户写入。

1. 备份原始 SQLite 文件及其 `-wal`、`-shm` 文件。
2. 在 SQLite 模式进入“设置 → 数据库”，导出 JSON。
3. 启动一个全新的 PostgreSQL 数据库。
4. 使用管理员账号导入 JSON，选择 `replace`。
5. 执行“数据库修正 → 全部”。
6. 核对用户、组织、列表、Issue、点检、推送、字典和功能数量。

JSON 不包含 `passwordHash`。导入的用户密码会临时设为 `123456`，上线前必须由管理员逐一重置，并通知用户首次登录修改密码。

`replace` 会清空目标数据库内对应业务表，只能对新建或已确认可覆盖的 PG 数据库使用。日常合并使用 `merge`，主键或唯一键冲突的行会跳过。

## 4. 迁移校验

至少核对：

- `users`、`orgUnits`、`issueLists`、`issues` 总数。
- 每个列表的成员数和 Issue 数。
- `checkpoints`、`pushRecords`、`issueListLinks` 总数。
- 管理员登录、列表权限、Issue 编辑、推送审批和备份导出。

发布前运行：

```bash
pnpm test
TEST_POSTGRES_URL=postgresql://127.0.0.1:5432/openissue_test pnpm test:pg
pnpm build
```

`TEST_POSTGRES_URL` 必须指向专用测试数据库。集成测试只创建并清理带 `pg-test-` 前缀的数据。

## 5. 回滚

迁移后先保留原 SQLite 文件，不要覆盖或删除。

回滚时停止服务，将环境变量恢复为 `DB_DRIVER=sqlite` 和原 `DB_PATH`，再启动并执行登录及列表检查。PG 数据保留用于问题分析，不要在未确认差异前反向覆盖 SQLite。

## 6. 运维

- PostgreSQL 使用连接池，默认上限 10；根据实例连接上限调整 `DB_POOL_MAX`。
- `SIGTERM`/`SIGINT` 会先停止 HTTP 服务，再关闭数据库连接池。
- 数据库 URL 不会写入启动日志。
- 数据库备份仍应使用 PostgreSQL 原生定时备份；应用 JSON 用于迁移和人工恢复，不替代 PITR。
