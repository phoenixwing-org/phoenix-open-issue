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

  function persist() {
    localStorage.setItem('open-issue-settings', JSON.stringify({
      colWidths: colWidths.value,
      maxTimelineRows: maxTimelineRows.value,
      defaultViewMode: defaultViewMode.value,
      cpYearThresholdMonths: cpYearThresholdMonths.value,
      issueSort: issueSort.value,
    }))
  }

  watch(colWidths, persist, { deep: true })
  watch(maxTimelineRows, persist)
  watch(defaultViewMode, persist)
  watch(cpYearThresholdMonths, persist)
  watch(issueSort, persist)

  function setColWidth(col: string, width: number) {
    colWidths.value[col] = width
  }

  return { colWidths, maxTimelineRows, defaultViewMode, cpYearThresholdMonths, issueSort, setColWidth }
})
