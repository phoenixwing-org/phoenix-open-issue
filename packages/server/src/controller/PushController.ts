import type { Request, Response } from 'express'
import { PushService } from '../service/PushService.js'
import { routeParam } from '../utils/request.js'

const pushService = new PushService()

export class PushController {
  async preview(req: Request, res: Response): Promise<void> {
    const { fromListId, toListId } = req.query
    const result = await pushService.preview(fromListId as string, toListId as string, req.user!.userId)
    res.json(result)
  }

  async push(req: Request, res: Response): Promise<void> {
    const result = await pushService.push(req.body, req.user!.userId)
    res.status(201).json(result)
  }

  async getListPushHistory(req: Request, res: Response): Promise<void> {
    const records = await pushService.getListPushHistory(routeParam(req, 'listId'), req.user!.userId)
    res.json(records)
  }

  async getMyPushHistory(req: Request, res: Response): Promise<void> {
    const records = await pushService.getMyPushHistory(req.user!.userId)
    res.json(records)
  }

  async getIncomingPushes(req: Request, res: Response): Promise<void> {
    const records = await pushService.getIncomingPushes(routeParam(req, 'listId'), req.user!.userId)
    res.json(records)
  }

  async handlePush(req: Request, res: Response): Promise<void> {
    const { action, rejectReason } = req.body
    const record = await pushService.handlePush(routeParam(req, 'id'), action, req.user!.userId, rejectReason)
    res.json(record)
  }
}
