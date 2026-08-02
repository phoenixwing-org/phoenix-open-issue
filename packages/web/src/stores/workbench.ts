import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  pnwNormalizeWorkbenchDisplayPreferences,
  type PnwWorkbenchDisplayPreferences,
} from 'phoenix-wing'

const STORAGE_KEY = 'open-issue-workbench-preferences-v2'
const LEGACY_STORAGE_KEY = 'open-issue-workbench-preferences-v1'

interface OpenIssueWorkbenchPreferences {
  version: 2
  displayPreferences: PnwWorkbenchDisplayPreferences
  expandedNodeIds?: readonly string[]
}

function parseStoredPreferences(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function readPreferences() {
  const current = parseStoredPreferences(STORAGE_KEY) as Partial<OpenIssueWorkbenchPreferences> | null
  if (current?.version === 2) {
    return {
      displayPreferences: pnwNormalizeWorkbenchDisplayPreferences(current.displayPreferences),
      expandedNodeIds: current.expandedNodeIds,
    }
  }

  const legacy = parseStoredPreferences(LEGACY_STORAGE_KEY) as Record<string, unknown> | null
  return {
    displayPreferences: pnwNormalizeWorkbenchDisplayPreferences(legacy),
    expandedNodeIds: legacy?.expandedNodeIds as readonly string[] | undefined,
  }
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const stored = readPreferences()
  const displayPreferences = ref(stored.displayPreferences)
  const expandedNodeIds = ref<readonly string[]>(stored.expandedNodeIds ?? [
    'issue',
    'issue-nav',
    'system',
    'system-nav',
  ])

  function preference<K extends keyof PnwWorkbenchDisplayPreferences>(key: K) {
    return computed({
      get: () => displayPreferences.value[key],
      set: (value: PnwWorkbenchDisplayPreferences[K]) => {
        displayPreferences.value = pnwNormalizeWorkbenchDisplayPreferences({
          ...displayPreferences.value,
          [key]: value,
        })
      },
    })
  }

  const presentation = preference('presentation')
  const ribbonAppearance = preference('ribbonAppearance')
  const treeCollapsed = preference('treeCollapsed')
  const treeAppearance = preference('treeAppearance')
  const tabBarPlacement = preference('tabBarPlacement')
  const colorScheme = preference('colorScheme')
  const layoutState = preference('layoutState')
  const settingsPositions = preference('settingsPositions')

  function closeBottom() {
    layoutState.value = {
      ...layoutState.value,
      visibility: {
        ...layoutState.value.visibility,
        bottom: false,
      },
    }
  }

  function togglePrimary() {
    layoutState.value = {
      ...layoutState.value,
      visibility: {
        ...layoutState.value.visibility,
        primary: !layoutState.value.visibility.primary,
      },
    }
  }

  function openBottom() {
    layoutState.value = {
      ...layoutState.value,
      visibility: {
        ...layoutState.value.visibility,
        bottom: true,
      },
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      displayPreferences: displayPreferences.value,
      expandedNodeIds: expandedNodeIds.value,
    } satisfies OpenIssueWorkbenchPreferences))
  }

  watch([displayPreferences, expandedNodeIds], persist, {
    deep: true,
  })

  return {
    presentation,
    expandedNodeIds,
    treeCollapsed,
    treeAppearance,
    tabBarPlacement,
    ribbonAppearance,
    colorScheme,
    layoutState,
    settingsPositions,
    togglePrimary,
    closeBottom,
    openBottom,
  }
})
