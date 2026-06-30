import type { Request, Response } from 'express'
import { DictService } from '../service/DictService.js'

const dictService = new DictService()

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
    const { groupName, value, label } = req.body
    const item = dictService.create(groupName, value, label)
    res.status(201).json(item)
  }

  update(req: Request, res: Response): void {
    const item = dictService.update(req.params.id, req.body)
    res.json(item)
  }

  delete(req: Request, res: Response): void {
    dictService.delete(req.params.id)
    res.status(204).send()
  }
}
