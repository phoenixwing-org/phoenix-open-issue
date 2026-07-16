import { getAsyncDb } from '../db/connection.js'
import { NotFoundError } from '../utils/errors.js'
import { generateId } from '@open-issue/core'
import type { Checkpoint, CreateCheckpointInput, UpdateCheckpointInput } from '@open-issue/core'
import { assertIssueReadableAsync, assertListActionAsync, getIssueOriginListIdAsync } from '../utils/access.js'

export class CheckpointService {
  async getByIssueId(issueId: string, userId: string): Promise<Checkpoint[]> {
    const db = getAsyncDb()
    await assertIssueReadableAsync(db, issueId, userId)
    return await db.all(
      'SELECT * FROM checkpoints WHERE issueId = ? ORDER BY checkpointDate DESC, sortOrder DESC',
      [issueId],
    ) as Checkpoint[]
  }

  /** 批量获取列表下所有 Issue 的点检，按 issueId 分组返回 */
  async getByListId(listId: string, userId: string): Promise<Record<string, Checkpoint[]>> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'read', '无权查看此列表的点检项')
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

  private async getRawById(id: string): Promise<Checkpoint | undefined> {
    const db = getAsyncDb()
    return await db.get('SELECT * FROM checkpoints WHERE id = ?', [id]) as Checkpoint | undefined
  }

  async create(issueId: string, input: CreateCheckpointInput, userId: string): Promise<Checkpoint> {
    const db = getAsyncDb()
    const listId = await getIssueOriginListIdAsync(db, issueId)
    await assertListActionAsync(db, listId, userId, 'modify-issue')

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
    const cp = await this.getRawById(id)
    if (!cp) throw new NotFoundError('点检项')

    const listId = await getIssueOriginListIdAsync(db, cp.issueId)
    await assertListActionAsync(db, listId, userId, 'modify-issue')

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
    const cp = await this.getRawById(id)
    if (!cp) throw new NotFoundError('点检项')

    const listId = await getIssueOriginListIdAsync(db, cp.issueId)
    await assertListActionAsync(db, listId, userId, 'modify-issue')

    await db.run(
      `UPDATE checkpoints SET status = 'voided', updatedAt = ? WHERE id = ?`,
      [new Date().toISOString(), id],
    )
  }
}
