# TODO — phoenix-open-issue

## Step 1: 项目初始化

- [ ] `npm init` + Vite + Vue 3 + TypeScript
- [ ] 加入 pnpm workspace，引用 `phoenix-wing`（`workspace:*`）
- [ ] Element Plus + Pinia 安装配置
- [ ] 基础目录结构：`src/`, `src/pages/`, `src/layout/`

## Step 2: 壳层布局（搭积木）

- [ ] **AppShell.vue** — 顶层壳组件，组合 phoenix-wing 组件
  - [ ] `PnwRibbonTabBar` — 功能标签切换（系统 | Issue）
  - [ ] `PnwWorkbenchTabBar` — 页面标签栏
  - [ ] `PnwRibbonShell` — Ribbon 容器
    - [ ] `PnwRibbonGroup` + `PnwRibbonToolButton` — 工具按钮
  - [ ] `PnwSidebarBlock` — 左侧栏（筛选面板，可折叠）
  - [ ] `PnwShellLogPanel` — 底部日志面板
  - [ ] `PnwAppModalOverlay` — 全屏模态框（配置弹窗）
  - [ ] `PnwChoiceDialogHost` — 确认对话框
  - [ ] `PnwAsyncProgressOverlay` — 异步进度浮层
- [ ] Ribbon 配置（tabs / groups / items 数据定义）
- [ ] 注册图标映射 `pnwRegisterRibbonIcons`
- [ ] 注册 URL 解析器 `pnwRegisterUrlParser`
- [ ] Workbench 引擎 `pnwCreateWorkbench(config)`
- [ ] Ribbon Tab 切换 `usePnwRibbonTabs`
- [ ] 文档标题 `usePnwDocumentTitle`
- [ ] 色彩方案 `pnwResolveColorScheme` + `pnwApplyColorScheme`

## Step 3: 欢迎页

- [ ] **WelcomePage** — 基于 `PnwWelcomeShell`
  - [ ] slot `brand` — 应用 Logo/名称
  - [ ] slot `actions` — 打开工作空间按钮
  - [ ] slot `main` — 最近工程列表
  - [ ] slot `links` — 外链（Gitee / 文档）

## Step 4: 页面开发

- [ ] **IssueListPage** — Issue 列表
  - [ ] `PnwPageHeader` 页面标题
  - [ ] 表格 + 筛选 + 排序
  - [ ] 打开详情（触发 Tab 切换）
- [ ] **IssueDetailPage** — Issue 详情
  - [ ] `PnwPageHeader` 页面标题
  - [ ] 详情内容展示

## Step 5: 工作台体验（后续）

- [ ] 多 Tab 切换（列表 ↔ 详情）
- [ ] Tab 脏状态提示
- [ ] 从列表打开详情自动新建/复用 Tab

## Step 6: 属性面板（后续）

- [ ] `PnwSidebarBlock`（右侧）— 属性面板
- [ ] `pnwPagePropertiesHost` + `usePnwPagePropertySheet`
- [ ] `pnwPropGroup`, `pnwPropBool`, `pnwPropString` 等 — 属性表字段

## Step 7: 验证 & 反馈

- [ ] 框架组件在实际项目中是否好用
- [ ] 哪些功能需要补充到 phoenix-wing
- [ ] 文档查漏补缺
