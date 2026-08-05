export type PoiPrimarySectionExpansion = Record<string, boolean>

export function poiPrimarySectionKey(viewId: string, sectionId: string): string {
  const normalizedViewId = viewId.trim()
  const normalizedSectionId = sectionId.trim()
  if (!normalizedViewId || !normalizedSectionId) {
    throw new Error('Primary Section 必须提供 viewId 和 sectionId')
  }
  return `${normalizedViewId}:${normalizedSectionId}`
}

export function normalizePoiPrimarySectionExpansion(
  value: unknown,
): PoiPrimarySectionExpansion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => (
      entry[0].trim().length > 0 && typeof entry[1] === 'boolean'
    )),
  )
}

export function readPoiPrimarySectionExpanded(
  state: PoiPrimarySectionExpansion,
  viewId: string,
  sectionId: string,
  defaultExpanded = true,
): boolean {
  const value = state[poiPrimarySectionKey(viewId, sectionId)]
  return typeof value === 'boolean' ? value : defaultExpanded
}

export function writePoiPrimarySectionExpanded(
  state: PoiPrimarySectionExpansion,
  viewId: string,
  sectionId: string,
  expanded: boolean,
): PoiPrimarySectionExpansion {
  return {
    ...state,
    [poiPrimarySectionKey(viewId, sectionId)]: expanded,
  }
}
