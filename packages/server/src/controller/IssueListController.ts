import type { Request, Response } from 'express'
import { IssueListService } from '../service/IssueListService.js'
import { NotFoundError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const listService = new IssueListService()

export class IssueListController {
  async getMyLists(req: Request, res: Response): Promise<void> {
    const lists = await listService.getMyLists(req.user!.userId, req.query.includeArchived === 'true')
    res.json(lists)
  }

  async getAllLists(req: Request, res: Response): Promise<void> {
    const lists = await listService.getAllLists(
      req.user!.userId,
      req.query.includeArchived === 'true',
      req.query.includeDeleted === 'true',
    )
    res.json(lists)
  }

  async getById(req: Request, res: Response): Promise<void> {
    const list = await listService.getEnrichedById(routeParam(req, 'id'), req.user!.userId)
    if (!list) throw new NotFoundError('列表')
    res.json(list)
  }

  async create(req: Request, res: Response): Promise<void> {
    const list = await listService.create(req.body, req.user!.userId)
    res.status(201).json(list)
  }

  async update(req: Request, res: Response): Promise<void> {
    const list = await listService.update(routeParam(req, 'id'), req.body, req.user!.userId)
    res.json(list)
  }

  async delete(req: Request, res: Response): Promise<void> {
    await listService.delete(routeParam(req, 'id'), req.user!.userId)
    res.status(204).send()
  }

  async getMembers(req: Request, res: Response): Promise<void> {
    const members = await listService.getMembersWithUser(routeParam(req, 'id'), req.user!.userId)
    res.json(members)
  }

  async addMember(req: Request, res: Response): Promise<void> {
    const { userId, role } = req.body
    const member = await listService.addMember(routeParam(req, 'id'), userId, role ?? 'editor', req.user!.userId)
    res.status(201).json(member)
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    await listService.removeMember(routeParam(req, 'id'), routeParam(req, 'userId'), req.user!.userId)
    res.status(204).send()
  }

  async archiveList(req: Request, res: Response): Promise<void> {
    const list = await listService.archiveList(routeParam(req, 'id'), req.body.archived, req.user!.userId)
    res.json(list)
  }

  async getArchivedLists(req: Request, res: Response): Promise<void> {
    const lists = await listService.getArchivedLists(req.user!.userId)
    res.json(lists)
  }

  async getDeletedLists(req: Request, res: Response): Promise<void> {
    const lists = await listService.getDeletedLists(req.user!.userId)
    res.json(lists)
  }

  async restoreList(req: Request, res: Response): Promise<void> {
    const list = await listService.restoreList(routeParam(req, 'id'), req.user!.userId)
    res.json(list)
  }

  // ── Feature 3: Owner 转移 ──
  async transferOwner(req: Request, res: Response): Promise<void> {
    const list = await listService.transferOwner(routeParam(req, 'id'), req.body.userId, req.user!.userId)
    res.json(list)
  }

  async updateMemberRole(req: Request, res: Response): Promise<void> {
    const member = await listService.updateMemberRole(
      routeParam(req, 'id'),
      routeParam(req, 'userId'),
      req.body.role,
      req.user!.userId,
    )
    res.json(member)
  }
}
