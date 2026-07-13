import type { Request, Response } from 'express'
import { CheckpointService } from '../service/CheckpointService.js'
import { NotFoundError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const cpService = new CheckpointService()

export class CheckpointController {
  async getByIssueId(req: Request, res: Response): Promise<void> {
    const checkpoints = await cpService.getByIssueId(routeParam(req, 'issueId'))
    res.json(checkpoints)
  }

  async getByListId(req: Request, res: Response): Promise<void> {
    const grouped = await cpService.getByListId(routeParam(req, 'listId'))
    res.json(grouped)
  }

  async create(req: Request, res: Response): Promise<void> {
    const cp = await cpService.create(routeParam(req, 'issueId'), req.body, req.user!.userId)
    res.status(201).json(cp)
  }

  async update(req: Request, res: Response): Promise<void> {
    const cp = await cpService.update(routeParam(req, 'id'), req.body, req.user!.userId)
    res.json(cp)
  }

  async delete(req: Request, res: Response): Promise<void> {
    await cpService.delete(routeParam(req, 'id'), req.user!.userId)
    res.status(204).send()
  }
}
