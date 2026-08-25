import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

describe('Open Issue 本地 Pnw 工作台适配', () => {
  it('由组合 Shell 接管壳层，产品 Router 与 session 留在薄 adapter', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')
    const adapter = read('packages/web/src/composables/useOpenIssueWorkbench.ts')

    expect(shell).toContain('<PnwWorkbenchShell')
    expect(shell).not.toContain('<AppToolbar')
    expect(shell).not.toContain('<RibbonShell')
    expect(shell).not.toContain('<StatusBar')
    expect(shell).toContain('<router-view')
    expect(adapter).toContain('useRoute()')
    expect(adapter).toContain('pnwCreateWorkbench')
    expect(adapter).toContain("const SESSION_KEY = 'open-issue-tabs'")
  })

  it('由 AppShell 常驻 Bottom，页面 contribution 只替换内容而不控制可用性', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')

    expect(shell).toContain(':view-blocks="viewBlocks"')
    expect(shell).toContain('usePoiRegisteredViewContribution')
    expect(shell).toContain('const workbenchContributions: PnwViewBlockContributions = { bottom: true }')
    expect(shell).toContain(':contributions="workbenchContributions"')
    expect(shell).toContain(':bottom-tabs="WORKBENCH_BOTTOM_TABS"')
    expect(shell).toContain('<template #bottom>')
    expect(shell).toContain('v-if="viewBlocks.bottom"')
    expect(shell).toContain('<PoiWorkbenchBottom')
    expect(shell).not.toContain('<PnwShellLogPanel')
    expect(shell).toContain('<template #footer>')
    expect(shell).toContain('Open Issue List v{{ pkg.version }}')
    expect(shell).toContain(':show-ribbon-appearance-menu="true"')
    expect(shell).toContain('@update:presentation="workbenchStore.presentation = $event"')
    expect(shell).toContain(':display-settings-positions="workbenchStore.settingsPositions"')
    expect(shell).not.toContain('@toggle-log')
  })

  it('把 Wing 主题偏好接到应用根节点与 Element Plus 暗色变量', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')
    const main = read('packages/web/src/main.ts')
    const themeAdapter = read('packages/web/src/layout/workbench/usePoiColorScheme.ts')
    const globalStyle = read('packages/web/src/styles/global.scss')

    expect(shell).toContain('usePoiColorScheme(() => workbenchStore.colorScheme)')
    expect(shell).toContain('@update:color-scheme="workbenchStore.colorScheme = $event"')
    expect(main).toContain("element-plus/theme-chalk/dark/css-vars.css")
    expect(themeAdapter).toContain('pnwApplyColorScheme')
    expect(themeAdapter).toContain("classList.toggle('dark'")
    expect(globalStyle).toContain('var(--el-bg-color-page, #f5f7fa)')
    expect(globalStyle).toContain('html.dark')
  })

  it('页眉账号区垂直居中，并用带无障碍名称的图标退出', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')

    expect(shell).toContain("import { SwitchButton, UserFilled } from '@element-plus/icons-vue'")
    expect(shell).toContain('class="open-issue-account"')
    expect(shell).toContain('class="open-issue-user-avatar"')
    expect(shell).toContain('class="open-issue-logout"')
    expect(shell).toContain('aria-label="退出登录"')
    expect(shell).toContain('content="退出登录"')
    expect(shell).toContain('align-items: center')
    expect(shell).not.toContain('>退出</el-button>')
  })

  it('业务页面在 setup 登记真实 Primary 与 Bottom，Issue 时间线常驻页面正文', () => {
    const registry = read('packages/web/src/layout/workbench/poiViewContributions.ts')
    const dashboard = read('packages/web/src/views/DashboardView.vue')
    const welcome = read('packages/web/src/views/WelcomeView.vue')
    const listIndex = read('packages/web/src/views/lists/ListIndexView.vue')
    const listDetail = read('packages/web/src/views/lists/ListDetailView.vue')
    const issueDetail = read('packages/web/src/views/issues/IssueDetailView.vue')
    const org = read('packages/web/src/views/org/OrgTreeView.vue')
    const pushHistory = read('packages/web/src/views/push/PushHistoryView.vue')
    const eightDReports = read('packages/web/src/views/reports/EightDReportIndexView.vue')
    const functions = read('packages/web/src/views/functions/FunctionIndexView.vue')
    const testRunner = read('packages/web/src/views/TestRunnerView.vue')
    const settings = read('packages/web/src/views/SettingsView.vue')

    expect(registry).toContain('pnwCreateViewContributionRegistry')
    expect(registry).toContain('usePnwViewContribution')
    expect(registry).toContain('resolvePoiViewContributions')
    expect(read('packages/web/src/layout/workbench/poiWorkbenchPrimaryPolicy.ts'))
      .toContain("dashboard: 'none'")
    for (const source of [welcome, listIndex, listDetail, issueDetail, org, pushHistory, eightDReports, functions, testRunner, settings]) {
      expect(source).toContain('usePoiViewContribution')
    }
    expect(dashboard).not.toContain('usePoiViewContribution')
    expect(dashboard).not.toContain('PoiDashboardPrimary')
    expect(welcome).toContain('component: PoiWelcomePrimary')
    expect(listIndex).toContain('component: PoiIssueListPrimary')
    expect(listDetail).toContain('component: PoiIssueTablePrimary')
    expect(org).toContain('component: PoiOrgPrimary')
    expect(issueDetail).toContain('component: PoiIssueDetailPrimary')
    expect(issueDetail).not.toContain('secondary:')
    expect(issueDetail).toContain('<IssueCheckpointTimeline')
    expect(issueDetail).toContain('class="issue-timeline-splitter"')
    expect(pushHistory).toContain('component: PoiPushHistoryPrimary')
    expect(eightDReports).toContain('component: PoiEightDReportsPrimary')
    expect(functions).toContain('component: PoiFunctionPrimary')
    expect(testRunner).toContain('component: PoiTestRunnerPrimary')
    expect(settings).toContain('component: PoiSettingsPrimary')
    expect(settings).toContain('bottom:')
    expect(settings).toContain('component: PoiSettingsRepairBottom')
  })

  it('贡献组件不复制 Wing 的窄屏断点', () => {
    const contributionFiles = [
      'PoiDefaultPrimary.vue',
      'PoiFunctionPrimary.vue',
      'PoiIssueDetailPrimary.vue',
      'PoiIssueListPrimary.vue',
      'PoiIssueTablePrimary.vue',
      'PoiOrgPrimary.vue',
      'PoiPushHistoryPrimary.vue',
      'PoiEightDReportsPrimary.vue',
      'PoiSettingsPrimary.vue',
      'PoiSettingsRepairBottom.vue',
      'PoiTestRunnerPrimary.vue',
      'PoiWelcomePrimary.vue',
      'PoiWorkbenchBottom.vue',
    ]

    for (const file of contributionFiles) {
      const source = read(`packages/web/src/components/workbench/${file}`)
      expect(source).not.toContain('@media')
      expect(source).not.toContain('@container')
    }
  })

  it('既有 Ribbon contribution 只投影为一棵 Ribbon/Tree 共用导航树', () => {
    const navigation = read('packages/web/src/layout/workbench/openIssueNavigation.ts')
    const shell = read('packages/web/src/layout/AppShell.vue')

    expect(navigation).toContain('pnwNavigationFromRibbonTabs(RIBBON_TABS')
    expect(navigation).toContain('return markRaw(nodes)')
    expect(shell).toContain(':nodes="openIssueWorkbench.navigation.nodes"')
    expect(shell).toContain(':presentation="workbenchStore.presentation"')
  })

  it('Dashboard、列表与设置使用 Wing 页面布局，并让 Shell 取消旧 Editor inset', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')
    const pages = [
      read('packages/web/src/views/DashboardView.vue'),
      read('packages/web/src/views/lists/ListIndexView.vue'),
      read('packages/web/src/views/SettingsView.vue'),
    ]

    expect(shell).toContain("['dashboard', 'lists', 'settings']")
    expect(shell).toContain("'open-issue-editor--wing-page-layout': usesWingPageLayout")
    expect(shell).toContain('.open-issue-editor--wing-page-layout')
    for (const source of pages) {
      expect(source).toContain("phoenix-wing/layout/PnwPageLayout.vue")
      expect(source).toContain('<PnwPageLayout')
      expect(source).not.toContain('phoenix-wing/layout/PnwPageHeader.vue')
      expect(source).not.toContain(':deep(.pnw-head-')
    }
  })

  it('仅消费 Registry 0.7.1，且不保留本地 Wing resolver', () => {
    const rootManifest = JSON.parse(read('package.json'))
    const webManifest = JSON.parse(read('packages/web/package.json'))
    const serverManifest = JSON.parse(read('packages/server/package.json'))

    const pluginManifest = JSON.parse(read('packages/admin-plugin/package.json'))

    expect(webManifest.dependencies['phoenix-wing']).toBe('0.7.1')
    expect(serverManifest.dependencies['phoenix-wing']).toBe('0.7.1')
    expect(pluginManifest.peerDependencies['phoenix-wing']).toBe('0.7.1')
    expect(Object.keys(rootManifest.scripts).some(name => name.includes('local-wing'))).toBe(false)
    expect(() => read('scripts/open-issue-wing-mode.mjs')).toThrow()
  })

  it('使用归一化显示偏好 envelope，并让最后一个 Tab 关闭后保持空工作台', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')
    const store = read('packages/web/src/stores/workbench.ts')
    const adapter = read('packages/web/src/composables/useOpenIssueWorkbench.ts')

    expect(store).toContain('PnwWorkbenchDisplayPreferences')
    expect(store).toContain('pnwNormalizeWorkbenchDisplayPreferences')
    expect(store).toContain("const STORAGE_KEY = 'open-issue-workbench-preferences-v2'")
    expect(shell).toContain(':show-empty-view="openIssueWorkbench.tabs.empty"')
    expect(shell).toContain('openIssueWorkbenchController.tabs.empty.value ? null : route.fullPath')
    expect(adapter).toContain("const empty = computed(")
    expect(adapter).not.toContain("router.push('/dashboard')")
  })
})
