import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, checkListAccess, canModifyIssue } from '@open-issue/core'
import type { Checkpoint, CreateCheckpointInput, UpdateCheckpointInput, MemberRole } from '@open-issue/core'

export class CheckpointService {
  async getByIssueId(issueId: string): Promise<Checkpoint[]> {
    const db = getAsyncDb()
    return await db.all(
      'SELECT * FROM checkpoints WHERE issueId = ? ORDER BY checkpointDate DESC, sortOrder DESC',
      [issueId],
    ) as Checkpoint[]
  }

  /** 批量获取列表下所有 Issue 的点检，按 issueId 分组返回 */
  async getByListId(listId: string): Promise<Record<string, Checkpoint[]>> {
    const db = getAsyncDb()
    const rows = await db.all(`
      SELECT DISTINCT c.* FROM checkpoints c
      JOIN issues i ON i.id = c.issueId
      JOIN issueListLinks il ON il.issueId = i.id
      WHERE il.listId = ?
      ORDER BY c.checkpointDate DESC, c.sortOrder DESC
    `, [listId]) as Checkpoint[]

    const grouped: Record<string, Checkpoint[]> = {}
    for (const cp of rows) {
      if (!grouped[cp.issueId]) grouped[cp.issueId] = []
      grouped[cp.issueId].push(cp)
    }
    return grouped
  }

  async getById(id: string): Promise<Checkpoint | undefined> {
    const db = getAsyncDb()
    return await db.get('SELECT * FROM checkpoints WHERE id = ?', [id]) as Checkpoint | undefined
  }

  async create(issueId: string, input: CreateCheckpointInput, userId: string): Promise<Checkpoint> {
    const db = getAsyncDb()
    // 权限：通过 issue 所属的 list 来检查
    const issue = await db.get('SELECT listId FROM issues WHERE id = ?', [issueId]) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = await db.all('SELECT * FROM issueListMembers WHERE listId = ?', [issue.listId]) as Array<{ userId: string; role: MemberRole }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const id = generateId()
    const now = new Date().toISOString()

    const maxSort = await db.get('SELECT MAX(sortOrder) as m FROM checkpoints WHERE issueId = ?', [issueId]) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    await db.run(
      `INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, issueId, input.checkpointDate, input.description, input.responsibleUserId ?? null, sortOrder, now, now],
    )

    return await db.get('SELECT * FROM checkpoints WHERE id = ?', [id]) as Checkpoint
  }

  async update(id: string, input: UpdateCheckpointInput, userId: string): Promise<Checkpoint> {
    const db = getAsyncDb()
    const cp = await this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = await db.get('SELECT listId FROM issues WHERE id = ?', [cp.issueId]) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = await db.all('SELECT * FROM issueListMembers WHERE listId = ?', [issue.listId]) as Array<{ userId: string; role: MemberRole }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    await db.run(
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

    return await db.get('SELECT * FROM checkpoints WHERE id = ?', [id]) as Checkpoint
  }

  async delete(id: string, userId: string): Promise<void> {
    const db = getAsyncDb()
    const cp = await this.getById(id)
    if (!cp) throw new NotFoundError('点检项')

    const issue = await db.get('SELECT listId FROM issues WHERE id = ?', [cp.issueId]) as { listId: string } | undefined
    if (!issue) throw new NotFoundError('Issue')

    const members = await db.all('SELECT * FROM issueListMembers WHERE listId = ?', [issue.listId]) as Array<{ userId: string; role: MemberRole }>
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    await db.run(
      `UPDATE checkpoints SET status = 'skipped', updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), id],
    )
  }
}
