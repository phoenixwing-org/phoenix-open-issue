import type { Request, Response } from 'express'
import type { DashboardTaskScope } from '@open-issue/core'
import { BadRequestError } from '../utils/errors.js'
import { DashboardTaskService } from '../service/DashboardTaskService.js'

const dashboardTaskService = new DashboardTaskService()

export class DashboardTaskController {
  async getTasks(req: Request, res: Response): Promise<void> {
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'summary'
    if (!['summary', 'incoming', 'outgoing', 'admin'].includes(tab)) {
      throw new BadRequestError('无效的待办中心 Tab')
    }
    const requestedLimit = Number(req.query.limit ?? 5)
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(20, Math.trunc(requestedLimit)))
      : 5
    res.json(await dashboardTaskService.getTasks(req.user!.userId, tab as DashboardTaskScope, limit))
  }
}
