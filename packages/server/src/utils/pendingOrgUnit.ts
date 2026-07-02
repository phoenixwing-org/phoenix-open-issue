import type Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

export const PENDING_ORG_UNIT_NAME = '待定组'

export function getPendingOrgUnitId(db: Database.Database): string | null {
  const row = db.prepare('SELECT id FROM orgUnits WHERE name = ? LIMIT 1').get(PENDING_ORG_UNIT_NAME) as { id: string } | undefined
  return row?.id ?? null
}

/** 确保「待定组」存在，并将 orgUnitId 为 null 的用户迁入该组 */
export function ensurePendingOrgUnit(db: Database.Database): string {
  let id = getPendingOrgUnitId(db)
  if (!id) {
    id = uuid()
    db.prepare('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)').run(
      id,
      PENDING_ORG_UNIT_NAME,
      'group',
      null,
    )
    console.log(`🏢 [ORG] created "${PENDING_ORG_UNIT_NAME}" (${id})`)
  }
  migrateUsersWithoutOrg(db, id)
  return id
}

export function migrateUsersWithoutOrg(db: Database.Database, pendingOrgId: string): number {
  const result = db.prepare('UPDATE users SET orgUnitId = ?, updatedAt = ? WHERE orgUnitId IS NULL').run(
    pendingOrgId,
    new Date().toISOString(),
  )
  if (result.changes > 0) {
    console.log(`👤 [ORG] migrated ${result.changes} user(s) without org → "${PENDING_ORG_UNIT_NAME}"`)
  }
  return result.changes
}

/** 未指定组织时归入待定组；显式 null/空字符串同样归入待定组 */
export function resolveOrgUnitId(db: Database.Database, orgUnitId?: string | null): string {
  const trimmed = orgUnitId?.trim()
  if (trimmed) return trimmed
  return ensurePendingOrgUnit(db)
}

export function isPendingOrgUnit(db: Database.Database, orgUnitId: string): boolean {
  const pendingId = getPendingOrgUnitId(db)
  return pendingId !== null && pendingId === orgUnitId
}
