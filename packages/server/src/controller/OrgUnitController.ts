import type { Request, Response } from 'express'
import { OrgUnitService } from '../service/OrgUnitService.js'
import { NotFoundError } from '../utils/errors.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import { getAsyncDb } from '../db/connection.js'
import { routeParam } from '../utils/request.js'

const orgUnitService = new OrgUnitService()

export class OrgUnitController {
  async getTree(_req: Request, res: Response): Promise<void> {
    const tree = await orgUnitService.getTree()
    res.json(tree)
  }

  async getById(req: Request, res: Response): Promise<void> {
    const unit = await orgUnitService.getById(routeParam(req, 'id'))
    if (!unit) throw new NotFoundError('组织节点')
    res.json(unit)
  }

  async create(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    const { name, unitType, parentId } = req.body
    const unit = await orgUnitService.create(name, unitType, parentId ?? null)
    res.status(201).json(unit)
  }

  async update(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    const unit = await orgUnitService.update(routeParam(req, 'id'), req.body)
    res.json(unit)
  }

  async delete(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    await orgUnitService.delete(routeParam(req, 'id'))
    res.status(204).send()
  }

  async getUsers(req: Request, res: Response): Promise<void> {
    const includeChildren = req.query.includeChildren !== 'false'
    const users = await orgUnitService.getUsers(routeParam(req, 'id'), includeChildren)
    res.json(users)
  }
}
