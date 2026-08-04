import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  ISSUE_LIST_COLUMNS_VERSION,
  upgradeIssueListColumns,
  type IssueListColumnSettings,
  DEFAULT_ISSUE_SORT,
} from '/$/phoenix-open-issue/config/issueListColumns'
import {
  normalizePoiPrimarySectionExpansion,
  readPoiPrimarySectionExpanded,
  writePoiPrimarySectionExpanded,
} from '/$/phoenix-open-issue/core/algorithms/primary-section-state'

export const useSettingsStore = defineStore('phoenix-open-issue-settings', () => {
  const stored = localStorage.getItem('open-issue-settings')
  const data = stored ? JSON.parse(stored) : {}

  const colWidths = ref<Record<string, number>>(data.colWidths || {})
  const maxTimelineRows = ref<number>(data.maxTimelineRows || 3)
  const checkpointTimelineOrder = ref<'desc' | 'asc'>(data.checkpointTimelineOrder === 'asc' ? 'asc' : 'desc')
  const checkpointTimelineDisplay = ref<'cards' | 'table'>(data.checkpointTimelineDisplay === 'table' ? 'table' : 'cards')
  const issueTimelineWidth = ref<number>(Math.min(720, Math.max(360, Number(data.issueTimelineWidth) || 440)))
  const defaultViewMode = ref<string>(data.defaultViewMode || 'complex')
  const cpYearThresholdMonths = ref<number>(data.cpYearThresholdMonths ?? 2)  // 最近点检的点检日隐藏年份阈值
  const legacySort = data.issueSort === 'createdAt:desc' ? DEFAULT_ISSUE_SORT : (data.issueSort || DEFAULT_ISSUE_SORT)
  const issueSort = ref<string>(legacySort)
  const orgIncludeChildren = ref<boolean>(data.orgIncludeChildren !== false)    // 组织架构：默认含下级
  const funcNumericSort = ref<boolean>(data.funcNumericSort !== false)           // 功能表：外部ID按数字排序，默认勾选
  const funcSearch = ref<string>(data.funcSearch || '')                          // 功能表：搜索关键词
  const primarySectionExpanded = ref(normalizePoiPrimarySectionExpansion(data.primarySectionExpanded))
  const issueListColumns = ref<IssueListColumnSettings>(upgradeIssueListColumns(
    data.issueListColumns,
    Number(data.issueListColumnsVersion) || 0,
  ))

  function persist() {
    localStorage.setItem('open-issue-settings', JSON.stringify({
      colWidths: colWidths.value,
      maxTimelineRows: maxTimelineRows.value,
      checkpointTimelineOrder: checkpointTimelineOrder.value,
      checkpointTimelineDisplay: checkpointTimelineDisplay.value,
      issueTimelineWidth: issueTimelineWidth.value,
      defaultViewMode: defaultViewMode.value,
      cpYearThresholdMonths: cpYearThresholdMonths.value,
      issueSort: issueSort.value,
      orgIncludeChildren: orgIncludeChildren.value,
      funcNumericSort: funcNumericSort.value,
      funcSearch: funcSearch.value,
      primarySectionExpanded: primarySectionExpanded.value,
      issueListColumns: issueListColumns.value,
      issueListColumnsVersion: ISSUE_LIST_COLUMNS_VERSION,
    }))
  }

  watch(colWidths, persist, { deep: true })
  watch(maxTimelineRows, persist)
  watch(checkpointTimelineOrder, persist)
  watch(checkpointTimelineDisplay, persist)
  watch(issueTimelineWidth, persist)
  watch(defaultViewMode, persist)
  watch(cpYearThresholdMonths, persist)
  watch(issueSort, persist)
  watch(orgIncludeChildren, persist)
  watch(funcNumericSort, persist)
  watch(funcSearch, persist)
  watch(primarySectionExpanded, persist, { deep: true })
  watch(issueListColumns, persist, { deep: true })

  function setColWidth(col: string, width: number) {
    colWidths.value[col] = width
  }

  function setIssueListColumns(cols: IssueListColumnSettings) {
    issueListColumns.value = upgradeIssueListColumns(cols, ISSUE_LIST_COLUMNS_VERSION)
  }

  function getPrimarySectionExpanded(viewId: string, sectionId: string, defaultExpanded = true) {
    return readPoiPrimarySectionExpanded(
      primarySectionExpanded.value,
      viewId,
      sectionId,
      defaultExpanded,
    )
  }

  function setPrimarySectionExpanded(viewId: string, sectionId: string, expanded: boolean) {
    primarySectionExpanded.value = writePoiPrimarySectionExpanded(
      primarySectionExpanded.value,
      viewId,
      sectionId,
      expanded,
    )
  }

  return {
    colWidths, maxTimelineRows, checkpointTimelineOrder, checkpointTimelineDisplay, issueTimelineWidth, defaultViewMode, cpYearThresholdMonths, issueSort,
    orgIncludeChildren, funcNumericSort, funcSearch, primarySectionExpanded, issueListColumns,
    setColWidth, setIssueListColumns, getPrimarySectionExpanded, setPrimarySectionExpanded,
  }
})
