# SQLite 清理执行草案

状态：draft

盘点日期：2026-08-03

> 本文是 standalone 全仓清理计划，不是 Admin 插件迁移脚本。本轮已完成只读资产盘点、停止条件和 PG-default 配置门禁；没有删除数据库/恢复代码，没有执行导入、migration、repair、reset 或 restore。

## 1. 当前结论

Admin 插件交付闭包已无 SQLite，但整个 Open Issue 仓库尚未清理完成。正式 standalone 配置已默认 PostgreSQL，并在缺少 `DATABASE_URL` 时 fail closed；正式 async schema/migration runner 也已收敛为 PostgreSQL-only。无调用者的通用 async factory 已删除，公开 barrel 也不再导出 SQLite adapter；当前仍有只供 legacy 归档/导入的 `node-sqlite3-wasm`、同步 adapter/schema/migration、专属测试和示例配置。current 文档只剩一份 transitional 兼容规则，其他命中均已降为 historical/draft。

2026-08-03 已分别在整改 worktree 与主 checkout 使用包含 ignored/hidden 文件、排除 `.git`/`node_modules` 的只读文件清单复核；两处均没有 `.sqlite`、`.sqlite3`、`.db`、`-wal` 或 `-shm` 数据文件。根目录 `data/` 虽被 `.gitignore` 整体忽略，但当前两个 checkout 的 ignored `data/` 也没有命中。由此只能得出“这两个源码 checkout 没有旧库”，不能得出所有部署、备份卷或历史机器的旧库已经归档。

## 2. 只读资产清单

### 生产代码与依赖

- `packages/server/package.json`：`node-sqlite3-wasm`；
- `packages/server/src/db/pnw/pnwSqliteAdapter.ts`；
- `packages/server/src/db/pnwDbAdapter.ts` 与同步 `connection.ts`；
- `pnwDbConfig.ts` 已默认 PostgreSQL；legacy SQLite 必须同时显式设置 `DB_DRIVER=sqlite`、`ALLOW_LEGACY_SQLITE=true` 和绝对 `DB_PATH`，生产环境直接拒绝，且拒绝与 `DATABASE_URL` 混配；`config.ts` 已删除默认旧库路径；
- `pnwDbTypes.ts` 仍保留 legacy 双 dialect contract；无调用者的 `pnwDbFactory.ts` 已删除，正式 async connection 直接构造 PostgreSQL adapter，`pnw/index.ts` 不再公开导出 SQLite adapter；`pnwSchema.ts`、`pnwMigrationRunner.ts` 已拒绝非 PostgreSQL adapter；
- `schema.ts`、`migrations.ts`、`dictDedupe.ts` 和 `DbRepairService.ts` 的 SQLite 专属逻辑。

### 测试与运维入口

- `tests/server/pnw-sqlite-adapter.test.ts`；
- `pnw-db-config`、schema、migration、access-control、data-protection、external-auth、db-repair 等测试仍有 SQLite 相关契约或 fixture；login-policy 已迁为依赖注入的内存契约测试，不再启动 SQLite；
- `packages/server/.env.sqlite.example`；
- `scripts/migrate-rebuild-db.sh` 与 `scripts/migrate-rebuild-db.md`。

### 文档

README、架构、使用手册、部署/迁移、代码规范、v0.4 双库计划、路线/TODO 以及部分专题文档仍含“SQLite 默认/双库正式支持”表述。历史说明可归档，但 current 文档最终必须只描述 PostgreSQL 正式路径。

### 调用可达性与处置矩阵

| 资产 | 当前可达性 | 分类 | 本轮处置 | 最终处置门禁 |
| --- | --- | --- | --- | --- |
| `pnwDbConfig.ts`、`config.ts`、`.env.sqlite.example` | standalone 启动配置入口 | transitional | 已删除隐式默认文件；生产拒绝 SQLite；非生产也必须显式 opt-in、绝对路径且只能操作副本 | 真实归档/导入演练后删除整个 legacy 配置分支与模板 |
| `connection.ts`、`pnwDbTypes.ts` | 正式服务仍编译 legacy 双 dialect，SQLite 分支由显式恢复配置可达 | transitional / mixed | 已删除通用 factory，正式 PG 路径直接构造 PG adapter；同步恢复 bridge 暂保留 | 先把领域服务和测试迁到 async PostgreSQL，再删除同步/SQLite 分支 |
| `pnwDbAdapter.ts`、`pnwSqliteAdapter.ts` | 被 legacy connection、schema 与多项测试直接引用 | transitional recovery asset | 保留，不新增调用者 | 归档校验和、owner/保留期和导入演练均有证据后删除 |
| `schema.ts`、`migrations.ts`、`dictDedupe.ts` | legacy 初始化和 `DbRepairService` 的 SQLite 分支可达 | transitional recovery asset | 保留其旧库升级/去重能力，不把它们用于 Admin 插件 | 同上；迁移中仍有价值的领域算法先转为 PG migration/纯算法 |
| `pnwSchema.ts`、`pnwMigrationRunner.ts`、`externalAuthSchema.ts` | 前两者只由 PostgreSQL 正式路径调用并 fail closed；共享 external-auth SQL 仍服务 legacy schema bridge | plugin-independent PG truth + transitional helper | 已删除正式 runner 的 SQLite 分支；通用 schema/migration 单测改用 PostgreSQL contract double | 真实 PG 集成/build/启动点检通过后，再判断 shared helper 是否可拆 |
| `DbRepairService.ts` | standalone 管理 API 可达；多数任务已 async，`linkAttention`/`ensureSchema` 仍桥接 SQLite | mixed | 不把 legacy repair 迁入 Admin；先保留唯一恢复能力 | PG repair 契约测试覆盖后删除 SQLite 分支 |
| SQLite fixture/adapter/schema/migration 测试 | CI/本地测试可达，不是运行时 | transitional tests | 通用 schema/migration runner 测试已改用 PostgreSQL recording adapter；login-policy 已迁为内存 port 测试；仍有 4 个 full-server fixture 必须显式 `ALLOW_LEGACY_SQLITE=true`，另有 1 个驱动专属 adapter 测试 | 领域语义迁为纯算法或 PG 集成；驱动专属测试随 adapter 删除 |
| `sqlite:inventory`、`sqlite:verify-rehearsal`、`sqlite:audit-cleanup` | 显式运维/验收命令 | host-independent recovery tooling | 保留；均 fail closed，且不被服务启动隐式调用 | 最后一批旧库完成归档、导入核对和保留期决策后再归档/删除 |
| `migrate-rebuild-db.*` | 人工旧库重建入口 | obsolete after recovery | 当前只作 historical，不执行 | 新 PG 导入/恢复入口验证后删除或永久归档 |

直接结论：无调用者的通用 factory、公开 SQLite adapter 导出和不依赖数据库的 login-policy fixture 可以安全移除/迁走，且已经完成；但在“不知道最后一批旧库位置、owner 与保留期”的情况下，剩余恢复核心不能删除。隐式默认路径、生产运行时启用和“只读模板”误导也不属于恢复能力，已经移除/修正。

## 3. 删除前门禁

1. 从实际部署/备份位置取得最后一批 SQLite 文件；逐个记录 owner、来源、只读 SHA-256、大小、最后修改时间和保留期限；
2. 在隔离环境完成 SQLite→PostgreSQL 导入演练，核对表数、行数、主外键、字典、Issue/list links、8D 与黄金查询；
3. 保存导入批次 ledger、旧→新 ID/字段映射和异常清单；
4. ✅ standalone 正式配置默认 PostgreSQL，缺 `DATABASE_URL` 时 fail closed，禁止静默回退 SQLite；生产运行时拒绝 SQLite，legacy adapter 只允许非生产环境对显式绝对工作副本 opt-in，待前两项完成后删除；
5. PostgreSQL 单元/集成、production build 与真实启动点检通过；
6. 将旧库重建/恢复说明标为 historical，并指向已验证的 PG 导入/恢复入口。

前两项需要仓库外真实数据与 owner，当前不可由源码调查替代。门禁未满足前，SQLite adapter、导入工具和唯一恢复文档仍是可恢复性资产，不能先删。

### 已落地的只读证据入口

- `pnpm sqlite:audit-cleanup -- --summary`：只读扫描当前 worktree，并按 production、current docs、historical/draft docs、tests/tools/importer 分类；`--check` 在 production 或 current docs 仍有命中时非零退出。删除默认旧库路径并加生产禁用门禁后的首个过渡快照为 production 18 文件/63 命中、current docs 1 文件/7 命中；正式 runner、通用 factory/public export 和 login-policy fixture 收敛后的当前快照为 production 13 文件/54 命中、current docs 1 文件/7 命中、historical/draft 22 文件/263 命中、tests/tools/importer 18 文件/166 命中。因此 `--check` 仍按预期失败，不能用于宣称完成。draft/TODO 的命中来自本处可达性矩阵与证据说明，不计作正式支持回归。
- `pnpm sqlite:audit-no-regression`：在上述严格清零门禁尚不可通过时，对当前 13 份 production 和 1 份 current-doc 过渡资产设定逐文件“只能减少、不能新增文件或增加命中”的上限；删除某项不会因基线缺失失败，新增或回流则 fail closed。4 项 audit 回归通过。
- `pnpm sqlite:inventory -- --owner <owner> --retention-until YYYY-MM-DD <绝对路径...>`：只接受显式绝对普通文件，拒绝目录、符号链接和非 SQLite 资产；校验数据库头并在 stdout 输出 realpath、角色、大小、mtime 与 SHA-256。它不打开 SQLite、不扫描目录，也不写归档文件。
- `pnpm sqlite:verify-rehearsal -- --sqlite-export <绝对 JSON> --postgres-export <绝对 JSON>`：只离线比较两份 Open Issue full backup v1；按表核对行数与规范化内容，并检查关键引用、Issue/list links、`listCount` 和字典唯一性。密码、tokenVersion、可重建 listCount、legacy checkpoint deadline 与 JSONB 表示差异按已声明迁移规则归一化。
- `tests/scripts/sqlite-cleanup-evidence.test.ts`：覆盖 SHA 清单、拒绝隐式相对路径、允许的迁移归一化和业务字段/悬空引用 fail-closed。

这些入口只把门禁变成可复现证据，不代表已取得真实旧库或已完成 SQLite→PG 演练；本次没有对任何真实数据库执行查询或写入。`pnw-db-config` 与清理证据锁定 PG 默认、缺连接串拒绝、生产禁用 legacy、绝对工作副本路径和双配置冲突拒绝。当前 dirty 源码在 `/private/tmp` 隔离副本中复用已安装依赖完成全量 Vitest：30 files / 206 tests 通过，2 files / 9 个需要真实 PostgreSQL 的条件测试跳过；Server TypeScript `--noEmit` 与 production build 通过。login-policy 从 2 个 SQLite 集成断言迁为 4 个注入式契约断言；剩余 4 个 full-server legacy SQLite fixture 均显式 opt-in，另有 1 个驱动专属 adapter 测试。通用 schema/migration 测试不再启动 SQLite。直接在无完整 package `node_modules` 的 Codex worktree 调用外部 `tsc` 会产生依赖解析错误，不计作代码失败或成功证据。

### 文档清理进度

`document-policy.json` 已把旧 Linux 单机部署、早期架构、better-sqlite3 重建说明和已落地功能的迁移设计标为 archived，把 PostgreSQL 导入与 Admin 整改说明标为 draft。current 文档的 SQLite 命中由 9 份降到 1 份；剩余 `.claude/rules/no-better-sqlite3.md` 已从“推荐 WASM 驱动”改为“PG 正式路径 + legacy 禁增/待删”规则，待兼容代码删除后再移除。历史恢复内容保留但已从 README/current runbook 降级，使用手册不再建议删除数据库文件重置生产数据。

## 4. 建议执行批次

### A. 归档与导入演练

- 使用 `sqlite:inventory` 只读收集明确指定的旧库、哈希、owner 与保留期；
- 在隔离目标 PG 执行转换，分别导出 full backup v1，再使用 `sqlite:verify-rehearsal` 形成离线核对报告；
- 不覆盖现有 PG，不在源库上 repair。

### B. PG-only fail closed

- [x] 默认解析和正式模板只选择 PostgreSQL；缺 `DATABASE_URL`、混配旧路径时 fail closed；
- [x] legacy SQLite 分支改为非生产显式双开关 opt-in，要求绝对工作副本路径，不再是启动回退；
- [x] 删除 resolver 内部默认旧库路径；修正 `.env.sqlite.example` 的“只读”误导，明确 standalone 会写 schema/seed，绝不能指向归档原件；
- [x] 正式 async `pnwRunSchema` / `pnwRunMigrations` 收敛为 PostgreSQL-only，非 PG adapter fail closed；legacy 初始化继续走隔离的同步 schema bridge，不写正式 migration ledger；
- [x] 通用 schema/migration runner 测试改用 PostgreSQL recording adapter；login-policy 改用可注入 port 的内存契约测试，不再启动数据库；
- [x] 删除无调用者的通用 async DB factory，并从 `pnw/index.ts` 移除 SQLite adapter 公共导出；正式 connection 直接构造 PostgreSQL adapter，legacy 恢复仍走显式内部路径；
- [x] 仅保留 4 个覆盖 legacy 恢复/领域行为的 full-server SQLite fixture，并要求显式 opt-in；另有 1 个驱动专属 adapter 测试随 adapter 最终删除；
- [ ] 在真实旧库归档与导入演练后，从 `PnwDbConfig` 删除 legacy 分支和默认旧路径；
- 将领域服务从同步 bridge 完整迁到 async adapter；
- 先迁测试，再删除生产分支。

### C. 代码、依赖与脚本删除

- 删除 `node-sqlite3-wasm` 和 lockfile 残留；
- 删除 SQLite adapter、同步 connection、schema/migration/repair 分支；
- 删除 SQLite 专属测试与 `.env.sqlite.example`；
- 将已完成使命的重建脚本移入历史归档或在恢复证据冻结后删除。

### D. 文档与 CI 收口

- current 文档中 SQLite 正式支持命中归零；
- historical 文档保留 archived 状态和替代入口；
- 更新 document policy/manifest、CI 和 pack 清单；
- 增加“生产源码/依赖/config/current docs 无 SQLite”门禁，同时允许明确的 historical/importer 白名单。

## 5. 完成定义

- 生产依赖、源码、配置和 current 文档中 SQLite 命中为 0；
- historical/importer 命中有明确白名单、owner 与删除期限；
- 缺 PostgreSQL 配置时启动失败，不生成本地 SQLite；
- PG 全套测试、build、真实启动和备份恢复点检通过；
- 最后一批 legacy 数据的归档与导入核对可复查。
