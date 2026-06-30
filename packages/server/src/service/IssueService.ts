import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { checkListAccess, canModifyIssue } from '@phoenix-wing/open-issue-core'
import type { Issue, CreateIssueInput, UpdateIssueInput, ReorderInput, IssueStatus } from '@phoenix-wing/open-issue-core'
import { IssueListService } from './IssueListService.js'

const listService = new IssueListService()

export class IssueService {
  getIssues(listId: string, userId: string, opts: {
    status?: string
    priority?: string
    search?: string
    page?: number
    size?: number
  } = {}): { items: Issue[]; total: number } {
    const db = getDb()

    // 权限检查
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!role) throw new ForbiddenError('无权访问此列表')

    const { status, priority, search, page = 1, size = 50 } = opts
    const conditions: string[] = ['listId = ?']
    const params: unknown[] = [listId]

    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (priority) {
      conditions.push('priority = ?')
      params.push(priority)
    }
    if (search) {
      conditions.push('(title LIKE ? OR description LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const where = conditions.join(' AND ')
    const total = db.prepare(`SELECT COUNT(*) as count FROM issues WHERE ${where}`).get(...params) as { count: number }

    const offset = (page - 1) * size
    params.push(size, offset)
    const items = db.prepare(
      `SELECT * FROM issues WHERE ${where} ORDER BY sortOrder ASC, createdAt DESC LIMIT ? OFFSET ?`,
    ).all(...params) as Issue[]

    return { items, total: total.count }
  }

  getById(id: string): Issue | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue | undefined
  }

  create(listId: string, input: CreateIssueInput, userId: string): Issue {
    const db = getDb()
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const id = uuid()
    const now = new Date().toISOString()

    // 计算下一个 sortOrder
    const maxSort = db.prepare('SELECT MAX(sortOrder) as m FROM issues WHERE listId = ?').get(listId) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    // 生成可读编号：ISS-2026-0001（按年度+列表自增）
    const year = new Date().getFullYear()
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM issues WHERE listId = ? AND issueNo LIKE ?",
    ).get(listId, `ISS-${year}-%`) as { c: number }
    const issueNo = `ISS-${year}-${String((count?.c ?? 0) + 1).padStart(4, '0')}`

    db.prepare(
      `INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase,
        reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction,
        sortOrder, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, listId, issueNo, input.title, input.description ?? '',
      'open', input.priority ?? 'medium', input.severity ?? 'minor',
      input.category ?? null, input.detectionPhase ?? null,
      input.reporterId ?? null, input.assigneeId ?? null, input.dueDate ?? null,
      input.containment ?? '', input.rootCause ?? '', input.correctiveAction ?? '',
      sortOrder, userId, now, now,
    )

    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue
  }

  update(id: string, input: UpdateIssueInput, userId: string): Issue {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare(
      `UPDATE issues
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           severity = COALESCE(?, severity),
           category = COALESCE(?, category),
           detectionPhase = COALESCE(?, detectionPhase),
           reporterId = COALESCE(?, reporterId),
           assigneeId = COALESCE(?, assigneeId),
           dueDate = COALESCE(?, dueDate),
           closeReason = COALESCE(?, closeReason),
           closedBy = COALESCE(?, closedBy),
           completedAt = COALESCE(?, completedAt),
           containment = COALESCE(?, containment),
           rootCause = COALESCE(?, rootCause),
           correctiveAction = COALESCE(?, correctiveAction),
           updatedAt = ?
       WHERE id = ?`,
    ).run(
      input.title ?? null,
      input.description ?? null,
      input.status ?? null,
      input.priority ?? null,
      input.severity ?? null,
      input.category ?? null,
      input.detectionPhase ?? null,
      input.reporterId ?? null,
      input.assigneeId ?? null,
      input.dueDate ?? null,
      input.closeReason ?? null,
      input.closedBy ?? null,
      input.completedAt ?? null,
      input.containment ?? null,
      input.rootCause ?? null,
      input.correctiveAction ?? null,
      new Date().toISOString(), id,
    )

    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue
  }

  updateStatus(id: string, status: IssueStatus, userId: string): Issue {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    // 如果转为 resolved/closed，自动记录完成时间
    const now = new Date().toISOString()
    if (status === 'resolved' || status === 'closed') {
      db.prepare('UPDATE issues SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?')
        .run(status, now, now, id)
    } else {
      db.prepare('UPDATE issues SET status = ?, updatedAt = ? WHERE id = ?')
        .run(status, now, id)
    }

    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare('DELETE FROM checkpoints WHERE issueId = ?').run(id)
    db.prepare('DELETE FROM issues WHERE id = ?').run(id)
  }

  reorder(listId: string, input: ReorderInput, userId: string): void {
    const db = getDb()
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const stmt = db.prepare('UPDATE issues SET sortOrder = ?, updatedAt = ? WHERE id = ?')
    const now = new Date().toISOString()
    const reorder = db.transaction(() => {
      input.issueIds.forEach((issueId, index) => {
        stmt.run(index, now, issueId)
      })
    })
    reorder()
  }
}
