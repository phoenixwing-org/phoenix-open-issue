import type { Request, Response } from 'express'
import { IssueService } from '../service/IssueService.js'
import { NotFoundError } from '../utils/errors.js'

const issueService = new IssueService()

export class IssueController {
  getIssues(req: Request, res: Response): void {
    const { status, priority, search, sort, page, size, includeVoided } = req.query
    const result = issueService.getIssues(req.params.listId, req.user!.userId, {
      status: status as string,
      priority: priority as string,
      search: search as string,
      sort: sort as string,
      page: page ? parseInt(page as string) : undefined,
      size: size ? parseInt(size as string) : undefined,
      includeVoided: includeVoided === 'true',
    })
    res.json(result)
  }

  getById(req: Request, res: Response): void {
    const issue = issueService.getById(req.params.id)
    if (!issue) throw new NotFoundError('Issue')
    res.json(issue)
  }

  create(req: Request, res: Response): void {
    const issue = issueService.create(req.params.listId, req.body, req.user!.userId)
    res.status(201).json(issue)
  }

  update(req: Request, res: Response): void {
    const issue = issueService.update(req.params.id, req.body, req.user!.userId)
    res.json(issue)
  }

  updateStatus(req: Request, res: Response): void {
    const issue = issueService.updateStatus(req.params.id, req.body.status, req.user!.userId)
    res.json(issue)
  }

  delete(req: Request, res: Response): void {
    issueService.delete(req.params.id, req.user!.userId)
    res.status(204).send()
  }

  reorder(req: Request, res: Response): void {
    issueService.reorder(req.params.listId, req.body, req.user!.userId)
    res.status(204).send()
  }

  // ── 链接关注系数（void/unvoid 为兼容快捷方式） ──
  setAttention(req: Request, res: Response): void {
    const { attentionLevel } = req.body
    issueService.setAttentionLevel(
      req.params.issueId,
      req.params.listId,
      attentionLevel,
      req.user!.userId,
    )
    res.json({ message: '关注级别已更新', attentionLevel: attentionLevel ?? 3 })
  }

  voidLink(req: Request, res: Response): void {
    issueService.voidLink(req.params.issueId, req.params.listId, req.user!.userId)
    res.json({ message: '已设为不关注', attentionLevel: 0 })
  }

  unvoidLink(req: Request, res: Response): void {
    issueService.unvoidLink(req.params.issueId, req.params.listId, req.user!.userId)
    res.json({ message: '已恢复默认关注', attentionLevel: 3 })
  }
}
