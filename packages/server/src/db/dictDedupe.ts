import type { PnwDbAdapter } from 'phoenix-wing/db/pnwDbAdapter'
import { mergeDictTags, normalizeDictTags } from '@open-issue/core'

function dictTableExists(db: PnwDbAdapter): boolean {
  const row = db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='dict'",
  ) as { name: string } | undefined
  return !!row
}

export interface DictDedupeDetail {
  groupName: string
  value: string
  keptId: string
  removedIds: string[]
}

export interface DictDedupeResult {
  removed: number
  tagsMerged: number
  details: DictDedupeDetail[]
}

type DictRow = {
  id: string
  groupName: string
  value: string
  tags: string
  enabled: number
  sortOrder: number
}

/**
 * 同分组 value 重复时保留一条，删除其余行。
 * Issue / 列表等引用的是 value 而非 dict.id，去重不影响业务数据。
 */
export function dedupeDictEntries(db: PnwDbAdapter): DictDedupeResult {
  const empty: DictDedupeResult = { removed: 0, tagsMerged: 0, details: [] }
  if (!dictTableExists(db)) return empty

  const dups = db.all(`
    SELECT groupName, value FROM dict
    GROUP BY groupName, value HAVING COUNT(*) > 1
  `) as { groupName: string; value: string }[]

  let removed = 0
  let tagsMerged = 0
  const details: DictDedupeDetail[] = []

  for (const { groupName, value } of dups) {
    const rows = db.all(`
      SELECT id, groupName, value, tags, enabled, sortOrder FROM dict
      WHERE groupName = ? AND value = ?
      ORDER BY
        CASE WHEN tags LIKE '%,core,%' THEN 0 ELSE 1 END,
        enabled DESC,
        sortOrder ASC,
        id ASC
    `, [groupName, value]) as DictRow[]

    if (rows.length <= 1) continue

    const keeper = rows[0]
    let mergedTags = keeper.tags
    const removedIds: string[] = []

    for (let i = 1; i < rows.length; i++) {
      mergedTags = mergeDictTags(mergedTags, rows[i].tags)
      db.run('DELETE FROM dict WHERE id = ?', rows[i].id)
      removedIds.push(rows[i].id)
      removed++
    }

    const normalized = normalizeDictTags(mergedTags)
    if (normalized !== normalizeDictTags(keeper.tags)) {
      db.run('UPDATE dict SET tags = ? WHERE id = ?', [normalized, keeper.id])
      tagsMerged++
    }

    details.push({ groupName, value, keptId: keeper.id, removedIds })
  }

  return { removed, tagsMerged, details }
}
