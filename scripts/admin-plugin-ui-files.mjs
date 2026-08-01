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
  ['packages/web/src/views/TestRunnerView.vue', 'views/test-runner.vue'],

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
  ['packages/web/src/components/workbench/PoiTestRunnerPrimary.vue', 'components/workbench/PoiTestRunnerPrimary.vue'],

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
