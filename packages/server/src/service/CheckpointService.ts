import { getDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, checkListAccess, canModifyIssue } from '@open-issue/core'
import type { Checkpoint, CreateCheckpointInput, UpdateCheckpointInput, MemberRole } from '@open-issue/core'

export class CheckpointService {
  getByIssueId(issueId: string): Checkpoint[] {
    const db = getDb()
    return db.all(
      'SELECT * FROM checkpoints WHERE issueId = ? ORDER BY checkpointDate ASC, sortOrder ASC',
      issueId,
    ) as Checkpoint[]
  }

  /** 批量获取列表下所有 Issue 的点检，按 issueId 分组返回 */
  getByListId(listId: string): Record<string, Checkpoint[]> {
    const db = getDb()
    const rows = db.all(`
      SELECT c.* FROM checkpoints c
      JOIN issues i ON i.id = c.issueId
      WHERE i.listId = ?
      ORDER BY c.checkpointDate ASC, c.sortOrder ASC
    `, listId) as Checkpoint[]

    const grouped: Record<string, Checkpoint[]> = {}
    for (const cp of rows) {
      if (!grouped[cp.issueId]) grouped[cp.issueId] = []
      grouped[cp.issueId].push(cp)
    }
    return grouped
  }

  getById(id: string): Checkpoint | undefined {
    const db = getDb()
    return db.get('SELECT * FROM checkpoints WHERE id = ?', id) as Checkpoint | undefined
  }

  create(issueId: string, input: CreateCheckpointInput, userId: string): Checkpoint {
    const db = getDb()
    // 权限：通过 issue 所属的 list 来检查
    const issue = db.get('SELECT listId FROM issues WHERE id = ?', issueId) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.all('SELECT * FROM issueListMembers WHERE listId = ?', issue.listId) as Array<{ userId: string; role: MemberRole }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const id = generateId()
    const now = new Date().toISOString()

    const maxSort = db.get('SELECT MAX(sortOrder) as m FROM checkpoints WHERE issueId = ?', issueId) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    db.run(
      `INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, issueId, input.checkpointDate, input.description, input.responsibleUserId ?? null, sortOrder, now, now],
    )

    return db.get('SELECT * FROM checkpoints WHERE id = ?', id) as Checkpoint
  }

  update(id: string, input: UpdateCheckpointInput, userId: string): Checkpoint {
    const db = getDb()
    const cp = this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = db.get('SELECT listId FROM issues WHERE id = ?', cp.issueId) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.all('SELECT * FROM issueListMembers WHERE listId = ?', issue.listId) as Array<{ userId: string; role: MemberRole }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.run(
      `UPDATE checkpoints
       SET checkpointDate = COALESCE(?, checkpointDate), description = COALESCE(?, description),
           status = COALESCE(?, status), responsibleUserId = COALESCE(?, responsibleUserId), updatedAt = ?
       WHERE id = ?`,
      [
        input.checkpointDate ?? null, input.description ?? null,
        input.status ?? null, input.responsibleUserId ?? null,
        new Date().toISOString(), id,
      ],
    )

    return db.get('SELECT * FROM checkpoints WHERE id = ?', id) as Checkpoint
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const cp = this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = db.get('SELECT listId FROM issues WHERE id = ?', cp.issueId) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.all('SELECT * FROM issueListMembers WHERE listId = ?', issue.listId) as Array<{ userId: string; role: MemberRole }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.run(
      `UPDATE checkpoints SET status = 'skipped', updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), id],
    )
  }
}
