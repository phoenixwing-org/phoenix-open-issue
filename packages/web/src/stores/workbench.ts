import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  PNW_DEFAULT_RIBBON_APPEARANCE,
  PNW_DEFAULT_WORKBENCH_LAYOUT_STATE,
  type PnwActivityBarPresentation,
  type PnwColorScheme,
  type PnwRibbonAppearance,
  type PnwWorkbenchLayoutState,
} from 'phoenix-wing'

const STORAGE_KEY = 'open-issue-workbench-preferences-v1'

interface OpenIssueWorkbenchPreferences {
  presentation?: PnwActivityBarPresentation
  expandedNodeIds?: readonly string[]
  treeCollapsed?: boolean
  ribbonAppearance?: PnwRibbonAppearance
  colorScheme?: PnwColorScheme
  layoutState?: PnwWorkbenchLayoutState
}

function readPreferences(): OpenIssueWorkbenchPreferences {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as OpenIssueWorkbenchPreferences
  } catch {
    return {}
  }
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const stored = readPreferences()
  const presentation = ref<PnwActivityBarPresentation>(stored.presentation === 'tree' ? 'tree' : 'ribbon')
  const expandedNodeIds = ref<readonly string[]>(stored.expandedNodeIds ?? [
    'issue',
    'issue-nav',
    'system',
    'system-nav',
  ])
  const treeCollapsed = ref(Boolean(stored.treeCollapsed))
  const ribbonAppearance = ref<PnwRibbonAppearance>(stored.ribbonAppearance ?? PNW_DEFAULT_RIBBON_APPEARANCE)
  const colorScheme = ref<PnwColorScheme>(stored.colorScheme ?? 'system')
  const layoutState = ref<PnwWorkbenchLayoutState>(stored.layoutState ?? PNW_DEFAULT_WORKBENCH_LAYOUT_STATE)

  function closeBottom() {
    layoutState.value = {
      ...layoutState.value,
      visibility: {
        ...layoutState.value.visibility,
        bottom: false,
      },
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      presentation: presentation.value,
      expandedNodeIds: expandedNodeIds.value,
      treeCollapsed: treeCollapsed.value,
      ribbonAppearance: ribbonAppearance.value,
      colorScheme: colorScheme.value,
      layoutState: layoutState.value,
    } satisfies OpenIssueWorkbenchPreferences))
  }

  watch([presentation, expandedNodeIds, treeCollapsed, ribbonAppearance, colorScheme, layoutState], persist, {
    deep: true,
  })

  return {
    presentation,
    expandedNodeIds,
    treeCollapsed,
    ribbonAppearance,
    colorScheme,
    layoutState,
    closeBottom,
  }
})
