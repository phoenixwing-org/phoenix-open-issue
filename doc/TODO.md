# TODO

## Step 1: 项目初始化
- [ ] `npm init` + Vite + Vue 3 + TypeScript
- [ ] 加入 pnpm workspace（引用 phoenix-wing）
- [ ] Element Plus 配置
- [ ] Pinia 配置

## Step 2: 壳层搭建（搭积木）
- [ ] index.vue — 顶层壳组件
  - [ ] PnwRibbonShell + PnwRibbonTabBar
  - [ ] PnwWorkbenchTabBar
  - [ ] PnwSidebarBlock（左侧筛选/属性）
  - [ ] PnwShellLogPanel（底部日志）
  - [ ] PnwAppModalOverlay（配置弹层）
  - [ ] PnwChoiceDialogHost（确认对话框）
  - [ ] PnwAsyncProgressOverlay（异步进度）
- [ ] Ribbon 配置（tabs/groups/items）
- [ ] 注册图标映射（pnwRegisterRibbonIcons）
- [ ] 注册 URL 解析器（pnwRegisterUrlParser）
- [ ] Workbench 引擎配置（pnwCreateWorkbench）
- [ ] Ribbon Tab 切换（usePnwRibbonTabs）
- [ ] 文档标题同步（usePnwDocumentTitle）
- [ ] 主题/色彩方案（pnwResolveColorScheme）

## Step 3: 页面开发
- [ ] WelcomePage — 欢迎页
- [ ] IssueListPage — Issue 列表
- [ ] IssueDetailPage — Issue 详情

## Step 4: 验证 & 反馈
- [ ] 框架组件在实际项目中是否好用
- [ ] 需要补充哪些组件/功能到 phoenix-wing
- [ ] 文档完善
