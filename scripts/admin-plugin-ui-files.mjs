export const ADMIN_PLUGIN_VUE_ROOT = 'packages/admin-plugin/vue/phoenix-open-issue'

export const ISSUE_UI_FILE_MAPPINGS = [
  ['packages/web/src/views/DashboardView.vue', 'views/dashboard.vue'],
  ['packages/web/src/views/lists/ListIndexView.vue', 'views/lists.vue'],
  ['packages/web/src/views/lists/ListDetailView.vue', 'views/list-detail.vue'],
  ['packages/web/src/views/issues/IssueDetailView.vue', 'views/issue-detail.vue'],
  ['packages/web/src/views/push/PushDialog.vue', 'views/push/PushDialog.vue'],
  ['packages/web/src/views/push/PushHistoryView.vue', 'views/push-history.vue'],
  ['packages/web/src/views/reports/EightDReportIndexView.vue', 'views/eight-d-reports.vue'],
  ['packages/web/src/views/functions/FunctionIndexView.vue', 'views/functions.vue'],
  ['packages/web/src/views/SettingsView.vue', 'views/maintenance.vue'],

  ['packages/web/src/components/AttentionStars.vue', 'components/AttentionStars.vue'],
  ['packages/web/src/components/CheckpointFormDialog.vue', 'components/CheckpointFormDialog.vue'],
  ['packages/web/src/components/CheckpointStatusTag.vue', 'components/CheckpointStatusTag.vue'],
  ['packages/web/src/components/EightDReportDialog.vue', 'components/EightDReportDialog.vue'],
  ['packages/web/src/components/IssueCheckpointTimeline.vue', 'components/IssueCheckpointTimeline.vue'],
  ['packages/web/src/components/IssueColumnSettingsDialog.vue', 'components/IssueColumnSettingsDialog.vue'],
  ['packages/web/src/components/IssueFormDialog.vue', 'components/IssueFormDialog.vue'],
  ['packages/web/src/components/IssueListCell.vue', 'components/IssueListCell.vue'],
  ['packages/web/src/components/IssueQuickEditDialog.vue', 'components/IssueQuickEditDialog.vue'],
  ['packages/web/src/components/ListFormDialog.vue', 'components/ListFormDialog.vue'],
  ['packages/web/src/components/MemberManageDialog.vue', 'components/MemberManageDialog.vue'],
  ['packages/web/src/components/PageHelpButton.vue', 'components/PageHelpButton.vue'],
  ['packages/web/src/components/dashboard/DashboardTaskCenter.vue', 'components/dashboard/DashboardTaskCenter.vue'],
  ['packages/web/src/components/workbench/PoiEightDReportsPrimary.vue', 'components/workbench/PoiEightDReportsPrimary.vue'],
  ['packages/web/src/components/workbench/PoiIssueDetailPrimary.vue', 'components/workbench/PoiIssueDetailPrimary.vue'],
  ['packages/web/src/components/workbench/PoiIssueListPrimary.vue', 'components/workbench/PoiIssueListPrimary.vue'],
  ['packages/web/src/components/workbench/PoiIssueTablePrimary.vue', 'components/workbench/PoiIssueTablePrimary.vue'],
  ['packages/web/src/components/workbench/PoiPushHistoryPrimary.vue', 'components/workbench/PoiPushHistoryPrimary.vue'],
  ['packages/web/src/components/workbench/PoiFunctionPrimary.vue', 'components/workbench/PoiFunctionPrimary.vue'],
  ['packages/web/src/components/workbench/PoiTestRunnerPrimary.vue', 'components/workbench/PoiMaintenancePrimary.vue'],

  ['packages/web/src/api/auth.ts', 'api/auth.ts'],
  ['packages/web/src/api/checkpoints.ts', 'api/checkpoints.ts'],
  ['packages/web/src/api/dashboard.ts', 'api/dashboard.ts'],
  ['packages/web/src/api/dict.ts', 'api/dict.ts'],
  ['packages/web/src/api/eightDReports.ts', 'api/eightDReports.ts'],
  ['packages/web/src/api/functions.ts', 'api/functions.ts'],
  ['packages/web/src/api/issueLists.ts', 'api/issueLists.ts'],
  ['packages/web/src/api/issues.ts', 'api/issues.ts'],
  ['packages/web/src/api/push.ts', 'api/push.ts'],
  ['packages/web/src/api/test.ts', 'api/test.ts'],
  ['packages/web/src/api/request.ts', 'api/request.ts'],

  ['packages/web/src/composables/useDictGroup.ts', 'composables/useDictGroup.ts'],
  ['packages/web/src/config/issueListColumns.ts', 'config/issueListColumns.ts'],
  ['packages/web/src/content/pageHelp.ts', 'content/pageHelp.ts'],
  ['packages/web/src/layout/workbench/poiViewContributions.ts', 'layout/workbench/poiViewContributions.ts'],
  ['packages/web/src/stores/auth.ts', 'stores/auth.ts'],
  ['packages/web/src/stores/dict.ts', 'stores/dict.ts'],
  ['packages/web/src/stores/functions.ts', 'stores/functions.ts'],
  ['packages/web/src/stores/issueLists.ts', 'stores/issueLists.ts'],
  ['packages/web/src/stores/issues.ts', 'stores/issues.ts'],
  ['packages/web/src/stores/settings.ts', 'stores/settings.ts'],
  ['packages/web/src/utils/listLifecycle.ts', 'utils/listLifecycle.ts'],
]

export const ISSUE_CORE_SOURCE_ROOT = 'packages/core/src'
export const ISSUE_CORE_TARGET_ROOT = `${ADMIN_PLUGIN_VUE_ROOT}/core`

export const ISSUE_UI_FIDELITY_MAPPINGS = ISSUE_UI_FILE_MAPPINGS.filter(
  ([source]) => source.endsWith('.vue'),
)

// 迁移后新增、没有 legacy 一对一文件的 Host/Wing 布局组件；仍必须经过
// 语义颜色与结构指纹门禁，并计入插件 UI/业务闭包。
export const ISSUE_UI_NEW_TARGETS = [
  'components/workbench/PoiDashboardPrimary.vue',
  'components/workbench/PoiCompactEditorView.vue',
]

const ISSUE_PRIMARY_STRUCTURE_REQUIRED = [
  "import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'",
  "import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'",
  'usePoiPrimarySectionExpanded',
  '<PnwPrimaryPanel',
  '<PnwPrimarySection',
  'v-model:expanded=',
  'margin: 8px;',
]

const ISSUE_PRIMARY_STRUCTURE_FORBIDDEN = [
  '<aside',
  'padding: 14px',
  'primary-separator',
  ':deep(.pnw-sidebar-block-body)',
  'PnwExpandCaret',
  'ArrowRight',
]

/**
 * 迁移期允许的最小产品修正。每项必须声明理由和 UI 结构指纹；保真门禁只会
 * 放行这些已审计差异，其余 template/style 偏差仍直接失败。
 */
export const ISSUE_UI_INTENTIONAL_DELTAS = new Map([
  ['components/workbench/PoiDashboardPrimary.vue', {
    reason: '仪表盘区段、范围和状态筛选改用 Wing PrimaryPanel/Section，折叠状态由插件按稳定 View key 持有，业务控件保留 8px inset',
    requiredUi: [
      ...ISSUE_PRIMARY_STRUCTURE_REQUIRED,
      'aria-label="仪表盘导航与筛选"',
      "activeSection === 'overview'",
      'onSelectScope',
      'onSelectLifecycle',
      '<el-segmented',
    ],
    forbiddenUi: ISSUE_PRIMARY_STRUCTURE_FORBIDDEN,
  }],
  ['components/workbench/PoiCompactEditorView.vue', {
    reason: '七个数据型 View 统一复用最新 Wing PnwPageLayout；正文由默认 PnwPageMainBlock 消费 Host 10px 密度与语义主题 token，Issue 不再自建 gutter',
    requiredUi: [
      "import PnwPageLayout from 'phoenix-wing/layout/PnwPageLayout.vue'",
      'class="poi-compact-editor-view__body"',
    ],
    forbiddenUi: [':body-inset="false"', 'padding: 0 16px;', '<style'],
  }],
  ['views/dashboard.vue', {
    reason: '仪表盘改用 Wing Primary 承载区段和列表筛选，Editor 只保留页头动作与业务内容；同时删除 Host-owned 账号审批/演示数据壳',
    requiredUi: ['component: PoiDashboardPrimary', "viewKey: 'phoenix-open-issue-dashboard'", 'onSelectScope:', 'data-tour="dashboard-views"', '<PoiCompactEditorView', 'content-aria-label="Open Issue 仪表盘"'],
    forbiddenUi: ["activeDashboardTab === 'admin'", 'showSeedPrompt', 'getSeedStatus'],
  }],
  ['views/lists.vue', {
    reason: '列表范围与检索统一进入 Primary，页头只保留新建动作；页面复用 Wing PnwPageLayout 默认 MainBlock，不再自建左右 16px；全局/已删除范围使用独立 Cool list:admin capability',
    requiredUi: ["viewKey: 'phoenix-open-issue-lists'", 'listView: listView.value', 'onSelectView:', '<PoiCompactEditorView', 'content-aria-label="Open Issue 列表管理"'],
    forbiddenUi: ['data-tour="lists-status"', 'PnwPageHeader', 'class="page"', 'padding: 0 16px;'],
  }],
  ['components/workbench/PoiIssueListPrimary.vue', {
    reason: '列表范围与筛选改用 Wing PrimaryPanel/Section，折叠状态由插件按稳定 View key 持有，业务控件保留 8px inset',
    requiredUi: [...ISSUE_PRIMARY_STRUCTURE_REQUIRED, 'aria-label="列表范围"', 'onSelectView', 'v-if="canAdministerLists"', 'title="筛选列表"'],
    forbiddenUi: ISSUE_PRIMARY_STRUCTURE_FORBIDDEN,
  }],
  ['views/list-detail.vue', {
    reason: '数据筛选与表格显示设置统一进入 Primary；页面复用 Wing PnwPageLayout 默认 MainBlock，页头只保留列表级动作；Issue/点检/推送按钮同时满足 Cool capability 与插件资源角色',
    requiredUi: ['viewKey: `phoenix-open-issue-list-detail:${listId.value}`', 'class="permission-note"', "capabilities.can('phoenix-open-issue:issue:read')", 'viewMode: viewMode.value', 'onOpenColumnSettings:', '<PoiCompactEditorView', 'content-aria-label="Open Issue 列表详情"'],
    forbiddenUi: ['class="filters"', 'data-tour="list-view-toggle"', 'PnwPageHeader', 'class="page"', 'padding: 0 16px;'],
  }],
  ['components/workbench/PoiIssueTablePrimary.vue', {
    reason: '列表详情筛选与显示设置拆为 Wing PrimarySection，折叠状态按列表实体 key 隔离，删除产品分隔线并保留 8px 控件 inset',
    requiredUi: [...ISSUE_PRIMARY_STRUCTURE_REQUIRED, 'aria-label="Issue 显示方式"', 'onOpenColumnSettings', 'maxTimelineRows', 'title="显示方式"'],
    forbiddenUi: ISSUE_PRIMARY_STRUCTURE_FORBIDDEN,
  }],
  ['views/issue-detail.vue', {
    reason: '详情页保留四向 16px 与业务卡片；页头只保留页面级编辑/推送，8D 新建留在章节内，Primary 只导航；各动作分别消费 Cool capability',
    requiredUi: [
      ':can-create="canCreateCheckpoint"',
      ':can-update="canUpdateCheckpoint"',
      'viewKey: `phoenix-open-issue-issue-detail:${issueId}`',
      'box-sizing: border-box;',
      'padding: 16px;',
      'color: var(--el-text-color-primary,',
      'background: var(--el-bg-color-page,',
      'background: var(--el-bg-color,',
    ],
    forbiddenUi: ['<DocumentAdd />'],
  }],
  ['components/workbench/PoiIssueDetailPrimary.vue', {
    reason: 'Issue 摘要与章节导航改用 Wing PrimaryPanel/Section，折叠状态按 Issue 实体 key 隔离；标题与编辑/推送/返回动作仍由页头拥有',
    requiredUi: [...ISSUE_PRIMARY_STRUCTURE_REQUIRED, '<span>详情导航</span>', 'onNavigateSection', 'aria-label="Issue 章节"'],
    forbiddenUi: [...ISSUE_PRIMARY_STRUCTURE_FORBIDDEN, 'onEdit', 'onPush', '快速操作', ':title="title"'],
  }],
  ['views/push-history.vue', {
    reason: 'Primary 只筛选状态，刷新回到页头页面级动作；页面复用 Wing PnwPageLayout 默认 MainBlock，不再自建左右 16px',
    requiredUi: ["viewKey: 'phoenix-open-issue-push-history'", '<Refresh />', '<PoiCompactEditorView', 'content-aria-label="Open Issue 推送历史"'],
    forbiddenUi: ['onRefresh: load', 'PnwPageHeader', 'class="page"', 'padding: 0 16px;'],
  }],
  ['components/workbench/PoiPushHistoryPrimary.vue', {
    reason: '推送状态与计数改用 Wing PrimaryPanel/Section，折叠状态由插件按稳定 View key 持有；刷新动作仍由 Editor 页头拥有',
    requiredUi: [...ISSUE_PRIMARY_STRUCTURE_REQUIRED, 'title="推送状态"', 'counts[option.value]'],
    forbiddenUi: [...ISSUE_PRIMARY_STRUCTURE_FORBIDDEN, 'onRefresh', '刷新记录'],
  }],
  ['views/eight-d-reports.vue', {
    reason: '8D 列表使用统一紧凑 Editor；Primary 只筛选，页头只保留搜索与创建，写操作由 Cool report:write 与插件资源权限共同控制',
    requiredUi: ["viewKey: 'phoenix-open-issue-eight-d-reports'", 'row._canModify && canCreate', 'class="view-table"', '<PoiCompactEditorView', 'content-aria-label="8D 报告列表"'],
  }],
  ['views/functions.vue', {
    reason: '功能表使用统一紧凑 Editor，筛选只在 Primary、刷新/新建/导入/导出只在页头，并修复 legacy 停用生命周期缺口',
    requiredUi: [
      "viewKey: 'phoenix-open-issue-functions'",
      'v-if="canWriteFunctions"',
      'prop="enabled" label="状态"',
      "row.enabled ? '启用' : '停用'",
      '@click="onEnable(row)"',
      '<Refresh />',
      '<Upload />',
      '<PoiCompactEditorView',
      'content-aria-label="Open Issue 功能表"',
    ],
  }],
  ['components/AttentionStars.vue', {
    reason: '关注星级保留原交互与语义，仅将 readonly、星色、提示和 hover 切到 Host 语义 token',
    requiredUi: ['var(--el-color-warning,', 'var(--el-text-color-secondary,', 'var(--el-color-primary,'],
  }],
  ['components/CheckpointFormDialog.vue', {
    reason: '点检表单保留原对话框层级，仅将 Issue 上下文提示切到 Host primary token',
    requiredUi: ['background: var(--el-color-primary-light-9,', 'border-left: 3px solid var(--el-color-primary,'],
  }],
  ['components/ListFormDialog.vue', {
    reason: '列表表单保留原字段和对话框；负责人选择仅在消费 Cool base:sys:user:list 后显示和提交',
    requiredUi: [
      "capabilities.has('base:sys:user:list')",
      'canEditOwner && isEdit && canListHostUsers',
      'getAllUsers()',
    ],
  }],
  ['components/IssueCheckpointTimeline.vue', {
    reason: '点检时间线保留状态算法与语义 token，并把读取、创建、更新拆到对应 Cool capability',
    requiredUi: ['v-if="!canRead"', 'v-if="canCreate"', ':disabled="!canUpdate"', "done: 'var(--el-color-success,", "voided: 'var(--el-color-danger,"],
  }],
  ['views/push/PushDialog.vue', {
    reason: '移除 legacy viewer 角色筛选；用户目标只在 Cool 用户列表权限可用时展示，列表推送保持可用',
    requiredUi: ['v-if="canListHostUsers" value="user"'],
    forbiddenUi: ['systemRole'],
  }],
  ['components/dashboard/DashboardTaskCenter.vue', {
    reason: '删除 Host-owned 账号审批 Tab，仅保留 Issue 推送待办，并按 Cool push/issue capability 显示动作；内容紧贴页头且待办行使用 BOM 直角紧凑样式',
    requiredUi: ['v-if="canHandlePush"', 'v-if="canReadPushHistory"', 'v-if="canReadIssue"', 'padding-top: 0;', 'border-radius: 0;'],
    forbiddenUi: ['pendingUsers', 'externalBindRequests', 'approveUser', 'systemRole'],
  }],
  ['components/IssueColumnSettingsDialog.vue', {
    reason: '列设置对话框保留结构与圆角，仅将提示、边界和 hover 切到 Host 语义 token',
    requiredUi: ['border: 1px solid var(--el-border-color-lighter,', 'background: var(--el-fill-color-light,'],
  }],
  ['components/IssueListCell.vue', {
    reason: '列表单元格保留点检、超期和快捷编辑语义，仅将文本、状态面和 hover 切到 Host 语义 token',
    requiredUi: ['background: var(--el-color-danger-light-9,', 'color: var(--el-text-color-primary,', 'background: var(--el-color-primary-light-9,'],
  }],
  ['components/IssueQuickEditDialog.vue', {
    reason: '快捷编辑保留四级业务语义与渐变，仅将四级颜色和提示文字切到 Element Plus token',
    requiredUi: ['--dimension-color: var(--el-color-success,', '--dimension-color: var(--el-color-danger,', 'linear-gradient(90deg, var(--el-color-success,'],
  }],
  ['components/MemberManageDialog.vue', {
    reason: '成员对话框保留结构，仅将提示与占位文字切到 Host 语义 token',
    requiredUi: ['color: var(--el-text-color-secondary,', 'color: var(--el-text-color-placeholder,'],
  }],
  ['components/PageHelpButton.vue', {
    reason: '页内帮助保留交互，仅按 Wing 优先、Element Plus 回退消费文字、hover 与边界 token',
    requiredUi: ['var(--pnw-workbench-muted,', 'var(--pnw-workbench-hover-bg,', 'var(--pnw-workbench-border,'],
  }],
  ['components/workbench/PoiFunctionPrimary.vue', {
    reason: '功能筛选改用 Wing PrimaryPanel/Section，折叠状态由插件按稳定 View key 持有，并保留 legacy 启用/停用/全部状态筛选',
    requiredUi: [
      ...ISSUE_PRIMARY_STRUCTURE_REQUIRED,
      ':model-value="statusFilter"',
      'aria-label="功能状态"',
      '<el-option label="停用" value="disabled" />',
    ],
    forbiddenUi: ISSUE_PRIMARY_STRUCTURE_FORBIDDEN,
  }],
  ['components/workbench/PoiEightDReportsPrimary.vue', {
    reason: '8D 关联状态与计数改用 Wing PrimaryPanel/Section，折叠状态由插件按稳定 View key 持有；创建动作仍留在 Editor 页头',
    requiredUi: [...ISSUE_PRIMARY_STRUCTURE_REQUIRED, 'title="关联状态"', 'counts[option.value]'],
    forbiddenUi: [...ISSUE_PRIMARY_STRUCTURE_FORBIDDEN, 'onCreate', 'canCreate', '新建 8D 报告'],
  }],
  ['components/workbench/PoiMaintenancePrimary.vue', {
    reason: '维护导航改用 Wing PrimaryPanel/Section，折叠状态由插件按稳定维护 View key 持有，继续统一数据修正、单元测试和审计区段',
    requiredUi: [
      ...ISSUE_PRIMARY_STRUCTURE_REQUIRED,
      'aria-label="Open Issue 维护导航"',
      "activeSection === 'repair'",
      "activeSection === 'tests'",
      "activeSection === 'audit'",
      'canReadMaintenance',
      'canReadTests',
    ],
    forbiddenUi: ISSUE_PRIMARY_STRUCTURE_FORBIDDEN,
  }],
  ['views/maintenance.vue', {
    reason: '维护与单元测试合并为一个 Wing Workbench View；四种 capability 独立控制内容和动作，刷新、dry-run、repair 和测试过程追加到 Host 全局 Output，View 只保留任务、测试清单、ledger 和报告动作',
    requiredUi: [
      'component: PoiMaintenancePrimary',
      "viewKey: 'phoenix-open-issue-maintenance'",
      "activeSection === 'repair'",
      "activeSection === 'tests'",
      "activeSection === 'audit'",
      'v-if="canRunMaintenance"',
      'v-if="canRunTests"',
      '@click="onPreviewTask(row.id)"',
      '>预览 dry-run</el-button>',
      '@click="onRepairTask(row.id)"',
      'title="Open Issue 维护"',
      'data-tour="settings-repair"',
      'aria-labelledby="maintenance-tests-title"',
      'empty-text="尚无修正审计记录"',
      'usePahWorkbenchOutput',
      'workbenchOutput?.appendLine',
      'repairPlanOutputLines(plan)',
      'repairResultOutputLines(results)',
      'testResultOutputLines(data)',
      'maintenanceFailureOutputLine',
      '已取消：${taskTitle}，未执行写入',
      'if (announce) appendOutput',
      '<PoiCompactEditorView',
      'content-aria-label="Open Issue 维护内容"',
    ],
    forbiddenUi: [
      'title="单元测试"',
      'PoiTestRunnerPrimary',
      'PoiSettingsRepairBottom',
      'aria-label="最近一次 dry-run 计划"',
      'aria-label="数据库修正结果"',
      'workbenchOutput?.clear',
    ],
  }],
])
