# 更新日志

## v0.7.1（2026-08-09）

- 修复 PostgreSQL 示例数据初始化时 `eightDReports` / `relatedIssueId` 未按混合大小写标识符引用导致的 `42P01`，并增加空 PostgreSQL schema 的完整 seed 回归。
- 完善 Windows PowerShell 首次启动、`packages/server/.env`、PostgreSQL 连接、`Ctrl+C` 停止与重启步骤，示例只使用占位凭据。
- 增加 Vue/Node 双 Host 的普通权限 Junction 挂载、状态和卸载脚本，强制校验 `LinkType=Junction`、目标一致和本机 Git 排除。
- 关闭 workspace 的 peer 自动安装；Phoenix Admin 运行时继续由 Host 提供，冻结锁文件安装不再因插件 peer importer 漂移失败。

### Windows 测试整改归档（Open Issue 部分）

归档日期：2026-08-09。问题来源为《Admin和Issue测试问题整理》和《Admin和Issue测试问题整改计划》；本节只归档 Open Issue 仓库负责的 F01、F04、F05，以及 R01～R06、R09、R13 中本仓可以完成的复检。目标 Windows 机器、真实 Junction 和已登录 Host 会话的联合复检不在本仓自动化结果中冒充通过。

#### 版本与提交

| 对象 | 结果 |
| --- | --- |
| 整改起点 | `b245527fa4941655222c420df565cb59d70c5d83`（`develop`，Open Issue `0.7.0`） |
| 整改提交 | `3500fc52481466b6cdb851172e197916fbb0ee31`（`修复：完成 Windows 测试整改并升级至 0.7.1`） |
| 构建锚点提交 | `75cefad9a048d84e513667a3fa282da0c0127098`（`构建：更新 Wing 0.6.3 联调锚点`） |
| 插件版本 | `0.7.1`；该版本归档时尚未对外发布，因此不另升 `0.7.2` |
| Wing | 本地类型检查精确锚点为 `0.6.3@4aa2a439bce89ca2827d991c650393eae54d85ac`；生产 peer 兼容范围仍为 `>=0.6.2 <0.7.0` |

`75cefad9a0` 只更新仓库侧本地联调/类型检查锚点。`scripts/open-issue-wing-mode.mjs` 不在生产包清单中，未改变 manifest、DDL、业务源码或运行时 payload。

#### 整改项收口

| 项目 | 本仓结论 | 证据与边界 |
| --- | --- | --- |
| F01 / PPT 1.4 | 实现完成 | PostgreSQL 标识符白名单补入 `eightDReports`、`relatedIssueId`；空 schema 创建完整表后执行 `seedTestData`，断言 3 个列表、5 个 Issue、13 个点检、4 个关联 8D 和 1 条推送 |
| F04 / PPT 1.3 | 文档完成 | 根 README 已明确 `packages/server/.env`、占位连接串、首次启动、单次 `Ctrl+C`、等待关闭和再次启动；未写入真实凭据 |
| F05 / PPT 2.7 | 脚本与文档完成 | `scripts/mount-admin-plugin-dev.ps1` 使用 `New-Item -ItemType Junction`，覆盖 Vue/Node 两处 Mount/Status/Unmount，拒绝覆盖真实目录或外来 Junction，并校验 `LinkType`、目标和本机 Git exclude |

#### 本仓复检记录

| 编号 | 本仓结果 | 可复现证据 | 目标 Windows / Host 剩余点检 |
| --- | --- | --- | --- |
| R01 | 通过 | `pnpm install --frozen-lockfile --offline` 通过；仓库声明 `pnpm@10.15.1` | 在目标 Windows 使用 Node.js 22.x 和同一 pnpm 版本复跑在线/缓存安装 |
| R02 | 部分通过 | `DATABASE_URL= pnpm test` 为 210 passed / 10 skipped，`pnpm build` 通过 | 实际启动 core/server/web，核对三进程成功与失败日志 |
| R03 | 文档通过 | README 明确 `.env` 文件位置、必填 PostgreSQL/JWT/初始管理员占位项和启动顺序 | 由未配置过项目的 Windows 用户只按 README 首次启动 |
| R04 | 文档通过 | README 明确按一次 `Ctrl+C`、等待数据库关闭和保留 `.env` 后重启 | 在 PowerShell 中完成真实停止与重启 |
| R05 | 通过 | 独立 PostgreSQL 测试 schema 执行 `pnpm test:pg`，6/6 通过；完整示例数据含关联 8D，无 `42P01` | Windows UI 登录后点击添加示例数据 |
| R06 | 自动化通过 | fresh-schema seed 对列表、Issue、点检、8D、推送和完成标记逐项断言；全仓测试、构建通过 | Windows 页面查看和操作示例数据 |
| R09 | 静态契约通过 | `tests/scripts/windows-junction-mount.test.ts` 3/3 通过，校验双挂载、Junction-only、`LinkType`、目标和脱敏路径 | 普通权限 PowerShell 实际 Mount/Status/Unmount，两处均显示 `LinkType=Junction` |
| R13 | manifest 门禁通过 | `pnpm admin-plugin:verify-manifest` 通过：`phoenix-open-issue`、`/open-issue`、2 条 SQL migration | 使用已登录管理员会话完成真实登记并保存脱敏结果 |

因此，本仓 F01 实现与回归、F04 文档、F05 脚本/文档可以归档；Windows 联合复检 F07 仍由测试责任人在目标环境完成，不能由 macOS/Linux 的静态检查替代。

#### 发布候选制品

在 clean `75cefad9a0` 上执行 `pnpm admin-plugin:release-package`，固定顺序完成 browser runtime build、descriptor/integrity、pack、生产组包门禁、Midway/Vue 类型检查和 135 项插件核心测试；随后执行 `pnpm admin-plugin:verify-production-package` 独立验包。

| 字段 | 值 |
| --- | --- |
| 文件 | `dist/admin-plugin/phoenix-open-issue-0.7.1.phoenix.cool`（`dist/` 已忽略，不进入 Git） |
| 类型 | Pah 声明式 Phoenix 业务插件包；COOL 原生 Hook 安装器不兼容并 fail closed |
| 文件数 | 132 |
| 压缩字节 | 243,085 |
| SHA-256 | `fe71571c491a216be8afa80090b3b5afafd171f2c095474ffef1d72dbca60c1a` |
| 数据保留契约 | 普通卸载保留 9 张业务表和 7 类字典 |

复验命令：

```bash
pnpm admin-plugin:verify-production-package
```

归档时只创建中文本地提交，未 push；日志、路径示例和配置示例均未保存用户名、密码、令牌或真实数据库连接串。

## v0.7.0（2026-08-05）

- Open Issue 从独立站交付形态收敛为 Phoenix Admin 声明式业务插件；插件、根工作区及三个 legacy 兼容包统一使用 `0.7.0`，正式制品统一为 `phoenix-open-issue-0.7.0.phoenix.cool`。
- 建立可重复的 runtime build → descriptor/integrity → 完整门禁 → immutable package → clean Host assembly 流程；制品记录源码 commit，拒绝脏工作树、旧 `.pah.cool` 后缀、同名覆盖和发布边界并发覆盖。
- 已在独立 PostgreSQL 与生产模拟 Admin 中初步跑通验包、可信备份/恢复、安装、启用、停用和普通卸载；普通卸载保留 9 张 `oip_*` 表、7 类字典、migration/repair/dictionary ledger 与管理员导航 assignment。当前人工步骤仍较多，后续继续收敛为 Host 受控编排。
- 旧站 JSON 迁移支持 Host 用户唯一精确映射、核心业务单事务写入、重复记录跳过和可选 8D 独立事务；真实 41 行测试包首轮导入及第二轮零新增幂等复验通过，组织引用按冻结规则移除。
- 修复导入后部分 IssueList 负责人显示为 `—`：列表服务批量解析稳定 Host 用户 ID，列表、详情和编辑保持一致；未知用户保留原 ID，不自动补建 Host 用户。
- 修复 Host 字典 label 与 fallback 优先级，并持久化非敏感字典显示缓存；空白或等于稳定 value 时回退内置中文，真实 Host 自定义 label 继续优先。
- 本版本确认插件化交付方向，但不把初步生产模拟等同于全自动生产发布；同版本重装、跨版本升级和 Host 统一身份等后续闭环继续单独验收。

## v0.6.1（2026-07-31）

- 仪表盘 Header 同行显示标题与“概览 / 待我处理 / 我发起的 / 管理审批”四个平级 Tab，列表操作仅在概览显示；任务 Tab 按点击加载、切离销毁且最多返回 5 条，聚合真实 pending 推送、待批准账号和第三方登录待关联申请，支持接受、拒绝、撤回、批准和完整页面跳转。管理员全局权限不自动放大为个人待办；同步修复列表卡片在黑天主题下仍使用白色背景的问题。
- Issue 新增 `extensions JSONB NOT NULL DEFAULT '{}'` 通用扩展属性，以及独立的 `listCount INTEGER NOT NULL DEFAULT 0` 关联列表计数；PostgreSQL 由 `issueListLinks` 触发器维护并在升级时回填，列表查询直接读取单表字段。列表标题右下角与 Issue View 仅在关联 2 个及以上点检表时显示数量。
- 已关联到当前列表的 Issue 仍可按当前列表权限继续推送，支持个人、小组、科室、部门之间逐级或多次流转；Issue 主字段权限仍由原始列表控制，各列表关注度保持独立。
- 推送新增“推送给用户”：发送人不查看接收人列表，接收人接受时选择自己管理的目标列表；支持拒绝、发起人撤回、个人历史筛选、审计与并发幂等。原列表推送保持兼容。
- 将 8D 从 Issue 核心字段拆为首个附属功能：新增可空 `relatedIssueId` 的独立 8D 报告、专属页面与 Issue 详情关联维护；旧 D3/D4/D5-D6 数据安全迁移，纳入 SQLite/PostgreSQL、备份和数据库修正。
- 修复 Wing 颜色主题的受控回写：工作台选择白天、黑天或跟随系统后同步保存到应用偏好，并驱动 Element Plus 暗色变量。
- Issue 状态改为直接点选并自动换行；状态文案明确为「待处理 / 处理中 / 待验收 / 已完成 / 已取消」，终态单独分组，避免「已关闭」含义不清。
- Issue 采用“重要度 × 紧急度”二维模型并保持 `severity` / `priority` 存储兼容；两组四档值作为内置字典不可增删、停用或改编码，仅允许管理员修改显示名，快速编辑继续使用直接点选交互。
- 跟踪视图默认以 Issue 截止日替代创建日期；旧本地列配置自动迁移，创建日期仍可在列设置中手动开启。
- 点检项明确区分点检日与可选截止日：点检日可编辑并负责时间线排序，截止日可编辑、可清空且只负责逾期；卡片以「截止 / 点检」左右排列，表格和复制内容以截止为首列、点检日为末列。新增 SQLite/PostgreSQL 幂等迁移、旧备份兼容和后台数据库修正检查；无截止日是合法数据，不会逾期。「点检 · 时间线」在 Issue View 内恢复为常驻 Block，宽屏左右分栏并可拖动调宽，窄屏自动转为上下布局，不再依赖 Secondary 显隐。
- 修正日期型点检的逾期边界：截止日当天结束前不算逾期，次日开始标记逾期。
- phoenix-wing 前后端由 npm Registry `0.5.1` 精确升级至 `0.6.0`，同步更新消费者契约门禁并完成完整测试与构建验证。
- `single` 派生验证分支接入 `PnwWorkbenchShell`：一棵导航树供 Ribbon/Tree 共用，将 Router/Tab/session 收敛到产品 adapter；Footer 面板开关、页面/版本信息和工作台显示设置均使用 Wing 正式契约。
- 完善认证工作台子 View 的 Primary 覆盖：Dashboard 明确不提供 Primary；欢迎页、Issue 详情、推送历史、功能表和单元测试页新增页面专用导航、筛选或快捷操作，并保留 Bottom contribution。
- 将静态工作台导航树标记为非响应式，避免 Element Plus 图标组件被 Vue 深度代理并反复产生性能警告。

## v0.5.0（2026-07-20）

本版将 `package.json` 从 `0.4.0` 提升至 `0.5.0`，并收录此前积压在「未发布」中的能力（含飞书登录二期）。

- **登录方式设定（仅管理员）**：设置 → 登录方式可勾选「本地账号密码」「第三方登录」（可同时开，至少保留一种）；登录页与接口同步生效。存于 `systemFlags`。
- **飞书登录二期（管理员绑定 + 待审查）**：取消用户自助绑定；未绑定飞书登录写入 `externalBindRequests`；组织页管理员可绑定已有账号或新建并绑定；设置「表结构补全」幂等校验第三方登录表。设计归档见 `doc/第三方登录/`。**真实飞书点检已通过**（2026-07-21，见 `飞书登录点检用例.md`）。
- 飞书首期 OAuth（可配置启用、租户白名单、解绑/管理员撤销、备份不含令牌）保留；自助绑定已被二期取代。
- 统一仪表盘与列表管理的归档语义；列表管理搜索/筛选/分页与状态视图完善。
- phoenix-wing 精确锁定 Registry `0.4.2`，相关校验进入 `verify:ci`。
- 系统权限「查看」落实为全局只读；禁用/撤批/改密立即失效旧令牌；生产强制安全 JWT/管理员密码。
- 点检时间线、已作废状态、Issue 详情宽屏与操作列等交互改进。

## v0.4.0（2026-07-11）

- 包版本统一为 `0.4.0`。
- 修复 Express 5 类型与生产构建，恢复 `pnpm build` 全绿。
- 后端落实数据保护规则，并新增临时 SQLite 集成测试。
- 修复 Issue 编号索引命名冲突及旧库幂等迁移。
- 增加 Linux 内部测试部署和发布检查文档。

## v0.3.0

- Issue 支持多列表关联与列表级关注度。
- 新增功能表及 Issue 功能关联。
- 完善数据字典、系统管理、备份恢复和数据库修复能力。
- 升级列表交互、列设置、快速编辑与多 Tab 工作台。

## v0.2.0（2026-07-09）

### 列表详情页

- **三视图列设置**：简单 / 复杂 / 跟踪 分别配置显示列与顺序（localStorage 持久化）
- **表格交互**：标题/编号点击查看详情；严重度、优先级、状态、关注、责任人等快速编辑弹窗
- **操作列**：🔍 详情 · ✏️ 编辑 · 📤 推送 · ⋮ 更多
- **关注度**：列表文字标签；弹窗/编辑内 `AttentionStars` 五星控件（可清零）
- **筛选**：「只显示【不关注】」纯前端筛选
- **排序**：关注列可排序；默认关注度降序 → 优先级（紧急优先）

### Issue 编辑

- 编辑弹窗补充 8D 字段（D3/D4/D5-D6）
- 编辑模式可改本列表关注度

### 数据与 API

- **关注系数** 替代 `voided`：`attentionLevel` 0~5
- 迁移后删除 `voided` / `voidedAt` / `voidedBy` 三列
- 移除 `includeVoided` 查询参数及 `PATCH .../void`、`PATCH .../unvoid`
- 统一使用 `PATCH .../attention`

### 其他

- 版本号升至 0.2.0（状态栏自动读取）
- 单元测试页（系统管理员）
- 文档：`Issue列设计`、`IssueListLink关注系数`、使用手册、API 参考

---

## v0.1 原型（2026-06-30）

- SQLite + Express + Vue 3 基础 CRUD
- 列表、Issue、点检、推送、组织架构
