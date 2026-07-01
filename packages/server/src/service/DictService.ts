import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import type { DictItem } from '@phoenix-wing/open-issue-core'

// ── 预设定义 ──
export interface PresetEntry { v: string; l: string }
export interface PresetGroup { [groupName: string]: PresetEntry[] }

export const DICT_PRESETS: Record<string, PresetGroup> = {
  automotive: {
    issueCategory: [
      { v: 'appearance', l: '外观' },
      { v: 'dimension', l: '尺寸' },
      { v: 'function', l: '功能' },
      { v: 'process', l: '过程' },
      { v: 'safety', l: '安全' },
      { v: 'other', l: '其他' },
    ],
    detectionPhase: [
      { v: 'incoming', l: '来料检验' },
      { v: 'in_process', l: '过程检验' },
      { v: 'final', l: '终检' },
      { v: 'customer', l: '客户反馈' },
      { v: 'audit', l: '审核发现' },
      { v: 'supplier', l: '供应商端' },
    ],
    orgUnitType: [
      { v: 'group', l: '小组' },
      { v: 'department', l: '科室' },
      { v: 'division', l: '部' },
    ],
    severity: [
      { v: 'fatal', l: '致命' },
      { v: 'major', l: '严重' },
      { v: 'minor', l: '轻微' },
      { v: 'trivial', l: '一般' },
    ],
    closeReason: [
      { v: 'completed', l: '已完成' },
      { v: 'cancelled', l: '已取消' },
      { v: 'duplicate', l: '重复' },
      { v: 'transferred', l: '已转交' },
      { v: 'unreproducible', l: '不可复现' },
    ],
  },
  software: {
    issueCategory: [
      { v: 'ui', l: '界面' },
      { v: 'logic', l: '业务逻辑' },
      { v: 'performance', l: '性能' },
      { v: 'security', l: '安全' },
      { v: 'data', l: '数据' },
      { v: 'integration', l: '集成接口' },
      { v: 'compatibility', l: '兼容性' },
      { v: 'algorithm', l: '算法' },
      { v: 'simulation', l: '仿真模拟' },
      { v: 'build', l: '构建部署' },
      { v: 'other', l: '其他' },
    ],
    detectionPhase: [
      { v: 'code_review', l: '代码评审' },
      { v: 'static_analysis', l: '静态分析' },
      { v: 'unit_test', l: '单元测试' },
      { v: 'integration_test', l: '集成测试' },
      { v: 'system_test', l: '系统测试' },
      { v: 'uat', l: '用户验收' },
      { v: 'production', l: '生产环境' },
      { v: 'post_market', l: '售后反馈' },
    ],
    orgUnitType: [
      { v: 'group', l: '小组' },
      { v: 'department', l: '部门' },
      { v: 'division', l: '事业部' },
      { v: 'squad', l: '敏捷小队' },
    ],
    severity: [
      { v: 'fatal', l: '致命-系统崩溃' },
      { v: 'major', l: '严重-核心不可用' },
      { v: 'minor', l: '轻微-部分异常' },
      { v: 'trivial', l: '一般-体验问题' },
    ],
    closeReason: [
      { v: 'completed', l: '已完成' },
      { v: 'cancelled', l: '已取消' },
      { v: 'duplicate', l: '重复' },
      { v: 'transferred', l: '已转交' },
      { v: 'wont_fix', l: '不予修复' },
      { v: 'unreproducible', l: '不可复现' },
    ],
  },
}

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

  create(groupName: string, value: string, label: string, tags?: string): DictItem {
    const db = getDb()
    const id = uuid()
    const maxSort = db.prepare('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?').get(groupName) as { m: number | null }
    const sortOrder = (maxSort?.m ?? -1) + 1
    db.prepare('INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, groupName, value, label, sortOrder, tags || '')
    return db.prepare('SELECT * FROM dict WHERE id = ?').get(id) as DictItem
  }

  /** 批量追加预设项；对新项打标签，对已存在的项追加标签 */
  batchCreate(items: { groupName: string; value: string; label: string }[], tag: string): { added: number; skipped: number; tagged: number } {
    const db = getDb()
    const existStmt = db.prepare('SELECT id, tags FROM dict WHERE groupName = ? AND value = ?')
    const maxStmt = db.prepare('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?')
    const insertStmt = db.prepare('INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)')
    const appendTagStmt = db.prepare('UPDATE dict SET tags = ? WHERE id = ?')

    let added = 0
    let skipped = 0
    let tagged = 0

    const sortCache: Record<string, number> = {}

    const batch = db.transaction(() => {
      for (const item of items) {
        const row = existStmt.get(item.groupName, item.value) as { id: string; tags: string } | undefined
        if (row) {
          // 已存在 → 追加 tag（如果还没有）
          const existingTags = row.tags || ''
          const tagSet = new Set(existingTags.split(',').map(t => t.trim()).filter(Boolean))
          if (!tagSet.has(tag)) {
            tagSet.add(tag)
            appendTagStmt.run([...tagSet].join(','), row.id)
            tagged++
          } else {
            skipped++
          }
          continue
        }
        // 新项 → 打上标签
        if (sortCache[item.groupName] === undefined) {
          const r = maxStmt.get(item.groupName) as { m: number | null }
          sortCache[item.groupName] = r?.m ?? -1
        }
        sortCache[item.groupName]++
        insertStmt.run(uuid(), item.groupName, item.value, item.label, sortCache[item.groupName], tag)
        added++
      }
    })
    batch()
    return { added, skipped, tagged }
  }

  update(id: string, data: { label?: string; value?: string; enabled?: number; sortOrder?: number }): DictItem {
    const db = getDb()
    db.prepare('UPDATE dict SET label = COALESCE(?, label), value = COALESCE(?, value), enabled = COALESCE(?, enabled), sortOrder = COALESCE(?, sortOrder) WHERE id = ?')
      .run(data.label ?? null, data.value ?? null, data.enabled ?? null, data.sortOrder ?? null, id)
    return db.prepare('SELECT * FROM dict WHERE id = ?').get(id) as DictItem
  }

  /** 检查字典项被数据表引用的次数 */
  checkUsage(id: string): { table: string; column: string; label: string; count: number }[] {
    const db = getDb()
    const item = db.prepare('SELECT groupName, value FROM dict WHERE id = ?').get(id) as { groupName: string; value: string } | undefined
    if (!item) return []

    const usageMap: Record<string, { table: string; column: string; label: string }> = {
      issueCategory:    { table: 'issues', column: 'category', label: 'Issue 问题分类' },
      detectionPhase:   { table: 'issues', column: 'detectionPhase', label: 'Issue 发现阶段' },
      severity:         { table: 'issues', column: 'severity', label: 'Issue 严重度' },
      closeReason:      { table: 'issues', column: 'closeReason', label: 'Issue 关闭理由' },
      orgUnitType:      { table: 'orgUnits', column: 'unitType', label: '组织类型' },
    }

    const result: { table: string; column: string; label: string; count: number }[] = []

    const targets = usageMap[item.groupName]
    if (targets) {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${targets.table} WHERE ${targets.column} = ?`).get(item.value) as { c: number }
      if (row.c > 0) {
        result.push({ ...targets, count: row.c })
      }
    }

    return result
  }

  delete(id: string): void {
    const db = getDb()
    db.prepare('DELETE FROM dict WHERE id = ?').run(id)
  }
}
