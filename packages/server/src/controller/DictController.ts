import type { Request, Response } from 'express'
import { DictService, DICT_PRESETS } from '../service/DictService.js'

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
}

export class DictController {
  getByGroup(req: Request, res: Response): void {
    const items = dictService.getByGroup(req.params.groupName)
    res.json(items)
  }

  getAll(_req: Request, res: Response): void {
    const items = dictService.getAll()
    res.json(items)
  }

  create(req: Request, res: Response): void {
    const { groupName, value, label, tags } = req.body
    const item = dictService.create(groupName, value, label, tags)
    res.status(201).json(item)
  }

  /** 应用预设字典 */
  applyPreset(req: Request, res: Response): void {
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

    const result = dictService.batchCreate(items, preset)
    res.json(result)
  }

  update(req: Request, res: Response): void {
    const item = dictService.update(req.params.id, req.body)
    res.json(item)
  }

  delete(req: Request, res: Response): void {
    const usage = dictService.checkUsage(req.params.id)
    if (usage.length > 0) {
      const details = usage.map(u => `${u.label}: ${u.count} 条`).join('；')
      res.status(409).json({
        error: '该字典项正在使用中，无法删除',
        usage,
        message: `使用情况 — ${details}`,
      })
      return
    }
    dictService.delete(req.params.id)
    res.status(204).send()
  }

  /** 按标签批量删除字典项 */
  deleteByTag(req: Request, res: Response): void {
    const { tag } = req.params
    const result = dictService.deleteByTag(tag)
    res.json(result)
  }
}
