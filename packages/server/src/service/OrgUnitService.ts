import { getAsyncDb } from '../db/connection.js'
import { generateId } from '@open-issue/core'
import { ConflictError } from '../utils/errors.js'
import { getPendingOrgUnitIdAsync, isPendingOrgUnitAsync, PENDING_ORG_UNIT_NAME } from '../utils/pendingOrgUnit.js'
import type { OrgUnit, OrgTreeNode } from '@open-issue/core'

export class OrgUnitService {
  async getTree(): Promise<OrgTreeNode[]> {
    const db = getAsyncDb()
    const all = await db.all<OrgUnit>('SELECT * FROM "orgUnits" ORDER BY "name"')
    return buildTree(all)
  }

  async getById(id: string): Promise<OrgUnit | undefined> {
    return getAsyncDb().get<OrgUnit>('SELECT * FROM "orgUnits" WHERE "id" = ?', [id])
  }

  async create(name: string, unitType: string, parentId: string | null): Promise<OrgUnit> {
    const db = getAsyncDb()
    const id = generateId()
    await db.run(
      'INSERT INTO "orgUnits" ("id", "name", "unitType", "parentId") VALUES (?, ?, ?, ?)',
      [id, name, unitType, parentId],
    )
    return await db.get<OrgUnit>('SELECT * FROM "orgUnits" WHERE "id" = ?', [id]) as OrgUnit
  }

  async update(id: string, data: { name?: string; parentId?: string | null; unitType?: string }): Promise<OrgUnit> {
    const db = getAsyncDb()
    await db.run('UPDATE "orgUnits" SET "name" = COALESCE(?, "name"), "parentId" = COALESCE(?, "parentId"), "unitType" = COALESCE(?, "unitType") WHERE "id" = ?',
      [data.name ?? null, data.parentId ?? null, data.unitType ?? null, id])
    return await db.get<OrgUnit>('SELECT * FROM "orgUnits" WHERE "id" = ?', [id]) as OrgUnit
  }

  async delete(id: string): Promise<void> {
    const db = getAsyncDb()
    if (await isPendingOrgUnitAsync(db, id)) {
      throw new ConflictError(`「${PENDING_ORG_UNIT_NAME}」为系统保留节点，不可删除`)
    }
    const unit = await this.getById(id)
    if (!unit) return
    throw new ConflictError('组织节点已进入业务数据，不允许删除；请改名为“停用-原名称”或迁移其成员')
  }

  async getUsers(orgUnitId: string, includeChildren = true) {
    const db = getAsyncDb()
    const userCols = '"id", "username", "email", "displayName", "orgUnitId", "approved", "disabled", "systemRole", "createdAt", "updatedAt"'
    if (await isPendingOrgUnitAsync(db, orgUnitId)) {
      const pendingId = await getPendingOrgUnitIdAsync(db) ?? orgUnitId
      return db.all(
        `SELECT ${userCols} FROM "users" WHERE "orgUnitId" = ? OR "orgUnitId" IS NULL ORDER BY "approved" ASC, "displayName", "username"`,
        [pendingId],
      )
    }
    if (!includeChildren) {
      return db.all(
        `SELECT ${userCols} FROM "users" WHERE "orgUnitId" = ? ORDER BY "approved" ASC, "displayName", "username"`,
        [orgUnitId],
      )
    }
    const all = await db.all<Pick<OrgUnit, 'id' | 'parentId'>>('SELECT "id", "parentId" FROM "orgUnits"')
    const orgIds = collectDescendantIds(all, orgUnitId)
    const placeholders = orgIds.map(() => '?').join(', ')
    return db.all(
      `SELECT ${userCols} FROM "users" WHERE "orgUnitId" IN (${placeholders}) ORDER BY "approved" ASC, "displayName", "username"`,
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
