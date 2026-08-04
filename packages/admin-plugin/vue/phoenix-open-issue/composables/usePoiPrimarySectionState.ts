import { computed, type WritableComputedRef } from 'vue'
import { useSettingsStore } from '/$/phoenix-open-issue/stores/settings'

export function usePoiPrimarySectionState(
  viewId: string,
  sectionId: string,
  defaultExpanded = true,
): WritableComputedRef<boolean> {
  const settings = useSettingsStore()
  return computed({
    get: () => settings.getPrimarySectionExpanded(viewId, sectionId, defaultExpanded),
    set: expanded => settings.setPrimarySectionExpanded(viewId, sectionId, expanded),
  })
}
