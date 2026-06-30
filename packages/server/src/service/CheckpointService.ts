import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { checkListAccess, canModifyIssue } from '@phoenix-wing/open-issue-core'
import type { Checkpoint, CreateCheckpointInput, UpdateCheckpointInput } from '@phoenix-wing/open-issue-core'

export class CheckpointService {
  getByIssueId(issueId: string): Checkpoint[] {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM checkpoints WHERE issueId = ? ORDER BY checkpointDate ASC, sortOrder ASC',
    ).all(issueId) as Checkpoint[]
  }

  /** 批量获取列表下所有 Issue 的点检，按 issueId 分组返回 */
  getByListId(listId: string): Record<string, Checkpoint[]> {
    const db = getDb()
    const rows = db.prepare(`
      SELECT c.* FROM checkpoints c
      JOIN issues i ON i.id = c.issueId
      WHERE i.listId = ?
      ORDER BY c.checkpointDate ASC, c.sortOrder ASC
    `).all(listId) as Checkpoint[]

    const grouped: Record<string, Checkpoint[]> = {}
    for (const cp of rows) {
      if (!grouped[cp.issueId]) grouped[cp.issueId] = []
      grouped[cp.issueId].push(cp)
    }
    return grouped
  }

  getById(id: string): Checkpoint | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint | undefined
  }

  create(issueId: string, input: CreateCheckpointInput, userId: string): Checkpoint {
    const db = getDb()
    // 权限：通过 issue 所属的 list 来检查
    const issue = db.prepare('SELECT listId FROM issues WHERE id = ?').get(issueId) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.prepare('SELECT * FROM issueListMembers WHERE listId = ?').all(issue.listId) as Array<{ userId: string; role: string }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const id = uuid()
    const now = new Date().toISOString()

    const maxSort = db.prepare('SELECT MAX(sortOrder) as m FROM checkpoints WHERE issueId = ?').get(issueId) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    db.prepare(
      `INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    ).run(id, issueId, input.checkpointDate, input.description, input.responsibleUserId ?? null, sortOrder, now, now)

    return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint
  }

  update(id: string, input: UpdateCheckpointInput, userId: string): Checkpoint {
    const db = getDb()
    const cp = this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = db.prepare('SELECT listId FROM issues WHERE id = ?').get(cp.issueId) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.prepare('SELECT * FROM issueListMembers WHERE listId = ?').all(issue.listId) as Array<{ userId: string; role: string }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare(
      `UPDATE checkpoints
       SET checkpointDate = COALESCE(?, checkpointDate), description = COALESCE(?, description),
           status = COALESCE(?, status), responsibleUserId = COALESCE(?, responsibleUserId), updatedAt = ?
       WHERE id = ?`,
    ).run(
      input.checkpointDate ?? null, input.description ?? null,
      input.status ?? null, input.responsibleUserId ?? null,
      new Date().toISOString(), id,
    )

    return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const cp = this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = db.prepare('SELECT listId FROM issues WHERE id = ?').get(cp.issueId) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.prepare('SELECT * FROM issueListMembers WHERE listId = ?').all(issue.listId) as Array<{ userId: string; role: string }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare('DELETE FROM checkpoints WHERE id = ?').run(id)
  }
}
