import type { Request, Response } from 'express'
import { OrgUnitService } from '../service/OrgUnitService.js'
import { NotFoundError } from '../utils/errors.js'

const orgUnitService = new OrgUnitService()

export class OrgUnitController {
  getTree(_req: Request, res: Response): void {
    const tree = orgUnitService.getTree()
    res.json(tree)
  }

  getById(req: Request, res: Response): void {
    const unit = orgUnitService.getById(req.params.id)
    if (!unit) throw new NotFoundError('组织节点')
    res.json(unit)
  }

  create(req: Request, res: Response): void {
    const { name, unitType, parentId } = req.body
    const unit = orgUnitService.create(name, unitType, parentId ?? null)
    res.status(201).json(unit)
  }

  update(req: Request, res: Response): void {
    const unit = orgUnitService.update(req.params.id, req.body.name)
    res.json(unit)
  }

  delete(req: Request, res: Response): void {
    orgUnitService.delete(req.params.id)
    res.status(204).send()
  }

  getUsers(req: Request, res: Response): void {
    const users = orgUnitService.getUsers(req.params.id)
    res.json(users)
  }
}
