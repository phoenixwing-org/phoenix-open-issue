import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import type { OrgUnit, OrgTreeNode } from '@phoenix-wing/open-issue-core'

export class OrgUnitService {
  getTree(): OrgTreeNode[] {
    const db = getDb()
    const all = db.prepare('SELECT * FROM orgUnits ORDER BY name').all() as OrgUnit[]
    return buildTree(all)
  }

  getById(id: string): OrgUnit | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM orgUnits WHERE id = ?').get(id) as OrgUnit | undefined
  }

  create(name: string, unitType: string, parentId: string | null): OrgUnit {
    const db = getDb()
    const id = uuid()
    db.prepare(
      'INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)',
    ).run(id, name, unitType, parentId)
    return db.prepare('SELECT * FROM orgUnits WHERE id = ?').get(id) as OrgUnit
  }

  update(id: string, data: { name?: string; parentId?: string | null; unitType?: string }): OrgUnit {
    const db = getDb()
    db.prepare('UPDATE orgUnits SET name = COALESCE(?, name), parentId = COALESCE(?, parentId), unitType = COALESCE(?, unitType) WHERE id = ?')
      .run(data.name ?? null, data.parentId ?? null, data.unitType ?? null, id)
    return db.prepare('SELECT * FROM orgUnits WHERE id = ?').get(id) as OrgUnit
  }

  delete(id: string): void {
    const db = getDb()
    // 解除子节点的 parentId
    db.prepare('UPDATE orgUnits SET parentId = NULL WHERE parentId = ?').run(id)
    db.prepare('DELETE FROM orgUnits WHERE id = ?').run(id)
  }

  getUsers(orgUnitId: string) {
    const db = getDb()
    return db.prepare(
      'SELECT id, username, email, displayName, orgUnitId, approved, createdAt, updatedAt FROM users WHERE orgUnitId = ?',
    ).all(orgUnitId)
  }
}

function buildTree(units: OrgUnit[], parentId: string | null = null): OrgTreeNode[] {
  return units
    .filter(u => u.parentId === parentId)
    .map(u => ({
      ...u,
      children: buildTree(units, u.id),
    }))
}
