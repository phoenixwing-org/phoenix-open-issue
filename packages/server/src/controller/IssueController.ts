import type { Request, Response } from 'express'
import { IssueService } from '../service/IssueService.js'
import { NotFoundError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const issueService = new IssueService()

export class IssueController {
  getIssues(req: Request, res: Response): void {
    const { status, priority, search, sort, page, size } = req.query
    const result = issueService.getIssues(routeParam(req, 'listId'), req.user!.userId, {
      status: status as string,
      priority: priority as string,
      search: search as string,
      sort: sort as string,
      page: page ? parseInt(page as string) : undefined,
      size: size ? parseInt(size as string) : undefined,
    })
    res.json(result)
  }

  getById(req: Request, res: Response): void {
    const issue = issueService.getById(routeParam(req, 'id'))
    if (!issue) throw new NotFoundError('Issue')
    res.json(issue)
  }

  create(req: Request, res: Response): void {
    const issue = issueService.create(routeParam(req, 'listId'), req.body, req.user!.userId)
    res.status(201).json(issue)
  }

  update(req: Request, res: Response): void {
    const issue = issueService.update(routeParam(req, 'id'), req.body, req.user!.userId)
    res.json(issue)
  }

  updateStatus(req: Request, res: Response): void {
    const issue = issueService.updateStatus(routeParam(req, 'id'), req.body.status, req.user!.userId)
    res.json(issue)
  }

  delete(req: Request, res: Response): void {
    issueService.delete(routeParam(req, 'id'), req.user!.userId)
    res.status(204).send()
  }

  reorder(req: Request, res: Response): void {
    issueService.reorder(routeParam(req, 'listId'), req.body, req.user!.userId)
    res.status(204).send()
  }

  // ── 链接关注系数 ──
  setAttention(req: Request, res: Response): void {
    const { attentionLevel } = req.body
    issueService.setAttentionLevel(
      routeParam(req, 'issueId'),
      routeParam(req, 'listId'),
      attentionLevel,
      req.user!.userId,
    )
    res.json({ message: '关注级别已更新', attentionLevel: attentionLevel ?? 3 })
  }
}
