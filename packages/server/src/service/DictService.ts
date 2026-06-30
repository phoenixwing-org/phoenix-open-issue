import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import type { DictItem } from '@phoenix-wing/open-issue-core'

export class DictService {
  /** 获取某个分组的字典项 */
  getByGroup(groupName: string): DictItem[] {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM dict WHERE groupName = ? AND enabled = 1 ORDER BY sortOrder',
    ).all(groupName) as DictItem[]
  }

  /** 获取所有分组的字典（管理用） */
  getAll(): DictItem[] {
    const db = getDb()
    return db.prepare('SELECT * FROM dict ORDER BY groupName, sortOrder').all() as DictItem[]
  }

  create(groupName: string, value: string, label: string): DictItem {
    const db = getDb()
    const id = uuid()
    const maxSort = db.prepare('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?').get(groupName) as { m: number | null }
    const sortOrder = (maxSort?.m ?? -1) + 1
    db.prepare('INSERT INTO dict (id, groupName, value, label, sortOrder) VALUES (?, ?, ?, ?, ?)')
      .run(id, groupName, value, label, sortOrder)
    return db.prepare('SELECT * FROM dict WHERE id = ?').get(id) as DictItem
  }

  update(id: string, data: { label?: string; value?: string; enabled?: number; sortOrder?: number }): DictItem {
    const db = getDb()
    db.prepare('UPDATE dict SET label = COALESCE(?, label), value = COALESCE(?, value), enabled = COALESCE(?, enabled), sortOrder = COALESCE(?, sortOrder) WHERE id = ?')
      .run(data.label ?? null, data.value ?? null, data.enabled ?? null, data.sortOrder ?? null, id)
    return db.prepare('SELECT * FROM dict WHERE id = ?').get(id) as DictItem
  }

  delete(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM dict WHERE id = ?').run(id)
  }
}
