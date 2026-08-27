import { readFileSync } from 'node:fs'
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
  it('uses the current Wing Editor and Primary layout primitives', async () => {
    const source = readVue('components/workbench/PoiCompactEditorView.vue')

    expect(source).toContain("import PnwPageLayout from 'phoenix-wing/layout/PnwPageLayout.vue'")
    expect(source).toContain('class="poi-compact-editor-view__body"')
    expect(source).not.toContain(':body-inset="false"')
    expect(source).not.toContain('padding: 0 16px;')
    expect(source).not.toContain('<style')
    expect(source).not.toContain('<PnwPageHeader')

    const primaryComponents = [
      'PoiDashboardPrimary.vue',
      'PoiEightDReportsPrimary.vue',
      'PoiFunctionPrimary.vue',
      'PoiIssueDetailPrimary.vue',
      'PoiIssueListPrimary.vue',
      'PoiIssueTablePrimary.vue',
      'PoiMaintenancePrimary.vue',
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
      ['views/maintenance.vue', "viewKey: 'phoenix-open-issue-maintenance'"],
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

    expect(source).toContain("components/workbench/PoiCompactEditorView.vue")
    expect(source).toContain(`<PoiCompactEditorView`)
    expect(source).toContain(`content-aria-label="${ariaLabel}"`)
    expect(source).not.toContain("phoenix-wing/layout/PnwPageHeader.vue")
    expect(source).not.toContain('class="page"')
    expect(source).not.toContain('padding: 0 16px;')
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

  it('lets maintenance consume the shared compact Editor shell', () => {
    expectSharedLayout('views/maintenance.vue', 'Open Issue 维护内容')
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

  it('lets the full Issue detail View move through the Wing presentation portal', () => {
    const source = readVue('views/issue-detail.vue')
    const listSource = readVue('views/list-detail.vue')
    const configSource = readVue('config.ts')
    const formSource = readVue('components/IssueFormDialog.vue')

    expect(source).toContain('class="page"')
    expect(source).toContain('PnwViewPresentationPortal')
    expect(source).toContain('pnwCreateViewPresentationRecord')
    expect(source).toContain("rendererId: 'phoenix-open-issue.view.issue-detail'")
    expect(source).toContain('viewInstanceId: `phoenix-open-issue.issue-detail:${issueId}`')
    expect(source).toContain('ownerTabId: `issueDetail:${issueId}`')
    expect(source).toContain('instanceKey: `issue:${issueId}`')
    expect(source).toContain('v-model:record="presentationRecord"')
    expect(source).toContain(':presentation-detachable="mode === \'embedded\'"')
    expect(source).toContain('@detach-view="detach"')
    expect(source).toContain('v-if="mode === \'embedded\'" class="hdr-btn-close"')
    expect(source).toContain('.issue-view-main {')
    expect(source).not.toContain('PnwAppModalOverlay')
    expect(source).not.toContain('show-close-action')
    expect(source).not.toContain('components/workbench/PoiCompactEditorView.vue')
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

  it('keeps unit tests inside the maintenance View and hides the compatibility route', () => {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'packages/admin-plugin/manifest.json'), 'utf8'))
    const maintenance = manifest.routes.find((route: any) => route.id === 'phoenix-open-issue-maintenance')
    const legacyTest = manifest.routes.find((route: any) => route.id === 'phoenix-open-issue-test-runner')
    const management = manifest.navigation.modules.find(
      (module: any) => module.id === 'phoenix-open-issue-management',
    )
    const visibleManagementRoutes = management.routeIds.filter((routeId: string) =>
      manifest.routes.find((route: any) => route.id === routeId)?.isShow !== false,
    )
    const source = readVue('views/maintenance.vue')

    expect(maintenance.viewPath).toBe('modules/phoenix-open-issue/views/maintenance.vue')
    expect(legacyTest).toMatchObject({
      viewPath: 'modules/phoenix-open-issue/views/maintenance.vue',
      isShow: false,
    })
    expect(visibleManagementRoutes).toContain('phoenix-open-issue-maintenance')
    expect(visibleManagementRoutes).not.toContain('phoenix-open-issue-test-runner')
    expect(source).toContain("activeSection === 'tests'")
    expect(source).toContain("path.endsWith('/test-runner')")
    expect(source).toContain("path.endsWith('/maintenance')")
    expect(source).toContain('component: PoiMaintenancePrimary')
    expect(source).not.toContain('PoiTestRunnerPrimary')
  })

  it('separates read-only repair dry-run from confirmed repair execution', () => {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'packages/admin-plugin/manifest.json'), 'utf8'))
    const source = readVue('views/maintenance.vue')
    const readCapability = manifest.capabilities.find(
      (item: any) => item.id === 'phoenix-open-issue:maintenance:read',
    )
    const runCapability = manifest.capabilities.find(
      (item: any) => item.id === 'phoenix-open-issue:maintenance:run',
    )

    expect(readCapability.endpoints).toContainEqual({
      method: 'GET',
      path: '/admin/phoenix-open-issue/maintenance/repair-plan',
    })
    expect(runCapability.endpoints).toContainEqual({
      method: 'POST',
      path: '/admin/phoenix-open-issue/maintenance/repair',
    })
    expect(runCapability.endpoints).toContainEqual({
      method: 'POST',
      path: '/admin/phoenix-open-issue/maintenance/legacy-import/plan',
    })
    expect(runCapability.endpoints).toContainEqual({
      method: 'POST',
      path: '/admin/phoenix-open-issue/maintenance/legacy-import/execute',
    })
    expect(source).toContain('await planLegacyImport(legacyImportSubmission.value')
    expect(source).toContain('await executeLegacyImport(plan.planId')
    expect(source).toContain('v-model="legacyImportBackupConfirmed"')
    expect(source).toContain("'确认执行一次性旧站导入'")
    expect(source).toContain('服务端只读计划完成')
    expect(source).toContain('不执行写入')
    expect(source).toContain('8D 采用独立可选事务')
    expect(source).toContain('mappedLegacyUserCount.value === legacyImportPreview.value.userReferences.length')
    expect(source).toContain('async function onPreviewTask')
    expect(source).toContain('if (!canReadMaintenance.value) return')
    expect(source).toContain('@click="onPreviewTask(row.id)"')
    expect(source).toContain('>预览 dry-run</el-button>')
    expect(source).toContain('v-if="canRunMaintenance"')
    expect(source).toContain('if (!canRunMaintenance.value) return')
    expect(source).toContain('@click="onRepairTask(row.id)"')
  })
})
