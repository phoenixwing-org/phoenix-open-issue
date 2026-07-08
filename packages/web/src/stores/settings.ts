import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const stored = localStorage.getItem('open-issue-settings')
  const data = stored ? JSON.parse(stored) : {}

  const colWidths = ref<Record<string, number>>(data.colWidths || {})
  const maxTimelineRows = ref<number>(data.maxTimelineRows || 3)
  const defaultViewMode = ref<string>(data.defaultViewMode || 'complex')
  const cpYearThresholdMonths = ref<number>(data.cpYearThresholdMonths ?? 2)  // 点检日期隐藏年份的月数阈值
  const issueSort = ref<string>(data.issueSort || 'createdAt:desc')            // Issue 排序，格式 "field:dir"，如 "severity:desc"
  const orgIncludeChildren = ref<boolean>(data.orgIncludeChildren !== false)    // 组织架构：默认含下级
  const funcNumericSort = ref<boolean>(data.funcNumericSort !== false)           // 功能表：外部ID按数字排序，默认勾选
  const funcSearch = ref<string>(data.funcSearch || '')                          // 功能表：搜索关键词

  function persist() {
    localStorage.setItem('open-issue-settings', JSON.stringify({
      colWidths: colWidths.value,
      maxTimelineRows: maxTimelineRows.value,
      defaultViewMode: defaultViewMode.value,
      cpYearThresholdMonths: cpYearThresholdMonths.value,
      issueSort: issueSort.value,
      orgIncludeChildren: orgIncludeChildren.value,
      funcNumericSort: funcNumericSort.value,
      funcSearch: funcSearch.value,
    }))
  }

  watch(colWidths, persist, { deep: true })
  watch(maxTimelineRows, persist)
  watch(defaultViewMode, persist)
  watch(cpYearThresholdMonths, persist)
  watch(issueSort, persist)
  watch(orgIncludeChildren, persist)
  watch(funcNumericSort, persist)
  watch(funcSearch, persist)

  function setColWidth(col: string, width: number) {
    colWidths.value[col] = width
  }

  return { colWidths, maxTimelineRows, defaultViewMode, cpYearThresholdMonths, issueSort, orgIncludeChildren, funcNumericSort, funcSearch, setColWidth }
})
