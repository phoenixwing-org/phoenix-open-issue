import type { Request, Response } from 'express'
import { IssueListService } from '../service/IssueListService.js'
import { NotFoundError } from '../utils/errors.js'

const listService = new IssueListService()

export class IssueListController {
  getMyLists(req: Request, res: Response): void {
    const lists = listService.getMyLists(req.user!.userId)
    res.json(lists)
  }

  getAllLists(req: Request, res: Response): void {
    const lists = listService.getAllLists(req.user!.userId)
    res.json(lists)
  }

  getById(req: Request, res: Response): void {
    const list = listService.getById(req.params.id)
    if (!list) throw new NotFoundError('列表')
    res.json(list)
  }

  create(req: Request, res: Response): void {
    const list = listService.create(req.body, req.user!.userId)
    res.status(201).json(list)
  }

  update(req: Request, res: Response): void {
    const list = listService.update(req.params.id, req.body, req.user!.userId)
    res.json(list)
  }

  delete(req: Request, res: Response): void {
    listService.delete(req.params.id, req.user!.userId, req.user!.username)
    res.status(204).send()
  }

  getMembers(req: Request, res: Response): void {
    const members = listService.getMembersWithUser(req.params.id)
    res.json(members)
  }

  addMember(req: Request, res: Response): void {
    const { userId, role } = req.body
    const member = listService.addMember(req.params.id, userId, role ?? 'editor', req.user!.userId)
    res.status(201).json(member)
  }

  removeMember(req: Request, res: Response): void {
    listService.removeMember(req.params.id, req.params.userId, req.user!.userId)
    res.status(204).send()
  }

  archiveList(req: Request, res: Response): void {
    const list = listService.archiveList(req.params.id, req.body.archived, req.user!.userId)
    res.json(list)
  }

  getArchivedLists(req: Request, res: Response): void {
    const lists = listService.getArchivedLists(req.user!.userId)
    res.json(lists)
  }

  // ── Feature 3: Owner 转移 ──
  transferOwner(req: Request, res: Response): void {
    const list = listService.transferOwner(req.params.id, req.body.userId, req.user!.userId)
    res.json(list)
  }

  updateMemberRole(req: Request, res: Response): void {
    const member = listService.updateMemberRole(
      req.params.id,
      req.params.userId,
      req.body.role,
      req.user!.userId,
    )
    res.json(member)
  }
}
