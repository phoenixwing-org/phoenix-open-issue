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

  it('使用 Wing Footer 切换标准 Bottom Panel，并显示工作台显示设置入口', () => {
    const shell = read('packages/web/src/layout/AppShell.vue')

    expect(shell).toContain(':contributions="{ bottom: true }"')
    expect(shell).toContain('<template #bottom>')
    expect(shell).toContain('<PnwShellLogPanel')
    expect(shell).toContain('<template #footer>')
    expect(shell).toContain('Open Issue List v{{ pkg.version }}')
    expect(shell).toContain(':show-ribbon-appearance-menu="true"')
    expect(shell).toContain('@update:presentation="workbenchStore.presentation = $event"')
    expect(shell).not.toContain('@toggle-log')
  })

  it('既有 Ribbon contribution 只投影为一棵 Ribbon/Tree 共用导航树', () => {
    const navigation = read('packages/web/src/layout/workbench/openIssueNavigation.ts')
    const shell = read('packages/web/src/layout/AppShell.vue')

    expect(navigation).toContain('pnwNavigationFromRibbonTabs(RIBBON_TABS')
    expect(shell).toContain(':nodes="openIssueWorkbench.navigation.nodes"')
    expect(shell).toContain(':presentation="workbenchStore.presentation"')
  })

  it('本地 0.5.2 不污染 Registry 0.5.1 依赖图', () => {
    const rootManifest = JSON.parse(read('package.json'))
    const webManifest = JSON.parse(read('packages/web/package.json'))
    const serverManifest = JSON.parse(read('packages/server/package.json'))

    expect(webManifest.dependencies['phoenix-wing']).toBe('0.5.1')
    expect(serverManifest.dependencies['phoenix-wing']).toBe('0.5.1')
    expect(rootManifest.scripts['dev:local-wing']).toContain('run-with-phoenix-wing.mjs')
    expect(rootManifest.scripts['verify:local-wing']).toContain('run-with-phoenix-wing.mjs')
  })
})
