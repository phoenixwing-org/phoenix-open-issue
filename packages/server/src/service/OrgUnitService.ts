import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import type { OrgUnit, OrgTreeNode } from '@phoenix-wing/open-issue-core'

export class OrgUnitService {
  getTree(): OrgTreeNode[] {
    const db = getDb()
    const all = db.prepare('SELECT * FROM org_units ORDER BY name').all() as OrgUnit[]
    return buildTree(all)
  }

  getById(id: string): OrgUnit | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM org_units WHERE id = ?').get(id) as OrgUnit | undefined
  }

  create(name: string, unitType: string, parentId: string | null): OrgUnit {
    const db = getDb()
    const id = uuid()
    db.prepare(
      'INSERT INTO org_units (id, name, unit_type, parent_id) VALUES (?, ?, ?, ?)',
    ).run(id, name, unitType, parentId)
    return db.prepare('SELECT * FROM org_units WHERE id = ?').get(id) as OrgUnit
  }

  update(id: string, name: string): OrgUnit {
    const db = getDb()
    db.prepare('UPDATE org_units SET name = ? WHERE id = ?').run(name, id)
    return db.prepare('SELECT * FROM org_units WHERE id = ?').get(id) as OrgUnit
  }

  delete(id: string): void {
    const db = getDb()
    // 解除子节点的 parent_id
    db.prepare('UPDATE org_units SET parent_id = NULL WHERE parent_id = ?').run(id)
    db.prepare('DELETE FROM org_units WHERE id = ?').run(id)
  }

  getUsers(orgUnitId: string) {
    const db = getDb()
    return db.prepare(
      'SELECT id, username, email, display_name, org_unit_id, created_at, updated_at FROM users WHERE org_unit_id = ?',
    ).all(orgUnitId)
  }
}

function buildTree(units: OrgUnit[], parentId: string | null = null): OrgTreeNode[] {
  return units
    .filter(u => u.parent_id === parentId)
    .map(u => ({
      ...u,
      children: buildTree(units, u.id),
    }))
}
