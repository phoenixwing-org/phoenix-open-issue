export const MAX_PRIMARY_VIEW_STATES = 64
export const PRIMARY_SECTION_STORAGE_KEY = 'phoenix-open-issue.primary-sections.v1'

const MAX_PRIMARY_SECTIONS_PER_VIEW = 32
const MAX_PRIMARY_STATE_BYTES = 32 * 1024
const SAFE_VIEW_KEY = /^phoenix-open-issue-[a-z0-9-]+(?::[A-Za-z0-9-]{1,96})?$/
const SAFE_SECTION_ID = /^[a-z][a-z0-9-]{0,63}$/

export type PoiPrimarySectionStates = Map<string, Map<string, boolean>>

export interface PoiPrimarySectionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function readPoiPrimarySectionStates(
  storage: PoiPrimarySectionStorage | null,
): PoiPrimarySectionStates {
  const result: PoiPrimarySectionStates = new Map()
  if (!storage) return result
  try {
    const raw = storage.getItem(PRIMARY_SECTION_STORAGE_KEY)
    if (!raw || raw.length > MAX_PRIMARY_STATE_BYTES) return result
    const entries: unknown = JSON.parse(raw)
    if (!Array.isArray(entries)) return result
    for (const entry of entries.slice(-MAX_PRIMARY_VIEW_STATES)) {
      if (
        !Array.isArray(entry)
        || entry.length !== 2
        || typeof entry[0] !== 'string'
        || !SAFE_VIEW_KEY.test(entry[0])
        || !Array.isArray(entry[1])
      ) continue
      const sections = new Map<string, boolean>()
      for (const section of entry[1].slice(0, MAX_PRIMARY_SECTIONS_PER_VIEW)) {
        if (
          Array.isArray(section)
          && section.length === 2
          && typeof section[0] === 'string'
          && SAFE_SECTION_ID.test(section[0])
          && typeof section[1] === 'boolean'
        ) {
          sections.set(section[0], section[1])
        }
      }
      if (sections.size) result.set(entry[0], sections)
    }
  } catch {
    // Stale or inaccessible storage must degrade to an empty in-memory state.
  }
  return result
}

export function writePoiPrimarySectionStates(
  storage: PoiPrimarySectionStorage | null,
  states: PoiPrimarySectionStates,
) {
  if (!storage) return
  try {
    storage.setItem(
      PRIMARY_SECTION_STORAGE_KEY,
      JSON.stringify(
        [...states]
          .slice(-MAX_PRIMARY_VIEW_STATES)
          .map(([key, sections]) => [key, [...sections].slice(0, MAX_PRIMARY_SECTIONS_PER_VIEW)]),
      ),
    )
  } catch {
    // Quota and privacy-mode failures must not break Primary controls.
  }
}
