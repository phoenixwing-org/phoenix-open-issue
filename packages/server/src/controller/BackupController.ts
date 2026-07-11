import type { Request, Response } from 'express'
import { BackupService } from '../service/BackupService.js'
import { DbRepairService, type RepairTaskId } from '../service/DbRepairService.js'
import { assertSystemAdmin } from '../utils/admin.js'

const backupService = new BackupService()
const repairService = new DbRepairService()

export class BackupController {
  exportDb(_req: Request, res: Response): void {
    const data = backupService.export()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="backup-${data.timestamp.slice(0, 10)}.json"`)
    res.json(data)
  }

  importDb(req: Request, res: Response): void {
    const { data, mode } = req.body
    if (!data) throw Object.assign(new Error('缺少 data 字段'), { statusCode: 400 })
    const result = backupService.import(data, mode || 'replace')
    res.json({ message: '导入完成', ...result })
  }

  repairLinks(req: Request, res: Response): void {
    assertSystemAdmin(req.user!.userId)
    const result = repairService.repairIssueListLinks()
    res.json({ created: result.fixed, skipped: 0, ...result })
  }

  repair(req: Request, res: Response): void {
    assertSystemAdmin(req.user!.userId)
    const task = (req.body?.task ?? req.params.task ?? 'all') as RepairTaskId
    const results = repairService.runTask(task)
    const totalFixed = results.reduce((s, r) => s + r.fixed, 0)
    res.json({ message: '修正完成', task, totalFixed, results })
  }
}
