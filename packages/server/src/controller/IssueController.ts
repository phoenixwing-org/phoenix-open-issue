import type { Request, Response } from 'express'
import { IssueService } from '../service/IssueService.js'
import { NotFoundError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const issueService = new IssueService()

export class IssueController {
  async getIssues(req: Request, res: Response): Promise<void> {
    const { status, priority, search, sort, page, size } = req.query
    const result = await issueService.getIssues(routeParam(req, 'listId'), req.user!.userId, {
      status: status as string,
      priority: priority as string,
      search: search as string,
      sort: sort as string,
      page: page ? parseInt(page as string) : undefined,
      size: size ? parseInt(size as string) : undefined,
    })
    res.json(result)
  }

  async getById(req: Request, res: Response): Promise<void> {
    const issue = await issueService.getById(routeParam(req, 'id'), req.user!.userId)
    if (!issue) throw new NotFoundError('Issue')
    res.json(issue)
  }

  async create(req: Request, res: Response): Promise<void> {
    const issue = await issueService.create(routeParam(req, 'listId'), req.body, req.user!.userId)
    res.status(201).json(issue)
  }

  async update(req: Request, res: Response): Promise<void> {
    const issue = await issueService.update(routeParam(req, 'id'), req.body, req.user!.userId)
    res.json(issue)
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const issue = await issueService.updateStatus(routeParam(req, 'id'), req.body.status, req.user!.userId)
    res.json(issue)
  }

  async delete(req: Request, res: Response): Promise<void> {
    await issueService.delete(routeParam(req, 'id'), req.user!.userId)
    res.status(204).send()
  }

  async reorder(req: Request, res: Response): Promise<void> {
    await issueService.reorder(routeParam(req, 'listId'), req.body, req.user!.userId)
    res.status(204).send()
  }

  // ── 链接关注系数 ──
  async setAttention(req: Request, res: Response): Promise<void> {
    const { attentionLevel } = req.body
    await issueService.setAttentionLevel(
      routeParam(req, 'issueId'),
      routeParam(req, 'listId'),
      attentionLevel,
      req.user!.userId,
    )
    res.json({ message: '关注级别已更新', attentionLevel: attentionLevel ?? 3 })
  }
}
