import type { Request, Response } from 'express'
import { BackupService } from '../service/BackupService.js'

const backupService = new BackupService()

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

  repairLinks(_req: Request, res: Response): void {
    const result = backupService.repairIssueListLinks()
    res.json({ message: '修正完成', ...result })
  }
}
