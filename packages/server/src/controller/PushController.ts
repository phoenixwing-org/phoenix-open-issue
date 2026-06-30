import type { Request, Response } from 'express'
import { PushService } from '../service/PushService.js'

const pushService = new PushService()

export class PushController {
  preview(req: Request, res: Response): void {
    const { fromListId, toListId } = req.query
    const result = pushService.preview(fromListId as string, toListId as string)
    res.json(result)
  }

  push(req: Request, res: Response): void {
    const result = pushService.push(req.body, req.user!.userId)
    res.status(201).json(result)
  }

  getListPushHistory(req: Request, res: Response): void {
    const records = pushService.getListPushHistory(req.params.listId)
    res.json(records)
  }

  getMyPushHistory(req: Request, res: Response): void {
    const records = pushService.getMyPushHistory(req.user!.userId)
    res.json(records)
  }

  getIncomingPushes(req: Request, res: Response): void {
    const records = pushService.getIncomingPushes(req.params.listId)
    res.json(records)
  }

  handlePush(req: Request, res: Response): void {
    const { action, rejectReason } = req.body
    const record = pushService.handlePush(req.params.id, action, req.user!.userId, rejectReason)
    res.json(record)
  }
}
