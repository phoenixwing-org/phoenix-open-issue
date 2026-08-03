# TODO — phoenix-open-issue

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

## 🔜 旧站迁移包与数据字典治理（等待开发者决策）

### 已点检事实（2026-08-04）

- [x] 只读预检 `migration-2026-08-03.json`：v1 / `full`，8 类 Issue 业务数据共 **41** 行（列表 4、成员 6、Issue 4、关联 7、点检 12、8D 3、推送 4、功能 1）。
- [x] `users`（4）、`orgUnits`（5）、`dict`（52）已被迁移界面明确排除；当前没有把这些数据写入目标数据库。
- [x] 当前旧接口 `POST /db/import` 是全库备份的 `replace|merge` 导入，包含用户和字典；它没有 Host 可信备份引用、恢复演练凭据、按数据集预检/冲突报告或受控执行计划，**不能直接作为新迁移入口**。
- [x] 已确认 7 个现有字典分组：`issueCategory`、`detectionPhase`、`orgUnitType`、`severity`、`priority`、`closeReason`、`listType`。前端现在优先 API/持久化缓存的 `label`，缺失或旧数据将 `label` 原样写为 `value` 时，使用内置中文显示兜底；业务表仍只保存稳定 `value`。

### 待开发者决定：迁移包中的字典是否、如何导入

- [ ] 决定字典是否继续永远排除，还是作为独立的“字典数据集”受控导入；不要随业务表导入隐式执行。
- [ ] 若导入：冻结按 `(groupName, value)` 的冲突策略（保留目标标签 / 覆盖标签 / 人工逐项选择），并明确 `sortOrder`、`enabled`、`tags` 的合并规则与预览报告格式。
- [ ] 若导入：系统内置项必须只校验并修正允许字段；`severity` / `priority` 的 value、顺序、启用状态和标签不可被迁移包覆盖，只允许经批准的显示名策略。
- [ ] 若导入：设计“预检 → 可信 PostgreSQL 备份 → 恢复演练 → 单事务执行 → 行数/唯一性/引用/前端刷新验证 → 精确回滚”的服务端流程；客户端不得直接写库、上传后立即执行或伪造备份凭据。
- [ ] 确定迁移包的版本兼容策略：v1 裸/全量包、未来数据集清单、未知字段处理、校验和、重复 ID / `(groupName,value)` 检测与可读错误报告。

### 待开发者决定：内置值、标签与单一真源

- [ ] 明确哪些分组和值属于不可变协议，哪些只是可扩展预设。当前 `severity` / `priority` 是固定四档且仅可改显示名；`listType` 有四项 `core` 与若干 `general` 扩展项；其余预设可追加。
- [ ] 合并内置中文默认值的维护真源。当前值分别存在 Core 前端兜底、服务端 `seed.ts` 与 `DictService` 预设中；在不改变现有行为的前提下，确定共享定义或生成方式，避免新值只在一端显示英文协议值。
- [ ] 冻结标签语义和治理：`core`、`general`、`automotive`、`software` 是否允许导入包追加、合并或移除；保留现有标准化格式 `,tag1,tag2,`、精确匹配与引用保护。
- [ ] 决定软件/汽车预设中同一 value 的不同中文 label（如组织类型）的产品级优先级；不能由导入顺序隐式决定。

### 待开发者决定：前端字典缓存与旧功能收口

- [ ] 评审当前前端策略：启动先恢复非敏感字典缓存，登录/首个受保护路由后从 `GET /dict` 刷新；确定是否需要 schema 版本、TTL/ETag、登出清除、字典变更后的跨标签页失效和离线提示。
- [ ] 保持后端检索简化：Issue、列表和组织 API 返回稳定 value；中文 label 由前端字典缓存翻译。不得为每个列表/Issue 查询重复 JOIN 字典标签。
- [ ] 为设置页的新增、编辑、停用、按标签批量停用、预设追加、去重、引用保护和“数据库修正 → 字典补全”建立用户点检矩阵；本轮不改变这些旧功能的权限或写入逻辑。
- [ ] 在新受控导入方案验收后，评估旧 `GET /db/export` / `POST /db/import` 是否保留为管理员备份恢复、改为受限兼容入口，或迁移后废弃；迁移前不得删除。

## 🔜 数据库收敛

- [ ] 本轮 `extensions` / `listCount` 完成后，独立清理 SQLite：正式运行仅支持 PostgreSQL，删除 SQLite 配置入口、同步适配层、旧 schema bridge 与专属测试；迁移前先归档旧 SQLite 数据导入 PostgreSQL 的操作说明。
