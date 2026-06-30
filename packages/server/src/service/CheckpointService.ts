import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { checkListAccess, canModifyIssue } from '@phoenix-wing/open-issue-core'
import type { Checkpoint, CreateCheckpointInput, UpdateCheckpointInput } from '@phoenix-wing/open-issue-core'

export class CheckpointService {
  getByIssueId(issueId: string): Checkpoint[] {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM checkpoints WHERE issue_id = ? ORDER BY checkpoint_date ASC, sort_order ASC',
    ).all(issueId) as Checkpoint[]
  }

  getById(id: string): Checkpoint | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint | undefined
  }

  create(issueId: string, input: CreateCheckpointInput, userId: string): Checkpoint {
    const db = getDb()
    // 权限：通过 issue 所属的 list 来检查
    const issue = db.prepare('SELECT list_id FROM issues WHERE id = ?').get(issueId) as { list_id: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.prepare('SELECT * FROM issue_list_members WHERE list_id = ?').all(issue.list_id) as Array<{ user_id: string; role: string }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const id = uuid()
    const now = new Date().toISOString()

    const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM checkpoints WHERE issue_id = ?').get(issueId) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    db.prepare(
      `INSERT INTO checkpoints (id, issue_id, checkpoint_date, description, status, responsible_user_id, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    ).run(id, issueId, input.checkpoint_date, input.description, input.responsible_user_id ?? null, sortOrder, now, now)

    return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint
  }

  update(id: string, input: UpdateCheckpointInput, userId: string): Checkpoint {
    const db = getDb()
    const cp = this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = db.prepare('SELECT list_id FROM issues WHERE id = ?').get(cp.issue_id) as { list_id: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.prepare('SELECT * FROM issue_list_members WHERE list_id = ?').all(issue.list_id) as Array<{ user_id: string; role: string }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare(
      `UPDATE checkpoints
       SET checkpoint_date = COALESCE(?, checkpoint_date), description = COALESCE(?, description),
           status = COALESCE(?, status), responsible_user_id = COALESCE(?, responsible_user_id), updated_at = ?
       WHERE id = ?`,
    ).run(
      input.checkpoint_date ?? null, input.description ?? null,
      input.status ?? null, input.responsible_user_id ?? null,
      new Date().toISOString(), id,
    )

    return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as Checkpoint
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const cp = this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = db.prepare('SELECT list_id FROM issues WHERE id = ?').get(cp.issue_id) as { list_id: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = db.prepare('SELECT * FROM issue_list_members WHERE list_id = ?').all(issue.list_id) as Array<{ user_id: string; role: string }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.prepare('DELETE FROM checkpoints WHERE id = ?').run(id)
  }
}
