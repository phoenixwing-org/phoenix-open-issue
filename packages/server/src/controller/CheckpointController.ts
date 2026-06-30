import type { Request, Response } from 'express'
import { CheckpointService } from '../service/CheckpointService.js'
import { NotFoundError } from '../utils/errors.js'

const cpService = new CheckpointService()

export class CheckpointController {
  getByIssueId(req: Request, res: Response): void {
    const checkpoints = cpService.getByIssueId(req.params.issueId)
    res.json(checkpoints)
  }

  getByListId(req: Request, res: Response): void {
    const grouped = cpService.getByListId(req.params.listId)
    res.json(grouped)
  }

  create(req: Request, res: Response): void {
    const cp = cpService.create(req.params.issueId, req.body, req.user!.userId)
    res.status(201).json(cp)
  }

  update(req: Request, res: Response): void {
    const cp = cpService.update(req.params.id, req.body, req.user!.userId)
    res.json(cp)
  }

  delete(req: Request, res: Response): void {
    cpService.delete(req.params.id, req.user!.userId)
    res.status(204).send()
  }
}
