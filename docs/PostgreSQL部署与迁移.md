# PostgreSQL 部署与 SQLite 数据迁移

状态：draft / transitional

> PostgreSQL 是唯一正式目标。本文件只描述 legacy SQLite 的一次性导入草案，尚未取得真实旧库归档和双 PostgreSQL 演练证据，不是可直接执行的发布或回滚 runbook。执行门禁以 [SQLite 清理执行草案](admin-plugin-rectification/SQLite清理执行草案.md) 为准。

## 1. 运行模式

正式服务只允许 PostgreSQL，连接失败必须 fail closed，不双写，也不静默回退 legacy SQLite。当前源码中的 SQLite 分支仅是待门禁完成后移除的过渡兼容，不构成正式支持。

```dotenv
DB_DRIVER=postgres
DATABASE_URL=postgresql://openissue:change-me@127.0.0.1:5432/openissue
DB_POOL_MAX=10
DB_SSL=false
```

正式环境必须设置至少 32 位的独立 `JWT_SECRET` 和至少 12 位的 `INITIAL_ADMIN_PASSWORD`，示例占位值会导致启动失败。远程数据库建议启用 TLS；`DB_SSL=true` 使用证书校验，数据库证书链必须受系统信任。

## 2. PostgreSQL 初始化

1. 创建独立数据库和最小权限账号。
2. 复制 PG 模板：`cp packages/server/.env.postgres.example packages/server/.env`，再填写 `JWT_SECRET`、`INITIAL_ADMIN_PASSWORD` 和 `DATABASE_URL`。
3. 服务自动创建 Schema、索引、admin 和基础字典。
4. 日志出现 `Database: PostgreSQL` 后访问 `/health`。

不要对 PG 手工执行 legacy SQLite 的 `schema.ts` 或 `migrations.ts`，它们只作为待归档的旧库升级证据。

## 3. SQLite → PostgreSQL

推荐在停机窗口迁移，避免导出后仍有用户写入。

1. 备份原始 SQLite 文件及其 `-wal`、`-shm` 文件。
2. 在 SQLite 模式进入“设置 → 数据库”，选择“迁移导出”。
3. 启动一个全新的 PostgreSQL 数据库。
4. 使用管理员账号导入 JSON，选择 `replace`。
5. 执行“数据库修正 → 全部”。
6. 核对用户、组织、列表、Issue、点检、推送、字典和功能数量。

“迁移导出”会保留非 `admin` 用户的 bcrypt 密码哈希；导入后这些用户可以继续使用原密码，只有 `admin` 会重置为部署配置 `INITIAL_ADMIN_PASSWORD`。迁移文件包含密码哈希，必须按敏感凭据保管，迁移完成后应安全删除。

普通“备份导出”不包含 `passwordHash`。导入这种备份时，所有用户密码会重置为 `INITIAL_ADMIN_PASSWORD`；旧版备份也按此规则处理。

只有系统管理员可以执行完整备份、迁移导出和导入。普通用户的“导出我的数据”只包含其可访问列表及相关 Issue、点检、链接和推送，不能作为数据库导入文件。

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

当前草案不授权把正式服务直接切回 SQLite。回滚必须由发布 owner 在冻结写入方、核对归档校验和并验证恢复路径后执行；PG 数据和原始 SQLite 资产均保留用于差异分析，禁止互相覆盖。

## 6. 运维

- PostgreSQL 使用连接池，默认上限 10；根据实例连接上限调整 `DB_POOL_MAX`。
- `SIGTERM`/`SIGINT` 会先停止 HTTP 服务，再关闭数据库连接池。
- 数据库 URL 不会写入启动日志。
- 数据库备份仍应使用 PostgreSQL 原生定时备份；应用 JSON 用于迁移和人工恢复，不替代 PITR。
