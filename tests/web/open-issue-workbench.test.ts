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

  it('由当前 View contribution 决定四区内容，并保留 Footer 与显示设置入口', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')

    expect(shell).toContain(':view-blocks="viewBlocks"')
    expect(shell).toContain('usePoiRegisteredViewContribution')
    expect(shell).not.toContain(':contributions="{ bottom: true }"')
    expect(shell).not.toContain('<template #bottom>')
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
    expect(main).toContain("element-plus/theme-chalk/dark/css-vars.css")
    expect(themeAdapter).toContain('pnwApplyColorScheme')
    expect(themeAdapter).toContain("classList.toggle('dark'")
    expect(globalStyle).toContain('var(--el-bg-color-page, #f5f7fa)')
    expect(globalStyle).toContain('html.dark')
  })

  it('业务页面在 setup 登记真实 Primary、Secondary 与 Bottom 内容', () => {
    const registry = read('packages/web/src/layout/workbench/poiViewContributions.ts')
    const dashboard = read('packages/web/src/views/DashboardView.vue')
    const listIndex = read('packages/web/src/views/lists/ListIndexView.vue')
    const listDetail = read('packages/web/src/views/lists/ListDetailView.vue')
    const issueDetail = read('packages/web/src/views/issues/IssueDetailView.vue')
    const org = read('packages/web/src/views/org/OrgTreeView.vue')
    const settings = read('packages/web/src/views/SettingsView.vue')

    expect(registry).toContain('pnwCreateViewContributionRegistry')
    expect(registry).toContain('usePnwViewContribution')
    for (const source of [dashboard, listIndex, listDetail, issueDetail, org, settings]) {
      expect(source).toContain('usePoiViewContribution')
    }
    expect(dashboard).toContain('component: PoiDashboardPrimary')
    expect(listIndex).toContain('component: PoiIssueListPrimary')
    expect(listDetail).toContain('component: PoiIssueTablePrimary')
    expect(org).toContain('component: PoiOrgPrimary')
    expect(issueDetail).toContain('secondary:')
    expect(issueDetail).toContain('component: PoiIssueCheckpointsSecondary')
    expect(settings).toContain('component: PoiSettingsPrimary')
    expect(settings).toContain('bottom:')
    expect(settings).toContain('component: PoiSettingsRepairBottom')
  })

  it('贡献组件不复制 Wing 的窄屏断点', () => {
    const contributionFiles = [
      'PoiDashboardPrimary.vue',
      'PoiIssueCheckpointsSecondary.vue',
      'PoiIssueListPrimary.vue',
      'PoiIssueTablePrimary.vue',
      'PoiOrgPrimary.vue',
      'PoiSettingsPrimary.vue',
      'PoiSettingsRepairBottom.vue',
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
    expect(shell).toContain(':nodes="openIssueWorkbench.navigation.nodes"')
    expect(shell).toContain(':presentation="workbenchStore.presentation"')
  })

  it('本地 Wing 不污染 Registry 0.5.1 依赖图', () => {
    const rootManifest = JSON.parse(read('package.json'))
    const webManifest = JSON.parse(read('packages/web/package.json'))
    const serverManifest = JSON.parse(read('packages/server/package.json'))

    expect(webManifest.dependencies['phoenix-wing']).toBe('0.5.1')
    expect(serverManifest.dependencies['phoenix-wing']).toBe('0.5.1')
    expect(rootManifest.scripts['dev:local-wing']).toContain('run-with-phoenix-wing.mjs')
    expect(rootManifest.scripts['verify:local-wing']).toContain('run-with-phoenix-wing.mjs')
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
