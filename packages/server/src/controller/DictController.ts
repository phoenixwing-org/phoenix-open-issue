import type { Request, Response } from 'express'
import { DictService, DICT_PRESETS } from '../service/DictService.js'
import { routeParam } from '../utils/request.js'

const dictService = new DictService()

/** dict groupName → 对应数据库表和列的映射 */
const DICT_USAGE: Record<string, { table: string; column: string; label: string }[]> = {
  issueCategory: [
    { table: 'issues', column: 'category', label: 'Issue 问题分类' },
  ],
  detectionPhase: [
    { table: 'issues', column: 'detectionPhase', label: 'Issue 发现阶段' },
  ],
  severity: [
    { table: 'issues', column: 'severity', label: 'Issue 严重度' },
  ],
  closeReason: [
    { table: 'issues', column: 'closeReason', label: 'Issue 关闭理由' },
  ],
  orgUnitType: [
    { table: 'orgUnits', column: 'unitType', label: '组织类型' },
  ],
  listType: [
    { table: 'issueLists', column: 'listType', label: '点检表类型' },
  ],
}

export class DictController {
  async getByGroup(req: Request, res: Response): Promise<void> {
    const items = await dictService.getByGroup(routeParam(req, 'groupName'))
    res.json(items)
  }

  async getAll(_req: Request, res: Response): Promise<void> {
    const items = await dictService.getAll()
    res.json(items)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { groupName, value, label, tags } = req.body
    const item = await dictService.create(groupName, value, label, tags)
    res.status(201).json(item)
  }

  /** 应用预设字典 */
  async applyPreset(req: Request, res: Response): Promise<void> {
    const { preset } = req.body
    const presetData = DICT_PRESETS[preset]
    if (!presetData) {
      res.status(400).json({ error: `未知预设: ${preset}，可用: ${Object.keys(DICT_PRESETS).join(', ')}` })
      return
    }

    // 将预设展开为批量插入列表
    const items: { groupName: string; value: string; label: string }[] = []
    for (const [groupName, entries] of Object.entries(presetData)) {
      for (const e of entries) {
        items.push({ groupName, value: e.v, label: e.l })
      }
    }

    const result = await dictService.batchCreate(items, preset)
    res.json(result)
  }

  async update(req: Request, res: Response): Promise<void> {
    const item = await dictService.update(routeParam(req, 'id'), req.body)
    res.json(item)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = routeParam(req, 'id')
    if (await dictService.isCore(id)) {
      res.status(403).json({
        error: '内置字典项不可删除',
        message: '年度、月度、项目、自定义为系统内置类型，不可删除',
      })
      return
    }
    const usage = await dictService.checkUsage(id)
    if (usage.length > 0) {
      const details = usage.map(u => `${u.label}: ${u.count} 条`).join('；')
      res.status(409).json({
        error: '该字典项正在使用中，无法删除',
        usage,
        message: `使用情况 — ${details}`,
      })
      return
    }
    await dictService.delete(id)
    res.json({ message: '字典项已停用' })
  }

  /** 按标签批量删除字典项 */
  async deleteByTag(req: Request, res: Response): Promise<void> {
    const result = await dictService.deleteByTag(routeParam(req, 'tag'))
    res.json(result)
  }

  /** 同分组 value 去重（引用按 value，不影响 Issue 等） */
  async dedupe(_req: Request, res: Response): Promise<void> {
    const result = await dictService.dedupe()
    res.json(result)
  }
}
