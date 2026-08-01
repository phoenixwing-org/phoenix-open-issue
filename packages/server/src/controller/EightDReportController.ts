import type { Request, Response } from 'express'
import { EightDReportService } from '../service/EightDReportService.js'
import { routeParam } from '../utils/request.js'

const service = new EightDReportService()

export class EightDReportController {
  async list(req: Request, res: Response): Promise<void> {
    res.json(await service.list(req.user!.userId))
  }

  async getByIssue(req: Request, res: Response): Promise<void> {
    res.json(await service.getByIssue(routeParam(req, 'issueId'), req.user!.userId))
  }

  async getById(req: Request, res: Response): Promise<void> {
    res.json(await service.getById(routeParam(req, 'id'), req.user!.userId))
  }

  async issueOptions(req: Request, res: Response): Promise<void> {
    res.json(await service.getIssueOptions(req.user!.userId))
  }

  async create(req: Request, res: Response): Promise<void> {
    res.status(201).json(await service.create(req.body, req.user!.userId))
  }

  async update(req: Request, res: Response): Promise<void> {
    res.json(await service.update(routeParam(req, 'id'), req.body, req.user!.userId))
  }

  async delete(req: Request, res: Response): Promise<void> {
    await service.delete(routeParam(req, 'id'), req.user!.userId)
    res.status(204).end()
  }
}
