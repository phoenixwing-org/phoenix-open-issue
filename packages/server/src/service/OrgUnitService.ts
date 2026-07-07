import { getDb } from '../db/connection.js'
import { generateId } from '@open-issue/core'
import { ConflictError } from '../utils/errors.js'
import { getPendingOrgUnitId, isPendingOrgUnit, PENDING_ORG_UNIT_NAME } from '../utils/pendingOrgUnit.js'
import type { OrgUnit, OrgTreeNode } from '@open-issue/core'

export class OrgUnitService {
  getTree(): OrgTreeNode[] {
    const db = getDb()
    const all = db.all('SELECT * FROM orgUnits ORDER BY name') as OrgUnit[]
    return buildTree(all)
  }

  getById(id: string): OrgUnit | undefined {
    const db = getDb()
    return db.get('SELECT * FROM orgUnits WHERE id = ?', id) as OrgUnit | undefined
  }

  create(name: string, unitType: string, parentId: string | null): OrgUnit {
    const db = getDb()
    const id = generateId()
    db.run(
      'INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)',
      [id, name, unitType, parentId],
    )
    return db.get('SELECT * FROM orgUnits WHERE id = ?', id) as OrgUnit
  }

  update(id: string, data: { name?: string; parentId?: string | null; unitType?: string }): OrgUnit {
    const db = getDb()
    db.run('UPDATE orgUnits SET name = COALESCE(?, name), parentId = COALESCE(?, parentId), unitType = COALESCE(?, unitType) WHERE id = ?',
      [data.name ?? null, data.parentId ?? null, data.unitType ?? null, id])
    return db.get('SELECT * FROM orgUnits WHERE id = ?', id) as OrgUnit
  }

  delete(id: string): void {
    const db = getDb()
    if (isPendingOrgUnit(db, id)) {
      throw new ConflictError(`「${PENDING_ORG_UNIT_NAME}」为系统保留节点，不可删除`)
    }
    // 解除子节点的 parentId
    db.run('UPDATE orgUnits SET parentId = NULL WHERE parentId = ?', id)
    db.run('DELETE FROM orgUnits WHERE id = ?', id)
  }

  getUsers(orgUnitId: string, includeChildren = true) {
    const db = getDb()
    const userCols = 'id, username, email, displayName, orgUnitId, approved, createdAt, updatedAt'
    if (isPendingOrgUnit(db, orgUnitId)) {
      const pendingId = getPendingOrgUnitId(db) ?? orgUnitId
      return db.all(
        `SELECT ${userCols} FROM users WHERE orgUnitId = ? OR orgUnitId IS NULL ORDER BY approved ASC, displayName, username`,
        pendingId,
      )
    }
    if (!includeChildren) {
      return db.all(
        `SELECT ${userCols} FROM users WHERE orgUnitId = ? ORDER BY approved ASC, displayName, username`,
        orgUnitId,
      )
    }
    const all = db.all('SELECT id, parentId FROM orgUnits') as Pick<OrgUnit, 'id' | 'parentId'>[]
    const orgIds = collectDescendantIds(all, orgUnitId)
    const placeholders = orgIds.map(() => '?').join(', ')
    return db.all(
      `SELECT ${userCols} FROM users WHERE orgUnitId IN (${placeholders}) ORDER BY approved ASC, displayName, username`,
      orgIds,
    )
  }
}

/** 收集节点自身及所有下级组织 id */
function collectDescendantIds(units: Pick<OrgUnit, 'id' | 'parentId'>[], rootId: string): string[] {
  const ids = [rootId]
  for (const unit of units) {
    if (unit.parentId === rootId) {
      ids.push(...collectDescendantIds(units, unit.id))
    }
  }
  return ids
}

function buildTree(units: OrgUnit[], parentId: string | null = null): OrgTreeNode[] {
  const ids = new Set(units.map(u => u.id))
  return units
    .filter(u => {
      if (parentId !== null) return u.parentId === parentId
      // 根节点：无上级，或上级已不存在（避免树中「消失」）
      const p = u.parentId
      return p == null || p === '' || !ids.has(p)
    })
    .map(u => ({
      ...u,
      children: buildTree(units, u.id),
    }))
}
