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

## 🔜 数据库收敛

- [ ] 本轮 `extensions` / `listCount` 完成后，独立清理 SQLite：正式运行仅支持 PostgreSQL，删除 SQLite 配置入口、同步适配层、旧 schema bridge 与专属测试；迁移前先归档旧 SQLite 数据导入 PostgreSQL 的操作说明。
