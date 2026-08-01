import { getAsyncDb } from '../db/connection.js'
import { BadRequestError, NotFoundError } from '../utils/errors.js'
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
    const checkpointDate = requireDateOnly(input.checkpointDate, '点检日')
    const deadline = optionalDateOnly(input.deadline, '截止日')

    const maxSort = await db.get('SELECT MAX(sortOrder) as m FROM checkpoints WHERE issueId = ?', [issueId]) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    await db.run(
      `INSERT INTO checkpoints (id, issueId, checkpointDate, deadline, description, status, responsibleUserId, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, issueId, checkpointDate, deadline, input.description, input.responsibleUserId ?? null, sortOrder, now, now],
    )

    return await db.get('SELECT * FROM checkpoints WHERE id = ?', [id]) as Checkpoint
  }

  async update(id: string, input: UpdateCheckpointInput, userId: string): Promise<Checkpoint> {
    const db = getAsyncDb()
    const cp = await this.getRawById(id)
    if (!cp) throw new NotFoundError('点检项')

    const listId = await getIssueOriginListIdAsync(db, cp.issueId)
    await assertListActionAsync(db, listId, userId, 'modify-issue')
    const checkpointDate = input.checkpointDate === undefined
      ? undefined
      : requireDateOnly(input.checkpointDate, '点检日')
    const deadline = optionalDateOnly(input.deadline, '截止日')

    await db.run(
      `UPDATE checkpoints
       SET checkpointDate = COALESCE(?, checkpointDate),
           deadline = CASE WHEN ? = 1 THEN ? ELSE deadline END,
           description = COALESCE(?, description),
           status = COALESCE(?, status), responsibleUserId = COALESCE(?, responsibleUserId), updatedAt = ?
       WHERE id = ?`,
      [
        checkpointDate ?? null,
        input.deadline !== undefined ? 1 : 0, deadline,
        input.description ?? null,
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

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function requireDateOnly(value: unknown, label: string): string {
  if (
    typeof value !== 'string'
    || !DATE_ONLY_PATTERN.test(value)
    || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestError(`${label}必须为 YYYY-MM-DD 格式`)
  }
  return value
}

function optionalDateOnly(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null
  return requireDateOnly(value, label)
}
