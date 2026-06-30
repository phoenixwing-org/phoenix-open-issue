import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const stored = localStorage.getItem('open-issue-settings')
  const data = stored ? JSON.parse(stored) : {}

  const colWidths = ref<Record<string, number>>(data.colWidths || {})
  const maxTimelineRows = ref<number>(data.maxTimelineRows || 3)
  const defaultViewMode = ref<string>(data.defaultViewMode || 'complex')

  function persist() {
    localStorage.setItem('open-issue-settings', JSON.stringify({
      colWidths: colWidths.value,
      maxTimelineRows: maxTimelineRows.value,
      defaultViewMode: defaultViewMode.value,
    }))
  }

  watch(colWidths, persist, { deep: true })
  watch(maxTimelineRows, persist)
  watch(defaultViewMode, persist)

  function setColWidth(col: string, width: number) {
    colWidths.value[col] = width
  }

  return { colWidths, maxTimelineRows, defaultViewMode, setColWidth }
})
