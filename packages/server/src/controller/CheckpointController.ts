import type { Request, Response } from 'express'
import { CheckpointService } from '../service/CheckpointService.js'
import { NotFoundError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const cpService = new CheckpointService()

export class CheckpointController {
  getByIssueId(req: Request, res: Response): void {
    const checkpoints = cpService.getByIssueId(routeParam(req, 'issueId'))
    res.json(checkpoints)
  }

  getByListId(req: Request, res: Response): void {
    const grouped = cpService.getByListId(routeParam(req, 'listId'))
    res.json(grouped)
  }

  create(req: Request, res: Response): void {
    const cp = cpService.create(routeParam(req, 'issueId'), req.body, req.user!.userId)
    res.status(201).json(cp)
  }

  update(req: Request, res: Response): void {
    const cp = cpService.update(routeParam(req, 'id'), req.body, req.user!.userId)
    res.json(cp)
  }

  delete(req: Request, res: Response): void {
    cpService.delete(routeParam(req, 'id'), req.user!.userId)
    res.status(204).send()
  }
}
