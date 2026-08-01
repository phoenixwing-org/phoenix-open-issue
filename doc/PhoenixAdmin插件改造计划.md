# Open Issue → Phoenix Admin 编译期插件改造计划

状态：historical / superseded

Owner：Open Issue maintainers / Phoenix Admin Host maintainers

适用范围：`phoenix-open-issue` 0.5.x 之后的插件试点

计划分支：历史 `admin-plugin`；当前为 `admin`

最后核验：2026-08-01

> 复核说明：本文保留 2026-07-26 的宿主原型和在线安装设想作为历史证据，不再作为当前执行真源。其中内置于 Phoenix Admin 的 Open Issue 页面、后端模块、PrototypeManifest、`moduleId=open-issue`、`/admin/open-issue/*` 和“编译期业务模块归 Host”均已废止。当前基线为 `legacy/2cdc5ea`，唯一插件 ID 为 `phoenix-open-issue`，产品路由为 `/open-issue/*`，API 为 `/admin/phoenix-open-issue/*`。执行入口见 [Admin 插件整改讨论稿](admin-plugin-rectification/README.md)，Host 业务副本正在从两个框架仓清除。

## 1. 目标与非目标

本计划把 Open Issue 作为 Phoenix Admin Host 的第一个业务插件试点，先交付可单独启用、可组合构建、可迁移和可回滚的轻量插件，再演进到可在 Admin 后台在线安装、升级、禁用和卸载的签名插件包。

本阶段目标：

- 保留 `@open-issue/core` 的领域类型、算法和资源级权限；
- 把 Open Issue 页面、服务、数据迁移和菜单贡献接入 Phoenix Admin Host；
- 使用 Host 的登录、会话、用户、部门、系统角色、菜单和统一审计；
- 同时保留 Open Issue 独立应用，作为开发样例、迁移来源和回滚基线；
- 证明 Open Issue 可独立启用，并为 Function 后续接入验证模块契约；
- 最终支持管理员从 Host 插件中心完成受控安装/升级/禁用/卸载，卸载默认保留业务数据。

本阶段明确不做：

- 原型阶段不直接使用 Cool Admin 现有 `eval` Hook 加载完整业务插件；
- 首个在线版本不强求无重启热加载，允许安装后受控重启 Host；
- 不允许未签名包、任意远程代码、无预览 migration 或卸载时静默删除数据；
- 不把 Open Issue 的 `owner/admin/editor/reporter/viewer` 资源角色提升为 Host 全局角色；
- 不把 Open Issue 自有用户、组织和 JWT 复制进 Host；
- 不修改或阻塞 Function 当前计划。

### 1.1 双分支产品线

| 分支 | 产品形态 | 长期职责 |
|---|---|---|
| `develop` | 独立本地化 Open Issue | 保留独立 Vue/Express、SQLite/PG、独立部署与离线使用 |
| `admin-plugin` | Phoenix Admin 插件 | 只保留领域、页面、资源权限和 Host adapter，最大化复用 Admin 能力 |

共同的领域修复优先进入 `develop`，再同步到 `admin-plugin`；Host 专属 adapter、manifest 和安装生命周期只进入 `admin-plugin`。不得把删除独立壳、登录或 SQLite 能力的改动反向合入 `develop`。两个产品线分别使用 `standalone-v*` 与 `admin-plugin-v*` 标签。

## 2. 当前事实与差距

| 领域 | Open Issue 当前实现 | Phoenix Admin Host | 改造结论 |
|---|---|---|---|
| 前端 | 独立 Vue Router、Pinia、AppShell、登录页 | Cool Router/Process、Pah Workbench | 提取业务页面贡献，删除插件内全局壳和第二套路由状态 |
| 后端 | Express Router/Controller/Service | Midway + Cool 模块 | 不嵌套 Express，增加 Midway 编译期适配包 |
| 身份 | 自有 users/JWT/tokenVersion/飞书绑定 | Host 用户、部门、角色、会话 | Host 唯一拥有；插件只消费 `OipActor` |
| 授权 | systemRole + 列表成员角色 | 菜单/capability + Host actor | 采用“Host capability 上限 + Open Issue resource policy”双层授权 |
| 数据 | SQLite/PostgreSQL adapter、camelCase 表名 | PostgreSQL/TypeORM | 业务表迁入 `oip_` 命名空间；用户引用通过显式映射导入 |
| 审计 | pushRecords 和业务历史为主 | Host 全局日志/审计入口 | 业务历史保留，统一审计由 Host 存储并关联 correlation ID |
| 许可 | Apache-2.0 | Admin Host MIT | 源码各自保持原许可，组合发行物同时携带 MIT/Apache-2.0/NOTICE |

旧 `plugin` 分支是已经合入 `develop` 的 Phoenix Wing 历史集成线，当前比 `develop` 落后，不作为本次 Admin 插件分支复用。

### 2.2 2026-07-25 宿主原型进度

已完成“只登记契约、不执行插件源码”的本机宿主生命周期闭环：

- Open Issue `admin-plugin`：`2e9d8f3`，提供 `@open-issue/admin-plugin` manifest、状态机和安全卸载计划；
- Phoenix Admin Node `codex/open-issue-plugin`：`9cc270e`，提供通用 `pah_plugin_installation` 注册表、运行时 manifest 校验和受控生命周期 API；
- Phoenix Admin Vue `codex/open-issue-plugin`：`ef0f474`，提供 `/pah/plugins` 本地候选清单和管理界面；
- 已用本机 PostgreSQL 与内置浏览器验证登记、安装、启用、停用、卸载，最终记录为 `uninstalled`、`dataRetained=true`，8 张 `oip_` 表声明保持不变；
- 宿主拒绝 `eval`、动态入口执行和启用状态直接卸载，畸形 HTTP manifest 只返回校验错误。

此里程碑证明的是 Host 注册表、UI 和数据保留门禁，不代表 Open Issue 页面/API 已被加载，也不代表已支持在线插件包。下一步仍按首批工作清单选择“我的列表”只读页面/API，接入 Host actor、菜单和审计；签名上传、升级/回滚与受控入口加载继续属于 O6/O7。

### 2.3 2026-07-26 当前交付与剩余迁移计划

已完成的 Host 原生闭环：

- Open Issue 的列表、Issue 写入、点检、推送历史均通过 `/admin/open-issue/*` 接入，复用 Host 登录、用户、菜单、角色权限和系统审计；列表成员角色仍是资源级边界；
- `oip_` 历史导入覆盖用户映射、列表、成员、Issue、推送和点检；迁移页先只读预检，同名 Host 用户仅作为建议，管理员必须显式确认映射。未映射人员关联的数据按批次列为跳过项，绝不复制密码或自动创建统一用户；按 `importBatchId` 回滚，并在 `pah_plugin_migration_record` 记录 manifest migration ID、版本、校验和、批次、摘要与回滚状态；
- Host 提供内置“管理 / 开发 / ISSUE”大分组。Open Issue 首次启用默认进入 `ISSUE`，管理员可以新建大分组并把“问题工作台”“协作治理”分别移动到任意分组；稳定目标键保证禁用、卸载、重装不会丢失选择；
- 已完成的安装、启用、停用、卸载、重装均默认保留 `oip_` 数据和角色授权快照；生命周期操作仅允许 Host 管理员，状态转换在菜单副作用之前校验；动态 function 插件仍不在本阶段实施。

剩余工作按以下顺序推进：

1. **生产迁移工件**：为 `pah_` 宿主表和 `oip_` 业务表提供可审核 SQL/TypeORM migration，而不是依赖本地 `synchronize`；补齐行数、孤儿引用、权限矩阵和脱敏黄金数据的报告。
2. **版本升级事务**：把“先停用再重新登记”升级为显式 upgrade plan，包含版本兼容性、migration preview、失败恢复点、并发锁和恢复/重试记录。
3. **签名安装包**：生成带 SHA-256、SBOM、LICENSE/NOTICE 与 Ed25519 签名的 `.pah-plugin`；Host 只验包和受控重启加载，继续拒绝 `eval` 与任意源码执行。
4. **插件中心验收**：展示 capability 同意、迁移预览/台账、兼容性与数据保留；完成篡改包、不兼容包、重复请求、双进程和断电中断的测试。
5. **业务增量**：再实现 Issue 推送的发起/处理写流程与独立版一致性回归。它不阻塞当前只读推送历史和点检闭环。

### 2.1 Admin 能力复用优先级

| 能力 | 插件处理 | 例外边界 |
|---|---|---|
| 登录、会话、刷新、禁用、外部身份 | 完全复用 Host | 插件不得保留第二份 JWT |
| 用户、部门、系统角色 | 完全复用 Host | 旧 ID 只用于迁移映射和历史显示 |
| 菜单、Ribbon、TreeView、页签 | 完全复用 Host | 插件只贡献 manifest |
| 文件上传与空间 | 复用 Host space/upload | Open Issue 只保存文件引用和业务元数据 |
| 定时任务 | 复用 Host task | 插件声明 job，不自建调度器 |
| 参数与运行配置 | 复用 Host param | 插件配置必须声明 schema 和敏感字段 |
| 系统日志与审计 | 复用 Host | Issue 时间线、点检、推送历史仍属领域记录 |
| 数据字典 | 能等价映射的优先复用 Host dict | tags、预设、去重语义不等价时保留最小 `oip_` 扩展 |
| 归档/回收 | 保留 Open Issue 领域语义 | 物理删除和平台级回收能力可调用 Host |
| 备份恢复 | 复用 Host 备份入口和存储 | 插件提供自身表清单、校验和与恢复钩子 |

轻量化判定：Admin 已有且语义等价的能力，插件不得再带页面、表、服务或后台任务；只有领域语义明确不同且有契约测试时才保留插件实现。

## 3. 目标结构

Open Issue 是一个逻辑插件，构建时拆成前后端两个包：

```text
phoenix-open-issue
├─ packages/core                         @open-issue/core（保留）
├─ packages/admin-web-plugin             Vue 页面、路由、菜单和工作台贡献
├─ packages/admin-node-plugin            Midway 控制器、服务、实体和 migration 清单
├─ packages/web                          独立应用壳（过渡期保留）
└─ packages/server                       独立 Express 服务（过渡期保留）

Phoenix Admin Host（编译期）
├─ phoenix-admin-vue  ← admin-web-plugin
└─ phoenix-admin-node ← admin-node-plugin
```

建议包名：

- `@open-issue/admin-web-plugin`
- `@open-issue/admin-node-plugin`

两个包共享 `moduleId = "open-issue"`、版本和兼容范围，但分别声明自己的 peer dependencies。Vue、Pinia、Element Plus、Phoenix Wing、Midway 和 TypeORM 必须由 Host 提供单例，插件包不得再捆绑一份运行时。

### 3.1 静态 manifest 最小字段

```ts
interface OipAdminPluginManifest {
  moduleId: 'open-issue'
  version: string
  hostCompatibility: string
  wingCompatibility: string
  preferredGroupId: 'pah-group-issue-collaboration'
  routes: OipRouteContribution[]
  navigation: OipNavigationContribution[]
  capabilities: OipCapabilityDeclaration[]
  resourcePolicies: OipResourcePolicyDeclaration[]
  auditCategories: OipAuditCategory[]
  migrations: OipMigrationDeclaration[]
  healthChecks: OipHealthCheckDeclaration[]
  hostReuse: OipHostCapabilityRequirement[]
  uninstall: OipUninstallPolicy
}
```

manifest 在构建时静态导入；缺少兼容版本、重复 ID、路由冲突、能力码冲突或 migration 顺序冲突时必须构建失败。

### 3.2 在线插件包与生命周期

现有 Cool Admin 插件中心可复用上传、列表、启停、配置和卸载交互，但当前后端通过 `eval` 执行单个 Hook，前端通过 `import.meta.glob` 编译期扫描，不能安全承载带路由、实体和 migration 的全栈业务插件。因此 Phoenix 需要在现有 UI/注册表上增加全栈协议，不直接把 Open Issue 塞进旧 Hook 格式。

建议发行物：`open-issue-admin-plugin-<version>.pah-plugin`，至少包含：

- 签名的 manifest、前后端预构建产物和 SHA-256 清单；
- publisher、SBOM、LICENSE、NOTICE、Host/Wing/Node/PostgreSQL 兼容范围；
- capability 请求清单、配置 schema、migration 清单和卸载策略；
- 前端远程 ESM 入口与 Host SDK 版本；
- 后端受控模块入口、健康检查和启停钩子。

安装状态机：

```text
uploaded → verified → staged → migrated → installed → enabled
              ↓          ↓          ↓          ↓         ↓
            rejected    failed     failed     disabled → uninstalled
```

规则：

1. 上传后先验签、校验哈希、兼容范围、稳定 ID 和 capability 请求；
2. 管理员确认权限与 migration 预览后才允许 staged；
3. 前后端产物原子落盘，migration 只前向执行并记录版本；
4. 首版允许激活或升级时受控重启，不使用 `eval` 加载任意代码；
5. 禁用立即撤下菜单、路由入口、job 和写 API，但不删除表；
6. 卸载先禁用并生成备份，再移除代码、注册表和静态资源；默认保留 `oip_` 数据；
7. “清除插件数据”是独立高风险操作，需要二次确认、备份和明确表清单；
8. 升级失败必须恢复上一版本代码和注册状态；数据库 downgrade 只能走已声明恢复方案。

## 4. 宿主导航与工作台贡献

Open Issue 首选贡献一个独立大组：

| 大组 | 模块 | 功能 |
|---|---|---|
| 议题协作 | 问题工作台 | 仪表盘、问题列表、Issue 详情、点检 |
| 议题协作 | 协作治理 | 推送历史、归档/回收、业务字典与模块诊断 |

约束：

- 大组 ID 固定为 `pah-group-issue-collaboration`，显示名“议题协作”可由 Host 本地化；
- 部署方可在编译期把这两个模块并入其他大组，但不能修改稳定 module/route/capability ID；
- 未识别配置由 Host 放入“其他模块”，插件不能自行创建第二套侧栏；
- 前端路由统一使用 `/open-issue/*`，后端使用 `/admin/open-issue/*`，避免与 `/issue/:id` 和其他模块冲突；
- Ribbon、TreeView、页签、Primary、Properties、Bottom Panel 和 Footer 全部贡献给 Host，插件不再创建 AppShell、全局登录页或自己的 workbench session。

区域建议：

| 页面 | Primary | Main | Properties | Bottom Panel |
|---|---|---|---|---|
| 问题列表 | 列表/保存视图/筛选 | Issue 表格 | 选中 Issue 摘要 | 导入、推送和校验结果 |
| Issue 详情 | 列表与时间线导航 | 详情和点检 | 成员、状态与责任人 | 操作记录和审计关联 |
| 推送治理 | 来源/目标列表 | 推送记录 | 选中推送上下文 | 批处理与错误日志 |

## 5. 身份、权限与审计

### 5.1 身份边界

Host 提供只读 actor：

```ts
interface OipActor {
  hostUserId: string
  username: string
  displayName?: string
  departmentIds: string[]
  capabilities: string[]
  correlationId: string
}
```

插件不得读取 Host 密码、签发令牌或维护第二份登录状态。Open Issue 旧用户只在迁移阶段通过 `oip_user_link(host_user_id, legacy_user_id)` 显式映射；不静默按姓名合并，不直接重写旧库历史引用。

飞书登录和外部身份由 Host identity 能力承接。Open Issue 原有待审查/审批语义只有在 Host 尚未提供等价能力时保留兼容读取，不在插件内继续签发独立会话。

### 5.2 双层授权

每个敏感请求依次执行：

1. Host 验证会话、账户启用和 token 撤销；
2. Host capability 允许进入该类操作；
3. `@open-issue/core` 根据列表成员角色和具体资源执行 action 判定；
4. domain service 在事务中执行不变量；
5. Host 记录允许/拒绝审计。

建议 capability：

- `open-issue:list:read|create|manage|delete`
- `open-issue:issue:read|create|update|delete|change-status`
- `open-issue:checkpoint:manage`
- `open-issue:push:create|handle|read`
- `open-issue:config:read|manage`
- `open-issue:migration:execute`

前端隐藏按钮只镜像结果，不能代替后端授权。系统角色名称不直接映射；Host 角色通过 capability 获得系统上限，资源角色继续使用 `owner/admin/editor/reporter/viewer`。

### 5.3 审计

审计类别统一使用 `open-issue.*`，至少记录 actor、capability、resource type/id、result、reason code、correlation ID、module version 和时间。不得记录令牌、密码、完整导入文件或未脱敏请求体。

`pushRecords`、点检和 Issue 时间线仍是业务历史；Host 审计是系统级安全记录，两者通过 correlation ID 关联，不互相替代。

## 6. 数据与 migration

### 6.1 数据所有权

- Host 拥有用户、部门、系统角色、菜单、会话、外部身份和统一审计表；
- Open Issue 拥有列表、列表成员、Issue、点检、推送、关注关联和业务字典；
- Open Issue 插件新表统一使用 `oip_` 前缀；Host 集成元数据继续使用 `pah_` 前缀；
- 不把旧 `users`、`orgUnits`、登录策略和 OAuth 临时表迁成 Open Issue 业务表。

### 6.2 迁移步骤

1. 冻结旧 schema、API、权限矩阵和一份脱敏黄金数据；
2. 导出 legacy ID、用户映射候选、业务表行数、引用摘要和校验和；
3. 人工确认冲突用户后写入 `oip_user_link`；未映射用户作为拒绝项，不自动创建 Host 账户；
4. 按 migration registry 顺序创建 `oip_` 表并导入业务数据；
5. 校验行数、唯一键、孤儿引用、成员角色、Issue 编号、归档/删除状态和抽样业务结果；
6. 执行系统 capability × 资源角色 × action 权限矩阵；
7. 试运行期间旧应用只读，Host 是唯一写入方；禁止无约束双写；
8. 输出 migration report、拒绝项、耗时和可恢复快照位置。

生产回滚分两档：首次 Host 写入前可直接恢复旧应用写入；首次 Host 写入后必须停止两端写入并运行受控差量导出/核对，不能简单切 DNS 后丢弃新数据。

## 7. 实施阶段

### O0：契约冻结与门禁（1–2 天）

- [x] 固定 manifest、route、module、capability、audit 和 migration ID；
- [ ] 冻结 Open Issue 关键 API、权限矩阵和黄金样例；
- [x] 为 Admin Vue/Node 分别建立 `codex/open-issue-plugin` 接入分支；
- [x] 验证 Host 当前登录、PostgreSQL、Ribbon/TreeView 和回滚基线。

退出条件：契约评审通过；三个仓库均有独立回滚点；尚未复制业务代码。

### O1：可复用边界提取（2–4 天）

- [ ] 让页面业务逻辑依赖 `OipActor`、API port 和 navigation port，而不是独立 AppShell/JWT；
- [ ] 保持 `@open-issue/core` 零 Vue、Express、Midway 和数据库驱动依赖；
- [ ] 建立 admin web/node plugin 包骨架和 manifest 契约测试；
- [ ] 独立 web/server 通过兼容 adapter 继续运行。

退出条件：独立构建、插件包构建和原回归同时通过。

### O2：前端宿主接入（2–4 天）

- [ ] 注册 `/open-issue/*` 路由和“议题协作”大组；
- [ ] 接入 Host Router/Process、Pinia、菜单权限和工作台区域；
- [ ] 移除插件路径中的独立登录、全局壳和第二套页签持久化；
- [ ] 验证直接 URL、刷新、KeepAlive、关闭页签及 Ribbon/TreeView 切换。

退出条件：`host-open-issue` 前端可构建；无 Vue/Pinia/Element/Wing 双实例。

### O3：后端与双层权限（3–6 天）

- [ ] 用 Midway controller/service adapter 暴露 `/admin/open-issue/*`；
- [ ] 接入 Host actor/capability，保留 core resource policy；
- [ ] 增加 `oip_` entity、migration registry、健康检查和审计 adapter；
- [ ] 对匿名、禁用、撤销、无 capability、非成员和不足资源角色逐格测试。

退出条件：敏感 API 的 401/403/404 语义和审计证据完整。

### O4：迁移与切换演练（3–5 天）

- [ ] 完成用户映射、业务数据导入、校验和拒绝项报告；
- [ ] 在脱敏 PostgreSQL 样本执行完整迁移和回滚；
- [ ] 演练旧应用只读、Host 单写和故障切回；
- [ ] 更新部署、备份、恢复和许可清单。

退出条件：关键页面/数据/权限结果一致，迁移和回滚报告可重复。

### O5：试点验收（2–3 天）

- [ ] `host-core` 和 `host-open-issue` 均可独立构建；
- [ ] Open Issue 全部关键流程浏览器验收；
- [ ] 与 Function 占位 manifest 组合时无 ID、路由、表、能力码或审计类别冲突；
- [ ] 决定继续推广、补契约或回退独立部署。

### O6：安全插件包与 Host SDK（3–6 天）

- [ ] 冻结 `@phoenix-admin/plugin-sdk`，只暴露 actor、导航、审计、文件、任务、字典和配置门面；
- [ ] 生成 `.pah-plugin` 包、哈希清单、SBOM、LICENSE/NOTICE 和 Ed25519 签名；
- [ ] 扩展 Host 插件注册表，保存安装状态、版本、兼容性、capability 授权和 migration 记录；
- [ ] 前端使用受控远程 ESM 入口并共享 Host Vue/Pinia/Element/Wing 单例；
- [ ] 后端以受控模块入口加载，禁止沿用旧插件中心的任意 `eval` 路径。

退出条件：离线包可被验证、staged、安装并经受控重启启用；篡改包和不兼容包被拒绝。

### O7：在线安装、升级与卸载闭环（3–5 天）

- [ ] 在 Admin 插件中心展示权限、migration、数据保留和兼容性预览；
- [ ] 完成上传安装、升级失败回退、禁用、重新启用和卸载；
- [ ] 卸载后菜单/API/job 不可用，但 `oip_` 数据仍在且可重新安装恢复；
- [ ] 单独演练“备份后清除插件数据”，确认不会删除 Host 表或其他插件表；
- [ ] 对双进程/PM2、并发安装、断电中断和重复请求执行幂等测试。

退出条件：管理员可在线完成完整生命周期，且每一步可审计、可恢复、无静默数据损失。

## 8. 验收矩阵

| 类别 | 必须通过 |
|---|---|
| 构建 | core、legacy web/server、admin web/node plugin、host-open-issue |
| 安装 | 验签、哈希、兼容性、capability 同意、migration 预览、幂等与中断恢复 |
| 导航 | 三层 TreeView、Ribbon、深链刷新、页签恢复、当前资源上下文 |
| 身份 | 登录、刷新、禁用、撤销、外部身份均由 Host 生效 |
| 权限 | capability × resource role × action 全矩阵；前端与 API 直接调用一致 |
| 数据 | 行数、引用、校验和、归档/删除、成员、Issue 编号和黄金样例一致 |
| 审计 | 成功/拒绝可由 correlation ID 追踪，敏感字段脱敏 |
| 回滚 | 首次写入前和首次写入后两档演练均有明确步骤和证据 |
| 卸载 | 入口/API/job 全部撤下，默认保留数据；重装恢复和独立数据清除均通过 |
| 许可 | Open Issue 插件 Apache-2.0；Host MIT；组合包携带双方 LICENSE/NOTICE |

## 9. 风险与决策点

| 风险/决策 | 当前建议 | 必须重新决策的条件 |
|---|---|---|
| Express 是否嵌入 Midway | 不嵌入，写 Midway adapter | 只有完整隔离服务部署成为明确产品要求时 |
| 表名/数据碰撞 | 新业务表使用 `oip_` 前缀 | 采用独立 PostgreSQL schema 前需验证 TypeORM、备份和迁移工具 |
| 用户 ID 类型不同 | 显式映射表，保留 legacy ID | 全量重键只有在映射稳定且回滚窗口关闭后评审 |
| Open Issue 大组位置 | 默认独立“ISSUE” | 管理员可在 Host 中移动到内置或自定义大分组，稳定目标键不变 |
| 业务字典是否并入 Host | 首期仍由 Open Issue 拥有 | Host 字典支持 tags、预设、去重和迁移语义后再评估 |
| 动态插件 | Open Issue 作为真实消费者，先受控重启再评估热加载 | 只有稳定安装/升级/卸载后才讨论无重启热替换 |
| 现有 Cool 插件 `eval` | 不用于业务插件 | 仅保留兼容旧 Hook；全栈插件必须走签名模块入口 |
| 旧应用何时删除 | 试点和回滚窗口结束前保留 | 两次发布周期无回滚且迁移证据稳定后另立清理任务 |

## 10. 首批工作清单

1. 定义并测试 `OipAdminPluginManifest` 与安装状态机，不接 UI/数据库；
2. 冻结 Open Issue 权限矩阵和关键 API fixture；
3. 建立 `OipActor`、capability adapter 和 audit event 类型；
4. 选择一个只读页面作为前端垂直切片，建议“问题列表”；
5. 选择一个只读 API 作为后端垂直切片，建议“我的列表”；
6. 在 Host `议题协作 → 问题工作台` 中完成只读闭环；
7. 只读闭环验收后，再开放首个写操作和 migration 实现。

首个垂直切片只证明契约，不迁移登录、用户管理、组织管理、备份导入或完整写链路。
