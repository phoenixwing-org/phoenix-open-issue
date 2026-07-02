import type { PnwDbAdapter } from 'phoenix-wing/db/pnwDbAdapter'
import { v4 as uuid } from 'uuid'

export const PENDING_ORG_UNIT_NAME = '待定组'

export function getPendingOrgUnitId(db: PnwDbAdapter): string | null {
  const row = db.get<{ id: string }>('SELECT id FROM orgUnits WHERE name = ? LIMIT 1', PENDING_ORG_UNIT_NAME)
  return row?.id ?? null
}

/** 确保「待定组」存在，并将 orgUnitId 为 null 的用户迁入该组 */
export function ensurePendingOrgUnit(db: PnwDbAdapter): string {
  let id = getPendingOrgUnitId(db)
  if (!id) {
    id = uuid()
    db.run('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)', [id, PENDING_ORG_UNIT_NAME, 'group', null])
    console.log(`🏢 [ORG] created "${PENDING_ORG_UNIT_NAME}" (${id})`)
  } else {
    // 已有记录可能被误设为子节点，修正为根节点以保证组织树可见
    const fixed = db.run(
      'UPDATE orgUnits SET parentId = NULL, unitType = ? WHERE id = ? AND (parentId IS NOT NULL OR unitType != ?)',
      ['group', id, 'group'],
    )
    if (fixed.changes > 0) {
      console.log(`🏢 [ORG] normalized "${PENDING_ORG_UNIT_NAME}" to root node`)
    }
  }
  migrateUsersWithoutOrg(db, id)
  return id
}

export function migrateUsersWithoutOrg(db: PnwDbAdapter, pendingOrgId: string): number {
  const result = db.run('UPDATE users SET orgUnitId = ?, updatedAt = ? WHERE orgUnitId IS NULL', [pendingOrgId, new Date().toISOString()])
  if (result.changes > 0) {
    console.log(`👤 [ORG] migrated ${result.changes} user(s) without org → "${PENDING_ORG_UNIT_NAME}"`)
  }
  return result.changes
}

/** 未指定组织时归入待定组；显式 null/空字符串同样归入待定组 */
export function resolveOrgUnitId(db: PnwDbAdapter, orgUnitId?: string | null): string {
  const trimmed = orgUnitId?.trim()
  if (trimmed) return trimmed
  return ensurePendingOrgUnit(db)
}

export function isPendingOrgUnit(db: PnwDbAdapter, orgUnitId: string): boolean {
  const pendingId = getPendingOrgUnitId(db)
  return pendingId !== null && pendingId === orgUnitId
}
