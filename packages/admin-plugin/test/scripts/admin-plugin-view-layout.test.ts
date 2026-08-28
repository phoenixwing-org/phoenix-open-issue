import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MAX_PRIMARY_VIEW_STATES,
  PRIMARY_SECTION_STORAGE_KEY,
  readPoiPrimarySectionStates,
  writePoiPrimarySectionStates,
} from '../../vue/phoenix-open-issue/components/workbench/poiPrimarySectionStorage'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const vueRoot = path.join(repoRoot, 'packages/admin-plugin/vue/phoenix-open-issue')

function readVue(relativePath: string) {
  return readFileSync(path.join(vueRoot, relativePath), 'utf8')
}

describe('Open Issue compact Editor layout', () => {
  it('uses only the current Phoenix Host imports and plugin APIs', () => {
    const listDetailSource = readVue('views/list-detail.vue')
    const issueDetailSource = readVue('views/issue-detail.vue')
    const contributionSource = readVue('layout/workbench/poiViewContributions.ts')

    expect(listDetailSource).toContain("from '/@/phoenix/PahViewDialogs'")
    expect(issueDetailSource).toContain("from '/@/phoenix/PahViewDialogs'")
    expect(contributionSource).toContain("from '/@/phoenix/PahViewContributions'")

    for (const source of [
      listDetailSource,
      issueDetailSource,
      contributionSource,
    ]) {
      expect(source).toContain('/@/phoenix/')
    }
  })

  it('uses the current Wing Editor and Primary layout primitives', async () => {
    const source = readVue('components/workbench/PoiCompactEditorView.vue')

    expect(source).toContain("import PnwPageLayout from 'phoenix-wing/layout/PnwPageLayout.vue'")
    expect(source).toContain('class="poi-compact-editor-view__body"')
    expect(source).not.toContain(':body-inset="false"')
    expect(source).not.toContain('padding: 0 16px;')
    expect(source).not.toContain('<style')
    expect(source).not.toContain('<PnwPageHeader')
    expect(source).not.toContain('subtitle?: string')
    expect(source).not.toContain('eyebrow?: string')
    expect(source).not.toContain('summary?: string')
    expect(source).not.toContain('description?: string')

    const primaryComponents = [
      'PoiDashboardPrimary.vue',
      'PoiEightDReportsPrimary.vue',
      'PoiFunctionPrimary.vue',
      'PoiIssueDetailPrimary.vue',
      'PoiIssueListPrimary.vue',
      'PoiIssueTablePrimary.vue',
      'PoiPushHistoryPrimary.vue',
    ]
    for (const fileName of primaryComponents) {
      const primarySource = readVue(`components/workbench/${fileName}`)
      expect(primarySource).toContain("import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'")
      expect(primarySource).toContain("import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'")
      expect(primarySource).toContain('usePoiPrimarySectionExpanded')
      expect(primarySource).toContain('<PnwPrimaryPanel')
      expect(primarySource).toContain('<PnwPrimarySection')
      expect(primarySource).toContain('v-model:expanded=')
      expect(primarySource).toContain('margin: 8px;')
      expect(primarySource).not.toContain('<aside')
      expect(primarySource).not.toMatch(/padding:\s*14px/u)
      expect(primarySource).not.toContain('primary-separator')
      expect(primarySource).not.toContain(':deep(.pnw-sidebar-block-body)')
      expect(primarySource).not.toContain('PnwExpandCaret')
    }

    const stateSource = readVue('components/workbench/poiPrimarySectionState.ts')
    const storageSource = readVue('components/workbench/poiPrimarySectionStorage.ts')
    expect(stateSource).toContain('expandedByView')
    expect(stateSource).toContain('viewKey: () => string')
    expect(stateSource).toContain('sectionId: string')
    expect(storageSource).toContain('MAX_PRIMARY_VIEW_STATES = 64')
    expect(storageSource).toContain("PRIMARY_SECTION_STORAGE_KEY = 'phoenix-open-issue.primary-sections.v1'")
    expect(stateSource).toContain('window.sessionStorage')

    const stableViewKeys = new Map([
      ['views/dashboard.vue', "viewKey: 'phoenix-open-issue-dashboard'"],
      ['views/eight-d-reports.vue', "viewKey: 'phoenix-open-issue-eight-d-reports'"],
      ['views/functions.vue', "viewKey: 'phoenix-open-issue-functions'"],
      ['views/lists.vue', "viewKey: 'phoenix-open-issue-lists'"],
      ['views/push-history.vue', "viewKey: 'phoenix-open-issue-push-history'"],
      ['views/list-detail.vue', 'viewKey: `phoenix-open-issue-list-detail:${listId.value}`'],
      ['views/issue-detail.vue', 'viewKey: `phoenix-open-issue-issue-detail:${issueId}`'],
    ])
    for (const [relativePath, viewKey] of stableViewKeys) {
      const viewSource = readVue(relativePath)
      expect(viewSource).toContain(viewKey)
      expect(viewSource).not.toContain('viewKey: route.fullPath')
      expect(viewSource).not.toContain('viewKey: route.query')
    }

    const stored = new Map<string, string>()
    const sessionStorage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    }
    const states = new Map<string, Map<string, boolean>>([
      ['phoenix-open-issue-dashboard', new Map([['scope', false]])],
    ])
    writePoiPrimarySectionStates(sessionStorage, states)
    expect(readPoiPrimarySectionStates(sessionStorage)).toEqual(states)

    const overLimit = new Map<string, Map<string, boolean>>()
    for (let index = 0; index <= MAX_PRIMARY_VIEW_STATES; index += 1) {
      overLimit.set(
        `phoenix-open-issue-list-detail:entity-${index}`,
        new Map([['filters', false]]),
      )
    }
    writePoiPrimarySectionStates(sessionStorage, overLimit)
    const bounded = readPoiPrimarySectionStates(sessionStorage)
    expect(bounded.size).toBe(MAX_PRIMARY_VIEW_STATES)
    expect(bounded.has('phoenix-open-issue-list-detail:entity-0')).toBe(false)
    expect(bounded.get('phoenix-open-issue-list-detail:entity-64')?.get('filters')).toBe(false)

    stored.set(PRIMARY_SECTION_STORAGE_KEY, '{not-json')
    expect(readPoiPrimarySectionStates(sessionStorage).size).toBe(0)
  })

  function expectSharedLayout(relativePath: string, ariaLabel: string) {
    const source = readVue(relativePath)
    const openingTag = source.match(/<PoiCompactEditorView[\s\S]*?>/u)?.[0] ?? ''

    expect(source).toContain("components/workbench/PoiCompactEditorView.vue")
    expect(openingTag).toContain(`<PoiCompactEditorView`)
    expect(source).toContain(`content-aria-label="${ariaLabel}"`)
    expect(source).not.toContain("phoenix-wing/layout/PnwPageHeader.vue")
    expect(source).not.toContain('class="page"')
    expect(source).not.toContain('padding: 0 16px;')
    expect(openingTag).not.toContain(':subtitle=')
    expect(openingTag).not.toContain(':eyebrow=')
    expect(openingTag).not.toContain(':summary=')
    expect(openingTag).not.toContain(':description=')
    expect(source).not.toContain('PnwViewPresentationPortal')
    expect(source).not.toContain('pnw-floating-panel__header')
  }

  it('lets the dashboard consume the shared compact Editor shell', () => {
    expectSharedLayout('views/dashboard.vue', 'Open Issue 仪表盘')
  })

  it('lets 8D reports consume the shared compact Editor shell', () => {
    expectSharedLayout('views/eight-d-reports.vue', '8D 报告列表')
  })

  it('lets the function table consume the shared compact Editor shell', () => {
    expectSharedLayout('views/functions.vue', 'Open Issue 功能表')
  })

  it('lets list management consume the shared compact Editor shell', () => {
    expectSharedLayout('views/lists.vue', 'Open Issue 列表管理')
  })

  it('lets list detail consume the shared compact Editor shell', () => {
    expectSharedLayout('views/list-detail.vue', 'Open Issue 列表详情')
  })

  it('lets push history consume the shared compact Editor shell', () => {
    expectSharedLayout('views/push-history.vue', 'Open Issue 推送历史')
  })

  it('uses the shared single-line View layout for full Issue detail', () => {
    const source = readVue('views/issue-detail.vue')
    const listSource = readVue('views/list-detail.vue')
    const configSource = readVue('config.ts')
    const formSource = readVue('components/IssueFormDialog.vue')

    expectSharedLayout('views/issue-detail.vue', 'Open Issue 详情')
    expect(source).toContain("components/workbench/PoiCompactEditorView.vue")
    expect(source).not.toContain('const ownerRoutePath = route.path')
    expect(source).not.toContain('class="hdr-btn-close"')
    expect(source).not.toContain('function goBack()')
    expect(source).not.toContain('PnwViewPresentationPortal')
    expect(source).not.toContain('pnwCreateViewPresentationRecord')
    expect(source).not.toContain('presentation-detachable')
    expect(source).not.toContain('@detach-view')
    expect(source).not.toContain('.issue-view-main {')
    expect(source).not.toContain('PnwAppModalOverlay')
    expect(source).not.toContain('show-close-action')
    expect(listSource).toContain('void router.push(`/open-issue/issue/${id}`)')
    expect(listSource).not.toContain('PnwAppModalOverlay')
    expect(listSource).not.toContain('IssueDetailView')
    expect(listSource).not.toContain('issue-detail-modal')
    expect(configSource).toContain("rendererId: ISSUE_FORM_DIALOG_RENDERER_ID")
    expect(configSource).toContain("load: () => import('./components/IssueFormDialog.vue')")
    expect(configSource).toContain('movable: true')
    expect(configSource).toContain('resizable: true')
    expect(formSource).toContain('PnwViewDialogRendererContext')
    expect(formSource).toContain('props.dialog.submit(result)')
    expect(formSource).toContain('props.dialog.cancel()')
    expect(formSource).not.toContain('<el-dialog')
    expect(formSource).not.toContain('PnwFloatingPanel')
    expect(listSource).toContain("usePhoenixViewDialog()")
    expect(listSource).toContain('instanceKey: `create:${listId.value}`')
    expect(listSource).toContain('instanceKey: `edit:${row.id}`')
    expect(source).toContain("usePhoenixViewDialog()")
    expect(source).toContain('instanceKey: `edit:${issueId}`')
    for (const consumer of [listSource, source]) {
      expect(consumer).not.toContain('requestId:')
      expect(consumer).not.toContain('viewId:')
      expect(consumer).not.toContain('PnwFloatingPanel')
    }
  })

  it('keeps every View Header single-line and moves long list context into main', () => {
    const viewPaths = [
      'views/dashboard.vue',
      'views/eight-d-reports.vue',
      'views/functions.vue',
      'views/lists.vue',
      'views/list-detail.vue',
      'views/issue-detail.vue',
      'views/push-history.vue',
    ]

    for (const viewPath of viewPaths) {
      const source = readVue(viewPath)
      const openingTag = source.match(/<PoiCompactEditorView[\s\S]*?>/u)?.[0] ?? ''
      expect(openingTag).toContain('<PoiCompactEditorView')
      expect(openingTag).not.toContain(':subtitle=')
      expect(openingTag).not.toContain(':eyebrow=')
      expect(openingTag).not.toContain(':summary=')
      expect(openingTag).not.toContain(':description=')
      expect(source).not.toContain('PnwViewPresentationPortal')
      expect(source).not.toContain('pnw-floating-panel__header')
    }

    const listDetailSource = readVue('views/list-detail.vue')
    expect(listDetailSource).toContain('v-if="headerSubtitle"')
    expect(listDetailSource).toContain(':title="headerSubtitle"')
    expect(listDetailSource).toContain('class="list-context-note"')
  })

  it('leaves the Host maintenance center as the only maintenance UI', () => {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'packages/admin-plugin/manifest.json'), 'utf8'))
    const controllerSource = readFileSync(
      path.join(repoRoot, 'packages/admin-plugin/midway/phoenix-open-issue/controller/admin/index.ts'),
      'utf8',
    )
    const management = manifest.navigation.modules.find(
      (module: any) => module.id === 'phoenix-open-issue-management',
    )

    expect(manifest.routes.map((route: any) => route.path)).not.toContain('/open-issue/maintenance')
    expect(manifest.routes.map((route: any) => route.path)).not.toContain('/open-issue/test-runner')
    expect(manifest.capabilities.map((item: any) => item.id)).not.toEqual(expect.arrayContaining([
      'phoenix-open-issue:maintenance:read',
      'phoenix-open-issue:maintenance:run',
      'phoenix-open-issue:test:read',
      'phoenix-open-issue:test:run',
    ]))
    expect(management.routeIds).toEqual(['phoenix-open-issue-functions'])
    expect(existsSync(path.join(vueRoot, 'views/maintenance.vue'))).toBe(false)
    expect(controllerSource).not.toMatch(/@(Get|Post)\(["']\/(?:maintenance|test)\//u)
  })

  it('keeps legacy repair logic quarantined until the Host adapter schema is frozen', () => {
    const domainSource = readFileSync(
      path.join(repoRoot, 'packages/admin-plugin/midway/phoenix-open-issue/domain/maintenance.ts'),
      'utf8',
    )
    const controllerSource = readFileSync(
      path.join(repoRoot, 'packages/admin-plugin/midway/phoenix-open-issue/controller/admin/index.ts'),
      'utf8',
    )

    expect(domainSource).toContain("'checkpoints'")
    expect(domainSource).toContain("'links'")
    expect(domainSource).toContain("'list-org-references'")
    expect(controllerSource).not.toContain('OpenIssueMaintenanceService')
    expect(controllerSource).not.toContain('OpenIssueLegacyImportService')
    expect(controllerSource).not.toContain('OpenIssueTestRunnerService')
  })
})
