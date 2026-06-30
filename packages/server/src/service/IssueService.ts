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
    const conditions: string[] = ['list_id = ?']
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
      `SELECT * FROM issues WHERE ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
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

    // 计算下一个 sort_order
    const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM issues WHERE list_id = ?').get(listId) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    db.prepare(
      `INSERT INTO issues (id, list_id, title, description, status, priority, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, listId, input.title, input.description ?? '', 'open', input.priority ?? 'medium', sortOrder, userId, now, now)

    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue
  }

  update(id: string, input: UpdateIssueInput, userId: string): Issue {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.list_id)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare(
      `UPDATE issues
       SET title = COALESCE(?, title), description = COALESCE(?, description),
           status = COALESCE(?, status), priority = COALESCE(?, priority), updated_at = ?
       WHERE id = ?`,
    ).run(
      input.title ?? null, input.description ?? null,
      input.status ?? null, input.priority ?? null,
      new Date().toISOString(), id,
    )

    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue
  }

  updateStatus(id: string, status: IssueStatus, userId: string): Issue {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.list_id)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id)

    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.list_id)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare('DELETE FROM checkpoints WHERE issue_id = ?').run(id)
    db.prepare('DELETE FROM issues WHERE id = ?').run(id)
  }

  reorder(listId: string, input: ReorderInput, userId: string): void {
    const db = getDb()
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const stmt = db.prepare('UPDATE issues SET sort_order = ?, updated_at = ? WHERE id = ?')
    const now = new Date().toISOString()
    const reorder = db.transaction(() => {
      input.issue_ids.forEach((issueId, index) => {
        stmt.run(index, now, issueId)
      })
    })
    reorder()
  }
}
