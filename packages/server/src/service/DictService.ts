import { getAsyncDb } from '../db/connection.js'
import type { DictDedupeResult } from '../db/dictDedupe.js'
import {
  generateId,
  hasDictTag,
  normalizeDictTags,
  mergeDictTags,
  dictTagLikePattern,
  isIssueSystemDictGroup,
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
  async getByGroup(groupName: string): Promise<DictItem[]> {
    const db = getAsyncDb()
    return await db.all(
      'SELECT * FROM dict WHERE groupName = ? AND enabled = 1 ORDER BY sortOrder',
      [groupName],
    ) as DictItem[]
  }

  /** 获取所有分组的字典（管理用） */
  async getAll(): Promise<DictItem[]> {
    const db = getAsyncDb()
    return await db.all('SELECT * FROM dict ORDER BY groupName, sortOrder') as DictItem[]
  }

  async create(groupName: string, value: string, label: string, tags?: string): Promise<DictItem> {
    const db = getAsyncDb()
    if (isIssueSystemDictGroup(groupName)) {
      throw new ConflictError('重要度和紧急度是内置系统字段，不能新增值，只能修改显示名')
    }
    const trimmed = value.trim()
    if (!trimmed) throw new ConflictError('字典值不能为空')

    const dup = await db.get(
      'SELECT id FROM dict WHERE groupName = ? AND value = ?',
      [groupName, trimmed],
    ) as { id: string } | undefined
    if (dup) throw new ConflictError(`分组「${groupName}」中值「${trimmed}」已存在`)

    const id = generateId()
    const maxSort = await db.get('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?', [groupName]) as { m: number | null }
    const sortOrder = (maxSort?.m ?? -1) + 1
    await db.run('INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [id, groupName, trimmed, label, sortOrder, normalizeDictTags(tags)])
    return await db.get('SELECT * FROM dict WHERE id = ?', [id]) as DictItem
  }

  /** 批量追加预设项；对新项打标签，对已存在的项追加标签 */
  async batchCreate(items: { groupName: string; value: string; label: string }[], tag: string): Promise<{ added: number; skipped: number; tagged: number }> {
    const db = getAsyncDb()

    let added = 0
    let skipped = 0
    let tagged = 0

    const sortCache: Record<string, number> = {}

    await db.transaction(async tx => {
      for (const item of items) {
        const val = item.value.trim()
        if (!val) continue
        const row = await tx.get('SELECT id, tags FROM dict WHERE groupName = ? AND value = ?',
          [item.groupName, val]) as { id: string; tags: string } | undefined
        if (row) {
          const merged = mergeDictTags(row.tags, tag)
          if (merged !== normalizeDictTags(row.tags)) {
            await tx.run('UPDATE dict SET tags = ? WHERE id = ?', [merged, row.id])
            tagged++
          } else {
            skipped++
          }
          continue
        }
        // 新项 → 打上标签
        if (sortCache[item.groupName] === undefined) {
          const r = await tx.get('SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?', [item.groupName]) as { m: number | null }
          sortCache[item.groupName] = r?.m ?? -1
        }
        sortCache[item.groupName]++
        await tx.run('INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), item.groupName, val, item.label, sortCache[item.groupName], normalizeDictTags(tag)])
        added++
      }
    })
    return { added, skipped, tagged }
  }

  async update(id: string, data: { label?: string; value?: string; enabled?: number; sortOrder?: number; tags?: string }): Promise<DictItem> {
    const db = getAsyncDb()
    const current = await db.get(
      'SELECT groupName, value, enabled, sortOrder, tags FROM dict WHERE id = ?',
      [id],
    ) as Pick<DictItem, 'groupName' | 'value' | 'enabled' | 'sortOrder' | 'tags'> | undefined
    if (!current) throw new ConflictError('字典项不存在')

    if (isIssueSystemDictGroup(current.groupName)) {
      const changesSystemContract =
        (data.value !== undefined && data.value.trim() !== current.value)
        || (data.enabled !== undefined && data.enabled !== current.enabled)
        || (data.sortOrder !== undefined && data.sortOrder !== current.sortOrder)
        || (data.tags !== undefined && normalizeDictTags(data.tags) !== normalizeDictTags(current.tags))
      if (changesSystemContract) {
        throw new ConflictError('内置重要度/紧急度只能修改显示名，值、顺序、标签和启用状态不可修改')
      }
      data = { label: data.label }
    }

    if (data.value !== undefined) {
      const trimmed = data.value.trim()
      if (!trimmed) throw new ConflictError('字典值不能为空')
      const dup = await db.get(
        'SELECT id FROM dict WHERE groupName = ? AND value = ? AND id != ?',
        [current.groupName, trimmed, id],
      ) as { id: string } | undefined
      if (dup) throw new ConflictError(`同分组中值「${trimmed}」已存在`)
      data = { ...data, value: trimmed }
    }
    if (data.tags !== undefined) {
      data = { ...data, tags: normalizeDictTags(data.tags) }
    }
    await db.run(
      `UPDATE dict SET
        label = COALESCE(?, label),
        value = COALESCE(?, value),
        enabled = COALESCE(?, enabled),
        sortOrder = COALESCE(?, sortOrder),
        tags = COALESCE(?, tags)
       WHERE id = ?`,
      [data.label ?? null, data.value ?? null, data.enabled ?? null, data.sortOrder ?? null, data.tags ?? null, id],
    )
    return await db.get('SELECT * FROM dict WHERE id = ?', [id]) as DictItem
  }

  /** 检查字典项被数据表引用的次数 */
  async checkUsage(id: string): Promise<{ table: string; column: string; label: string; count: number }[]> {
    const db = getAsyncDb()
    const item = await db.get('SELECT groupName, value FROM dict WHERE id = ?', [id]) as { groupName: string; value: string } | undefined
    if (!item) return []

    const usageMap: Record<string, { table: string; column: string; label: string }> = {
      issueCategory:    { table: 'issues', column: 'category', label: 'Issue 问题分类' },
      detectionPhase:   { table: 'issues', column: 'detectionPhase', label: 'Issue 发现阶段' },
      severity:         { table: 'issues', column: 'severity', label: 'Issue 重要度' },
      priority:         { table: 'issues', column: 'priority', label: 'Issue 紧急度' },
      closeReason:      { table: 'issues', column: 'closeReason', label: 'Issue 关闭理由' },
      orgUnitType:      { table: 'orgUnits', column: 'unitType', label: '组织类型' },
      listType:         { table: 'issueLists', column: 'listType', label: '点检表类型' },
    }

    const result: { table: string; column: string; label: string; count: number }[] = []

    const targets = usageMap[item.groupName]
    if (targets) {
      const row = await db.get(`SELECT COUNT(*) as c FROM ${targets.table} WHERE ${targets.column} = ?`, [item.value]) as { c: number }
      if (row.c > 0) {
        result.push({ ...targets, count: row.c })
      }
    }

    return result
  }

  /** 是否为内置字典项（不可删除） */
  async isCore(id: string): Promise<boolean> {
    const db = getAsyncDb()
    const item = await db.get('SELECT tags FROM dict WHERE id = ?', [id]) as { tags: string } | undefined
    return item ? hasDictTag(item.tags, DICT_CORE_TAG) : false
  }

  async delete(id: string): Promise<void> {
    const db = getAsyncDb()
    await db.run('UPDATE dict SET enabled = 0 WHERE id = ?', [id])
  }

  /** 按标签批量删除字典项（逐个检查引用，无引用才删） */
  async deleteByTag(tag: string): Promise<{ deleted: number; skipped: number; details: { id: string; label: string; groupName: string; reason: string }[] }> {
    const db = getAsyncDb()
    const items = await db.all('SELECT * FROM dict WHERE tags LIKE ?', [dictTagLikePattern(tag)]) as DictItem[]

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

      const usage = await this.checkUsage(item.id)
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
      await db.run('UPDATE dict SET enabled = 0 WHERE id = ?', [item.id])
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
  async dedupe(): Promise<DictDedupeResult & { indexOk: boolean; duplicateGroupsRemaining: number }> {
    const db = getAsyncDb()
    const details: DictDedupeResult['details'] = []
    let removed = 0
    let tagsMerged = 0

    await db.transaction(async tx => {
      const duplicates = await tx.all<{ groupName: string; value: string }>(`
        SELECT groupName, value FROM dict
        GROUP BY groupName, value HAVING COUNT(*) > 1
      `)
      for (const duplicate of duplicates) {
        const rows = await tx.all<DictItem>(`
          SELECT * FROM dict WHERE groupName = ? AND value = ?
          ORDER BY CASE WHEN tags LIKE '%,core,%' THEN 0 ELSE 1 END,
            enabled DESC, sortOrder ASC, id ASC
        `, [duplicate.groupName, duplicate.value])
        if (rows.length < 2) continue

        const keeper = rows[0]
        let mergedTags = keeper.tags
        const removedIds: string[] = []
        for (const row of rows.slice(1)) {
          mergedTags = mergeDictTags(mergedTags, row.tags)
          await tx.run('DELETE FROM dict WHERE id = ?', [row.id])
          removedIds.push(row.id)
          removed++
        }
        const normalized = normalizeDictTags(mergedTags)
        if (normalized !== normalizeDictTags(keeper.tags)) {
          await tx.run('UPDATE dict SET tags = ? WHERE id = ?', [normalized, keeper.id])
          tagsMerged++
        }
        details.push({ ...duplicate, keptId: keeper.id, removedIds })
      }
    })

    let indexOk = true
    try {
      await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_dict_group_value ON dict(groupName, value)')
    } catch {
      indexOk = false
    }
    const count = await db.get<{ c: number }>(`
      SELECT COUNT(*) as c FROM (
        SELECT groupName, value FROM dict GROUP BY groupName, value HAVING COUNT(*) > 1
      ) duplicateGroups
    `)
    const duplicateGroupsRemaining = Number(count?.c ?? 0)
    if (duplicateGroupsRemaining > 0) indexOk = false
    return {
      removed,
      tagsMerged,
      details,
      indexOk,
      duplicateGroupsRemaining,
    }
  }
}
