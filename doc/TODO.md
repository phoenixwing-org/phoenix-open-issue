# TODO — phoenix-open-issue

## 🔒 界面保真与变更授权

- Open Issue 全部业务页面以旧版本为原型，只做新 Host、Wing 与 Cool 契约适配；适配后的布局、入口、信息层级和交互不得随其他任务自行删改。
- 后台管理页面可因 Cool 兼容进行必要调整；调整完成后同样不得被其他维护、字典或数据任务删除或简化。
- 只有用户明确下达对应页面的界面修改指令，才允许改变已冻结 UI；接口、权限、数据与测试冲突一律以已验收页面为主做薄接入。

## ✅ 已完成

| 组件 | 位置 | 状态 |
|------|------|------|
| PnwChoiceDialogHost | AppShell | ✅ |
| PnwAsyncProgressOverlay | AppShell | ✅ |
| PnwAppModalOverlay | AppShell | ✅ |
| PnwRibbonShell + PnwRibbonGroup + PnwRibbonToolButton | RibbonShell | ✅ |
| PnwRibbonTabBar（可切换 Issue/系统） | AppToolbar | ✅ |
| PnwPageHeader | DashboardView | ✅ |
| PnwWelcomeShell | WelcomeView | ✅ |
| PnwShellLogPanel | AppShell 底部 | ✅ |
| pnwRegisterRibbonIcons + setupRibbonIcons | main.ts | ✅ |
| usePnwDocumentTitle | AppShell | ✅ |

## 🔜 多 Tab 工作台

- [x] PnwWorkbenchTabBar — 在 AppToolbar header 中显示页面标签
- [x] pnwCreateWorkbench — Tab 管理引擎（开/关/切/去重）
- [x] Ribbon 按钮点击 → openTab → 多 Tab 并存
- [ ] Tab 关闭确认（pnwPromptChoice）

## 🔜 属性面板

- [ ] PnwSidebarBlock（右侧）— Issue 详情属性面板
- [ ] pnwPagePropertiesHost + usePnwPagePropertySheet
- [ ] pnwPropGroup / pnwPropBool / pnwPropString 等构建属性表
- [ ] 各页面注册属性表，Tab 切换自动切换属性面板

## 🔜 对话框统一

- [x] ElMessageBox.confirm → pnwPromptChoice（5 个文件）
- [x] 补充 pnwPromptInput 到 phoenix-wing（文本输入对话框）
- [x] 补充 pnwAlert 到 phoenix-wing（简单消息弹窗）

## 🔜 Wing 共享编辑抽屉

- [ ] 作为第二个真实消费者参与 Wing `PnwEditorDrawerHost` 契约验证；最终名称与公开 API 以 Wing 主计划为准
- [ ] 优先用 `IssueFormDialog` 的新建/编辑流程提供消费 fixture，保留 Open Issue 自己的 DTO、API、权限和领域校验
- [ ] Wing 契约稳定前不在本仓复制通用抽屉 Host，也不为接入而重写现有业务表单
- [ ] 接入验收覆盖 dirty 关闭确认、异步保存、工作台多 Tab 状态隔离、独立路由回退、Esc 与焦点恢复

## 🔧 phoenix-wing 适配反馈

- [x] pnwPromptInput — PushHistoryView, ListDetailView 需要文本输入
- [x] pnwAlert — SettingsView 需要简单消息提示
- [x] Ribbon 切换模块时自动过滤 Ribbon 按钮（usePnwRibbonTabs 待接入）

## 🔜 功能待办

- [x] 界面巡游（Guided Tour）— 页面 `?` 帮助 + 欢迎页总揽
- [x] Ribbon 单/双行切换透传
- [x] 设置页实现
- [ ] Issue 列扩展（汽车行业 21 字段）
- [x] 推送确认/拒绝工作流
- [ ] 权限细化（列表级 + Issue 级）
- [ ] 搜索与全文检索
- [x] phoenix-wing 组件向 npm 包收敛

## 🔜 字典显示与旧站数据迁移（等待开发者决策）

### 当前事实与前端显示缺口

- [x] 已只读预检旧站 `migration-2026-08-03.json`：v1 / `full`，8 类 Issue 业务数据共 **41** 行；`users`（4）、`orgUnits`（5）、`dict`（52）被明确排除。
- [x] 插件已通过 `host-dict.ts` 从 COOL namespaced 字典读取 7 个分组，并具备 Host 缺失时的内置中文 fallback。
- [x] 已修正 Host 字典 label 解析：`name` 非空且不等于稳定 value 时才作为有效自定义显示名；`minor` 回退“一般”，`project` / `monthly` / `custom` 回退内置中文，真实 Host 自定义 label 仍优先。
- [x] 插件 Pinia 字典缓存已只持久化 `groupName` / `value` / `label` / `sortOrder` / `enabled` / `tags` 非敏感显示元数据：启动同步恢复，进入已登录插件刷新 Host 字典，Host 全局登出清除；登出前在途响应不会回填。业务 API 继续只返回稳定 value，不为列表/Issue 查询重复拼接 label。适配与生命周期新增 5 项回归；连同导入判重门禁，插件受控清单共 23 文件 / 134 测试通过。
- [x] 真实旧站 JSON 已通过服务端领域规划器：41 行、4 个核心用户引用、0 个组织引用、0 个结构阻断；旧版 IssueList 的 `orgUnitId` 未进入任何 View/编辑/筛选/权限或更新流程，迁移时统一置空且不导入 `orgUnits`。用户在维护页通过 Host 公共用户列表做唯一精确建议或手工映射，只提交 ID 对照，旧账号资料不上传。
- [x] 8D 已降为不阻断的可选迁移通道：存在独立报告时以其为准；缺失时可从 Issue 内嵌三字段生成确定性报告；坏记录、创建人未映射或目标 8D 表不可用时只跳过并报告。目标记录按最终 ID 优先，否则按 `(relatedIssueId, containment, rootCause, correctiveAction)` 精确签名判重，已存在项不导入且进入计划审计。
- [x] 已提供一次性简化导入：`POST /maintenance/legacy-import/plan` 验证核心协议、引用、完整的数字 Host 用户映射、目标冲突和快照。当前 Issue 仅处于少量测试数据阶段，相同 ID、`issueNo`、`(listId,userId)` 成员、`(issueId,listId)` 链接或 `(platform,externalId)` 功能均直接判重：逐条列出源/目标 ID、保留目标并跳过；`issueNo` 重复时把链接、点检、推送和 8D 简单改指向现有 Issue，功能重复时把 `functionId` 改指向现有功能，不做字段级复杂合并。计划 15 分钟且只能认领一次；Root 勾选“已有可恢复 PostgreSQL 备份”并二次确认后，`POST /maintenance/legacy-import/execute` 按固定依赖顺序以单事务写入剩余核心插件表，再独立尝试可选 8D 事务。核心失败自动回滚；8D 失败只报告且不回滚核心业务。不读取或修改 Host 私有用户表，不自动创建账号，也不由插件验证/生成整库备份。未来出现大规模迁移需求时再升级严格校验和人工冲突处置。
- [x] 2026-08-04 已在本地 Hub/PostgreSQL 使用 41 行真实测试包完成两轮执行验收：首轮计划写入 40 行，核心写入 37、按相同 Issue 编号跳过 1、可选 8D 写入 3；第二轮核心写入 0、重复跳过 38，可选 8D 写入 0、已存在跳过 3。重复执行未新增数据，确定性判重与幂等导入正常。
- [x] 维护中心新增幂等任务 `list-org-references`：dry-run 只统计 `oip_issue_list.orgUnitId` 非空行，确认执行后统一置空；第二次计划必须为 0，不修改 Host 组织，也不在普通维护操作中执行 DDL。

### 待开发者决定：字典作为独立迁移数据集

- [x] 52 条 `dict` 已作为独立候选数据集完成只读预检，不随 41 条业务数据进入服务端提交物；7 个 `(Issue group → COOL namespaced key)` 映射、行数、排序、停用、旧 tags 和 Host 显示名冲突已进入报告。
- [x] `severity`、`priority` 和核心 `listType` 共 12 项已冻结 value、顺序与启用；核心身份以 manifest `itemClass='core'` 为权威，legacy `core` tag 只作证据。显示名冲突只报告，不自动覆盖。
- [x] Admin 总控已决定 52 条字典不永久排除：Host 字典治理 0002、Node/Vue 与 Issue manifest policyVersion 部署后，升级为独立显式计划，与当前 Host 57 项 catalog 逐项比对；仍不得随 41 行业务数据导入。Host 已有 label 的逐项保留/覆盖选择留给计划确认。
- [x] Admin 总控已冻结 Host 字典列方向：二态只用 `enabled boolean`，不增加重复 `status`；`tags text[]` 为简单分类且不建 tag 表；`core boolean` 与 `ownerModuleId` 由 manifest/Pah 派生。当前 `dict_info` 尚无这些列，legacy tags 仍只读，不能借用 `remark` 落库。
- [ ] Host 侧按独立任务实现并发布 `schema/0002-dictionary-governance.sql`、Node CRUD/core guard/Pah reconcile metadata、Vue 字典列/筛选及 `/pah/dictionary-maintenance` View；DDL 必须走可信 PostgreSQL 备份与恢复演练，普通 View 按钮不得 `ALTER TABLE`。
- [ ] 设计服务端受控流程：预检 → 可信 PostgreSQL 备份 → 恢复演练 → 单事务执行 → 行数/唯一性/引用/前端缓存刷新验证 → 精确回滚。插件 UI 不直接写库、不伪造备份凭据。
- [x] 已确认 legacy tag 计数：`core=12`、`general=13`、`automotive=8`、`software=29`；当前 COOL 无 tags 内置列，因此只读保留，不能把旧 SQL 语义无审查复制为 COOL 通用概念。是否新增 Host 结构化列仍待决定。

### 待开发者决定：处置四字段的紧凑模式

- [ ] 将 **重要度、紧急度、关注度、状态** 作为一个“处置”能力簇点检；它们当前在简单、复杂、跟踪三种列表模式中都是独立列，且点击后各开单字段编辑。
- [ ] 设计默认紧凑模式：一个“处置”列以 2×2 紧凑标签显示四项；点击进入一个固定四行的“处置编辑”面板，当前选择仅浅色高亮，可一次保存多个已变化字段。
- [ ] 保留复杂/审计模式中的独立列、原排序键和导出字段；列设置升级时将旧用户偏好无损迁移，避免合并列后失去按重要度、紧急度、关注度或状态排序的能力。
- [ ] 决定快速入口：默认只保留联合编辑，或允许点击紧凑标签直接定位到该行；避免同时出现两个不一致的编辑交互。
- [ ] 点检窄屏、深浅色、无编辑权限、局部字段权限、脏关闭确认、并发更新和列表刷新后的高亮状态。

## 🔜 数据库收敛

- [ ] 本轮 `extensions` / `listCount` 完成后，独立清理 SQLite：正式运行仅支持 PostgreSQL，删除 SQLite 配置入口、同步适配层、旧 schema bridge 与专属测试；迁移前先归档旧 SQLite 数据导入 PostgreSQL 的操作说明。
