import { computed, reactive, type WritableComputedRef } from 'vue'
import {
  MAX_PRIMARY_VIEW_STATES,
  readPoiPrimarySectionStates,
  writePoiPrimarySectionStates,
} from './poiPrimarySectionStorage'

const expandedByView = reactive(new Map<string, Map<string, boolean>>())

let restored = false

function sessionStorageOrNull() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function restorePrimarySectionState() {
  if (restored) return
  restored = true
  for (const [key, sections] of readPoiPrimarySectionStates(sessionStorageOrNull())) {
    expandedByView.set(key, sections)
  }
}

function persistPrimarySectionState() {
  writePoiPrimarySectionStates(sessionStorageOrNull(), expandedByView)
}

export function usePoiPrimarySectionExpanded(
  viewKey: () => string,
  sectionId: string,
  defaultExpanded = true,
): WritableComputedRef<boolean> {
  return computed({
    get() {
      restorePrimarySectionState()
      const key = viewKey()
      return expandedByView.get(key)?.get(sectionId) ?? defaultExpanded
    },
    set(expanded) {
      restorePrimarySectionState()
      const key = viewKey()
      let state = expandedByView.get(key)
      if (!state) {
        if (expandedByView.size >= MAX_PRIMARY_VIEW_STATES) {
          const oldestKey = expandedByView.keys().next().value
          if (oldestKey !== undefined) expandedByView.delete(oldestKey)
        }
        state = new Map<string, boolean>()
        expandedByView.set(key, state)
      }
      state.set(sectionId, expanded)
      persistPrimarySectionState()
    },
  })
}
