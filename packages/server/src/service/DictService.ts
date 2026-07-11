import { getDb } from '../db/connection.js'
import { repairDictDataAndIndex } from '../db/migrations.js'
import type { DictDedupeResult } from '../db/dictDedupe.js'
import {
  generateId,
  hasDictTag,
  normalizeDictTags,
  mergeDictTags,
  dictTagLikePattern,
} from '@open-issue/core'
import type { DictItem } from '@open-issue/core'
import { ConflictError } from '../utils/errors.js'

export { hasDictTag } from '@open-issue/core'

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

/** 内置字典项标签，带此标签的项不可删除 */
export const DICT_CORE_TAG = 'core'

export class DictService {
  /** 获取某个分组的字典项 */
  getByGroup(groupName: string): DictItem[] {
    const db = getDb()
    return db.all(
      'SELECT * FROM dict WHERE groupName = ? AND enabled = 1 ORDER BY sortOrder',
      groupName,
    ) as DictItem[]
  }

  /** 获取所有分组的字典（管理用） */
  getAll(): DictItem[] {
    const db = getDb()
    return db.all('SELECT * FROM dict ORDER BY groupName, sortOrder') as DictItem[]
  }

  create(groupName: string, value: string, label: string, tags?: string): DictItem {
    const db = getDb()
    const trimmed = value.trim()
    if (!trimmed) throw new ConflictError('字典值不能为空')

    const dup = db.get(
      'SELECT id FROM dict WHERE groupName = ? AND value = ?',
      [groupName, trimmed],
    ) as { id: string } | undefined
    if (dup) throw new ConflictError(`分组「${groupName}」中值「${trimmed}」已存在`)

    const id = generateId()
    const maxSort = db.get('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?', groupName) as { m: number | null }
    const sortOrder = (maxSort?.m ?? -1) + 1
    db.run('INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [id, groupName, trimmed, label, sortOrder, normalizeDictTags(tags)])
    return db.get('SELECT * FROM dict WHERE id = ?', id) as DictItem
  }

  /** 批量追加预设项；对新项打标签，对已存在的项追加标签 */
  batchCreate(items: { groupName: string; value: string; label: string }[], tag: string): { added: number; skipped: number; tagged: number } {
    const db = getDb()

    let added = 0
    let skipped = 0
    let tagged = 0

    const sortCache: Record<string, number> = {}

    db.exec('BEGIN TRANSACTION')
    try {
      for (const item of items) {
        const val = item.value.trim()
        if (!val) continue
        const row = db.get('SELECT id, tags FROM dict WHERE groupName = ? AND value = ?',
          [item.groupName, val]) as { id: string; tags: string } | undefined
        if (row) {
          const merged = mergeDictTags(row.tags, tag)
          if (merged !== normalizeDictTags(row.tags)) {
            db.run('UPDATE dict SET tags = ? WHERE id = ?', [merged, row.id])
            tagged++
          } else {
            skipped++
          }
          continue
        }
        // 新项 → 打上标签
        if (sortCache[item.groupName] === undefined) {
          const r = db.get('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?', item.groupName) as { m: number | null }
          sortCache[item.groupName] = r?.m ?? -1
        }
        sortCache[item.groupName]++
        db.run('INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), item.groupName, val, item.label, sortCache[item.groupName], normalizeDictTags(tag)])
        added++
      }
      db.exec('COMMIT')
    } catch (err) {
      if (db.inTransaction) db.exec('ROLLBACK')
      throw err
    }
    return { added, skipped, tagged }
  }

  update(id: string, data: { label?: string; value?: string; enabled?: number; sortOrder?: number; tags?: string }): DictItem {
    const db = getDb()
    if (data.value !== undefined) {
      const current = db.get('SELECT groupName FROM dict WHERE id = ?', id) as { groupName: string } | undefined
      if (!current) throw new ConflictError('字典项不存在')
      const trimmed = data.value.trim()
      if (!trimmed) throw new ConflictError('字典值不能为空')
      const dup = db.get(
        'SELECT id FROM dict WHERE groupName = ? AND value = ? AND id != ?',
        [current.groupName, trimmed, id],
      ) as { id: string } | undefined
      if (dup) throw new ConflictError(`同分组中值「${trimmed}」已存在`)
      data = { ...data, value: trimmed }
    }
    if (data.tags !== undefined) {
      data = { ...data, tags: normalizeDictTags(data.tags) }
    }
    db.run(
      `UPDATE dict SET
        label = COALESCE(?, label),
        value = COALESCE(?, value),
        enabled = COALESCE(?, enabled),
        sortOrder = COALESCE(?, sortOrder),
        tags = COALESCE(?, tags)
       WHERE id = ?`,
      [data.label ?? null, data.value ?? null, data.enabled ?? null, data.sortOrder ?? null, data.tags ?? null, id],
    )
    return db.get('SELECT * FROM dict WHERE id = ?', id) as DictItem
  }

  /** 检查字典项被数据表引用的次数 */
  checkUsage(id: string): { table: string; column: string; label: string; count: number }[] {
    const db = getDb()
    const item = db.get('SELECT groupName, value FROM dict WHERE id = ?', id) as { groupName: string; value: string } | undefined
    if (!item) return []

    const usageMap: Record<string, { table: string; column: string; label: string }> = {
      issueCategory:    { table: 'issues', column: 'category', label: 'Issue 问题分类' },
      detectionPhase:   { table: 'issues', column: 'detectionPhase', label: 'Issue 发现阶段' },
      severity:         { table: 'issues', column: 'severity', label: 'Issue 严重度' },
      closeReason:      { table: 'issues', column: 'closeReason', label: 'Issue 关闭理由' },
      orgUnitType:      { table: 'orgUnits', column: 'unitType', label: '组织类型' },
      listType:         { table: 'issueLists', column: 'listType', label: '点检表类型' },
    }

    const result: { table: string; column: string; label: string; count: number }[] = []

    const targets = usageMap[item.groupName]
    if (targets) {
      const row = db.get(`SELECT COUNT(*) as c FROM ${targets.table} WHERE ${targets.column} = ?`, item.value) as { c: number }
      if (row.c > 0) {
        result.push({ ...targets, count: row.c })
      }
    }

    return result
  }

  /** 是否为内置字典项（不可删除） */
  isCore(id: string): boolean {
    const db = getDb()
    const item = db.get('SELECT tags FROM dict WHERE id = ?', id) as { tags: string } | undefined
    return item ? hasDictTag(item.tags, DICT_CORE_TAG) : false
  }

  delete(id: string): void {
    const db = getDb()
    db.run('UPDATE dict SET enabled = 0 WHERE id = ?', id)
  }

  /** 按标签批量删除字典项（逐个检查引用，无引用才删） */
  deleteByTag(tag: string): { deleted: number; skipped: number; details: { id: string; label: string; groupName: string; reason: string }[] } {
    const db = getDb()
    const items = db.all('SELECT * FROM dict WHERE tags LIKE ?', [dictTagLikePattern(tag)]) as DictItem[]

    let deleted = 0
    let skipped = 0
    const details: { id: string; label: string; groupName: string; reason: string }[] = []

    for (const item of items) {
      if (!hasDictTag(item.tags, tag)) continue

      if (hasDictTag(item.tags, DICT_CORE_TAG)) {
        skipped++
        details.push({
          id: item.id,
          label: item.label,
          groupName: item.groupName,
          reason: '内置项，不可删除',
        })
        continue
      }

      const usage = this.checkUsage(item.id)
      if (usage.length > 0) {
        skipped++
        details.push({
          id: item.id,
          label: item.label,
          groupName: item.groupName,
          reason: usage.map(u => `${u.label}: ${u.count} 条`).join('；'),
        })
        continue
      }
      db.run('UPDATE dict SET enabled = 0 WHERE id = ?', item.id)
      deleted++
      details.push({
        id: item.id,
        label: item.label,
        groupName: item.groupName,
        reason: '已停用',
      })
    }
    return { deleted, skipped, details }
  }

  /**
   * 同分组 value 去重：保留一条（core 标签优先），合并 tags，删除重复行。
   * Issue / 列表 / 组织等引用的是 value，非 dict.id，去重不影响引用。
   */
  dedupe(): DictDedupeResult & { indexOk: boolean; duplicateGroupsRemaining: number } {
    const repair = repairDictDataAndIndex(getDb())
    return {
      removed: repair.removed,
      tagsMerged: repair.tagsMerged,
      details: [],
      indexOk: repair.indexOk,
      duplicateGroupsRemaining: repair.duplicateGroupsRemaining,
    }
  }
}
